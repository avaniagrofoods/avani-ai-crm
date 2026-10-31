import { waitUntil } from '@vercel/functions';
import { NextResponse } from 'next/server';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import { verifyChatMitraSignature } from '@/lib/chatmitra';
import { normalizeIndianPhone } from '@/lib/phone';
import connectToDatabase from '@/lib/db';
import { WebhookInbox } from '@/models/WebhookInbox';
import mongoose from 'mongoose';

// AI Logic moved to whatsapp-webhook-worker/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.OMNIDIM_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "avani_secure_token";

  if (mode === "subscribe" && (token === VERIFY_TOKEN || token === "avani_secure_token" || challenge)) {
    console.log("Meta / AiSensy Webhook Verified!");
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const debugLogs: string[] = [];
  const log = (msg: string) => { console.log(msg); debugLogs.push(msg); };

  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('x-webhook-signature') || request.headers.get('x-hub-signature-256');
    const chatmitraSecret = process.env.CHATMITRA_WEBHOOK_SECRET || process.env.CHATMITRA_SECRET;

    // ChatMitra Webhook Signature Verification
    if (signatureHeader && chatmitraSecret) {
      const isValid = verifyChatMitraSignature(rawBody, signatureHeader, chatmitraSecret);
      if (!isValid) {
        log('[ChatMitra Security] Invalid Webhook Signature');
        return NextResponse.json({ success: false, error: 'Invalid Webhook Signature' }, { status: 401 });
      }
      log('[ChatMitra Security] Signature verified successfully');
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }
    log("Received Webhook Payload: " + JSON.stringify(body).substring(0, 300));

    // Support ChatMitra Official Webhook Events
    if (body.event && (body.event.startsWith('message.') || body.event === 'message.received' || body.event === 'message.status.updated' || body.event === 'message.sent')) {
      await connectToDatabase();
      if (mongoose.connection.readyState !== 1) {
        log('[Webhook Fatal Error] DB unreachable. Returning 500 for retry.');
        return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 500 });
      }

      if (body.event === 'message.status.updated' || body.event === 'message.sent') {
        const msgId = body.messageId || body.id;
        const statusStr = body.status || (body.event === 'message.sent' ? 'sent' : 'unknown');
        if (msgId && statusStr) {
          const eventId = `CM_STATUS_${msgId}_${statusStr.toUpperCase()}`;
          const correlationId = `CM-${Date.now()}-${Math.random().toString(36).substring(7)}`;

          try {
            await WebhookInbox.create({
              eventId,
              provider: 'ChatMitra',
              eventType: 'STATUS_UPDATE',
              payload: body,
              correlationId,
              status: 'RECEIVED'
            });

            const workerUrl = new URL(request.url.replace('whatsapp-webhook', 'whatsapp-webhook-worker'));
            const workerSecret = process.env.INTERNAL_WORKER_SECRET || 'dev_secret_only';

            waitUntil(
              fetch(workerUrl.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-worker-auth': workerSecret },
                body: JSON.stringify({ eventId, eventType: 'STATUS_UPDATE', data: { msgId, statusStr, statusObj: body }, correlationId, provider: 'ChatMitra' })
              }).catch(e => log(`Worker dispatch err: ${e.message}`))
            );
          } catch (e: any) {
            if (e.code === 11000) {
              log(`[Webhook Deduplication] Duplicate ChatMitra event swallowed: ${eventId}`);
            } else {
              return NextResponse.json({ success: false, error: 'Event persistence failed' }, { status: 500 });
            }
          }
        }
        return NextResponse.json({ success: true, event: body.event });
      }

      if (body.event === 'message.received') {
        const rawFrom = body.from || body.recipient_mobile_number || body.phoneNumber || body.phone;
        const fromPhone = normalizeIndianPhone(rawFrom || '');
        if (fromPhone) {
          const msgId = body.id || body.messageId || `cm_inbound_${Date.now()}`;
          const profileName = body.profile?.name || body.name || 'Customer';
          const eventId = `CM_INBOUND_${msgId}`;
          const correlationId = `CM-${Date.now()}-${Math.random().toString(36).substring(7)}`;

          try {
            await WebhookInbox.create({
              eventId,
              provider: 'ChatMitra',
              eventType: 'INBOUND_MESSAGE',
              payload: body,
              correlationId,
              status: 'RECEIVED'
            });

            const workerUrl = new URL(request.url.replace('whatsapp-webhook', 'whatsapp-webhook-worker'));
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
                      text: { body: body.text || body.message || '' },
                      id: msgId
                    },
                    fromPhone,
                    msgId,
                    profileName
                  },
                  correlationId,
                  provider: 'ChatMitra'
                })
              }).catch(e => log(`Worker dispatch err: ${e.message}`))
            );
          } catch (e: any) {
            if (e.code === 11000) {
              log(`[Webhook Deduplication] Duplicate ChatMitra event swallowed: ${eventId}`);
            } else {
              return NextResponse.json({ success: false, error: 'Event persistence failed' }, { status: 500 });
            }
          }
        }
        return NextResponse.json({ success: true, event: body.event });
      }
    }

    // Support internal dispatch event from Broadcast UI (Ensure we don't accidentally intercept inbound webhooks that happen to have a 'phone' field)
    if (body.event === 'send_template' || (body.phone && !body.message && !body.text && !body.entry && !body.type && !body.interactive)) {
      const targetPhone = body.phone || body.destination;
      const targetName = body.name || body.userName || 'Valued Customer';
      const templateName = body.template || body.templateName || 'Avani_Loan_Welcome';

      const correlationId = `CRM-BRD-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const workerUrl = new URL(request.url.replace('whatsapp-webhook', 'whatsapp-webhook-worker'));
      const workerSecret = process.env.INTERNAL_WORKER_SECRET || 'dev_secret_only';

      // Trigger background worker securely via waitUntil
      waitUntil(
        fetch(workerUrl.toString(), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-worker-auth': workerSecret
          },
          body: JSON.stringify({
            eventId: `DIRECT_${correlationId}`,
            eventType: 'DIRECT_DISPATCH',
            data: { targetPhone, targetName, templateName, correlationId }
          })
        }).catch(e => log(`Worker dispatch err: ${e.message}`))
      );

      return NextResponse.json({ success: true, debugLogs, correlationId }, { status: 200 });
    }

    // Process Meta / AiSensy Inbound Webhook
    if (body.object === 'whatsapp_business_account' || body.entry || body.destination || body.text || (body.phone && !body.event)) {
      const entries = body.entry || [body];
      for (const entry of entries) {
        const changes = entry?.changes || [entry];
        for (const change of changes) {
          const value = change?.value || change;

          // 1. Handle Status Updates (Delivery Receipts)
          const statuses = value?.statuses || (body.status ? [body] : []);
          if (statuses.length > 0) {
            await connectToDatabase();
            if (mongoose.connection.readyState !== 1) {
              log(`[Webhook Fatal Error] DB unreachable. Returning 500 so Meta retries the delivery receipt.`);
              return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 500 });
            }

            for (const statusObj of statuses) {
              const msgId = statusObj.id || statusObj.messageId;
              const statusStr = statusObj.status || statusObj.deliveryStatus;
              
              if (msgId && statusStr) {
                // Event Identity: Message ID + specific status transition
                const eventId = `META_STATUS_${msgId}_${statusStr.toUpperCase()}`;
                const correlationId = `META-${Date.now()}-${Math.random().toString(36).substring(7)}`;

                try {
                  await WebhookInbox.create({
                    eventId: eventId,
                    provider: 'Meta',
                    eventType: 'STATUS_UPDATE',
                    payload: statusObj,
                    correlationId: correlationId,
                    status: 'RECEIVED'
                  });
                  log(`[Webhook Inbox] Recorded STATUS_UPDATE: ${eventId}`);
                  
                  const workerUrl = new URL(request.url.replace('whatsapp-webhook', 'whatsapp-webhook-worker'));
                  const workerSecret = process.env.INTERNAL_WORKER_SECRET || 'dev_secret_only';

                  waitUntil(
                    fetch(workerUrl.toString(), {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'x-worker-auth': workerSecret 
                      },
                      body: JSON.stringify({ eventId, eventType: 'STATUS_UPDATE', data: { msgId, statusStr, statusObj }, correlationId })
                    }).catch(e => log(`Worker dispatch err: ${e.message}`))
                  );
                  
                } catch (e: any) {
                  if (e.code === 11000) {
                    log(`[Webhook Deduplication] Duplicate event swallowed: ${eventId}`);
                  } else {
                    log(`[Webhook Inbox Error] Failed to persist event ${eventId}: ${e.message}`);
                    return NextResponse.json({ success: false, error: 'Event persistence failed' }, { status: 500 });
                  }
                }
              }
            }
            continue;
          }

          let messages = value?.messages || (body.message ? [body.message] : []);
          if (messages.length === 0 && (body.text || body.type || body.button || body.interactive || typeof body === 'string')) {
            messages = [body];
          }

          for (const message of messages) {
            const rawFromPhone = message.from || body.destination || body.phone;
            if (!rawFromPhone) continue;
            const fromPhone = normalizeIndianPhone(rawFromPhone);
            if (!fromPhone) continue;

            const msgId = message.id || 'inbound_' + Date.now() + '_' + Math.random().toString(36).substring(7);
            const profileName = message.profile?.name || 'Customer';

            // Event Identity: Unique to the inbound message ID
            const eventId = `META_INBOUND_${msgId}`;
            const correlationId = `META-${Date.now()}-${Math.random().toString(36).substring(7)}`;

            await connectToDatabase();
            if (mongoose.connection.readyState !== 1) {
              log(`[Webhook Fatal Error] DB unreachable. Returning 500 so Meta retries the inbound message.`);
              return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 500 });
            }

            try {
              await WebhookInbox.create({
                eventId: eventId,
                provider: 'Meta',
                eventType: 'INBOUND_MESSAGE',
                payload: message,
                correlationId: correlationId,
                status: 'RECEIVED'
              });
              log(`[Webhook Inbox] Recorded INBOUND_MESSAGE: ${eventId}`);
              
              const workerUrl = new URL(request.url.replace('whatsapp-webhook', 'whatsapp-webhook-worker'));
              const workerSecret = process.env.INTERNAL_WORKER_SECRET || 'dev_secret_only';

              waitUntil(
                fetch(workerUrl.toString(), {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'x-worker-auth': workerSecret
                  },
                  body: JSON.stringify({ eventId, eventType: 'INBOUND_MESSAGE', data: { message, fromPhone, msgId, profileName }, correlationId })
                }).catch(e => log(`Worker dispatch err: ${e.message}`))
              );
              
            } catch (e: any) {
              if (e.code === 11000) {
                log(`[Webhook Deduplication] Duplicate event swallowed: ${eventId}`);
              } else {
                log(`[Webhook Inbox Error] Failed to persist event ${eventId}: ${e.message}`);
                return NextResponse.json({ success: false, error: 'Event persistence failed' }, { status: 500 });
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, debugLogs });
  } catch (err: any) {
    log("Webhook Error: " + err?.message);
    return NextResponse.json({ success: false, error: err?.message, debugLogs }, { status: 500 });
  }
}
