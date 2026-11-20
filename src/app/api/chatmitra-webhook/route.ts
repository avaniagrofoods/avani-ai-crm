import { waitUntil } from '@vercel/functions';
import { NextResponse } from 'next/server';
import {
  verifyChatMitraSignature,
  classifyLoanCategory,
  validateChatMitraInboundPayload
} from '@/lib/chatmitra';
import {
  CrmSheetsService,
  SheetsCrmError,
  webhookEventRepository
} from '@/lib/google-sheets';

/**
 * GET Handler: Webhook Verification Handshake
 * Used by ChatMitra, Meta WABA, and webhook test tools to verify ownership.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token') || searchParams.get('verify_token') || searchParams.get('token');
  const challenge = searchParams.get('hub.challenge') || searchParams.get('challenge');

  const configuredToken = process.env.CHATMITRA_VERIFY_TOKEN ||
                          process.env.CHATMANTRA_VERIFY_TOKEN ||
                          process.env.OMNIDIM_VERIFY_TOKEN ||
                          process.env.META_WEBHOOK_VERIFY_TOKEN ||
                          '';

  if (mode === 'subscribe' || token) {
    if (token && configuredToken && token === configuredToken) {
      console.log('[ChatMitra Webhook] Verification Handshake Accepted');
      return new NextResponse(challenge || 'VERIFIED', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }

  return new NextResponse('Forbidden', { status: 403 });
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

    // 3. Strict Payload Validation Guard
    const validation = validateChatMitraInboundPayload(body);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    // 4. Google Sheets Connectivity & Fail-Closed Guard (Zero MongoDB Fallback)
    await CrmSheetsService.assertHealthy();

    const eventName = validation.eventName || 'message.received';
    const correlationId = `CM-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // 5. Handle Status Updates (sent, delivered, read, failed)
    if (
      eventName === 'message.status.updated' ||
      eventName === 'message.sent' ||
      eventName === 'message.delivered' ||
      eventName === 'message.read' ||
      eventName === 'message.failed'
    ) {
      const msgId = validation.msgId!;
      const statusStr = body.status || eventName.replace('message.', '');
      const eventId = `CM_STATUS_${msgId}_${statusStr.toUpperCase()}`;

      const reg = await webhookEventRepository.registerWebhookEventIdempotent({
        event_id: eventId,
        provider: 'ChatMitra',
        event_type: 'STATUS_UPDATE',
        rawPayloadForHashOnly: body
      });

      if (reg.duplicate) {
        console.log(`[ChatMitra Webhook] Duplicate status event swallowed: ${eventId}`);
        return NextResponse.json({ success: true, duplicate: true, eventId });
      }

      const workerUrl = new URL(request.url.replace('chatmitra-webhook', 'whatsapp-webhook-worker'));
      const workerSecret = process.env.INTERNAL_WORKER_SECRET?.trim() || '';

      waitUntil(
        fetch(workerUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-worker-auth': workerSecret },
          body: JSON.stringify({
            eventId,
            eventType: 'STATUS_UPDATE',
            data: { msgId, statusStr, statusObj: { status: statusStr, errors: body.errors } },
            correlationId,
            provider: 'ChatMitra'
          })
        }).catch((e) => console.warn(`[ChatMitra Webhook] Worker dispatch err: ${e.message}`))
      );

      return NextResponse.json({ success: true, event: eventName, correlationId });
    }

    // 6. Handle Inbound Messages
    if (eventName === 'message.received' || body.messages || body.text || body.message) {
      const fromPhone = validation.fromPhone!;
      const msgId = validation.msgId!;
      const profileName = validation.profileName || 'Customer';
      const messageText = validation.text || '';
      const eventId = `CM_INBOUND_${msgId}`;

      const loanClassification = classifyLoanCategory(messageText);

      const reg = await webhookEventRepository.registerWebhookEventIdempotent({
        event_id: eventId,
        provider: 'ChatMitra',
        event_type: 'INBOUND_MESSAGE',
        rawPayloadForHashOnly: body
      });

      if (reg.duplicate) {
        console.log(`[ChatMitra Webhook] Duplicate inbound event swallowed: ${eventId}`);
        return NextResponse.json({ success: true, duplicate: true, eventId });
      }

      const workerUrl = new URL(request.url.replace('chatmitra-webhook', 'whatsapp-webhook-worker'));
      const workerSecret = process.env.INTERNAL_WORKER_SECRET?.trim() || '';

      waitUntil(
        fetch(workerUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-worker-auth': workerSecret },
          body: JSON.stringify({
            eventId,
            eventType: 'INBOUND_MESSAGE',
            data: {
              message: {
                type: body.type === 'document' || body.type === 'image' || body.type === 'audio' || body.type === 'video'
                  ? body.type
                  : 'text',
                text: { body: messageText },
                id: msgId
              },
              fromPhone,
              msgId,
              profileName,
              loanClassification
            },
            correlationId,
            provider: 'ChatMitra'
          })
        }).catch((e) => console.warn(`[ChatMitra Webhook] Worker dispatch err: ${e.message}`))
      );

      return NextResponse.json({
        success: true,
        event: 'message.received',
        messageId: msgId,
        correlationId,
        loanCategory: loanClassification.category
      });
    }

    return NextResponse.json({ success: false, error: `Unsupported event type: ${eventName}` }, { status: 400 });
  } catch (err: any) {
    if (err instanceof SheetsCrmError) {
      return NextResponse.json(
        { success: false, error: err.code, message: err.message },
        { status: err.httpStatus }
      );
    }
    console.error('[ChatMitra Webhook] Fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
