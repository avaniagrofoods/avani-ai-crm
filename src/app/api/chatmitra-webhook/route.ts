import { waitUntil } from '@vercel/functions';
import { NextResponse } from 'next/server';
import { sanitizeErrorForLog } from '@/lib/aisensy';
import { constantTimeEqualStrings } from '@/lib/auth';
import {
  verifyChatMitraSignature,
  classifyLoanCategory,
  validateChatMitraInboundPayload
} from '@/lib/chatmitra';
import {
  PersistenceState,
  normalizeSupportedProvider,
  resolveInboundMessageType
} from '@/lib/messaging-contract';
import { normalizeIndianPhone } from '@/lib/phone';
import {
  CrmSheetsService,
  SheetsCrmError,
  verifyCustomerAndLeadOwnership,
  webhookEventRepository
} from '@/lib/google-sheets';

export interface ChatMitraWorkerDispatchResult {
  ok: boolean;
  status: number;
  persisted: boolean;
  persistenceState?: PersistenceState;
  errorCode?: string;
  message?: string;
  retryable: boolean;
  timedOut?: boolean;
  eventId: string;
  correlationId: string;
  body?: any;
}

/**
 * Task 5H.35 F34-04: Bounded-timeout worker dispatch for ChatMitra webhook events that
 * preserves downstream semantic error codes (e.g. CUSTOMER_IDENTITY_UNRESOLVED),
 * HTTP status, retryability, and correlation ID while redacting secrets/PII/stack traces.
 */
