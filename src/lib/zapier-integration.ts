/**
 * APR-009 STAGE 5F — HARDENED ZAPIER INTEGRATION ENGINE
 *
 * Implements:
 * - Typed Trigger & Action definitions for AVANI AI CRM
 * - Timing-safe HMAC-SHA256 signing & verification
 * - Strict minimal-PII field mapping (zero passwords/tokens/transcripts/recordings)
 * - Consent & opt-out suppression BEFORE outbound dispatch
 * - Deterministic idempotency keys & duplicate suppression
 * - Bounded exponential-backoff retries (429 / 5xx / network timeout only; never retry 4xx)
 * - Fail-closed standby clamp: live HTTP dispatch requires BOTH ZAPIER_ENABLED=true AND PROVIDER_MODE=live
 */

import crypto from 'node:crypto';
import { maskPhoneForLog } from './safeguards';

export const ZAPIER_TRIGGER_EVENTS = [
  'LEAD_CREATED',
  'LEAD_QUALIFIED',
  'ADVISOR_HANDOFF',
  'APPLICATION_CREATED',
  'OPTED_OUT'
] as const;

export type ZapierTriggerEvent = (typeof ZAPIER_TRIGGER_EVENTS)[number];

export const ZAPIER_INBOUND_ACTIONS = [
  'CREATE_ENQUIRY',
  'UPDATE_FOLLOWUP',
  'RECORD_CONSENT_OPTOUT'
] as const;

export type ZapierInboundAction = (typeof ZAPIER_INBOUND_ACTIONS)[number];

export interface ZapierMappedTriggerPayload {
  schemaVersion: 'apr009.zapier.v1';
  idempotencyKey: string;
  eventId: string;
  eventType: ZapierTriggerEvent;
  leadId: string;
  timestamp: string;
  source: string;
  correlationId: string;
  lead: {
    fullName: string;
    mobileLast4: string;
    city: string;
    loanProduct: string;
    requestedAmount: number | null;
    stage: string;
  };
}

export interface ZapierDispatchResult {
  dispatched: boolean;
  status:
    | 'DISPATCHED'
    | 'DUPLICATE_SUPPRESSED'
    | 'OPTED_OUT_SUPPRESSED'
    | 'STANDBY_NOT_ACTIVATED'
    | 'UNCONFIGURED'
    | 'FAILED';
  idempotencyKey: string;
  attempts: number;
  httpStatus?: number;
  error?: string;
  auditLog: {
    eventId: string;
    eventType: ZapierTriggerEvent;
    leadId: string;
    phoneMasked: string;
    timestamp: string;
    status: string;
  };
}

export interface ZapierRawTriggerInput {
  eventId: string;
  eventType: ZapierTriggerEvent;
  leadId: string;
  correlationId?: string;
  source?: string;
  timestamp?: string;
  consentStatus?: string;
  isOptedOut?: boolean;
  data?: {
    name?: string;
    fullName?: string;
    phone?: string;
    mobile?: string;
    city?: string;
    product?: string;
    loanProduct?: string;
    requestedAmount?: number | string;
    stage?: string;
  };
}

export function isZapierTriggerEvent(value: unknown): value is ZapierTriggerEvent {
  return typeof value === 'string' && (ZAPIER_TRIGGER_EVENTS as readonly string[]).includes(value);
}

export function isZapierInboundAction(value: unknown): value is ZapierInboundAction {
  return typeof value === 'string' && (ZAPIER_INBOUND_ACTIONS as readonly string[]).includes(value);
}

export function buildZapierIdempotencyKey(eventType: string, leadId: string, eventId: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(`${eventType}|${leadId}|${eventId}`, 'utf8')
    .digest('hex')
    .slice(0, 24);
  return `zap_${eventType.toLowerCase()}_${digest}`;
}

