/**
 * TASK 5H.33 — VERIFIED CUSTOMER/LEAD OWNERSHIP (D-01) &
 * DURABLE BOUNDED CUSTOMER IDENTITY RETRY/RECONCILIATION (SECTION 9 / R-05)
 *
 * Uses ONLY the existing canonical 9-tab Google Sheets schema:
 * - CUSTOMERS, LEADS, CONSENTS, MESSAGE_EVENTS, WEBHOOK_EVENTS, SYSTEM_CONFIG
 * Zero new tabs, zero schema changes, zero raw phone numbers or message bodies in SYSTEM_CONFIG.
 */

import crypto from 'node:crypto';
import { BaseSheetsRepository } from './sheets-repository';
import { CustomerRow, LeadRow, MessageEventRow, SystemConfigRow } from './sheet-schema';
import { normalizeMobileNumber, sanitizeCellForSheets } from './sheet-validation';
import { customerRepository } from './customer-repository';
import { leadRepository } from './lead-repository';
import { consentRepository } from './consent-repository';
import {
  isUnresolvedCustomerId,
  messageEventRepository
} from './message-event-repository';
import { webhookEventRepository } from './webhook-event-repository';
import {
  ConsentEligibilityResult,
  IdentityReconciliationEntry,
  IdentityReconciliationRunResult,
  ReconciliationDiagnosticsSummary,
  ReconciliationRecordStatus,
  VerifiedCustomerLeadIdentity,
  normalizeSupportedProvider
} from '../messaging-contract';

const RECON_CONFIG_KEY_PREFIX = 'RECON_';
const RECON_LEASE_KEY_PREFIX = 'RECON_LEASE_';
const RECON_CHECKPOINT_KEY_REGEX = /^RECON_[0-9a-f]{16}$/;
const RECON_LEASE_KEY_REGEX = /^RECON_LEASE_[0-9a-f]{16}$/;
const FORBIDDEN_SECRET_CONFIG_KEY_REGEX = /secret|password|token|private_key|api_key|credential|uri/i;
const DEFAULT_MAX_RECONCILIATION_ATTEMPTS = 5;
const DEFAULT_BASE_BACKOFF_MS = 15_000;
const DEFAULT_MAX_BACKOFF_MS = 15 * 60 * 1000;
const DEFAULT_JITTER_RATIO = 0.2;
const DEFAULT_RECON_LEASE_TTL_SEC = 60;

const inFlightReconciliationKeys = new Set<string>();

/**
 * Dedicated mutex for read-modify-write checkpoint updates in SYSTEM_CONFIG.
 * Kept separate from BaseSheetsRepository's low-level `sheetsWriteMutex` to prevent
 * non-reentrant deadlock when `setCheckpoint` delegates to `this.upsert()`.
 */
class CheckpointSerializeLock {
  private queue: Promise<void> = Promise.resolve();
  public async withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const nextReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = this.queue;
    this.queue = prev.then(() => nextReady).catch(() => nextReady);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

const checkpointMutex = new CheckpointSerializeLock();

class ReconciliationCheckpointRepository extends BaseSheetsRepository<SystemConfigRow> {
  constructor() {
    super('SYSTEM_CONFIG');
  }

