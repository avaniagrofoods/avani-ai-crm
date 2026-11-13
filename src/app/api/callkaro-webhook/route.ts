import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';
import { OptOutEngine } from '@/lib/optout-engine';
import { verifySharedWebhookSecret } from '@/lib/auth';
import { evaluateAuthorizedTestRecipient, maskPhoneForLog } from '@/lib/safeguards';

export async function POST(request: Request) {
  const webhookAuth = verifySharedWebhookSecret(
    request,
    ['CALLKARO_WEBHOOK_SECRET', 'INTERNAL_WORKER_SECRET'],
    ['x-callkaro-secret', 'x-webhook-secret']
  );
  if (!webhookAuth.ok) return webhookAuth.response;

  try {
    const body = await request.json();
    console.log("Received CallKaro AI Webhook:", JSON.stringify({ call_id: body?.call_id, status: body?.status, phoneMasked: maskPhoneForLog(body?.phone_number || body?.to || body?.phone) }));

    const { call_id, phone_number, customer_name, transcript, status, duration, call_analysis } = body;

    let phone = phone_number || body.to || body.phone;
    if (phone && !phone.startsWith('+')) {
      phone = phone.length === 10 ? '+91' + phone : '+' + phone;
    }

    try {
      await connectToDatabase();
      if (phone) {
        const { raw10, variants: phoneVariants } = OptOutEngine.getPhoneVariants(phone);
        const optedOutLead = await Lead.findOne({
          $or: [
            { phone: { $in: phoneVariants } },
            ...(raw10.length === 10 ? [{ normalizedMobile: raw10 }] : [])
          ],
          $and: [
            {
              $or: [
                { isOptedOut: true },
                { status: 'OPTED_OUT' },
                { consentStatus: { $in: ['DENIED', 'WITHDRAWN'] } }
              ]
            }
          ]
        }).lean();
        const optedOutContact = await Contact.findOne({
          phone: { $in: phoneVariants },
          optedIn: false
        }).lean();

        if (optedOutLead || optedOutContact) {
          console.log(`[CallKaro Webhook] Recipient ${maskPhoneForLog(phone)} is opted out. Skipping status overwrite and post-call WhatsApp.`);
          return NextResponse.json({ success: true, optedOutSuppressed: true, message: "CallKaro Webhook suppressed (recipient opted out)" });
        }

        if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('localhost')) {
          await Lead.findOneAndUpdate(
            { phone },
            {
              $set: {
                status: status === 'completed' || status === 'COMPLETED' ? 'Called' : 'Engaged',
                callDuration: duration || 0,
                transcript: transcript || '',
                summary: call_analysis?.summary || 'Call completed via CallKaro AI',
                updatedAt: new Date()
              }
            },
            { upsert: true }
          );
        }
      }
    } catch (dbErr) {
      console.warn("DB Update notice in CallKaro Webhook:", dbErr);
    }

    // Trigger Meta / AiSensy WhatsApp Followup Template ONLY when live mode + token configured
    if (phone && (status === 'completed' || status === 'COMPLETED' || !status)) {
      const metaToken = process.env.WHATSAPP_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!metaToken || !phoneId || process.env.PROVIDER_MODE !== 'live') {
        return NextResponse.json({ success: true, message: "CallKaro Webhook processed (live WA disabled)" });
      }
      const recipientCheck = evaluateAuthorizedTestRecipient(phone);
      if (!recipientCheck.allowed) {
        console.error(`[CallKaro Webhook Safety Clamp] Blocked live WA followup to unauthorized recipient: ${recipientCheck.targetMasked}`);
        return NextResponse.json(
          { success: false, error: recipientCheck.error || 'LIVE_DISPATCH_RESTRICTED', message: recipientCheck.message },
          { status: recipientCheck.status }
        );
      }

      const whatsappPayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "avani_loan_intro_v2",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: customer_name || "Valued Customer" }
              ]
            }
          ]
        }
      };

      try {
        await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${metaToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(whatsappPayload)
        });
        console.log(`✅ Sent WhatsApp template follow-up to ${maskPhoneForLog(phone)}`);
      } catch (waErr) {
        console.warn("WhatsApp template post-call error:", waErr);
      }
    }

    return NextResponse.json({ success: true, message: "CallKaro Webhook processed" });
  } catch (err: any) {
    console.error("CallKaro Webhook Error:", err);
    return NextResponse.json({ success: true, message: "Webhook received" });
  }
}

export async function GET() {
  return NextResponse.json({ status: "CallKaro AI Webhook Endpoint Active" });
}
