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
import { constantTimeEqualStrings, verifySharedWebhookSecret } from '@/lib/auth';
import { maskPhoneForLog } from '@/lib/safeguards';
import {
  CrmSheetsService,
  consentRepository,
  customerRepository,
  messageEventRepository,
  normalizeMobileNumber,
  webhookEventRepository
} from '@/lib/google-sheets';

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
      if (lead && typeof lead.save === 'function') {
        lead.currentWorkflowState = "awaiting_correction";
        lead.pendingCorrectionLog = { targetField: verification.missingFields[0], retryCount: 0 };
        await lead.save();
      }

      const correctiveWhatsAppMessage = `Hi ${compiledPayload.fullName || "Customer"},\n\nThank you for choosing AVANI LOAN SERVICES. \n\nTo finalize your dynamic pre-qualification calculations for a *${loanType}*, our automated processing engine needs a bit more clarification.\n\n👉 *Please reply directly by typing your: ${missingItemsFriendly.join(', ')}*\n\nOnce received, our engine will instantly compile your verified EMI projections and doc checklists. Thank you!\n\n*Avani Finserv - Fast & Secure Approvals*`;

      if (process.env.OMNIDM_LIVE_ENABLED === 'true' && process.env.PROVIDER_MODE === 'live') {
        await sendAiSensyWhatsApp({ destination: userPhone, userName: compiledPayload.fullName || 'Customer', text: correctiveWhatsAppMessage }, `OMNIDM_CORRECTIVE_${Date.now()}_${userPhone}`);
      }
    }

    return false;
  }

  if (process.env.PROVIDER_MODE !== 'live' || process.env.ZAPIER_ENABLED !== 'true') {
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

  if (mode === "subscribe" && token && VERIFY_TOKEN && constantTimeEqualStrings(token, VERIFY_TOKEN)) {
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
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const callId = body.call_id || body.id || body.requestId;
    const phone = body.to || body.to_number || body.phone_number || body.request_data?.phone;
    if (!callId && !phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required OmniDim call identifier or phone number' },
        { status: 400 }
      );
    }

    console.log("OmniDM AI Webhook Event Received:", JSON.stringify({ callId, status: body.status || body.event, phoneMasked: maskPhoneForLog(phone) }));

    // APR-008 Phase 3B & APR-009 Stage 5G: Preserve strict guard against legacy MongoDB fallback.
    const legacyMongoEnabled = process.env.LEGACY_MONGODB_ROUTES_ENABLED === 'true';
    if (legacyMongoEnabled) {
      try {
        await connectToDatabase();
      } catch (dbErr) {
        console.warn("DB Connection warning:", dbErr instanceof Error ? dbErr.message : 'unavailable');
      }
    }

    const isCompleted = body.completed || body.status === 'completed' || body.event === 'call_ended';
    const variables = body.variables || body.request_data || {};
    const name = variables.customerName || variables.name || 'Valued Customer';
    const loanType = variables.loanType || 'Personal Loan';
    const notes = body.summary || `OmniDM AI Voice Call event: ${body.status || body.event || 'ended'}`;
    let lead: any = null;
    let isOptedOut = false;
    let canonicalConsentGranted = false;

    let mappedStatus = isCompleted ? 'CONVERSATION_COMPLETED' : 'FAILED';
    if (body.status === 'no-answer') mappedStatus = 'NO_ANSWER';
    else if (body.status === 'answered') mappedStatus = 'ANSWERED';
    else if (body.status === 'calling') mappedStatus = 'RINGING';
    else if (body.status === 'busy') mappedStatus = 'BUSY';

    // Capture dynamic variables returned by agent
    const agentCapturedCity = variables.city || variables.City;
    const agentCapturedProfession = variables.profession || variables.Employment || variables.Profession;
    const agentCapturedIncome = variables.monthlyIncomeRange || variables.Income;
    const agentCapturedAmount = variables.Loan_requirement || variables.loanRequirement || variables.Amount;

    // APR-009 Stage 5G: Canonical Google Sheets CRM Handoff (Zero MongoDB Fallback)
    if (!legacyMongoEnabled) {
      const eventId = `OMNIDIM_${String(callId || phone).replace(/[^A-Za-z0-9._:-]/g, '_')}_${mappedStatus}`;
      try {
        const reg = await webhookEventRepository.registerWebhookEventIdempotent({
          event_id: eventId,
          provider: 'OmniDM',
          event_type: mappedStatus,
          rawPayloadForHashOnly: {
            callId: callId || null,
            status: mappedStatus,
            phoneMasked: maskPhoneForLog(phone),
            duration: body.duration || 0
          }
        });

        if (reg.duplicate) {
          return NextResponse.json({
            success: true,
            duplicate: true,
            callId,
            status: mappedStatus,
            dataStore: 'GOOGLE_SHEETS',
            message: 'Duplicate OmniDim webhook ignored idempotently'
          });
        }

        if (phone) {
          const normalized = normalizeMobileNumber(String(phone));
          const existingCust = await customerRepository.findByMobile(normalized.e164);
          const existingConsent = existingCust
            ? await consentRepository.findByCustomerId(existingCust.customer_id)
            : null;

          if (
            existingCust?.record_status === 'OPTED_OUT' ||
            existingConsent?.consent_status === 'DENIED' ||
            existingConsent?.consent_status === 'WITHDRAWN'
          ) {
            isOptedOut = true;
          } else if (existingConsent?.consent_status === 'GRANTED' || body.consentGranted === true) {
            canonicalConsentGranted = true;
          }

          if (isOptedOut) {
            await webhookEventRepository.markWebhookStatus({
              event_id: eventId,
              processing_status: 'COMPLETED',
              error_code: 'OPTED_OUT_SUPPRESSED'
            });
            return NextResponse.json({
              success: true,
              callId,
              status: mappedStatus,
              dataStore: 'GOOGLE_SHEETS',
              optedOutSuppressed: true
            });
          }

          const crmHandoff = await CrmSheetsService.registerOrUpdateCustomerLead({
            enquiryKey: `OMNIDIM_${String(callId || normalized.raw10)}`,
            name,
            phone: normalized.e164,
            city: agentCapturedCity || undefined,
            loanCategory: loanType,
            requestedAmount: agentCapturedAmount,
            leadStatus: isCompleted ? 'CONTACTED' : 'FOLLOWUP_REQUIRED',
            leadSource: 'OMNIDIM_VOICE',
            consentStatus: canonicalConsentGranted ? 'GRANTED' : 'PENDING',
            consentSource: 'OMNIDIM_WEBHOOK'
          });

          lead = {
            leadId: crmHandoff.lead.lead_id,
            customerId: crmHandoff.customer.customer_id,
            city: crmHandoff.customer.city,
            consentStatus: crmHandoff.consent.consent_status,
            isOptedOut: crmHandoff.hydrated.isOptedOut
          };

          // Zero-Media-Storage policy: store ONLY operational metadata (never recordingUrl or transcript)
          if (callId) {
            await messageEventRepository.recordMessageEvent({
              customer_id: crmHandoff.customer.customer_id,
              provider: 'OmniDM',
              message_type: 'VOICE_CALL_EVENT',
              direction: 'inbound',
              delivery_status: mappedStatus,
              provider_message_id: String(callId)
            });
          }
        }

        await webhookEventRepository.markWebhookStatus({
          event_id: eventId,
          processing_status: 'COMPLETED'
        });
      } catch (sheetsErr: unknown) {
        console.error(
          '[OmniDM Webhook] Canonical Sheets handoff failed (no MongoDB fallback):',
          sheetsErr instanceof Error ? sheetsErr.message : 'unavailable'
        );
        return NextResponse.json(
          {
            success: false,
            error: 'Canonical CRM store temporarily unavailable',
            code: 'CANONICAL_SHEETS_UNAVAILABLE',
            retryable: true
          },
          { status: 503 }
        );
      }
    } else if (mongoose.connection.readyState === 1) {
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
        try { await lead.save(); } catch {}
      }

      const updateData: any = { status: mappedStatus };
      if (body.duration) updateData.duration = body.duration;
      // TASK 5H.7 (A-03): Prohibited recordingUrl and transcript persistence removed under Zero-Media-Storage policy.

      if (mappedStatus === 'CONVERSATION_COMPLETED' || mappedStatus === 'NO_ANSWER' || mappedStatus === 'FAILED' || mappedStatus === 'BUSY') {
        updateData.completedAt = new Date();
      }

      if (callId) {
        const existingCall = await Call.findOne({ callId });
        if (existingCall && existingCall.status === mappedStatus) {
          console.log(`[OmniDM Webhook] Call ${callId} already processed with status ${mappedStatus}. Skipping duplicate action.`);
          return NextResponse.json({ success: true, message: "Duplicate webhook ignored" });
        }

        updateData.providerCallId = callId;
        await Call.findOneAndUpdate({ callId }, { $set: updateData }, { new: true, upsert: true });
      }
    }

    if (isOptedOut) {
      console.log(`[OmniDM Webhook] Recipient ${maskPhoneForLog(phone)} is opted out. Skipping post-call integrations and WhatsApp follow-up.`);
      return NextResponse.json({ success: true, callId, status: mappedStatus, optedOutSuppressed: true });
    }

    // Update Legacy Lead if active
    if (legacyMongoEnabled && lead && mongoose.connection.readyState === 1 && typeof lead.save === 'function') {
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
      city: agentCapturedCity || lead?.city || "Unknown",
      profession: agentCapturedProfession || lead?.profession || "Unknown",
      incomeRange: agentCapturedIncome || lead?.monthlyIncomeRange || "Unknown",
      loanAmountRequired: agentCapturedAmount || lead?.requiredLoanAmount || 1000000,
      leadProfile: {
        fullName: name,
        mobileNumber: phone,
        city: agentCapturedCity || lead?.city || "Unknown",
        profession: agentCapturedProfession || lead?.profession || "Unknown",
        incomeRange: agentCapturedIncome || lead?.monthlyIncomeRange || "Unknown"
      },
      financialRequirements: {
        loanType: loanType,
        requiredLoanAmount: agentCapturedAmount || lead?.requiredLoanAmount || 1000000
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

    // 2. Zapier / Google Sheets Integration via processor (strictly gated)
    await processOutgoingZapierPayload(loanType, integrationPayload, lead);

    // 3. Post-Call WhatsApp Follow-up (strictly gated: requires live mode + explicit OmniDim live enable + verified consent)
    if (phone && process.env.OMNIDM_LIVE_ENABLED === 'true' && process.env.PROVIDER_MODE === 'live' && canonicalConsentGranted) {
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

        if (legacyMongoEnabled && mongoose.connection.readyState === 1) {
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

    return NextResponse.json({
      success: true,
      callId,
      status: mappedStatus,
      dataStore: legacyMongoEnabled ? 'LEGACY_MONGODB' : 'GOOGLE_SHEETS',
      leadId: lead?.leadId || null
    });
  } catch (error: unknown) {
    console.error("OmniDM Webhook Error:", error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