  public async setCheckpoint(key: string, value: string): Promise<SystemConfigRow> {
    const cleanKey = sanitizeCellForSheets('config_key', key, { maxLength: 80 });
    if (!cleanKey || !cleanKey.startsWith(RECON_CONFIG_KEY_PREFIX) || FORBIDDEN_SECRET_CONFIG_KEY_REGEX.test(cleanKey)) {
      throw new Error(`Invalid reconciliation config key: ${cleanKey}`);
    }
    const cleanVal = sanitizeCellForSheets('config_value', value, { maxLength: 240 });
    const res = await this.upsert({
      config_key: cleanKey,
      config_value: cleanVal,
      updated_at: new Date().toISOString()
    });
    return res.record;
  }
}

const reconCheckpointRepo = new ReconciliationCheckpointRepository();

function normalizeOptionalId(val?: string | { toString(): string } | null): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

export function tryNormalizeRaw10(phone?: string | null): string | null {
  const raw = String(phone ?? '').trim();
  if (!raw) return null;
  try {
    return normalizeMobileNumber(raw).raw10;
  } catch {
    return null;
  }
}

/**
 * Strictly compares a canonical customer's normalized 10-digit Indian mobile number
 * against an expected normalized 10-digit sender/recipient mobile number.
 *
 * Task 5H.35 F34-01 invariant:
 * - Missing, null, empty, or malformed phone values NEVER match (`return false`).
 * - Two missing/invalid phones NEVER match each other.
 */
export function customerMatchesPhone(
  customer: CustomerRow | null | undefined,
  expectedRaw10: string | null
): boolean {
  if (!customer || !expectedRaw10) return false;
  const custRaw10 = tryNormalizeRaw10(customer.mobile_number);
  if (!custRaw10) return false;
  return custRaw10 === expectedRaw10;
}

/**
 * D-01 / F34-01 Canonical Customer & Lead Ownership Verification.
 *
 * Rules enforced:
 * 1. A valid, normalizable provider sender/recipient phone is MANDATORY to verify caller-supplied IDs.
 *    Missing, null, empty, or malformed phone values fail closed (`MISSING_OR_INVALID_PHONE`).
 * 2. Never trusts caller-supplied customerId merely because it is present.
 * 3. Never trusts caller-supplied leadId merely because it is present.
 * 4. Verifies customer exists in canonical CUSTOMERS sheet AND matches normalized sender phone.
 * 5. Verifies lead exists in canonical LEADS sheet AND belongs to the verified customer (`lead.customer_id === customer.customer_id`).
 * 6. Discards unverified/spoofed/mismatched IDs and falls back safely to canonical phone lookup without inventing customer IDs.
 */
export async function verifyCustomerAndLeadOwnership(params: {
  fromPhone?: string | null;
  candidateCustomerId?: string | null;
  candidateLeadId?: string | null;
}): Promise<VerifiedCustomerLeadIdentity> {
  const expectedRaw10 = tryNormalizeRaw10(params.fromPhone);
  const candidateCustomerId = normalizeOptionalId(params.candidateCustomerId);
  const candidateLeadId = normalizeOptionalId(params.candidateLeadId);

  // Task 5H.35 F34-01: Fail closed immediately if sender/recipient phone is missing, empty, null, or unnormalizable.
  // Never verify or attach a caller-supplied customerId/leadId without authenticated phone ownership evidence.
  if (!expectedRaw10) {
    return {
      verified: false,
      rejectedCandidateCustomerId: Boolean(candidateCustomerId),
      rejectedCandidateLeadId: Boolean(candidateLeadId),
      rejectionReason: 'MISSING_OR_INVALID_PHONE'
    };
  }

  let verifiedCustomer: CustomerRow | null = null;
  let verifiedLead: LeadRow | null = null;
  let leadExplicitlyVerified = false;
  let source: VerifiedCustomerLeadIdentity['source'];
  let rejectedCandidateCustomerId = false;
  let rejectedCandidateLeadId = false;
  let rejectionReason: VerifiedCustomerLeadIdentity['rejectionReason'];

  // 1. Validate caller-supplied customerId against canonical CUSTOMERS sheet + phone ownership
  if (candidateCustomerId) {
    if (isUnresolvedCustomerId(candidateCustomerId)) {
      rejectedCandidateCustomerId = true;
      rejectionReason = 'CUSTOMER_ID_NOT_FOUND';
    } else {
      const custRecord = await customerRepository.findById(candidateCustomerId);
      if (!custRecord || isUnresolvedCustomerId(custRecord.customer_id)) {
        rejectedCandidateCustomerId = true;
        rejectionReason = 'CUSTOMER_ID_NOT_FOUND';
      } else if (!customerMatchesPhone(custRecord, expectedRaw10)) {
        rejectedCandidateCustomerId = true;
        rejectionReason = 'CUSTOMER_MOBILE_MISMATCH';
      } else {
        verifiedCustomer = custRecord;
        source = 'verified_explicit_customer';
      }
    }
  }

  // 2. Validate caller-supplied leadId against canonical LEADS + CUSTOMERS ownership
  let candidateLeadRecord: LeadRow | null = null;
  if (candidateLeadId) {
    candidateLeadRecord = await leadRepository.findById(candidateLeadId);
    if (!candidateLeadRecord) {
      rejectedCandidateLeadId = true;
      rejectionReason = rejectionReason || 'LEAD_NOT_FOUND';
    } else if (verifiedCustomer) {
      if (candidateLeadRecord.customer_id === verifiedCustomer.customer_id) {
        verifiedLead = candidateLeadRecord;
        leadExplicitlyVerified = true;
      } else {
        rejectedCandidateLeadId = true;
        rejectionReason = 'LEAD_OWNERSHIP_MISMATCH';
      }
    } else {
      if (!candidateLeadRecord.customer_id || isUnresolvedCustomerId(candidateLeadRecord.customer_id)) {
        rejectedCandidateLeadId = true;
        rejectionReason = 'LEAD_FOUND_CUSTOMER_NOT_FOUND';
      } else {
        const ownerCustomer = await customerRepository.findById(candidateLeadRecord.customer_id);
        if (!ownerCustomer || isUnresolvedCustomerId(ownerCustomer.customer_id)) {
          rejectedCandidateLeadId = true;
          rejectionReason = 'LEAD_FOUND_CUSTOMER_NOT_FOUND';
        } else if (!customerMatchesPhone(ownerCustomer, expectedRaw10)) {
          rejectedCandidateLeadId = true;
          rejectionReason = 'LEAD_OWNERSHIP_MISMATCH';
        } else {
          verifiedCustomer = ownerCustomer;
          verifiedLead = candidateLeadRecord;
          leadExplicitlyVerified = true;
          source = 'verified_lead_owner';
        }
      }
    }
  }

  // 3. Safe fallback lookup by authenticated sender mobile number (never invents CUST-<phone>)
  if (!verifiedCustomer) {
    const custByPhone = await customerRepository.findByMobile(expectedRaw10);
    if (custByPhone && !isUnresolvedCustomerId(custByPhone.customer_id) && customerMatchesPhone(custByPhone, expectedRaw10)) {
      verifiedCustomer = custByPhone;
      source = 'verified_customer_mobile';

      if (candidateLeadRecord && !verifiedLead) {
        if (candidateLeadRecord.customer_id === verifiedCustomer.customer_id) {
          verifiedLead = candidateLeadRecord;
          leadExplicitlyVerified = true;
          rejectedCandidateLeadId = false;
        } else {
          rejectedCandidateLeadId = true;
          rejectionReason = 'LEAD_OWNERSHIP_MISMATCH';
        }
      }
    }
  }

  // 4. If customer is verified and no valid lead was matched yet, resolve customer's own existing lead
  if (verifiedCustomer && !verifiedLead) {
    const ownedLeads = await leadRepository.findByCustomerId(verifiedCustomer.customer_id);
    if (ownedLeads.length > 0 && ownedLeads[0]?.lead_id) {
      verifiedLead = ownedLeads[0];
    }
  }

  if (!verifiedCustomer) {
    return {
      verified: false,
      rejectedCandidateCustomerId,
      rejectedCandidateLeadId,
      rejectionReason: rejectionReason || 'CUSTOMER_NOT_FOUND'
    };
  }

  return {
    verified: true,
    customerId: verifiedCustomer.customer_id,
    leadId: verifiedLead?.lead_id,
    leadExplicitlyVerified,
    customer: verifiedCustomer,
    lead: verifiedLead,
    source,
    rejectedCandidateCustomerId,
    rejectedCandidateLeadId,
    rejectionReason: rejectedCandidateCustomerId || rejectedCandidateLeadId ? rejectionReason : undefined
  };
}

/**
 * Evaluates DPDP opt-out and explicit consent eligibility for a verified customer.
 * Never allows AI replies unless consent is explicitly GRANTED and customer is not opted out.
 */
export async function evaluateCustomerConsentEligibility(
  customer: CustomerRow
): Promise<ConsentEligibilityResult> {
  const consent = await consentRepository.findByCustomerId(customer.customer_id);
  const isOptedOut =
    customer.record_status === 'OPTED_OUT' ||
    consent?.optout_status === 'OPTED_OUT' ||
    consent?.consent_status === 'WITHDRAWN' ||
    consent?.consent_status === 'DENIED';

  if (isOptedOut) {
    return {
      eligibleForAiReply: false,
      isOptedOut: true,
      consentStatus: consent?.consent_status || 'WITHDRAWN',
      reason: 'OPTED_OUT'
    };
  }

  const consentStatus = consent?.consent_status || 'UNKNOWN';
  if (consentStatus !== 'GRANTED') {
    return {
      eligibleForAiReply: false,
      isOptedOut: false,
      consentStatus,
      reason: 'CONSENT_NOT_GRANTED'
    };
  }

  return {
    eligibleForAiReply: true,
    isOptedOut: false,
    consentStatus: 'GRANTED',
    reason: 'ELIGIBLE'
  };
}

/**
 * Computes a one-way salted SHA-256 lookup token for a normalized Indian mobile number
 * so SYSTEM_CONFIG checkpoints NEVER persist raw customer phone numbers.
 */
export function computePhoneLookupHash(phone?: string | null): string {
  const raw10 = tryNormalizeRaw10(phone);
  if (!raw10) return '';
  return crypto
    .createHash('sha256')
    .update(`AVANI_RECON_PHONE_V1:${raw10}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
}

export function buildReconciliationConfigKey(messageEventId: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(String(messageEventId || '').trim(), 'utf8')
    .digest('hex')
    .slice(0, 16);
  return `${RECON_CONFIG_KEY_PREFIX}${digest}`;
}

export function computeReconciliationBackoffMs(
  attempt: number,
  options?: {
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitterRatio?: number;
    randomFn?: () => number;
  }
): number {
  const baseDelayMs = Math.max(100, options?.baseDelayMs ?? DEFAULT_BASE_BACKOFF_MS);
  const maxDelayMs = Math.max(baseDelayMs, options?.maxDelayMs ?? DEFAULT_MAX_BACKOFF_MS);
  const jitterRatio = Math.min(0.5, Math.max(0, options?.jitterRatio ?? DEFAULT_JITTER_RATIO));
  const rand = options?.randomFn ?? Math.random;

  const safeAttempt = Math.max(1, Math.floor(attempt));
  const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, safeAttempt - 1));
  const jitter = Math.floor(exp * jitterRatio * Math.min(1, Math.max(0, rand())));
  return Math.min(maxDelayMs, exp + jitter);
}

type CompactEventType = 'ST' | 'IN' | 'OB';
type CompactStatus = 'P' | 'R' | 'D' | 'X';

function toCompactEventType(et: IdentityReconciliationEntry['eventType']): CompactEventType {
  if (et === 'INBOUND_MESSAGE') return 'IN';
  if (et === 'OUTBOUND_SEND') return 'OB';
  return 'ST';
}

function fromCompactEventType(code: string): IdentityReconciliationEntry['eventType'] {
  if (code === 'IN') return 'INBOUND_MESSAGE';
  if (code === 'OB') return 'OUTBOUND_SEND';
  return 'STATUS_UPDATE';
}

function toCompactStatus(st: ReconciliationRecordStatus): CompactStatus {
  if (st === 'RETRYING') return 'R';
  if (st === 'RECONCILED') return 'D';
  if (st === 'EXHAUSTED') return 'X';
  return 'P';
}

function fromCompactStatus(code: string): ReconciliationRecordStatus {
  if (code === 'R') return 'RETRYING';
  if (code === 'D') return 'RECONCILED';
  if (code === 'X') return 'EXHAUSTED';
  return 'PENDING';
}

function sanitizeErrorCode(code?: string): string {
  const clean = String(code || 'CUST_UNRESOLVED')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24);
  return clean || 'CUST_UNRESOLVED';
}

function serializeCheckpoint(entry: IdentityReconciliationEntry): string {
  const compactWebhookId = entry.webhookEventId
    ? entry.webhookEventId.length <= 36
      ? entry.webhookEventId
      : `H:${crypto.createHash('sha256').update(entry.webhookEventId, 'utf8').digest('hex').slice(0, 16)}`
    : '';

  const payload = {
    p: entry.provider,
    ph: entry.phoneHash.slice(0, 16),
    et: toCompactEventType(entry.eventType),
    we: compactWebhookId,
    c: String(entry.correlationId || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 20),
    fs: entry.firstSeenSec,
    a: entry.attempts,
    nr: entry.nextRetrySec,
    st: toCompactStatus(entry.status),
    err: sanitizeErrorCode(entry.lastErrorCode)
  };
  return JSON.stringify(payload);
}

export function isReconciliationCheckpointKey(key?: string | null): boolean {
  return typeof key === 'string' && RECON_CHECKPOINT_KEY_REGEX.test(key.trim());
}

export function isReconciliationLeaseKey(key?: string | null): boolean {
  return typeof key === 'string' && RECON_LEASE_KEY_REGEX.test(key.trim());
}

export function buildReconciliationLeaseKey(eventIdHash: string): string {
  const cleanHash = String(eventIdHash || '').trim().toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 16);
  return `${RECON_LEASE_KEY_PREFIX}${cleanHash}`;
}

function parseCheckpointRow(row: SystemConfigRow): IdentityReconciliationEntry | null {
  if (!isReconciliationCheckpointKey(row.config_key)) return null;
  try {
    const parsed = JSON.parse(row.config_value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (typeof parsed.p !== 'string' || typeof parsed.st !== 'string') return null;
    if (!['P', 'R', 'D', 'X'].includes(parsed.st)) return null;
    if (
      !Number.isFinite(Number(parsed.fs)) ||
      !Number.isFinite(Number(parsed.a)) ||
      !Number.isFinite(Number(parsed.nr))
    ) {
      return null;
    }
    const prov = normalizeSupportedProvider(parsed.p);
    return {
      configKey: row.config_key,
      eventIdHash: row.config_key.slice(RECON_CONFIG_KEY_PREFIX.length),
      provider: prov.key,
      phoneHash: typeof parsed.ph === 'string' ? parsed.ph : '',
      eventType: fromCompactEventType(String(parsed.et || 'ST')),
      webhookEventId: typeof parsed.we === 'string' && parsed.we ? parsed.we : undefined,
      correlationId: typeof parsed.c === 'string' && parsed.c ? parsed.c : undefined,
      firstSeenSec: Number(parsed.fs),
      attempts: Number(parsed.a),
      nextRetrySec: Number(parsed.nr),
      status: fromCompactStatus(String(parsed.st)),
      lastErrorCode: typeof parsed.err === 'string' ? parsed.err : ''
    };
  } catch {
    return null;
  }
}

interface ReconciliationLeasePayload {
  o: string;
  exp: number;
}

function parseLeaseValue(raw?: string | null): ReconciliationLeasePayload | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof parsed.o === 'string' &&
      parsed.o.trim().length > 0 &&
      Number.isFinite(Number(parsed.exp))
    ) {
      return { o: parsed.o.trim(), exp: Number(parsed.exp) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Acquires a durable cross-instance reconciliation lease in `SYSTEM_CONFIG` using
 * `gateway.gs` atomic `INSERT_IF_ABSENT` under `LockService.getScriptLock()`.
 *
 * Distributed-safety boundary (honestly documented):
 * - Normal concurrent acquisition across independent serverless instances is atomically
 *   serialized by `gateway.gs` `INSERT_IF_ABSENT` + `LockService.getScriptLock()`.
 * - Stale-lease reclamation after an owner crash uses `DELETE_ROW` followed by
 *   `INSERT_IF_ABSENT` (two separate `gateway.gs` calls because `gateway.gs` does not
 *   expose a single-call conditional compare-and-swap action). Even in that narrow
 *   reclaim window, all MESSAGE_EVENTS and WEBHOOK_EVENTS updates remain idempotent
 *   and zero outbound messages are ever resent.
 */
async function acquireDurableReconciliationLease(params: {
  eventIdHash: string;
  workerId: string;
  nowSec: number;
  leaseTtlSec: number;
}): Promise<{ acquired: boolean; leaseKey: string }> {
  const leaseKey = buildReconciliationLeaseKey(params.eventIdHash);
  const cleanOwner = params.workerId.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 24) || 'wrk';
  const leaseRecord: SystemConfigRow = {
    config_key: leaseKey,
    config_value: JSON.stringify({ o: cleanOwner, exp: params.nowSec + params.leaseTtlSec }),
    updated_at: new Date(params.nowSec * 1000).toISOString()
  };

  const firstAttempt = await reconCheckpointRepo.insertIfAbsent(leaseRecord);
  if (firstAttempt.inserted) {
    return { acquired: true, leaseKey };
  }

  const existingLease = parseLeaseValue(firstAttempt.record?.config_value);
  if (existingLease && existingLease.exp > params.nowSec) {
    return { acquired: false, leaseKey };
  }

  // Expired or malformed stale lease: reclaim via DELETE_ROW + INSERT_IF_ABSENT
  await reconCheckpointRepo.deleteById(leaseKey);
  const reclaimAttempt = await reconCheckpointRepo.insertIfAbsent(leaseRecord);
  return { acquired: reclaimAttempt.inserted, leaseKey };
}

async function releaseDurableReconciliationLease(leaseKey: string, workerId: string): Promise<void> {
  const cleanOwner = workerId.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 24) || 'wrk';
  const current = await reconCheckpointRepo.findById(leaseKey);
  if (!current) return;
  const parsed = parseLeaseValue(current.config_value);
  if (!parsed || parsed.o === cleanOwner) {
    await reconCheckpointRepo.deleteById(leaseKey);
  }
}

/**
 * Persists a minimal, PII-free durable pending-reconciliation checkpoint in SYSTEM_CONFIG
 * keyed deterministically by the canonical MESSAGE_EVENTS `event_id`.
 * Never stores raw mobile numbers, message bodies, media, or secrets.
 */
export async function stagePendingIdentityReconciliation(params: {
  messageEventId: string;
  provider: string;
  providerMessageId: string;
  fromPhone?: string | null;
  eventType: 'STATUS_UPDATE' | 'INBOUND_MESSAGE' | 'OUTBOUND_SEND';
  webhookEventId?: string;
  correlationId?: string;
  errorCode?: string;
  nowMs?: number;
}): Promise<IdentityReconciliationEntry> {
  const prov = normalizeSupportedProvider(params.provider);
  const configKey = buildReconciliationConfigKey(params.messageEventId);
  const nowSec = Math.floor((params.nowMs ?? Date.now()) / 1000);
  const phoneHash = computePhoneLookupHash(params.fromPhone);

  return checkpointMutex.withLock(async () => {
    const existingRow = await reconCheckpointRepo.findById(configKey);
    const existing = existingRow ? parseCheckpointRow(existingRow) : null;

    if (existing && existing.status === 'RECONCILED') {
      return existing;
    }

    const entry: IdentityReconciliationEntry = {
      configKey,
      eventIdHash: configKey.slice(RECON_CONFIG_KEY_PREFIX.length),
      provider: prov.key,
      phoneHash: phoneHash || existing?.phoneHash || '',
      eventType: params.eventType,
      webhookEventId: params.webhookEventId || existing?.webhookEventId,
      correlationId: params.correlationId || existing?.correlationId,
      firstSeenSec: existing?.firstSeenSec || nowSec,
      attempts: existing?.attempts ?? 0,
      nextRetrySec: existing?.nextRetrySec ?? nowSec,
      status: existing?.status === 'EXHAUSTED' ? 'EXHAUSTED' : existing?.status || 'PENDING',
      lastErrorCode: sanitizeErrorCode(params.errorCode || existing?.lastErrorCode || 'CUST_UNRESOLVED')
    };

    await reconCheckpointRepo.setCheckpoint(configKey, serializeCheckpoint(entry));
    return entry;
  });
}

/**
 * Marks a reconciliation checkpoint as RECONCILED when an event is resolved through
 * a normal inline retry (e.g. persistMessageEventToSheets or worker retry).
 */
export async function markIdentityReconciliationCompleted(
  messageEventId: string,
  nowMs = Date.now()
): Promise<void> {
  const configKey = buildReconciliationConfigKey(messageEventId);
  await checkpointMutex.withLock(async () => {
    const existingRow = await reconCheckpointRepo.findById(configKey);
    const existing = existingRow ? parseCheckpointRow(existingRow) : null;
    if (!existing || existing.status === 'RECONCILED') return;

    const completed: IdentityReconciliationEntry = {
      ...existing,
      status: 'RECONCILED',
      nextRetrySec: Math.floor(nowMs / 1000),
      lastErrorCode: 'NONE'
    };
    await reconCheckpointRepo.setCheckpoint(configKey, serializeCheckpoint(completed));
  });
}

async function resolveWebhookRowForEntry(
  webhookEventId?: string
): Promise<string | null> {
  if (!webhookEventId) return null;
  if (!webhookEventId.startsWith('H:')) {
    const direct = await webhookEventRepository.findById(webhookEventId);
    return direct ? direct.event_id : null;
  }
  const targetHash = webhookEventId.slice(2);
  const all = await webhookEventRepository.findAll();
  const match = all.find(
    (w) =>
      crypto.createHash('sha256').update(w.event_id, 'utf8').digest('hex').slice(0, 16) === targetHash
  );
  return match ? match.event_id : null;
}

async function convergeLinkedWebhookEvent(
  webhookEventId: string | undefined,
  consentState: ConsentEligibilityResult
): Promise<void> {
  const linkedWebhookId = await resolveWebhookRowForEntry(webhookEventId);
  if (!linkedWebhookId) return;
  const wh = await webhookEventRepository.findById(linkedWebhookId);
  if (wh && wh.processing_status !== 'COMPLETED' && wh.processing_status !== 'ARCHIVED_HISTORICAL') {
    await webhookEventRepository.markWebhookStatus({
      event_id: linkedWebhookId,
      processing_status: 'COMPLETED',
      error_code: consentState.isOptedOut ? 'RECONCILED_OPTED_OUT' : 'RECONCILED'
    });
  }
}

/**
 * Bounded, idempotent, crash-recoverable reconciliation runner for unresolved message events
 * (Task 5H.33 R-05 + Task 5H.35 F34-05).
 *
 * Guarantees:
 * - Filters eligible DUE records (`nextRetrySec <= nowSec`) BEFORE applying `batchLimit`,
 *   preventing non-due entries from ever starving due records.
 * - Uses durable cross-instance lease claims (`RECON_LEASE_<hash>`) in `SYSTEM_CONFIG`
 *   via `gateway.gs` atomic `INSERT_IF_ABSENT` + `LockService` (in addition to fast local guard).
 * - Converges all 3 persistence layers in deterministic order on every recovery path:
 *     1. `MESSAGE_EVENTS` (in-place update on canonical `event_id`, zero duplicates)
 *     2. `WEBHOOK_EVENTS` (converges `FAILED`/`RECEIVED`/`PROCESSING` -> `COMPLETED`)
 *     3. `SYSTEM_CONFIG` checkpoint (`RECONCILED` ONLY after steps 1 & 2 succeed)
 * - Uses `phoneHash` ONLY as a PII-free lookup index; re-verifies canonical customer ownership
 *   via `verifyCustomerAndLeadOwnership` + `evaluateCustomerConsentEligibility` and fails closed
 *   on ambiguous hash collisions.
 * - Never triggers duplicate outbound sends (`outboundResent === 0` always).
 * - Quarantines/skips malformed checkpoint JSON without crashing valid entries or touching
 *   unrelated `SYSTEM_CONFIG` keys.
 */
export async function reconcilePendingMessageIdentities(options?: {
  nowMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  randomFn?: () => number;
  batchLimit?: number;
  workerId?: string;
  leaseTtlSec?: number;
  beforeCommitHook?: (configKey: string) => Promise<void>;
}): Promise<IdentityReconciliationRunResult> {
  const nowMs = options?.nowMs ?? Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_RECONCILIATION_ATTEMPTS);
  const batchLimit = Math.max(1, options?.batchLimit ?? 50);
  const leaseTtlSec = Math.max(5, Math.floor(options?.leaseTtlSec ?? DEFAULT_RECON_LEASE_TTL_SEC));
  const workerId =
    (options?.workerId && options.workerId.trim()) ||
    `wrk_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;

  const summary: IdentityReconciliationRunResult = {
    scanned: 0,
    reconciled: 0,
    retrying: 0,
    exhausted: 0,
    skippedNotDue: 0,
    skippedInFlight: 0,
    malformedSkipped: 0,
    errors: 0,
    outboundResent: 0
  };

  const [allConfig, allMessages, allCustomers] = await Promise.all([
    reconCheckpointRepo.findAll(),
    messageEventRepository.findAll(),
    customerRepository.findAll()
  ]);

  const msgByEventHash = new Map<string, MessageEventRow>();
  for (const m of allMessages) {
    const h = crypto.createHash('sha256').update(m.event_id, 'utf8').digest('hex').slice(0, 16);
    msgByEventHash.set(h, m);
  }

  // Group customers by phoneHash so any unexpected hash collision fails closed (never ambiguous)
  const customersByPhoneHash = new Map<string, CustomerRow[]>();
  for (const c of allCustomers) {
    if (isUnresolvedCustomerId(c.customer_id)) continue;
    const ph = computePhoneLookupHash(c.mobile_number);
    if (!ph) continue;
    const list = customersByPhoneHash.get(ph) || [];
    list.push(c);
    customersByPhoneHash.set(ph, list);
  }

  // Parse reconciliation checkpoint keys strictly; safely isolate malformed entries without colliding
  // with unrelated SYSTEM_CONFIG rows or RECON_LEASE_* rows.
  const activeEntries: IdentityReconciliationEntry[] = [];
  for (const row of allConfig) {
    if (!isReconciliationCheckpointKey(row.config_key)) continue;
    const parsed = parseCheckpointRow(row);
    if (!parsed) {
      summary.malformedSkipped = (summary.malformedSkipped || 0) + 1;
      summary.errors += 1;
      continue;
    }
    if (parsed.status === 'PENDING' || parsed.status === 'RETRYING') {
      activeEntries.push(parsed);
    }
  }

  // Task 5H.35 F34-05: Filter eligible DUE entries BEFORE applying batchLimit so non-due entries
  // can NEVER starve due reconciliation events.
  const dueEntries: IdentityReconciliationEntry[] = [];
  for (const entry of activeEntries) {
    if (entry.nextRetrySec > nowSec) {
      summary.skippedNotDue += 1;
    } else {
      dueEntries.push(entry);
    }
  }

  dueEntries.sort(
    (a, b) =>
      a.nextRetrySec - b.nextRetrySec ||
      a.firstSeenSec - b.firstSeenSec ||
      a.configKey.localeCompare(b.configKey)
  );

  const batch = dueEntries.slice(0, batchLimit);

  for (const initialEntry of batch) {
    summary.scanned += 1;

    // Fast same-process guard
    if (inFlightReconciliationKeys.has(initialEntry.configKey)) {
      summary.skippedInFlight += 1;
      continue;
    }

    inFlightReconciliationKeys.add(initialEntry.configKey);
    let leaseKeyAcquired: string | null = null;
    try {
      // Durable cross-instance lease claim in SYSTEM_CONFIG via atomic INSERT_IF_ABSENT
      const lease = await acquireDurableReconciliationLease({
        eventIdHash: initialEntry.eventIdHash,
        workerId,
        nowSec,
        leaseTtlSec
      });
      if (!lease.acquired) {
        summary.skippedInFlight += 1;
        continue;
      }
      leaseKeyAcquired = lease.leaseKey;

      if (options?.beforeCommitHook) {
        await options.beforeCommitHook(initialEntry.configKey);
      }

      // Re-read latest durable checkpoint after lease acquisition to prevent stale overwrites
      const latestConfigRow = await reconCheckpointRepo.findById(initialEntry.configKey);
      const entry = (latestConfigRow ? parseCheckpointRow(latestConfigRow) : null) || initialEntry;
      if (entry.status === 'RECONCILED' || entry.status === 'EXHAUSTED') {
        continue;
      }

      const cachedMsg = msgByEventHash.get(entry.eventIdHash) || null;
      const msgRow = cachedMsg ? (await messageEventRepository.findById(cachedMsg.event_id)) || cachedMsg : null;

      // Case A: MESSAGE_EVENTS was already resolved (inline retry OR crash between MESSAGE_EVENTS
      // write and WEBHOOK_EVENTS / SYSTEM_CONFIG checkpoint update).
      // Task 5H.35 F34-05: MUST converge linked WEBHOOK_EVENTS BEFORE marking checkpoint RECONCILED.
      if (msgRow && !isUnresolvedCustomerId(msgRow.customer_id)) {
        const canonicalOwner = await customerRepository.findById(msgRow.customer_id);
        if (canonicalOwner && !isUnresolvedCustomerId(canonicalOwner.customer_id)) {
          const consentState = await evaluateCustomerConsentEligibility(canonicalOwner);
          await convergeLinkedWebhookEvent(entry.webhookEventId, consentState);

          const updated: IdentityReconciliationEntry = {
            ...entry,
            status: 'RECONCILED',
            nextRetrySec: nowSec,
            lastErrorCode: consentState.eligibleForAiReply ? 'NONE' : consentState.reason
          };
          await reconCheckpointRepo.setCheckpoint(entry.configKey, serializeCheckpoint(updated));
          summary.reconciled += 1;
          continue;
        }
      }

      // Case B: Unresolved MESSAGE_EVENTS row — use phoneHash ONLY as lookup index, then re-verify
      // full canonical customer ownership and consent before reconciling.
      const matchingCustomers = entry.phoneHash ? customersByPhoneHash.get(entry.phoneHash) || [] : [];
      const candidateCustomer = matchingCustomers.length === 1 ? matchingCustomers[0] : null;

      if (candidateCustomer && msgRow) {
        const ownership = await verifyCustomerAndLeadOwnership({
          fromPhone: candidateCustomer.mobile_number,
          candidateCustomerId: candidateCustomer.customer_id
        });
        const verifiedCustomer = ownership.verified ? ownership.customer || null : null;
        if (
          verifiedCustomer &&
          !isUnresolvedCustomerId(verifiedCustomer.customer_id) &&
          computePhoneLookupHash(verifiedCustomer.mobile_number) === entry.phoneHash
        ) {
          const consentState = await evaluateCustomerConsentEligibility(verifiedCustomer);

          // Step 1: Reconcile MESSAGE_EVENTS in-place on exact event_id (zero duplicates, zero outbound resends)
          await messageEventRepository.recordMessageEvent({
            event_id: msgRow.event_id,
            customer_id: verifiedCustomer.customer_id,
            provider: msgRow.provider,
            message_type: msgRow.message_type,
            direction: msgRow.direction,
            delivery_status: msgRow.delivery_status,
            provider_message_id: msgRow.provider_message_id,
            event_timestamp: msgRow.event_timestamp
          });

          // Step 2: Converge linked WEBHOOK_EVENTS BEFORE marking checkpoint RECONCILED.
          // If this fails, error propagates and checkpoint remains retryable (never conceals FAILED webhook).
          await convergeLinkedWebhookEvent(entry.webhookEventId, consentState);

          // Step 3: Mark durable SYSTEM_CONFIG checkpoint RECONCILED
          const updated: IdentityReconciliationEntry = {
            ...entry,
            attempts: entry.attempts + 1,
            status: 'RECONCILED',
            nextRetrySec: nowSec,
            lastErrorCode: consentState.eligibleForAiReply ? 'NONE' : consentState.reason
          };
          await reconCheckpointRepo.setCheckpoint(entry.configKey, serializeCheckpoint(updated));
          summary.reconciled += 1;
          continue;
        }
      }

      // Case C: Customer still unresolved (or ambiguous hash collision): increment attempts & apply bounded backoff or EXHAUSTED
      const nextAttempts = entry.attempts + 1;
      const unresolvedCode =
        matchingCustomers.length > 1
          ? 'AMBIGUOUS_PHONE_HASH'
          : msgRow
            ? 'CUST_UNRESOLVED'
            : 'MSG_EVENT_NOT_FOUND';

      if (nextAttempts >= maxAttempts) {
        const exhaustedEntry: IdentityReconciliationEntry = {
          ...entry,
          attempts: nextAttempts,
          status: 'EXHAUSTED',
          nextRetrySec: nowSec,
          lastErrorCode: 'RECONCILIATION_EXHAUSTED'
        };
        await reconCheckpointRepo.setCheckpoint(entry.configKey, serializeCheckpoint(exhaustedEntry));

        const linkedWebhookId = await resolveWebhookRowForEntry(entry.webhookEventId);
        if (linkedWebhookId) {
          await webhookEventRepository
            .markWebhookStatus({
              event_id: linkedWebhookId,
              processing_status: 'FAILED',
              error_code: 'RECONCILIATION_EXHAUSTED'
            })
            .catch(() => {});
        }
        summary.exhausted += 1;
      } else {
        const backoffMs = computeReconciliationBackoffMs(nextAttempts, {
          baseDelayMs: options?.baseDelayMs,
          maxDelayMs: options?.maxDelayMs,
          jitterRatio: options?.jitterRatio,
          randomFn: options?.randomFn
        });
        const retryEntry: IdentityReconciliationEntry = {
          ...entry,
          attempts: nextAttempts,
          status: 'RETRYING',
          nextRetrySec: Math.ceil((nowMs + backoffMs) / 1000),
          lastErrorCode: unresolvedCode
        };
        await reconCheckpointRepo.setCheckpoint(entry.configKey, serializeCheckpoint(retryEntry));
        summary.retrying += 1;
      }
    } catch {
      summary.errors += 1;
    } finally {
      if (leaseKeyAcquired) {
        await releaseDurableReconciliationLease(leaseKeyAcquired, workerId).catch(() => {});
      }
      inFlightReconciliationKeys.delete(initialEntry.configKey);
    }
  }

  return summary;
}

/**
 * Returns PII-free operational counts for pending, retrying, reconciled, exhausted,
 * malformed checkpoints, and active durable leases.
 */
export async function getReconciliationDiagnostics(): Promise<ReconciliationDiagnosticsSummary> {
  const [allConfig, allMessages] = await Promise.all([
    reconCheckpointRepo.findAll(),
    messageEventRepository.findAll()
  ]);

  let pending = 0;
  let retrying = 0;
  let reconciled = 0;
  let exhausted = 0;
  let malformed = 0;
  let activeLeases = 0;
  const nowSec = Math.floor(Date.now() / 1000);

  for (const row of allConfig) {
    if (isReconciliationLeaseKey(row.config_key)) {
      const lease = parseLeaseValue(row.config_value);
      if (lease && lease.exp > nowSec) activeLeases += 1;
      continue;
    }
    if (!isReconciliationCheckpointKey(row.config_key)) continue;
    const entry = parseCheckpointRow(row);
    if (!entry) {
      malformed += 1;
      continue;
    }
    if (entry.status === 'PENDING') pending += 1;
    else if (entry.status === 'RETRYING') retrying += 1;
    else if (entry.status === 'RECONCILED') reconciled += 1;
    else if (entry.status === 'EXHAUSTED') exhausted += 1;
  }

  const unresolvedMessageEvents = allMessages.filter((m) => isUnresolvedCustomerId(m.customer_id)).length;

  return {
    totalTracked: pending + retrying + reconciled + exhausted,
    pending,
    retrying,
    reconciled,
    exhausted,
    malformed,
    activeLeases,
    unresolvedMessageEvents,
    generatedAt: new Date().toISOString()
  };
}
