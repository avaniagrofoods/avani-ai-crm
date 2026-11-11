import { waitUntil } from '@vercel/functions';
import { NextResponse } from 'next/server';
import { 
  verifyChatMantraSignature, 
  classifyLoanCategory,
  validateChatMantraInboundPayload
} from '@/lib/chatmantra';
import connectToDatabase from '@/lib/db';
import { WebhookInbox } from '@/models/WebhookInbox';
import mongoose from 'mongoose';

/**
 * GET Handler: Webhook Verification Handshake
 * Used by ChatMantra, Meta WABA, and webhook test tools to verify ownership.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token') || searchParams.get('verify_token') || searchParams.get('token');
  const challenge = searchParams.get('hub.challenge') || searchParams.get('challenge');

  const configuredToken = process.env.CHATMANTRA_VERIFY_TOKEN || 
                          process.env.CHATMITRA_VERIFY_TOKEN || 
                          process.env.OMNIDIM_VERIFY_TOKEN || 
                          process.env.META_WEBHOOK_VERIFY_TOKEN || 
                          '';

  if (mode === 'subscribe' || token) {
    if (token && configuredToken && token === configuredToken) {
      console.log('[ChatMantra Webhook] Verification Handshake Accepted');
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
 * Strict Security & Safety:
 * - HMAC-SHA256 signature verification against raw request body
 * - Rejects malformed JSON with HTTP 400
 * - Rejects missing messageId or sender with HTTP 400
 * - Fail-closed: Returns HTTP 503 if database is offline (ensuring webhook retry without message loss)
 * - Idempotent deduplication against WebhookInbox
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('x-webhook-signature') || 
                            request.headers.get('x-hub-signature-256') ||
                            request.headers.get('x-signature');
                            
    const secret = process.env.CHATMANTRA_WEBHOOK_SECRET || 
                   process.env.CHATMITRA_WEBHOOK_SECRET || 
                   process.env.CHATMANTRA_SECRET || 
                   process.env.CHATMITRA_SECRET;

    // 1. Signature Verification
    if (signatureHeader && secret) {
      const isValid = verifyChatMantraSignature(rawBody, signatureHeader, secret);
      if (!isValid) {
        console.warn('[ChatMantra Security] Signature verification failed');
        return NextResponse.json({ success: false, error: 'Invalid Webhook Signature' }, { status: 401 });
      }
      console.log('[ChatMantra Security] Signature verified successfully');
    } else if (!signatureHeader && secret) {
      console.warn('[ChatMantra Security] Missing required webhook signature header');
      return NextResponse.json({ success: false, error: 'Missing webhook signature' }, { status: 401 });
    }

    // 2. JSON Parsing & Structure Validation
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    // 3. Strict Payload Validation Guard
    const validation = validateChatMantraInboundPayload(body);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    // 4. Database Connection & Fail-Closed Guard
    await connectToDatabase();
    if (mongoose.connection.readyState !== 1) {
      console.warn('[ChatMantra Webhook] Database unreachable. Returning HTTP 503 for retry.');
      return NextResponse.json(
        { success: false, error: 'Database unavailable: retry scheduled' }, 
        { status: 503 }
      );
    }

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

      try {
        await WebhookInbox.create({
          eventId,
          provider: 'ChatMantra',
          eventType: 'STATUS_UPDATE',
          payload: body,
          correlationId,
          status: 'RECEIVED'
        });

        const workerUrl = new URL(request.url.replace('chatmantra-webhook', 'whatsapp-webhook-worker'));
        const workerSecret = process.env.INTERNAL_WORKER_SECRET || 'dev_secret_only';

        waitUntil(
          fetch(workerUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-worker-auth': workerSecret },
            body: JSON.stringify({ 
              eventId, 
              eventType: 'STATUS_UPDATE', 
              data: { msgId, statusStr, statusObj: body }, 
              correlationId, 
              provider: 'ChatMantra' 
            })
          }).catch(e => console.warn(`[ChatMantra Webhook] Worker dispatch err: ${e.message}`))
        );
      } catch (e: any) {
        if (e.code === 11000) {
          console.log(`[ChatMantra Webhook] Duplicate status event swallowed: ${eventId}`);
          return NextResponse.json({ success: true, duplicate: true, eventId });
        }
        return NextResponse.json({ success: false, error: 'Event persistence failed' }, { status: 500 });
      }

      return NextResponse.json({ success: true, event: eventName, correlationId });
    }

    // 6. Handle Inbound Messages
    if (eventName === 'message.received' || body.messages || body.text || body.message) {
      const fromPhone = validation.fromPhone!;
      const msgId = validation.msgId!;
      const profileName = validation.profileName || 'Customer';
      const messageText = validation.text || '';
      const eventId = `CM_INBOUND_${msgId}`;

      // Classify Loan Product Interest from inbound text
      const loanClassification = classifyLoanCategory(messageText);

      try {
        await WebhookInbox.create({
          eventId,
          provider: 'ChatMantra',
          eventType: 'INBOUND_MESSAGE',
          payload: {
            ...body,
            loanClassification
          },
          correlationId,
          status: 'RECEIVED'
        });

        const workerUrl = new URL(request.url.replace('chatmantra-webhook', 'whatsapp-webhook-worker'));
        const workerSecret = process.env.INTERNAL_WORKER_SECRET || 'dev_secret_only';

        waitUntil(
          fetch(workerUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-worker-auth': workerSecret },
            body: JSON.stringify({
              eventId,
              eventType: 'INBOUND_MESSAGE',
              data: {
                message: {
                  type: 'text',
                  text: { body: messageText },
                  id: msgId
                },
                fromPhone,
                msgId,
                profileName,
                loanClassification
              },
              correlationId,
              provider: 'ChatMantra'
            })
          }).catch(e => console.warn(`[ChatMantra Webhook] Worker dispatch err: ${e.message}`))
        );

        return NextResponse.json({ 
          success: true, 
          event: 'message.received',
          messageId: msgId,
          correlationId,
          loanCategory: loanClassification.category
        });
      } catch (e: any) {
        if (e.code === 11000) {
          console.log(`[ChatMantra Webhook] Duplicate inbound event swallowed: ${eventId}`);
          return NextResponse.json({ success: true, duplicate: true, eventId });
        }
        return NextResponse.json({ success: false, error: 'Event persistence failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: false, error: `Unsupported event type: ${eventName}` }, { status: 400 });
  } catch (err: any) {
    console.error('[ChatMantra Webhook] Fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