export function signZapierPayload(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function verifyZapierSignature(rawBody: string, providedSignature: string | null | undefined, secret: string): boolean {
  if (!secret || secret.length < 16 || !providedSignature) return false;
  const cleaned = providedSignature.trim().replace(/^sha256=/i, '');
  const expected = signZapierPayload(rawBody, secret);
  try {
    const a = Buffer.from(cleaned, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function mapLeadToZapierTriggerPayload(input: ZapierRawTriggerInput): ZapierMappedTriggerPayload {
  const d = input.data || {};
  const rawPhone = String(d.phone || d.mobile || '').replace(/[^0-9]/g, '');
  const mobileLast4 = rawPhone.length >= 4 ? rawPhone.slice(-4) : 'NONE';
  const parsedAmount = Number(d.requestedAmount);
  const idempotencyKey = buildZapierIdempotencyKey(input.eventType, input.leadId, input.eventId);

  return {
    schemaVersion: 'apr009.zapier.v1',
    idempotencyKey,
    eventId: input.eventId,
    eventType: input.eventType,
    leadId: input.leadId,
    timestamp: input.timestamp || new Date().toISOString(),
    source: input.source || 'AVANI_AI_CRM',
    correlationId: input.correlationId || input.eventId,
    lead: {
      fullName: String(d.fullName || d.name || 'Customer').trim().slice(0, 120),
      mobileLast4,
      city: String(d.city || 'Unspecified').trim().slice(0, 80),
      loanProduct: String(d.loanProduct || d.product || 'General Loan Advisory').trim().slice(0, 80),
      requestedAmount: Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : null,
      stage: String(d.stage || input.eventType).trim().slice(0, 60)
    }
  };
}

const dispatchedKeysCache = new Set<string>();

export class ZapierIntegration {
  static clearLocalIdempotencyCacheForTests(): void {
    dispatchedKeysCache.clear();
  }

  static getContractSummary() {
    return {
      schemaVersion: 'apr009.zapier.v1',
      liveEnabled: process.env.ZAPIER_ENABLED === 'true' && process.env.PROVIDER_MODE === 'live',
      webhookConfigured: Boolean((process.env.ZAPIER_WEBHOOK_URL || '').trim()),
      signingSecretConfigured: Boolean((process.env.ZAPIER_WEBHOOK_SECRET || '').trim()),
      triggers: [...ZAPIER_TRIGGER_EVENTS],
      actions: [...ZAPIER_INBOUND_ACTIONS]
    };
  }

  static async dispatchTrigger(
    input: ZapierRawTriggerInput,
    options?: {
      fetchImpl?: typeof fetch;
      maxRetries?: number;
      baseDelayMs?: number;
      forceLiveForTest?: boolean;
      webhookUrlOverride?: string;
      signingSecretOverride?: string;
    }
  ): Promise<ZapierDispatchResult> {
    const mapped = mapLeadToZapierTriggerPayload(input);
    const phoneMasked = maskPhoneForLog(input.data?.phone || input.data?.mobile);
    const baseAudit = {
      eventId: input.eventId,
      eventType: input.eventType,
      leadId: input.leadId,
      phoneMasked,
      timestamp: mapped.timestamp
    };

    // 1. Consent / Opt-Out Guard (except explicit OPTED_OUT propagation events)
    const consentUpper = String(input.consentStatus || '').toUpperCase();
    const suppressedByConsent =
      input.eventType !== 'OPTED_OUT' &&
      (input.isOptedOut === true || consentUpper === 'DENIED' || consentUpper === 'WITHDRAWN');

    if (suppressedByConsent) {
      return {
        dispatched: false,
        status: 'OPTED_OUT_SUPPRESSED',
        idempotencyKey: mapped.idempotencyKey,
        attempts: 0,
        auditLog: { ...baseAudit, status: 'OPTED_OUT_SUPPRESSED' }
      };
    }

    // 2. Process-local Duplicate Suppression
    if (dispatchedKeysCache.has(mapped.idempotencyKey)) {
      return {
        dispatched: false,
        status: 'DUPLICATE_SUPPRESSED',
        idempotencyKey: mapped.idempotencyKey,
        attempts: 0,
        auditLog: { ...baseAudit, status: 'DUPLICATE_SUPPRESSED' }
      };
    }

    // 3. Fail-Closed Standby Clamp (No accidental live workflow activation!)
    const isLiveAuthorized =
      options?.forceLiveForTest === true ||
      (process.env.ZAPIER_ENABLED === 'true' && process.env.PROVIDER_MODE === 'live');
    if (!isLiveAuthorized) {
      return {
        dispatched: false,
        status: 'STANDBY_NOT_ACTIVATED',
        idempotencyKey: mapped.idempotencyKey,
        attempts: 0,
        auditLog: { ...baseAudit, status: 'STANDBY_NOT_ACTIVATED' }
      };
    }

    const targetUrl = (options?.webhookUrlOverride ?? process.env.ZAPIER_WEBHOOK_URL ?? '').trim();
    if (!targetUrl) {
      return {
        dispatched: false,
        status: 'UNCONFIGURED',
        idempotencyKey: mapped.idempotencyKey,
        attempts: 0,
        auditLog: { ...baseAudit, status: 'UNCONFIGURED' }
      };
    }

    const fetchFn = options?.fetchImpl || fetch;
    const maxRetries = Math.min(Math.max(options?.maxRetries ?? 3, 1), 5);
    const baseDelayMs = Math.max(options?.baseDelayMs ?? 250, 0);
    const rawBody = JSON.stringify(mapped);
    const signingSecret = (options?.signingSecretOverride ?? process.env.ZAPIER_WEBHOOK_SECRET ?? '').trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': mapped.idempotencyKey,
      'X-Avani-Event-Type': mapped.eventType
    };
    if (signingSecret) {
      headers['X-Zapier-Signature'] = `sha256=${signZapierPayload(rawBody, signingSecret)}`;
    }

    let lastStatus: number | undefined;
    let lastError = 'Zapier dispatch failed';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetchFn(targetUrl, {
          method: 'POST',
          headers,
          body: rawBody
        });
        lastStatus = res.status;

        if (res.ok) {
          dispatchedKeysCache.add(mapped.idempotencyKey);
          return {
            dispatched: true,
            status: 'DISPATCHED',
            idempotencyKey: mapped.idempotencyKey,
            attempts: attempt,
            httpStatus: res.status,
            auditLog: { ...baseAudit, status: 'DISPATCHED' }
          };
        }

        // Do not retry non-retryable 4xx client errors (except 429 Too Many Requests)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          lastError = `Zapier rejected request with HTTP ${res.status}`;
          return {
            dispatched: false,
            status: 'FAILED',
            idempotencyKey: mapped.idempotencyKey,
            attempts: attempt,
            httpStatus: res.status,
            error: lastError,
            auditLog: { ...baseAudit, status: `FAILED_HTTP_${res.status}` }
          };
        }

        lastError = `Retryable HTTP ${res.status} from Zapier`;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : 'Network error';
      }

      if (attempt < maxRetries && baseDelayMs > 0) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return {
      dispatched: false,
      status: 'FAILED',
      idempotencyKey: mapped.idempotencyKey,
      attempts: maxRetries,
      httpStatus: lastStatus,
      error: lastError,
      auditLog: { ...baseAudit, status: 'FAILED_RETRIES_EXHAUSTED' }
    };
  }
}
