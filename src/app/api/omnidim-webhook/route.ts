import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import axios from 'axios';

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
    console.log("OmniDim AI Webhook Received:", JSON.stringify(body, null, 2));

    try {
      await connectToDatabase();
    } catch (dbErr) {
      console.warn("DB Connection warning:", dbErr);
    }

    const callId = body.call_id || body.id;
    const phone = body.to || body.phone_number || body.request_data?.phone;
    const isCompleted = body.completed || body.status === 'completed' || body.event === 'call_ended';
    const variables = body.variables || body.request_data || {};
    const name = variables.customerName || variables.name || 'Customer';
    const loanType = variables.loanType || 'Personal Loan';

    let lead: any = null;
    try {
      if (callId) lead = await Lead.findOne({ callId });
      if (!lead && phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        lead = await Lead.findOne({ phone: { $regex: cleanPhone, $options: 'i' } });
      }
    } catch (e) { console.warn("Lead query warning:", e); }

    const status = isCompleted ? 'Contacted' : 'Failed';
    const notes = body.summary || body.transcript || 'OmniDM Voice Call completed';

    if (lead) {
      lead.status = status;
      lead.notes = notes;
      try { await lead.save(); } catch (e) {}
    }

    const integrationPayload = {
      name,
      phone,
      loanType,
      status,
      notes,
      source: 'OmniDim Voice AI'
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

    // 2. Zapier / Google Sheets Integration
    const targetUrl = process.env.ZAPIER_WEBHOOK_URL || process.env.GOOGLE_SHEET_APP_SCRIPT_URL;
    if (targetUrl) {
      try {
        await axios.post(targetUrl, integrationPayload);
      } catch (e) { console.error("Zapier/Sheets Sync Error", e); }
    }

    // 3. AiSensy WhatsApp Message
    if (isCompleted && phone) {
      try {
        await sendAiSensyWhatsApp({
          destination: phone,
          userName: name,
          templateName: 'Avani_Loan_Welcome',
          templateParams: [name, loanType]
        });
      } catch (e) { console.error("WhatsApp Trigger Error", e); }
    }

    return NextResponse.json({ success: true, message: "OmniDM Webhook processed" });
  } catch (error: any) {
    console.error("Error processing OmniDim AI webhook:", error);
    return NextResponse.json({ success: false, error: "Webhook processing failed" }, { status: 500 });
  }
}