export async function dispatchChatMitraWorker(params: {
  workerUrl: string;
  workerSecret: string;
  eventId: string;
  correlationId: string;
  workerPayload: Record<string, unknown>;
}): Promise<ChatMitraWorkerDispatchResult> {
  const { workerUrl, workerSecret, eventId, correlationId, workerPayload } = params;
  const trimmedSecret = String(workerSecret || '').trim();
  if (!trimmedSecret) {
    await webhookEventRepository
      .markWebhookStatus({
        event_id: eventId,
        processing_status: 'FAILED',
        error_code: 'WORKER_AUTH_UNCONFIGURED'
      })
      .catch(() => {});
    return {
      ok: false,
      status: 401,
      persisted: false,
      persistenceState: 'PERSISTENCE_FAILED',
      errorCode: 'WORKER_AUTH_UNCONFIGURED',
      message: 'INTERNAL_WORKER_SECRET is not configured for worker dispatch.',
      retryable: false,
      eventId,
      correlationId
    };
  }

  const rawTimeoutMs = Number(process.env.WHATSAPP_WORKER_HANDOFF_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(rawTimeoutMs) && rawTimeoutMs >= 50 ? rawTimeoutMs : 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-auth': trimmedSecret,
        'x-correlation-id': correlationId
      },
      body: JSON.stringify(workerPayload),
      signal: controller.signal
    });

    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }

    if (res.status === 401) {
      await webhookEventRepository
        .markWebhookStatus({
          event_id: eventId,
          processing_status: 'FAILED',
          error_code: 'WORKER_UNAUTHORIZED'
        })
        .catch(() => {});
      return {
        ok: false,
        status: 401,
        persisted: false,
        persistenceState: 'PERSISTENCE_FAILED',
        errorCode: 'WORKER_UNAUTHORIZED',
        message: 'Worker rejected internal authentication.',
        retryable: false,
        eventId,
        correlationId
      };
    }

    if (!res.ok) {
      const parsedErrorCode =
        typeof parsed?.error === 'string' && parsed.error.trim()
          ? parsed.error.trim().replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 64)
          : '';
      let errorCode = parsedErrorCode;
      if (!errorCode) {
        const existingWh = await webhookEventRepository.findById(eventId).catch(() => null);
        if (existingWh?.error_code && !/^WORKER_HTTP_\d+$/.test(existingWh.error_code)) {
          errorCode = existingWh.error_code;
        } else {
          errorCode = `WORKER_HTTP_${res.status}`;
        }
      }

      const persistenceState: PersistenceState =
        typeof parsed?.persistenceState === 'string'
          ? (parsed.persistenceState as PersistenceState)
          : res.status === 400
            ? 'UNSUPPORTED_EVENT'
            : 'PERSISTENCE_FAILED';
      const safeMessage = sanitizeErrorForLog(
        parsed?.message || parsed?.error || `Worker returned HTTP ${res.status}`
      );
      const retryable = res.status === 429 || res.status >= 500;

      await webhookEventRepository
        .markWebhookStatus({
          event_id: eventId,
          processing_status: 'FAILED',
          error_code: errorCode
        })
        .catch(() => {});

      return {
        ok: false,
        status: res.status,
        persisted: false,
        persistenceState,
        errorCode,
        message: safeMessage,
        retryable,
        eventId,
        correlationId
      };
    }

    const persistenceState: PersistenceState =
      typeof parsed?.persistenceState === 'string'
        ? (parsed.persistenceState as PersistenceState)
        : parsed?.persisted === true
          ? 'PERSISTED'
          : 'PERSISTENCE_FAILED';
    const confirmedPersisted =
      parsed?.success === true &&
      parsed?.persisted === true &&
      persistenceState !== 'UNSUPPORTED_EVENT' &&
      persistenceState !== 'PENDING_CUSTOMER_IDENTITY' &&
      persistenceState !== 'PERSISTENCE_FAILED';

    return {
      ok: parsed?.success === true,
      status: res.status,
      persisted: confirmedPersisted,
      persistenceState,
      retryable: false,
      eventId,
      correlationId,
      body: parsed
    };
  } catch (e: any) {
    const isAbort =
      e?.name === 'AbortError' || String(e?.message || '').toLowerCase().includes('abort');
    const errorCode = isAbort ? 'WORKER_TIMEOUT' : 'WORKER_DISPATCH_FAILED';
    const safeMsg = isAbort
      ? `Worker dispatch timed out after ${timeoutMs}ms`
      : sanitizeErrorForLog(e?.message || 'dispatch failed');
    console.warn(`[ChatMitra Webhook] Worker dispatch err (${errorCode}): ${safeMsg}`);
    await webhookEventRepository
      .markWebhookStatus({
        event_id: eventId,
        processing_status: 'FAILED',
        error_code: errorCode
      })
      .catch(() => {});
    return {
      ok: false,
      status: isAbort ? 504 : 503,
      persisted: false,
      persistenceState: 'PERSISTENCE_FAILED',
      errorCode,
      message: safeMsg,
      retryable: true,
      timedOut: isAbort,
      eventId,
      correlationId
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET Handler: Webhook Verification Handshake
 * Used by ChatMitra, Meta WABA, and webhook test tools to verify ownership.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token') || searchParams.get('verify_token') || searchParams.get('token');
  const challenge = searchParams.get('hub.challenge') || searchParams.get('challenge');

  const configuredToken = (
    process.env.CHATMITRA_VERIFY_TOKEN ||
    process.env.CHATMANTRA_VERIFY_TOKEN ||
    process.env.OMNIDIM_VERIFY_TOKEN ||
    process.env.META_WEBHOOK_VERIFY_TOKEN ||
    ''
  ).trim();

  if (mode === 'subscribe' || token) {
    if (token && configuredToken && constantTimeEqualStrings(token.trim(), configuredToken)) {
      console.log('[ChatMitra Webhook] Verification Handshake Accepted');
      return new NextResponse(challenge || 'VERIFIED', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }
      });
    }
  }

  return new NextResponse('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * POST Handler: Inbound WhatsApp Events & Message Status Callbacks
 *
 * Task 5H.4 Google Sheets Architecture:
 * - HMAC-SHA256 signature verification against raw request body
 * - Rejects malformed JSON with HTTP 400
 * - Rejects missing messageId or sender with HTTP 400
 * - Fail-closed: Returns HTTP 503 if Google Sheets store is unreachable (zero MongoDB fallback)
 * - Idempotent deduplication against WEBHOOK_EVENTS (stores SHA-256 payload_hash only, zero raw payload)
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('x-webhook-signature') ||
                            request.headers.get('x-hub-signature-256') ||
                            request.headers.get('x-signature');

    const secret = process.env.CHATMITRA_WEBHOOK_SECRET ||
                   process.env.CHATMANTRA_WEBHOOK_SECRET ||
                   process.env.CHATMITRA_SECRET ||
                   process.env.CHATMANTRA_SECRET;

    // 1. Signature & Secret Verification (Fail-Closed)
    if (!secret || !secret.trim()) {
      console.warn('[ChatMitra Security] Webhook secret unconfigured in environment. Rejecting unauthenticated request.');
      return NextResponse.json({ success: false, error: 'Webhook authentication unconfigured' }, { status: 401 });
    }

    if (!signatureHeader || !signatureHeader.trim()) {
      console.warn('[ChatMitra Security] Missing required webhook signature header');
      return NextResponse.json({ success: false, error: 'Missing webhook signature' }, { status: 401 });
    }

    const isValid = verifyChatMitraSignature(rawBody, signatureHeader, secret.trim());
    if (!isValid) {
      console.warn('[ChatMitra Security] Signature verification failed');
      return NextResponse.json({ success: false, error: 'Invalid Webhook Signature' }, { status: 401 });
    }
    console.log('[ChatMitra Security] Signature verified successfully');

    // 2. JSON Parsing & Structure Validation
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    // 3. Strict Payload Validation Guard & Optional Provider Validation
    const incomingCorrelationId = (
      request.headers.get('x-correlation-id') ||
      (typeof body?.correlationId === 'string' ? body.correlationId : '')
    ).trim();
    const correlationId =
      incomingCorrelationId || `CM-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const validation = validateChatMitraInboundPayload(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
          error: sanitizeErrorForLog(validation.error || 'INVALID_PAYLOAD'),
          retryable: false,
          correlationId
        },
        { status: 400 }
      );
    }

    let canonicalProvider = 'ChatMitra';
    if (body.provider !== undefined && body.provider !== null) {
      const normalized = normalizeSupportedProvider(String(body.provider));
      if (normalized.key !== 'CHATMITRA') {
        return NextResponse.json(
          {
            success: false,
            persisted: false,
            persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
            error: 'INVALID_PROVIDER',
            message: `Provider "${normalized.canonicalName}" is not supported on /api/chatmitra-webhook`,
            retryable: false,
            correlationId
          },
          { status: 400 }
        );
      }
      canonicalProvider = normalized.canonicalName;
    }

    // 4. Google Sheets Connectivity & Fail-Closed Guard (Zero MongoDB Fallback)
    await CrmSheetsService.assertHealthy();

    const eventName = validation.eventName || 'message.received';
    const workerUrl = new URL(request.url.replace('chatmitra-webhook', 'whatsapp-webhook-worker')).toString();
    const workerSecret = process.env.INTERNAL_WORKER_SECRET?.trim() || '';

    // 5. Handle Status Updates (sent, delivered, read, failed)
    if (
      eventName === 'message.status.updated' ||
      eventName === 'message.sent' ||
      eventName === 'message.delivered' ||
      eventName === 'message.read' ||
      eventName === 'message.failed'
    ) {
      const msgId = validation.msgId!;
      const statusStr = String(
        body.status || (eventName !== 'message.status.updated' ? eventName.replace('message.', '') : '')
      ).trim();
      const eventId = `CM_STATUS_${msgId}_${statusStr.toUpperCase()}`;

      const rawStatusPhone = body.from || body.recipient_mobile_number || body.phone || undefined;
      let normalizedStatusPhone: string | undefined;
      if (rawStatusPhone !== undefined && rawStatusPhone !== null && String(rawStatusPhone).trim() !== '') {
        const parsedPhone = normalizeIndianPhone(String(rawStatusPhone));
        if (!parsedPhone) {
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
              error: 'INVALID_SENDER_PHONE',
              retryable: false,
              correlationId
            },
            { status: 400 }
          );
        }
        normalizedStatusPhone = parsedPhone;
      }

      const reg = await webhookEventRepository.registerWebhookEventIdempotent({
        event_id: eventId,
        provider: canonicalProvider,
        event_type: 'STATUS_UPDATE',
        rawPayloadForHashOnly: body
      });

      if (reg.duplicate && reg.record.processing_status !== 'FAILED') {
        console.log(`[ChatMitra Webhook] Duplicate status event swallowed: ${eventId}`);
        return NextResponse.json({
          success: true,
          duplicate: true,
          persisted: false,
          persistenceState: 'DUPLICATE_ALREADY_PERSISTED',
          eventId,
          correlationId
        });
      }

      waitUntil(
        dispatchChatMitraWorker({
          workerUrl,
          workerSecret,
          eventId,
          correlationId,
          workerPayload: {
            eventId,
            eventType: 'STATUS_UPDATE',
            data: {
              msgId,
              statusStr,
              statusObj: { status: statusStr, errors: body.errors },
              ...(normalizedStatusPhone ? { fromPhone: normalizedStatusPhone } : {})
            },
            correlationId,
            provider: canonicalProvider
          }
        })
      );

      return NextResponse.json({
        success: true,
        persisted: false,
        queuedForWorker: true,
        event: eventName,
        eventId,
        correlationId
      });
    }

    // 6. Handle Inbound Messages (including explicit sticker/media handling — NEVER coerce media to text)
    if (eventName === 'message.received' || body.messages || body.text || body.message || validation.isMedia) {
      const fromPhone = normalizeIndianPhone(validation.fromPhone!) || validation.fromPhone!;
      const msgId = validation.msgId!;
      const profileName = validation.profileName || 'Customer';
      const mediaInfo = resolveInboundMessageType(body);
      if (!mediaInfo.valid) {
        return NextResponse.json(
          {
            success: false,
            persisted: false,
            persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
            error: mediaInfo.error || 'INVALID_MEDIA_PAYLOAD',
            retryable: false,
            correlationId
          },
          { status: 400 }
        );
      }

      const messageText = mediaInfo.isMedia ? '' : validation.text || '';
      const eventId = `CM_INBOUND_${msgId}`;

      const loanClassification = classifyLoanCategory(messageText);

      const reg = await webhookEventRepository.registerWebhookEventIdempotent({
        event_id: eventId,
        provider: canonicalProvider,
        event_type: 'INBOUND_MESSAGE',
        rawPayloadForHashOnly: body
      });

      if (reg.duplicate && reg.record.processing_status !== 'FAILED') {
        console.log(`[ChatMitra Webhook] Duplicate inbound event swallowed: ${eventId}`);
        return NextResponse.json({
          success: true,
          duplicate: true,
          persisted: false,
          persistenceState: 'DUPLICATE_ALREADY_PERSISTED',
          eventId,
          correlationId
        });
      }

      // Task 5H.33 D-01: Verify optional caller-supplied customerId/leadId strictly against canonical Sheets
      const verifiedIdentity = await verifyCustomerAndLeadOwnership({
        fromPhone,
        candidateCustomerId: String(body.customerId || '').trim() || undefined,
        candidateLeadId: String(body.leadId || '').trim() || undefined
      });
      if (verifiedIdentity.rejectedCandidateCustomerId || verifiedIdentity.rejectedCandidateLeadId) {
        console.warn(
          `[ChatMitra Security] Ignored unverified caller-supplied identity (${verifiedIdentity.rejectionReason || 'IDENTITY_UNVERIFIED'}) for ${eventId}`
        );
      }

      // Strip all media URLs/attachment payloads before forwarding to worker
      waitUntil(
        dispatchChatMitraWorker({
          workerUrl,
          workerSecret,
          eventId,
          correlationId,
          workerPayload: {
            eventId,
            eventType: 'INBOUND_MESSAGE',
            data: {
              message: {
                type: mediaInfo.messageType,
                ...(mediaInfo.isMedia ? {} : { text: { body: messageText } }),
                id: msgId
              },
              fromPhone,
              msgId,
              profileName,
              loanClassification,
              ...(verifiedIdentity.verified && verifiedIdentity.customerId
                ? { customerId: verifiedIdentity.customerId }
                : {}),
              ...(verifiedIdentity.verified && verifiedIdentity.leadId && verifiedIdentity.leadExplicitlyVerified
                ? { leadId: verifiedIdentity.leadId }
                : {})
            },
            correlationId,
            provider: canonicalProvider
          }
        })
      );

      return NextResponse.json({
        success: true,
        persisted: false,
        queuedForWorker: true,
        event: 'message.received',
        eventId,
        messageId: msgId,
        correlationId,
        messageType: mediaInfo.messageType,
        loanCategory: loanClassification.category
      });
    }

    return NextResponse.json(
      {
        success: false,
        persisted: false,
        persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
        error: `Unsupported event type: ${String(eventName).slice(0, 64)}`,
        retryable: false,
        correlationId
      },
      { status: 400 }
    );
  } catch (err: any) {
    if (err instanceof SheetsCrmError) {
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          error: err.code,
          message: sanitizeErrorForLog(err.message),
          retryable: err.retryable
        },
        { status: err.httpStatus }
      );
    }
    const safeErr = sanitizeErrorForLog(err?.message || err);
    console.error('[ChatMitra Webhook] Fatal error:', safeErr);
    return NextResponse.json(
      {
        success: false,
        persisted: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: safeErr,
        retryable: true
      },
      { status: 500 }
    );
  }
}
