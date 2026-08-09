import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import mongoose from 'mongoose';
import { Lead } from '@/models/Lead';
import { Call } from '@/models/Call';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import axios from 'axios';
import { validateProductPayload } from '@/lib/validators';
import { sendSlackAlert } from '@/lib/alerts';

export async function processOutgoingZapierPayload(loanType: string, compiledPayload: any, lead: any) {
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

      await sendAiSensyWhatsApp({ destination: userPhone, userName: compiledPayload.fullName || 'Customer', text: correctiveWhatsAppMessage });
    }

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

  const VERIFY_TOKEN = process.env.OMNIDIM_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "PWiRWHRQxNcR-dkCofM5dL2CxbkRQnUu";

  if (mode === "subscribe" && (token === VERIFY_TOKEN || token === "avani_secure_token")) {
    console.log("✅ OmniDM Webhook Verified!");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("OmniDM AI Webhook Event Received:", JSON.stringify(body, null, 2));

    try {
      await connectToDatabase();
    } catch (dbErr) {
      console.warn("DB Connection warning:", dbErr);
    }

    const callId = body.call_id || body.id || body.requestId;
    const phone = body.to || body.to_number || body.phone_number || body.request_data?.phone;
    const isCompleted = body.completed || body.status === 'completed' || body.event === 'call_ended';
    const variables = body.variables || body.request_data || {};
    const name = variables.customerName || variables.name || 'Valued Customer';
    const loanType = variables.loanType || 'Personal Loan';
    const notes = body.summary || body.transcript || `OmniDM AI Voice Call event: ${body.status || body.event || 'ended'}`;
    let lead: any = null;

    if (mongoose.connection.readyState === 1) {
      try {
        if (callId) lead = await Lead.findOne({ callId });
        if (!lead && phone) {
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          lead = await Lead.findOne({ phone: { $regex: cleanPhone, $options: 'i' } });
        }
      } catch (e) { console.warn("Lead query warning:", e); }

      const status = isCompleted ? 'Contacted' : 'Follow Up Required';
      if (lead) {
        lead.status = status;
        lead.notes = notes;
        try { await lead.save(); } catch (e) {}
      }
    }

    let mappedStatus = isCompleted ? 'Completed' : 'Failed';
    if (body.status === 'no-answer') mappedStatus = 'No Answer';
    else if (body.status === 'answered') mappedStatus = 'Answered';
    else if (body.status === 'calling') mappedStatus = 'Calling';

    const updateData: any = { status: mappedStatus };
    if (body.duration) updateData.duration = body.duration;
    if (body.recording_url) updateData.recordingUrl = body.recording_url;
    if (body.transcript || notes) updateData.transcript = body.transcript || notes;
    
    if (mappedStatus === 'Completed' || mappedStatus === 'No Answer' || mappedStatus === 'Failed') {
      updateData.completedAt = new Date();
    }

    if (callId) {
      if (mongoose.connection.readyState === 1) {
        await Call.findOneAndUpdate(
          { callId },
          { $set: updateData },
          { new: true }
        );
      } else {
        console.warn(`[Webhook DB Bypass] DB not connected, skipping status update for callId: ${callId}`);
      }
    }

    const integrationPayload: any = {
      eventId: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      sourceSystem: "Avani AI CRM Pipeline",
      campaign: {
        channel: "AI Voice (OmniDM)",
        metaWhatsAppSenderNumber: "7249108474",
        whatsappTemplateCompulsory: "loan_consultation_offer"
      },
      callMetrics: {
        callId: callId,
        callStatus: body.status || "completed",
        callDisposition: isCompleted ? "answered_interested" : "unanswered",
      },
      fullName: name,
      mobileNumber: phone,
      city: lead?.city || variables.city || "Unknown",
      loanAmountRequired: lead?.financialProfile?.requestedLoanAmount || 1000000,
      leadProfile: {
        fullName: name,
        mobileNumber: phone,
        city: lead?.city || variables.city || "Unknown"
      },
      financialRequirements: lead?.financialProfile || { loanType },
      productSpecificFields: lead?.financialProfile || {}
    };

    // 1. HubSpot Integration
    const portalId = process.env.HUBSPOT_PORTAL_ID;
    const formId = process.env.HUBSPOT_FORM_ID;
    if (portalId && formId) {
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

    // 3. Post-Call WhatsApp Follow-up (Dispatched for ALL call outcomes: completed, missed, ended, or failed)
    if (phone) {
      try {
        console.log(`[Post-Call WhatsApp] Triggering WhatsApp follow-up for ${phone}...`);
        
        // Update state to loan_consultation_offer_sent
        if (mongoose.connection.readyState === 1) {
          let lead = await Lead.findOne({ phone: phone });
          if (lead && lead.currentWorkflowState !== "awaiting_correction") {
            lead.currentWorkflowState = "loan_consultation_offer_sent";
            await lead.save();
          }
        }
        
        await sendAiSensyWhatsApp({
          destination: phone,
          userName: name,
          templateName: "loan_consultation_offer"
        });
      } catch (waErr: any) {
        console.error("Post-Call WhatsApp Error:", waErr.message);
      }
    }

    return NextResponse.json({ success: true, callId, status });
  } catch (error: any) {
    console.error("OmniDM Webhook Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
