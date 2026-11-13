import { NextResponse } from 'next/server';
import crypto from 'crypto';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';
import { WebhookInbox } from '@/models/WebhookInbox';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import { defaultVoiceService } from '@/lib/voice-provider';
import { isLeadOrContactOptedOut, evaluateWebhookReplyPolicy, maskPhoneForLog } from '@/lib/safeguards';
import axios from 'axios';

export const dynamic = 'force-dynamic';

function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  if (!/^[a-fA-F0-9]{64}$/.test(aHex) || !/^[a-fA-F0-9]{64}$/.test(bHex)) {
    return false;
  }
  const aBuf = Buffer.from(aHex.toLowerCase(), 'hex');
  const bBuf = Buffer.from(bHex.toLowerCase(), 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string | undefined
): { ok: true } | { ok: false; status: number; error: string } {
  const secret = appSecret?.trim();
  if (!secret) {
    return { ok: false, status: 401, error: 'META_APP_SECRET is not configured' };
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return { ok: false, status: 401, error: 'Missing or malformed X-Hub-Signature-256 header' };
  }
  const providedHex = signatureHeader.slice('sha256='.length).trim();
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

  if (!timingSafeHexEqual(expectedHex, providedHex)) {
    return { ok: false, status: 401, error: 'Invalid X-Hub-Signature-256 signature' };
  }
  return { ok: true };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = (process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.OMNIDIM_VERIFY_TOKEN || '').trim();
  if (!verifyToken) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (mode === 'subscribe' && token && challenge) {
    const aBuf = Buffer.from(token, 'utf8');
    const bBuf = Buffer.from(verifyToken, 'utf8');
    if (aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf)) {
      return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
  }

  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to read request body' }, { status: 400 });
  }

  const sigCheck = verifyMetaWebhookSignature(
    rawBody,
    request.headers.get('x-hub-signature-256'),
    process.env.META_APP_SECRET
  );
  if (!sigCheck.ok) {
    console.warn(`[MetaWebhook Security] Rejected POST: ${sigCheck.error}`);
    return NextResponse.json({ success: false, error: sigCheck.error }, { status: sigCheck.status });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json({ success: false, error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }

    const bodyDigest = crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex').slice(0, 24);
    const firstLeadgenId = body?.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
    const eventId = firstLeadgenId ? `META_LEADGEN_${firstLeadgenId}` : `META_EVT_${bodyDigest}`;

    let inboxDoc: any = null;
    try {
      inboxDoc = await WebhookInbox.create({
        eventId,
        provider: 'Meta_LeadAds',
        eventType: 'LEADGEN_EVENT',
        payload: body,
        status: 'PROCESSING',
        attemptCount: 1,
        receivedAt: new Date()
      });
    } catch (dupErr: any) {
      if (dupErr?.code === 11000) {
        await WebhookInbox.updateOne({ eventId }, { $inc: { attemptCount: 1 } }).catch(() => {});
        return NextResponse.json({ success: true, duplicate: true, eventId });
      }
      throw dupErr;
    }

    const entries = Array.isArray(body?.entry) ? body.entry : [];
    let processedLeadCount = 0;

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change?.field !== 'leadgen') continue;

        const leadgenId = change.value?.leadgen_id;
        const formId = change.value?.form_id;
        const adId = change.value?.ad_id;

        let leadName = 'Meta Lead';
        let leadPhone = change.value?.phone_number || '';
        let loanType = change.value?.loan_type || 'Personal Loan';
        let email = '';

        const graphToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN;
        if (process.env.PROVIDER_MODE === 'live' && graphToken && leadgenId) {
          try {
            const metaRes = await axios.get(`https://graph.facebook.com/v19.0/${leadgenId}`, {
              headers: { Authorization: `Bearer ${graphToken}` }
            });
            const fieldData = metaRes.data?.field_data || [];
            for (const field of fieldData) {
              const fname = String(field.name || '').toLowerCase();
              const val = String(field.values?.[0] || '');
              if (fname.includes('full_name') || fname.includes('name')) leadName = val || leadName;
              if (fname.includes('phone') || fname.includes('mobile')) leadPhone = val || leadPhone;
              if (fname.includes('email')) email = val || email;
              if (fname.includes('loan') || fname.includes('service')) loanType = val || loanType;
            }
          } catch {
            // Graph lookup non-fatal when test/webhook payload includes inline fields
          }
        }

        const formattedPhone = String(leadPhone || '').replace(/[^0-9]/g, '');
        if (formattedPhone.length < 10) {
          continue;
        }
        const raw10 = formattedPhone.slice(-10);
        const normalizedPhone = `+91${raw10}`;

        const lt = loanType.toLowerCase();
        let templateName = 'Avani_Loan_Welcome';
        let canonicalLoanType = 'Personal Loan';
        if (lt.includes('doctor')) { templateName = 'doctor_loan_offer'; canonicalLoanType = 'Doctor Loan'; }
        else if (lt.includes('business')) { templateName = 'business_loan_welcome'; canonicalLoanType = 'Business Loan'; }
        else if (lt.includes('home')) { templateName = 'home_loan_welcome'; canonicalLoanType = 'Home Loan'; }
        else if (lt.includes('mortgage') || lt.includes('property') || lt.includes('lap')) { templateName = 'mortgage_loan_welcome'; canonicalLoanType = 'Mortgage Loan'; }
        else if (lt.includes('global') || lt.includes('abroad')) { templateName = 'education_loan_global_welcome'; canonicalLoanType = 'Education Loan (Global)'; }
        else if (lt.includes('education') || lt.includes('student')) { templateName = 'education_loan_india_welcome'; canonicalLoanType = 'Education Loan (India)'; }
        else if (lt.includes('school')) { templateName = 'school_funding_welcome'; canonicalLoanType = 'School Funding'; }
        else if (lt.includes('college') || lt.includes('institution')) { templateName = 'college_funding_welcome'; canonicalLoanType = 'College Funding'; }

        const sourceTag = formId
          ? (change.value?.platform === 'instagram' ? 'INSTAGRAM_LEAD_FORM' : 'FACEBOOK_LEAD_FORM')
          : 'FACEBOOK_LEAD_FORM';

        const leadRecord = await Lead.findOneAndUpdate(
          { $or: [{ phone: normalizedPhone }, { normalizedMobile: raw10 }] },
          {
            $set: {
              name: leadName,
              phone: normalizedPhone,
              normalizedMobile: raw10,
              email: email || 'enquiry@avanifinserv.com',
              loanType: canonicalLoanType,
              metaLeadId: leadgenId,
              ad: adId,
              adSet: change.value?.adset_id,
              campaign: change.value?.campaign_id,
              lastInteractionAt: new Date(),
              lastContactAt: new Date()
            },
            $setOnInsert: {
              leadId: `AVL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
              source: sourceTag,
              leadSource: 'Meta Lead Ads',
              stage: 'NEW_ENQUIRY',
              status: 'New',
              correlationId: `META-LEAD-${Date.now()}`,
              createdAt: new Date()
            }
          },
          { upsert: true, new: true }
        );
        processedLeadCount++;

        const contactRecord = await Contact.findOne({
          $or: [{ phone: normalizedPhone }, { phone: raw10 }, { phone: `91${raw10}` }]
        }).lean();

        const isOptedOut = isLeadOrContactOptedOut(leadRecord, contactRecord);
        const replyPolicy = evaluateWebhookReplyPolicy({
          eventId,
          provider: 'META',
          payload: body,
          inboxRecord: inboxDoc
        });

        if (isOptedOut || !replyPolicy.canSendAnyProviderMessage || !replyPolicy.canTriggerAutoReply) {
          console.log(`[MetaWebhook] Outbound welcome/voice suppressed for ${maskPhoneForLog(normalizedPhone)} (optedOut=${isOptedOut}, reason=${replyPolicy.suppressionReason})`);
        } else if (process.env.PROVIDER_MODE === 'live') {
          try {
            const aiSensyRes = await sendAiSensyWhatsApp({
              destination: normalizedPhone,
              userName: leadName,
              templateName,
              templateParams: [leadName, canonicalLoanType],
              tags: [canonicalLoanType.replace(/\s+/g, '_').toUpperCase(), sourceTag]
            }, `META_WEBHOOK_${eventId}_${raw10}`);

            if (aiSensyRes.success && leadRecord) {
              await Lead.findByIdAndUpdate(leadRecord._id, {
                $set: {
                  aiSensyMessageId: aiSensyRes.messageId,
                  whatsappMessageId: aiSensyRes.messageId,
                  lastContactAt: new Date()
                }
              });
            }
          } catch (waErr: any) {
            console.error('[MetaWebhook] Welcome dispatch warning:', waErr?.message);
          }

          if (process.env.OMNIDM_LIVE_ENABLED === 'true') {
            try {
              await defaultVoiceService.dispatchCall({
                phoneNumber: normalizedPhone,
                customerName: leadName,
                loanType: canonicalLoanType,
                language: 'hi',
                isOptedOut: false
              });
            } catch (voiceErr: any) {
              console.error('[MetaWebhook] OmniDM warning:', voiceErr?.message);
            }
          }
        }
      }
    }

    if (inboxDoc) {
      await WebhookInbox.updateOne(
        { _id: inboxDoc._id },
        { $set: { status: 'COMPLETED', processedAt: new Date() } }
      );
    }

    return NextResponse.json({ success: true, eventId, processedLeadCount });
  } catch (error: any) {
    console.error('[MetaWebhook] Processing Error:', error?.message);
    return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
