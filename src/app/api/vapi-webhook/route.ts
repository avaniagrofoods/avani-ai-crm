import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';
import { OptOutEngine } from '@/lib/optout-engine';
import { logToGoogleSheets, syncToHubSpot, triggerMakeWebhook, triggerPabblyWebhook, sendWhatsAppChecklist, sendMissedCallWhatsApp, syncToZapier } from '@/lib/integrations';
import { logCallToPostgres } from '@/lib/postgres';
import axios from 'axios';
import { verifySharedWebhookSecret } from '@/lib/auth';
import { maskPhoneForLog } from '@/lib/safeguards';

export async function POST(request: Request) {
  const webhookAuth = verifySharedWebhookSecret(
    request,
    ['VAPI_WEBHOOK_SECRET', 'INTERNAL_WORKER_SECRET'],
    ['x-vapi-secret', 'x-webhook-secret']
  );
  if (!webhookAuth.ok) return webhookAuth.response;
  try {
    const body = await request.json();

    // VAPI sends events in body.message
    if (!body.message || body.message.type !== 'end-of-call-report') {
      return NextResponse.json({ success: true, note: "Ignored non end-of-call event" });
    }

    const { call, analysis } = body.message;
    const callId = call?.id;
    const summary = analysis?.summary || call?.summary || '';
    const duration = call?.duration || 0;

    // Check structured data from the call analysis
    const isInterested = analysis?.structuredData?.qualification_status === 'qualified' || analysis?.structuredData?.isInterested || false;
    let requestedAmount = analysis?.structuredData?.loanAmount || analysis?.structuredData?.loan_amount || '';

    // Extract fallback lead info from Vapi payload
    const fallbackName = analysis?.structuredData?.customer_name || body.message.artifact?.variableValues?.name || call?.customer?.name || 'Customer';
    const fallbackPhone = call?.customer?.number || body.message.artifact?.variableValues?.customer?.number || '';
    const fallbackLoanType = analysis?.structuredData?.loan_type || body.message.artifact?.variableValues?.loanType || 'Personal Loan';

    let lead: any = null;
    let dbConnected = false;
    let isOptedOut = false;

    try {
      await connectToDatabase();
      dbConnected = true;
      if (callId) {
        lead = await Lead.findOne({ callId });
      }
      const lookupPhone = lead?.phone || fallbackPhone;
      if (lookupPhone) {
        const { raw10, variants: phoneVariants } = OptOutEngine.getPhoneVariants(lookupPhone);
        if (!lead) {
          lead = await Lead.findOne({
            $or: [
              { phone: { $in: phoneVariants } },
              ...(raw10.length === 10 ? [{ normalizedMobile: raw10 }] : [])
            ]
          });
        }
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
        const optedOutContact = await Contact.findOne({ phone: { $in: phoneVariants }, optedIn: false }).lean();
        if (optedOutLead || optedOutContact) {
          isOptedOut = true;
        }
      }
    } catch (dbErr) {
      console.warn("MongoDB unavailable. Falling back to Vapi payload data.");
    }

    if (!lead) {
      console.warn("Lead not found in DB or DB failed. Constructing from payload.");
      if (!fallbackPhone) {
        return NextResponse.json({ success: true, note: "No phone number available to process" });
      }
      lead = {
        name: fallbackName,
        phone: fallbackPhone,
        loanType: fallbackLoanType,
        callSummary: summary,
        callDuration: duration.toString(),
        requestedAmount: requestedAmount,
        status: 'Unknown',
        save: async () => {}
      };
    } else {
      if (lead.isOptedOut || lead.status === 'OPTED_OUT' || lead.consentStatus === 'DENIED' || lead.consentStatus === 'WITHDRAWN') {
        isOptedOut = true;
      }
      lead.callSummary = summary;
      lead.callDuration = duration.toString();
      if (!lead.requestedAmount && requestedAmount) {
        lead.requestedAmount = requestedAmount;
      } else if (lead.requestedAmount) {
        requestedAmount = lead.requestedAmount;
      }
    }

    if (isOptedOut) {
      console.log(`[Vapi Webhook] Recipient ${maskPhoneForLog(lead.phone)} is opted out. Skipping status overwrite and post-call WhatsApp.`);
      return NextResponse.json({ success: true, optedOutSuppressed: true, leadId: lead._id || 'fallback-id' });
    }

    // Always log call to Postgres (Supabase)
    try {
      if (callId) {
        const start = new Date(Date.now() - Number(duration) * 1000);
        await logCallToPostgres(callId, lead.phone, start, new Date(), summary || "Call finished. No transcript available yet.");
      }
    } catch (pgErr: any) {
      console.error("Postgres logging failed:", pgErr.message);
    }

    // Check if the call was missed/unanswered
    const endedReason = call?.endedReason || '';
    const isMissedCall = ['customer-did-not-answer', 'customer-busy', 'voicemail', 'failed', 'silence', 'customer-ended-call', 'hangup', 'silence-timed-out'].includes(endedReason.toLowerCase()) || endedReason.toLowerCase().includes('error') || endedReason.toLowerCase().includes('failed') || endedReason.toLowerCase().includes('silence');

    const loanAgentsUrl = process.env.LOAN_AGENTS_URL || 'https://avani-loan-agents.vercel.app';

    if (isMissedCall) {
      lead.status = 'Missed Call';

      // Forward to AVANI LOAN AGENTS for WhatsApp Fallback (only in live mode)
      if (process.env.PROVIDER_MODE === 'live') {
        try {
          await axios.post(`${loanAgentsUrl}/api/incoming-lead`, {
            name: lead.name,
            phone: lead.phone,
            loanType: lead.loanType,
            requestedAmount: lead.requestedAmount,
            callSummary: summary,
            event_type: 'missed_call'
          });
          console.log("Pushed Missed Call event to AVANI LOAN AGENTS");
        } catch (err: any) {
          console.error("Failed to push missed call event:", err.message);
        }
      }

      // Send WhatsApp message from 7249108474
      await sendMissedCallWhatsApp(lead.phone, lead.name);
    } else if (isInterested || analysis?.structuredData?.next_action === 'human_callback') {
      lead.status = 'Documents Requested';

      // Trigger Integrations
      await Promise.allSettled([
        logToGoogleSheets(lead),
        syncToHubSpot(lead),
        triggerMakeWebhook(lead),
        triggerPabblyWebhook(lead),
        syncToZapier(lead)
      ]);

      // Send data to main AVANI LOAN AGENTS dashboard (only in live mode)
      if (process.env.PROVIDER_MODE === 'live') {
        try {
          await axios.post(`${loanAgentsUrl}/api/incoming-lead`, {
            name: lead.name,
            phone: lead.phone,
            loanType: lead.loanType,
            requestedAmount: lead.requestedAmount,
            callSummary: summary,
            event_type: 'interested_lead'
          });
          console.log("Successfully pushed lead to AVANI LOAN AGENTS dashboard");
        } catch (err: any) {
          console.error("Failed to push lead to dashboard:", err.message);
        }
      }

      // Keep legacy WhatsApp logic just in case
      await sendWhatsAppChecklist(lead.phone, lead.name, lead.loanType);
    } else {
      lead.status = 'Not Interested';
    }

    if (dbConnected && typeof lead.save === 'function' && lead.constructor.modelName === 'Lead') {
      await lead.save();
    }

    return NextResponse.json({ success: true, leadId: lead._id || 'fallback-id' });
  } catch (error: any) {
    console.error("VAPI Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
