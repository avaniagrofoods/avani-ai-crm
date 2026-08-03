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

    let lead: any = null;
    try {
      if (callId) lead = await Lead.findOne({ callId });
      if (!lead && phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        lead = await Lead.findOne({ phone: { $regex: cleanPhone, $options: 'i' } });
      }
    } catch (e) { console.warn("Lead query warning:", e); }

    const status = isCompleted ? 'Contacted' : 'Follow Up Required';
    const notes = body.summary || body.transcript || `OmniDM AI Voice Call event: ${body.status || body.event || 'ended'}`;

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
      source: 'OmniDM Voice AI'
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

    // 3. Post-Call WhatsApp Follow-up (Dispatched for ALL call outcomes: completed, missed, ended, or failed)
    if (phone) {
      try {
        console.log(`[Post-Call WhatsApp] Triggering WhatsApp follow-up for ${phone}...`);
        await sendAiSensyWhatsApp({
          destination: phone,
          userName: name,
          templateName: 'Avani_Loan_Welcome'
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
