import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import mongoose from 'mongoose';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';
import { Call } from '@/models/Call';
import { OptOutEngine } from '@/lib/optout-engine';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import axios from 'axios';
import { validateProductPayload } from '@/lib/validators';
import { sendSlackAlert } from '@/lib/alerts';
import { verifySharedWebhookSecret } from '@/lib/auth';
import { maskPhoneForLog } from '@/lib/safeguards';

export async function processOutgoingZapierPayload(loanType: string, compiledPayload: any, lead: any) {
  if (lead?.isOptedOut || lead?.status === 'OPTED_OUT' || lead?.consentStatus === 'DENIED' || lead?.consentStatus === 'WITHDRAWN') {
    return false;
  }

  const verification = validateProductPayload(loanType, compiledPayload);

  if (!verification.isValid) {
    const userPhone = compiledPayload.mobileNumber || compiledPayload.phone;
    const missingItemsFriendly = verification.missingFields.map(field => {
      if (field.includes('university')) return 'University / College Name';
      if (field.includes('propertyTypeDetails')) return 'Property Document Details (7 Bara NA status)';
      if (field.includes('annualTurnover')) return 'Annual Business Turnover';
      if (field.includes('monthlySalaryBracket')) return 'Monthly Net Salary';
      return field;
    });

    console.warn(`🛑 Zapier Webhook dispatch blocked! Triggering customer fallback request.`);

    await sendSlackAlert(verification.errorMessage || 'Validation Failed', "Outbound Interceptor Guardrail", userPhone);

    if (userPhone && userPhone.length === 10) {
      if (lead) {
        lead.currentWorkflowState = "awaiting_correction";
        lead.pendingCorrectionLog = { targetField: verification.missingFields[0], retryCount: 0 };
        await lead.save();
      }

      const correctiveWhatsAppMessage = `Hi ${compiledPayload.fullName || "Customer"},\n\nThank you for choosing AVANI LOAN SERVICES. \n\nTo finalize your dynamic pre-qualification calculations for a *${loanType}*, our automated processing engine needs a bit more clarification.\n\n👉 *Please reply directly by typing your: ${missingItemsFriendly.join(', ')}*\n\nOnce received, our engine will instantly compile your verified EMI projections and doc checklists. Thank you!\n\n*Avani Finserv - Fast & Secure Approvals*`;

      await sendAiSensyWhatsApp({ destination: userPhone, userName: compiledPayload.fullName || 'Customer', text: correctiveWhatsAppMessage }, `OMNIDM_CORRECTIVE_${Date.now()}_${userPhone}`);
    }

    return false;
  }

  if (process.env.PROVIDER_MODE !== 'live') {
    return false;
  }

  const targetUrl = process.env.ZAPIER_WEBHOOK_URL || process.env.GOOGLE_SHEET_APP_SCRIPT_URL;
  if (targetUrl) {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(compiledPayload)
    });
    return response.ok;
  }
  return false;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.OMNIDIM_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "";

  if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    console.log("✅ OmniDM Webhook Verified!");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const webhookAuth = verifySharedWebhookSecret(
    req,
    ['OMNIDIM_WEBHOOK_SECRET', 'OMNIDIM_VERIFY_TOKEN', 'INTERNAL_WORKER_SECRET'],
    ['x-omnidim-secret', 'x-webhook-secret']
  );
  if (!webhookAuth.ok) return webhookAuth.response;
  try {
    const body = await req.json();
    const callId = body.call_id || body.id || body.requestId;
    const phone = body.to || body.to_number || body.phone_number || body.request_data?.phone;
    console.log("OmniDM AI Webhook Event Received:", JSON.stringify({ callId, status: body.status || body.event, phoneMasked: maskPhoneForLog(phone) }));

    try {
      await connectToDatabase();
    } catch (dbErr) {
      console.warn("DB Connection warning:", dbErr);
    }

    const isCompleted = body.completed || body.status === 'completed' || body.event === 'call_ended';
    const variables = body.variables || body.request_data || {};
    const name = variables.customerName || variables.name || 'Valued Customer';
    const loanType = variables.loanType || 'Personal Loan';
    const notes = body.summary || body.transcript || `OmniDM AI Voice Call event: ${body.status || body.event || 'ended'}`;
    let lead: any = null;
    let isOptedOut = false;

    if (mongoose.connection.readyState === 1) {
      try {
        if (callId) lead = await Lead.findOne({ callId });
        if (!lead && phone) {
          const { raw10, variants: phoneVariants } = OptOutEngine.getPhoneVariants(phone);
          lead = await Lead.findOne({
            $or: [
              { phone: { $in: phoneVariants } },
              ...(raw10.length === 10 ? [{ normalizedMobile: raw10 }] : [])
            ]
          });
          const optedOutContact = await Contact.findOne({ phone: { $in: phoneVariants }, optedIn: false }).lean();
          if (optedOutContact) isOptedOut = true;
        }
      } catch (e) { console.warn("Lead query warning:", e); }

      if (lead && (lead.isOptedOut || lead.status === 'OPTED_OUT' || lead.consentStatus === 'DENIED' || lead.consentStatus === 'WITHDRAWN')) {
        isOptedOut = true;
      }

      const status = isCompleted ? 'Contacted' : 'Follow Up Required';
      if (lead && !isOptedOut) {
        lead.status = status;
        lead.notes = notes;
        try { await lead.save(); } catch (e) {}
      }
    }

    let mappedStatus = isCompleted ? 'CONVERSATION_COMPLETED' : 'FAILED';
    if (body.status === 'no-answer') mappedStatus = 'NO_ANSWER';
    else if (body.status === 'answered') mappedStatus = 'ANSWERED';
    else if (body.status === 'calling') mappedStatus = 'RINGING';
    else if (body.status === 'busy') mappedStatus = 'BUSY';

    const updateData: any = { status: mappedStatus };
    if (body.duration) updateData.duration = body.duration;
    if (body.recording_url) updateData.recordingUrl = body.recording_url;
    if (body.transcript || notes) updateData.transcript = body.transcript || notes;

    if (mappedStatus === 'CONVERSATION_COMPLETED' || mappedStatus === 'NO_ANSWER' || mappedStatus === 'FAILED' || mappedStatus === 'BUSY') {
      updateData.completedAt = new Date();
    }

    if (callId) {
      if (mongoose.connection.readyState === 1) {
        // Idempotency: Check if already processed
        const existingCall = await Call.findOne({ callId });
        if (existingCall && existingCall.status === mappedStatus) {
          console.log(`[OmniDM Webhook] Call ${callId} already processed with status ${mappedStatus}. Skipping duplicate action.`);
          return NextResponse.json({ success: true, message: "Duplicate webhook ignored" });
        }

        updateData.providerCallId = callId;

        await Call.findOneAndUpdate(
          { callId },
          { $set: updateData },
          { new: true, upsert: true }
        );
      } else {
        console.warn(`[Webhook DB Bypass] DB not connected, skipping status update for callId: ${callId}`);
      }
    }

    if (isOptedOut) {
      console.log(`[OmniDM Webhook] Recipient ${maskPhoneForLog(phone)} is opted out. Skipping post-call integrations and WhatsApp follow-up.`);
      return NextResponse.json({ success: true, callId, status: mappedStatus, optedOutSuppressed: true });
    }

    // Capture dynamic variables returned by agent
    const agentCapturedCity = variables.city || variables.City || lead?.city;
    const agentCapturedProfession = variables.profession || variables.Employment || variables.Profession || lead?.profession || lead?.employmentType;
    const agentCapturedIncome = variables.monthlyIncomeRange || variables.Income || lead?.monthlyIncomeRange;
    const agentCapturedAmount = variables.Loan_requirement || variables.loanRequirement || variables.Amount || lead?.requiredLoanAmount;

    // Update Lead with Agent captured data if changed
    if (lead && mongoose.connection.readyState === 1) {
      let leadUpdated = false;
      if (agentCapturedCity && lead.city !== agentCapturedCity) { lead.city = agentCapturedCity; leadUpdated = true; }
      if (agentCapturedProfession && lead.profession !== agentCapturedProfession) { lead.profession = agentCapturedProfession; leadUpdated = true; }
      if (agentCapturedIncome && lead.monthlyIncomeRange !== agentCapturedIncome) { lead.monthlyIncomeRange = agentCapturedIncome; leadUpdated = true; }
      if (agentCapturedAmount && lead.requiredLoanAmount !== agentCapturedAmount) { lead.requiredLoanAmount = agentCapturedAmount; leadUpdated = true; }
      if (leadUpdated) await lead.save();
    }

    const integrationPayload: any = {
      eventId: `evt_${callId}_${mappedStatus}`,
      leadId: lead?.leadId || `LID-${String(phone || '').replace(/[^0-9]/g, '')}`,
      timestamp: new Date().toISOString(),
      sourceSystem: "Avani AI CRM Pipeline",
      campaign: {
        channel: "AI Voice (OmniDM)",
        metaWhatsAppSenderNumber: "7249108474"
      },
      callMetrics: {
        callId: callId,
        callStatus: mappedStatus,
        callDisposition: isCompleted ? "answered_interested" : "unanswered",
      },
      fullName: name,
      mobileNumber: phone,
      city: agentCapturedCity || "Unknown",
      profession: agentCapturedProfession || "Unknown",
      incomeRange: agentCapturedIncome || "Unknown",
      loanAmountRequired: agentCapturedAmount || 1000000,
      leadProfile: {
        fullName: name,
        mobileNumber: phone,
        city: agentCapturedCity || "Unknown",
        profession: agentCapturedProfession || "Unknown",
        incomeRange: agentCapturedIncome || "Unknown"
      },
      financialRequirements: {
        loanType: loanType,
        requiredLoanAmount: agentCapturedAmount || 1000000
      },
      productSpecificFields: lead?.financialProfile || {}
    };

    // 1. HubSpot Integration (only in live mode)
    const portalId = process.env.HUBSPOT_PORTAL_ID;
    const formId = process.env.HUBSPOT_FORM_ID;
    if (portalId && formId && process.env.PROVIDER_MODE === 'live') {
      try {
        await axios.post(
          `https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`,
          {
            fields: [
              { name: "firstname", value: name },
              { name: "phone", value: phone },
              { name: "loan_type", value: loanType }
            ]
          }
        );
      } catch (e) { console.error("HubSpot Sync Error", e); }
    }

    // 2. Zapier / Google Sheets Integration via processor
    await processOutgoingZapierPayload(loanType, integrationPayload, lead);

    // 3. Post-Call WhatsApp Follow-up
    if (phone) {
      try {
        console.log(`[Post-Call WhatsApp] Triggering WhatsApp follow-up for ${maskPhoneForLog(phone)}... Status: ${mappedStatus}`);

        let targetTemplate = "loan_consultation_offer";
        let targetWorkflowState = "loan_consultation_offer_sent";
        let templateParams: string[] = [];

        if (mappedStatus === 'NO_ANSWER' || mappedStatus === 'FAILED' || mappedStatus === 'BUSY') {
          targetTemplate = "avani_loan_intro_v2";
          targetWorkflowState = "missed_call_intro_sent";
          templateParams = [name];
        }

        if (mongoose.connection.readyState === 1) {
          const leadDoc = await Lead.findOne({ phone: phone });
          if (leadDoc && leadDoc.currentWorkflowState !== "awaiting_correction") {
            leadDoc.currentWorkflowState = targetWorkflowState;
            await leadDoc.save();
          }
        }

        await sendAiSensyWhatsApp({
          destination: phone,
          userName: name,
          templateName: targetTemplate,
          templateParams: templateParams,
          correlationId: `OMNIDM_POSTCALL_${mappedStatus.toUpperCase()}_${Date.now()}_${phone}`
        }, undefined as any);
      } catch (waErr: any) {
        console.error("Post-Call WhatsApp Error:", waErr.message);
      }
    }

    return NextResponse.json({ success: true, callId, status: mappedStatus });
  } catch (error: any) {
    console.error("OmniDM Webhook Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
