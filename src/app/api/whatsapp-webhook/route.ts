import { NextResponse } from 'next/server';
import { sanitizeErrorForLog } from '@/lib/aisensy';
import { constantTimeEqualStrings } from '@/lib/auth';
import { verifyChatMitraSignature } from '@/lib/chatmitra';
import {
  PersistenceState,
  resolveInboundMessageType,
  validateProviderMessageId
} from '@/lib/messaging-contract';
import { normalizeIndianPhone } from '@/lib/phone';
import {
  CrmSheetsService,
  SheetsCrmError,
  verifyCustomerAndLeadOwnership,
  webhookEventRepository
} from '@/lib/google-sheets';

export interface WorkerHandoffResult {
  ok: boolean;
  status: number;
  persisted: boolean;
  persistenceState?: PersistenceState;
  eventId: string;
  correlationId: string;
  errorCode?: string;
  error?: string;
  retryable?: boolean;
  timedOut?: boolean;
  body?: any;
}

/**
 * Deterministic, bounded-timeout worker handoff for Meta WhatsApp webhook events (Task 5H.31).
 *
 * - Fails closed when INTERNAL_WORKER_SECRET is missing.
 * - Handles HTTP 401, HTTP 503, non-2xx responses, network failures, and AbortController timeouts
 *   explicitly by marking WEBHOOK_EVENTS as FAILED and returning ok=false, persisted=false.
 * - Confirms persisted=true ONLY when the worker HTTP 200 JSON explicitly reports
 *   `{ success: true, persisted: true }` (never falsely claims persistence).
 */
export async function dispatchToWebhookWorker(params: {
  workerUrl: string;
  workerSecret: string;
  eventId: string;
  correlationId: string;
  payload: Record<string, any>;
  log: (msg: string) => void;
}): Promise<WorkerHandoffResult> {
  const { workerUrl, workerSecret, eventId, correlationId, payload, log } = params;
  const trimmedSecret = String(workerSecret || '').trim();
  if (!trimmedSecret) {
    const error = 'INTERNAL_WORKER_SECRET is not configured for worker handoff';
    log(`[Worker Handoff Error] ${eventId}: WORKER_AUTH_UNCONFIGURED`);
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
      eventId,
      correlationId,
      errorCode: 'WORKER_AUTH_UNCONFIGURED',
      error
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
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }

    if (res.status === 401) {
      log(`[Worker Handoff Error] ${eventId}: HTTP 401 Unauthorized`);
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
        eventId,
        correlationId,
        errorCode: 'WORKER_UNAUTHORIZED',
        error: 'Worker rejected internal authentication (HTTP 401)'
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
      const safeErr = sanitizeErrorForLog(parsed?.message || parsed?.error || `Worker returned HTTP ${res.status}`);
      const persistenceState: PersistenceState =
        typeof parsed?.persistenceState === 'string'
          ? (parsed.persistenceState as PersistenceState)
          : res.status === 400
            ? 'UNSUPPORTED_EVENT'
            : 'PERSISTENCE_FAILED';
      const retryable = res.status === 429 || res.status >= 500;
      log(`[Worker Handoff Error] ${eventId}: HTTP ${res.status} (${errorCode})`);
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
        eventId,
        correlationId,
        errorCode,
        error: safeErr,
        retryable
      };
    }

    if (!parsed || parsed.success !== true) {
      const errorCode =
        typeof parsed?.error === 'string' && parsed.error.trim()
          ? parsed.error.trim().replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 64)
          : 'WORKER_INVALID_RESPONSE';
      log(`[Worker Handoff Error] ${eventId}: Worker returned 200 without success=true`);
      await webhookEventRepository
        .markWebhookStatus({
          event_id: eventId,
          processing_status: 'FAILED',
          error_code: errorCode
        })
        .catch(() => {});
      return {
        ok: false,
        status: 502,
        persisted: false,
        persistenceState: 'PERSISTENCE_FAILED',
        eventId,
        correlationId,
        errorCode,
        error: 'Worker response did not confirm success'
      };
    }

    // Strict persistence contract (Task 5H.33 D-03): only claim persisted=true when worker explicitly confirms persisted===true
    const workerPersistenceState: PersistenceState =
      typeof parsed.persistenceState === 'string'
        ? (parsed.persistenceState as PersistenceState)
        : parsed.persisted === true
          ? 'PERSISTED'
          : 'PERSISTENCE_FAILED';
    const confirmedPersisted =
      parsed.persisted === true &&
      workerPersistenceState !== 'UNSUPPORTED_EVENT' &&
      workerPersistenceState !== 'PENDING_CUSTOMER_IDENTITY' &&
      workerPersistenceState !== 'PERSISTENCE_FAILED';
    return {
      ok: true,
      status: res.status,
      persisted: confirmedPersisted,
      persistenceState: workerPersistenceState,
      eventId,
      correlationId,
      body: parsed
    };
  } catch (err: any) {
    const isAbort =
      err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('abort');
    const errorCode = isAbort ? 'WORKER_TIMEOUT' : 'WORKER_DISPATCH_FAILED';
    const safeErr = isAbort
      ? `Worker handoff timed out after ${timeoutMs}ms`
      : sanitizeErrorForLog(err?.message || err);
    log(`[Worker Handoff Error] ${eventId}: ${errorCode} (${safeErr})`);
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
      eventId,
      correlationId,
      timedOut: isAbort,
      errorCode,
      error: safeErr
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const omnidimToken = (process.env.OMNIDIM_VERIFY_TOKEN || '').trim();
  const metaToken = (process.env.META_WEBHOOK_VERIFY_TOKEN || '').trim();
  // Fail-closed: accept ONLY environment-configured verify tokens (zero hardcoded fallbacks)
  const validTokens = [metaToken, omnidimToken].filter((v) => v.length > 0);

  if (
    mode === 'subscribe' &&
    token &&
    validTokens.length > 0 &&
    validTokens.some((expected) => constantTimeEqualStrings(token.trim(), expected))
  ) {
    console.log('Meta / AiSensy Webhook Verified!');
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }
    });
  }
  return new NextResponse('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const debugLogs: string[] = [];
  const log = (msg: string) => { console.log(msg); debugLogs.push(msg); };

  try {
    const rawBody = await request.text();
    const webhookSig = request.headers.get('x-webhook-signature');
    const hubSig = request.headers.get('x-hub-signature-256');
    const customSig = request.headers.get('x-signature');
    const userAgent = request.headers.get('user-agent') || 'unknown';

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      log('[Webhook Security] Malformed JSON payload rejected');
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const isMetaPayload = Boolean(body?.object === 'whatsapp_business_account' || Array.isArray(body?.entry));
    const isChatMitraPayload = Boolean(
      body?.event && typeof body.event === 'string' &&
      (body.event.startsWith('message.') || body.event === 'message.received' || body.event === 'message.status.updated' || body.event === 'message.sent')
    );
    const isDirectDispatch = Boolean(
      body.event === 'send_template' || (body.phone && !body.message && !body.text && !body.entry && !body.type && !body.interactive)
    );

    const chatmitraSecret = process.env.CHATMITRA_WEBHOOK_SECRET ||
                            process.env.CHATMANTRA_WEBHOOK_SECRET ||
                            process.env.CHATMITRA_SECRET ||
                            process.env.CHATMANTRA_SECRET;
    const metaAppSecret = process.env.META_APP_SECRET;
    const unauthorizedWebhook = (error: string) =>
      NextResponse.json(
        { success: false, error },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            Pragma: 'no-cache'
          }
        }
      );

    // 1. Explicit ChatMitra Signature Header (x-webhook-signature or x-signature)
    if (webhookSig || customSig) {
      const sigToVerify = (webhookSig || customSig)!;
      if (!chatmitraSecret) {
        log('[ChatMitra Security] Signature header received but CHATMITRA_WEBHOOK_SECRET not configured');
        return unauthorizedWebhook('ChatMitra webhook secret not configured');
      }
      const isValid = verifyChatMitraSignature(rawBody, sigToVerify, chatmitraSecret);
      if (!isValid) {
        log(`[ChatMitra Security] Invalid Webhook Signature on ${isChatMitraPayload ? 'ChatMitra' : 'unknown'} payload (UA: ${userAgent.slice(0, 40)})`);
        return unauthorizedWebhook('Invalid Webhook Signature');
      }
      log('[ChatMitra Security] Signature verified successfully via x-webhook-signature');
    }
    // 2. Shared/Meta Signature Header (x-hub-signature-256)
    else if (hubSig) {
      let verified = false;

      if (metaAppSecret && verifyChatMitraSignature(rawBody, hubSig, metaAppSecret)) {
        verified = true;
        log('[Meta Security] Signature verified successfully via META_APP_SECRET');
      } else if (chatmitraSecret && verifyChatMitraSignature(rawBody, hubSig, chatmitraSecret)) {
        verified = true;
        log('[ChatMitra Security] Signature verified successfully via x-hub-signature-256');
      }

      if (!verified) {
        if (isChatMitraPayload && chatmitraSecret) {
          log(`[ChatMitra Security] Invalid Webhook Signature for ChatMitra payload via x-hub-signature-256 (UA: ${userAgent.slice(0, 40)})`);
          return unauthorizedWebhook('Invalid Webhook Signature');
        }
        if (isMetaPayload) {
          if (metaAppSecret) {
            log(`[Meta Security] Invalid Webhook Signature for Meta WABA payload (UA: ${userAgent.slice(0, 40)})`);
            return unauthorizedWebhook('Invalid Meta Webhook Signature');
          }
          log(`[Meta Security] Rejected unverified Meta WABA payload (UA: ${userAgent.slice(0, 40)})`);
          return unauthorizedWebhook('Meta App Secret not configured');
        }
        log(`[Webhook Security] Unknown payload rejected with invalid x-hub-signature-256 (UA: ${userAgent.slice(0, 40)})`);
        return unauthorizedWebhook('Invalid Webhook Signature');
      }
    }
    // 3. Missing Signature Guards
    else if ((isChatMitraPayload || isDirectDispatch) && chatmitraSecret) {
      log(`[ChatMitra Security] Missing required signature header on ChatMitra event: ${body.event} (UA: ${userAgent.slice(0, 40)})`);
      return unauthorizedWebhook('Missing webhook signature');
    }
    else if (isMetaPayload && (metaAppSecret || process.env.STRICT_META_WEBHOOK_VERIFICATION === 'true')) {
      log(`[Meta Security] Missing required x-hub-signature-256 header on Meta payload (UA: ${userAgent.slice(0, 40)})`);
      return unauthorizedWebhook('Missing Meta webhook signature');
    }
    else {
      log(`[Webhook Security] Unsigned POST request rejected (UA: ${userAgent.slice(0, 40)})`);
      return unauthorizedWebhook('Missing webhook signature');
    }

    log('Received Webhook Payload (redacted length): ' + rawBody.length);

    // Support ChatMitra Official Webhook Events (Task 5H.35 F34-03 hardened contract)
    if (body.event && typeof body.event === 'string' && body.event.startsWith('message.')) {
      const incomingCorrelationId = (
        request.headers.get('x-correlation-id') ||
        (typeof body?.correlationId === 'string' ? body.correlationId : '')
      ).trim();
      const correlationId =
        incomingCorrelationId || `CM-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      if (
        body.event === 'message.status.updated' ||
        body.event === 'message.sent' ||
        body.event === 'message.delivered' ||
        body.event === 'message.read' ||
        body.event === 'message.failed'
      ) {
        const rawMsgId = body.messageId ?? body.id ?? body.data?.id;
        const idCheck = validateProviderMessageId(rawMsgId, 'ChatMitra');
        if (!idCheck.valid || !idCheck.value) {
          log(`[ChatMitra Webhook] Rejected status event with missing/invalid messageId (${idCheck.reason || 'INVALID'})`);
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
              error: 'INVALID_MESSAGE_ID',
              message: 'Missing or invalid provider messageId in ChatMitra status callback.',
              correlationId,
              debugLogs
            },
            { status: 400 }
          );
        }
        const msgId = idCheck.value;
        const statusStr = String(
          body.status || (body.event !== 'message.status.updated' ? body.event.replace('message.', '') : '')
        ).trim();
        if (!statusStr) {
          log(`[ChatMitra Webhook] Rejected status event missing status field for ${msgId}`);
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
              error: 'INVALID_STATUS_PAYLOAD',
              message: 'Missing status field in ChatMitra status callback.',
              correlationId,
              debugLogs
            },
            { status: 400 }
          );
        }

        const rawStatusPhone = body.from || body.recipient_mobile_number || body.phoneNumber || body.phone;
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
                message: 'Invalid phone number in ChatMitra status callback.',
                correlationId,
                debugLogs
              },
              { status: 400 }
            );
          }
          normalizedStatusPhone = parsedPhone;
        }

        await CrmSheetsService.assertHealthy();

        const eventId = `CM_STATUS_${msgId}_${statusStr.toUpperCase()}`;
        const reg = await webhookEventRepository.registerWebhookEventIdempotent({
          event_id: eventId,
          provider: 'ChatMitra',
          event_type: 'STATUS_UPDATE',
          rawPayloadForHashOnly: body
        });

        if (reg.duplicate && reg.record.processing_status !== 'FAILED') {
          log(`[Webhook Deduplication] Duplicate ChatMitra event swallowed: ${eventId}`);
          return NextResponse.json({
            success: true,
            duplicate: true,
            persisted: false,
            persistenceState: 'DUPLICATE_ALREADY_PERSISTED' as PersistenceState,
            eventId,
            correlationId,
            debugLogs
          });
        }

        const workerUrl = new URL(request.url.replace('whatsapp-webhook', 'whatsapp-webhook-worker'));
        const workerSecret = process.env.INTERNAL_WORKER_SECRET?.trim() || '';

        const handoff = await dispatchToWebhookWorker({
          workerUrl: workerUrl.toString(),
          workerSecret,
          eventId,
          correlationId,
          payload: {
            eventId,
            eventType: 'STATUS_UPDATE',
            data: {
              msgId,
              statusStr,
              statusObj: { status: statusStr, errors: body.errors },
              ...(normalizedStatusPhone ? { fromPhone: normalizedStatusPhone } : {})
            },
            correlationId,
            provider: 'ChatMitra'
          },
          log
        });

        if (!handoff.ok) {
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: handoff.persistenceState || 'PERSISTENCE_FAILED',
              workerHandoffFailed: true,
              retryable: Boolean(handoff.retryable ?? handoff.timedOut),
              error: handoff.errorCode || 'WORKER_HANDOFF_FAILED',
              message: handoff.error,
              workerStatus: handoff.status,
              timedOut: Boolean(handoff.timedOut),
              eventId,
              correlationId,
              debugLogs
            },
            { status: handoff.timedOut ? 504 : handoff.status === 400 ? 400 : handoff.status === 429 ? 429 : 503 }
          );
        }

        return NextResponse.json({
          success: true,
          persisted: handoff.persisted,
          persistenceState: handoff.persistenceState,
          event: body.event,
          eventId,
          correlationId,
          provider: 'ChatMitra',
          debugLogs
        });
      }

      if (body.event === 'message.received') {
        const rawMsgId = body.id ?? body.messageId ?? body.messages?.[0]?.id;
        const idCheck = validateProviderMessageId(rawMsgId, 'ChatMitra');
        if (!idCheck.valid || !idCheck.value) {
          log(`[ChatMitra Webhook] Rejected inbound event missing/invalid messageId (${idCheck.reason || 'INVALID'})`);
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
              error: 'INVALID_MESSAGE_ID',
              message: 'Missing or invalid provider messageId in ChatMitra inbound event.',
              correlationId,
              debugLogs
            },
            { status: 400 }
          );
        }
        const msgId = idCheck.value;

        const rawFrom = body.from || body.recipient_mobile_number || body.phoneNumber || body.phone || body.messages?.[0]?.from;
        if (!rawFrom || !String(rawFrom).trim()) {
          log(`[ChatMitra Webhook] Rejected inbound event missing sender phone for ${msgId}`);
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
              error: 'MISSING_SENDER',
              message: 'Missing sender phone number in ChatMitra inbound event.',
              correlationId,
              debugLogs
            },
            { status: 400 }
          );
        }
        const fromPhone = normalizeIndianPhone(String(rawFrom));
        if (!fromPhone) {
          log(`[ChatMitra Webhook] Rejected inbound event with invalid sender phone for ${msgId}`);
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
              error: 'INVALID_SENDER_PHONE',
              message: 'Invalid sender phone number in ChatMitra inbound event.',
              correlationId,
              debugLogs
            },
            { status: 400 }
          );
        }

        const mediaInfo = resolveInboundMessageType(body);
        if (!mediaInfo.valid) {
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
              error: mediaInfo.error || 'INVALID_MEDIA_PAYLOAD',
              message: 'Invalid media payload in ChatMitra inbound event.',
              correlationId,
              debugLogs
            },
            { status: 400 }
          );
        }

        await CrmSheetsService.assertHealthy();

        const profileName = body.profile?.name || body.name || 'Customer';
        const eventId = `CM_INBOUND_${msgId}`;

        const reg = await webhookEventRepository.registerWebhookEventIdempotent({
          event_id: eventId,
          provider: 'ChatMitra',
          event_type: 'INBOUND_MESSAGE',
          rawPayloadForHashOnly: body
        });

        if (reg.duplicate && reg.record.processing_status !== 'FAILED') {
          log(`[Webhook Deduplication] Duplicate ChatMitra event swallowed: ${eventId}`);
          return NextResponse.json({
            success: true,
            duplicate: true,
            persisted: false,
            persistenceState: 'DUPLICATE_ALREADY_PERSISTED' as PersistenceState,
            eventId,
            correlationId,
            debugLogs
          });
        }

        const candidateCustomerId = String(body.customerId || '').trim() || undefined;
        const candidateLeadId = String(body.leadId || '').trim() || undefined;
        const verifiedIdentity = await verifyCustomerAndLeadOwnership({
          fromPhone,
          candidateCustomerId,
          candidateLeadId
        });
        if (verifiedIdentity.rejectedCandidateCustomerId || verifiedIdentity.rejectedCandidateLeadId) {
          log(
            `[Webhook Security] Ignored unverified caller-supplied identity (${verifiedIdentity.rejectionReason || 'IDENTITY_UNVERIFIED'}) for ${eventId}`
          );
        }

        const workerUrl = new URL(request.url.replace('whatsapp-webhook', 'whatsapp-webhook-worker'));
        const workerSecret = process.env.INTERNAL_WORKER_SECRET?.trim() || '';

        const textBody = mediaInfo.isMedia
          ? ''
          : body.text?.body ||
            (typeof body.text === 'string' ? body.text : '') ||
            (typeof body.message === 'string' ? body.message : '') ||
            '';

        const handoff = await dispatchToWebhookWorker({
          workerUrl: workerUrl.toString(),
          workerSecret,
          eventId,
          correlationId,
          payload: {
            eventId,
            eventType: 'INBOUND_MESSAGE',
            data: {
              message: {
                type: mediaInfo.messageType,
                ...(mediaInfo.isMedia ? {} : { text: { body: textBody } }),
                id: msgId
              },
              fromPhone,
              msgId,
              profileName,
              ...(verifiedIdentity.verified && verifiedIdentity.customerId
                ? { customerId: verifiedIdentity.customerId }
                : {}),
              ...(verifiedIdentity.verified && verifiedIdentity.leadId && verifiedIdentity.leadExplicitlyVerified
                ? { leadId: verifiedIdentity.leadId }
                : {})
            },
            correlationId,
            provider: 'ChatMitra'
          },
          log
        });

        if (!handoff.ok) {
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: handoff.persistenceState || 'PERSISTENCE_FAILED',
              workerHandoffFailed: true,
              retryable: Boolean(handoff.retryable ?? handoff.timedOut),
              error: handoff.errorCode || 'WORKER_HANDOFF_FAILED',
              message: handoff.error,
              workerStatus: handoff.status,
              timedOut: Boolean(handoff.timedOut),
              eventId,
              correlationId,
              debugLogs
            },
            { status: handoff.timedOut ? 504 : handoff.status === 400 ? 400 : handoff.status === 429 ? 429 : 503 }
          );
        }

        return NextResponse.json({
          success: true,
          persisted: handoff.persisted,
          persistenceState: handoff.persistenceState,
          event: body.event,
          eventId,
          correlationId,
          provider: 'ChatMitra',
          debugLogs
        });
      }

      // Any other message.* event type is explicitly unsupported — NEVER return false success
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
          error: 'UNSUPPORTED_EVENT',
          message: `Unsupported ChatMitra event type: ${String(body.event).slice(0, 64)}`,
          correlationId,
          debugLogs
        },
        { status: 400 }
      );
    }

    // Support internal dispatch event from Broadcast UI
    if (body.event === 'send_template' || (body.phone && !body.message && !body.text && !body.entry && !body.type && !body.interactive)) {
      if (process.env.AISENSY_INBOUND_WEBHOOK_ENABLED !== 'true' || process.env.BULK_BROADCAST_ENABLED !== 'true') {
        log('[Webhook Safeguard] Direct template dispatch blocked: AISENSY_INBOUND_WEBHOOK_ENABLED or BULK_BROADCAST_ENABLED is not true');
        return NextResponse.json(
          {
            success: false,
            error: 'AISENSY_INBOUND_DISABLED',
            message: 'Safety invariant: Direct template webhook dispatch is disabled in safe mode.'
          },
          { status: 403 }
        );
      }

      const correlationId = `CRM-BRD-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          persistenceState: 'UNSUPPORTED_EVENT',
          error: 'UNSUPPORTED_EVENT',
          message: 'Direct template webhook dispatch is not supported by the canonical worker contract.',
          correlationId,
          debugLogs
        },
        { status: 400 }
      );
    }

    // Process Meta / AiSensy Inbound Webhook
    if (body.object === 'whatsapp_business_account' || body.entry || body.destination || body.text || (body.phone && !body.event)) {
      const incomingCorrelationId = (
        request.headers.get('x-correlation-id') ||
        (typeof body?.correlationId === 'string' ? body.correlationId : '')
      ).trim();
      const handoffs: WorkerHandoffResult[] = [];
      const duplicateEventIds: string[] = [];

      const entries = body.entry || [body];
      for (const entry of entries) {
        const changes = entry?.changes || [entry];
        for (const change of changes) {
          const value = change?.value || change;

          // 1. Handle Status Updates (Delivery Receipts)
          const statuses = value?.statuses || (body.status ? [body] : []);
          if (statuses.length > 0) {
            await CrmSheetsService.assertHealthy();

            for (const statusObj of statuses) {
              const rawMsgId = statusObj?.id ?? statusObj?.messageId;
              const idCheck = validateProviderMessageId(rawMsgId, 'Meta');
              const statusStr = String(statusObj?.status || statusObj?.deliveryStatus || '').trim();

              if (!idCheck.valid || !idCheck.value || !statusStr) {
                log(`[Meta Webhook] Rejected malformed status item (msgId valid=${idCheck.valid}, statusStr=${Boolean(statusStr)})`);
                return NextResponse.json(
                  {
                    success: false,
                    persisted: false,
                    persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
                    error: !idCheck.valid ? 'INVALID_MESSAGE_ID' : 'INVALID_STATUS_PAYLOAD',
                    message: 'Meta status callback requires a valid provider message id and status.',
                    correlationId: incomingCorrelationId || undefined,
                    debugLogs
                  },
                  { status: 400 }
                );
              }
              const msgId = idCheck.value;

              const eventId = `META_STATUS_${msgId}_${statusStr.toUpperCase()}`;
              const correlationId =
                incomingCorrelationId ||
                `META-${Date.now()}-${Math.random().toString(36).substring(7)}`;

              const reg = await webhookEventRepository.registerWebhookEventIdempotent({
                event_id: eventId,
                provider: 'Meta',
                event_type: 'STATUS_UPDATE',
                rawPayloadForHashOnly: statusObj
              });

              if (reg.duplicate && reg.record.processing_status !== 'FAILED') {
                log(`[Webhook Deduplication] Duplicate event swallowed: ${eventId}`);
                duplicateEventIds.push(eventId);
                continue;
              }

              log(`[Webhook Inbox] Recorded STATUS_UPDATE: ${eventId}`);

              const workerUrl = new URL(request.url.replace('whatsapp-webhook', 'whatsapp-webhook-worker'));
              const workerSecret = process.env.INTERNAL_WORKER_SECRET?.trim() || '';

              const statusPhoneRaw = statusObj.recipient_id || statusObj.phone || undefined;
              const statusPhone = statusPhoneRaw
                ? normalizeIndianPhone(String(statusPhoneRaw)) || String(statusPhoneRaw).trim()
                : undefined;

              const handoff = await dispatchToWebhookWorker({
                workerUrl: workerUrl.toString(),
                workerSecret,
                eventId,
                correlationId,
                payload: {
                  eventId,
                  eventType: 'STATUS_UPDATE',
                  data: {
                    msgId,
                    statusStr,
                    statusObj: { status: statusStr, errors: statusObj.errors },
                    ...(statusPhone ? { fromPhone: statusPhone } : {})
                  },
                  correlationId,
                  provider: 'Meta'
                },
                log
              });
              handoffs.push(handoff);

              if (!handoff.ok) {
                return NextResponse.json(
                  {
                    success: false,
                    persisted: false,
                    persistenceState: handoff.persistenceState || 'PERSISTENCE_FAILED',
                    workerHandoffFailed: true,
                    retryable: Boolean(handoff.retryable ?? handoff.timedOut),
                    error: handoff.errorCode || 'WORKER_HANDOFF_FAILED',
                    message: handoff.error,
                    workerStatus: handoff.status,
                    timedOut: Boolean(handoff.timedOut),
                    eventId,
                    correlationId,
                    debugLogs
                  },
                  { status: handoff.timedOut ? 504 : handoff.status === 400 ? 400 : handoff.status === 429 ? 429 : 503 }
                );
              }
            }
            continue;
          }

          let messages = value?.messages || (body.message ? [body.message] : []);
          if (messages.length === 0 && (body.text || body.type || body.button || body.interactive || typeof body === 'string')) {
            messages = [body];
          }

          for (const message of messages) {
            const rawFromPhone = message?.from || body.destination || body.phone;
            if (!rawFromPhone || !String(rawFromPhone).trim()) {
              return NextResponse.json(
                {
                  success: false,
                  persisted: false,
                  persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
                  error: 'MISSING_SENDER',
                  message: 'Meta inbound message is missing sender phone number.',
                  correlationId: incomingCorrelationId || undefined,
                  debugLogs
                },
                { status: 400 }
              );
            }
            const fromPhone = normalizeIndianPhone(String(rawFromPhone));
            if (!fromPhone) {
              return NextResponse.json(
                {
                  success: false,
                  persisted: false,
                  persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
                  error: 'INVALID_SENDER_PHONE',
                  message: 'Meta inbound message contains an invalid sender phone number.',
                  correlationId: incomingCorrelationId || undefined,
                  debugLogs
                },
                { status: 400 }
              );
            }

            // Task 5H.35 F34-03: Never fabricate timestamp fallback provider message IDs
            const idCheck = validateProviderMessageId(message?.id, 'Meta');
            if (!idCheck.valid || !idCheck.value) {
              return NextResponse.json(
                {
                  success: false,
                  persisted: false,
                  persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
                  error: 'INVALID_MESSAGE_ID',
                  message: 'Meta inbound message is missing a valid provider message id.',
                  correlationId: incomingCorrelationId || undefined,
                  debugLogs
                },
                { status: 400 }
              );
            }
            const msgId = idCheck.value;

            const mediaInfo = resolveInboundMessageType(message);
            if (!mediaInfo.valid) {
              return NextResponse.json(
                {
                  success: false,
                  persisted: false,
                  persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
                  error: mediaInfo.error || 'INVALID_MEDIA_PAYLOAD',
                  message: 'Meta inbound message contains an invalid media payload.',
                  correlationId: incomingCorrelationId || undefined,
                  debugLogs
                },
                { status: 400 }
              );
            }

            const profileName =
              message.profile?.name ||
              value?.contacts?.[0]?.profile?.name ||
              'Customer';

            const eventId = `META_INBOUND_${msgId}`;
            const correlationId =
              incomingCorrelationId ||
              `META-${Date.now()}-${Math.random().toString(36).substring(7)}`;

            await CrmSheetsService.assertHealthy();

            const reg = await webhookEventRepository.registerWebhookEventIdempotent({
              event_id: eventId,
              provider: 'Meta',
              event_type: 'INBOUND_MESSAGE',
              rawPayloadForHashOnly: message
            });

            if (reg.duplicate && reg.record.processing_status !== 'FAILED') {
              log(`[Webhook Deduplication] Duplicate event swallowed: ${eventId}`);
              duplicateEventIds.push(eventId);
              continue;
            }

            log(`[Webhook Inbox] Recorded INBOUND_MESSAGE: ${eventId}`);

            // Task 5H.33 D-01: NEVER trust caller-supplied customerId or leadId blindly.
            // Verify existence, phone ownership, and lead-to-customer ownership against canonical Sheets.
            const candidateCustomerId = String(message.customerId || body.customerId || '').trim() || undefined;
            const candidateLeadId = String(message.leadId || body.leadId || '').trim() || undefined;
            const verifiedIdentity = await verifyCustomerAndLeadOwnership({
              fromPhone,
              candidateCustomerId,
              candidateLeadId
            });
            if (verifiedIdentity.rejectedCandidateCustomerId || verifiedIdentity.rejectedCandidateLeadId) {
              log(
                `[Webhook Security] Ignored unverified caller-supplied identity (${verifiedIdentity.rejectionReason || 'IDENTITY_UNVERIFIED'}) for ${eventId}`
              );
            }
            const forwardedCustomerId = verifiedIdentity.verified ? verifiedIdentity.customerId : undefined;
            const forwardedLeadId = verifiedIdentity.verified ? verifiedIdentity.leadId : undefined;

            const workerUrl = new URL(request.url.replace('whatsapp-webhook', 'whatsapp-webhook-worker'));
            const workerSecret = process.env.INTERNAL_WORKER_SECRET?.trim() || '';

            // Strip any media URLs/IDs before forwarding to worker
            const sanitizedMessage = {
              type: mediaInfo.messageType,
              id: msgId,
              text: !mediaInfo.isMedia && message.text ? { body: message.text.body || message.text } : undefined,
              button: !mediaInfo.isMedia ? message.button : undefined,
              interactive: !mediaInfo.isMedia ? message.interactive : undefined
            };

            const handoff = await dispatchToWebhookWorker({
              workerUrl: workerUrl.toString(),
              workerSecret,
              eventId,
              correlationId,
              payload: {
                eventId,
                eventType: 'INBOUND_MESSAGE',
                data: {
                  message: sanitizedMessage,
                  fromPhone,
                  msgId,
                  profileName,
                  ...(forwardedCustomerId ? { customerId: forwardedCustomerId } : {}),
                  ...(forwardedLeadId ? { leadId: forwardedLeadId } : {})
                },
                correlationId,
                provider: 'Meta'
              },
              log
            });
            handoffs.push(handoff);

            if (!handoff.ok) {
              return NextResponse.json(
                {
                  success: false,
                  persisted: false,
                  persistenceState: handoff.persistenceState || 'PERSISTENCE_FAILED',
                  workerHandoffFailed: true,
                  retryable: Boolean(handoff.retryable ?? handoff.timedOut),
                  error: handoff.errorCode || 'WORKER_HANDOFF_FAILED',
                  message: handoff.error,
                  workerStatus: handoff.status,
                  timedOut: Boolean(handoff.timedOut),
                  eventId,
                  correlationId,
                  debugLogs
                },
                { status: handoff.timedOut ? 504 : handoff.status === 400 ? 400 : handoff.status === 429 ? 429 : 503 }
              );
            }
          }
        }
      }

      if (handoffs.length === 0 && duplicateEventIds.length > 0) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          persisted: false,
          persistenceState: 'DUPLICATE_ALREADY_PERSISTED',
          eventId: duplicateEventIds[0],
          duplicateEventIds,
          debugLogs
        });
      }

      if (handoffs.length === 0) {
        return NextResponse.json(
          {
            success: false,
            persisted: false,
            persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
            error: 'UNSUPPORTED_EVENT',
            message: 'Webhook payload contained no supported message or status events.',
            correlationId: incomingCorrelationId || undefined,
            debugLogs
          },
          { status: 400 }
        );
      }

      const allPersisted = handoffs.every((h) => h.persisted === true);
      const aggregateState: PersistenceState = allPersisted
        ? 'PERSISTED'
        : handoffs[0]?.persistenceState || 'PERSISTENCE_FAILED';
      return NextResponse.json({
        success: true,
        persisted: allPersisted,
        persistenceState: aggregateState,
        correlationId: handoffs[0]?.correlationId || incomingCorrelationId || undefined,
        handoffs: handoffs.map((h) => ({
          eventId: h.eventId,
          correlationId: h.correlationId,
          status: h.status,
          persisted: h.persisted,
          persistenceState: h.persistenceState
        })),
        debugLogs
      });
    }

    return NextResponse.json(
      {
        success: false,
        persisted: false,
        persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
        error: 'UNSUPPORTED_EVENT',
        message: 'Unsupported webhook payload format or event type.',
        debugLogs
      },
      { status: 400 }
    );
  } catch (err: any) {
    if (err instanceof SheetsCrmError) {
      const safeMsg = sanitizeErrorForLog(err.message);
      log(`[Webhook Sheets Error] ${err.code}: ${safeMsg}`);
      return NextResponse.json(
        { success: false, persisted: false, error: err.code, message: safeMsg, retryable: err.retryable, debugLogs },
        { status: err.httpStatus }
      );
    }
    const safeMsg = sanitizeErrorForLog(err?.message || err);
    log('Webhook Error: ' + safeMsg);
    return NextResponse.json({ success: false, persisted: false, error: 'INTERNAL_SERVER_ERROR', message: safeMsg, debugLogs }, { status: 500 });
  }
}
