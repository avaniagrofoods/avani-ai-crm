import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import axios from 'axios';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("OmniDim AI Webhook Received:", JSON.stringify(body, null, 2));

    await connectToDatabase();

    const callId = body.call_id;
    const phone = body.to || body.phone_number;
    const isCompleted = body.completed || body.status === 'completed';
    const variables = body.variables || body.request_data || {};
    const name = variables.customerName || variables.name || 'Customer';

    let lead = await Lead.findOne({ callId });
    if (!lead && phone) {
      lead = await Lead.findOne({ phone: { $regex: phone.replace('+', ''), $options: 'i' } });
    }

    if (lead) {
      lead.status = isCompleted ? 'Contacted' : 'Failed';
      lead.notes = body.summary || body.transcript || 'Call processed';
      await lead.save();

      // Trigger Integrations
      const integrationPayload = {
        name: lead.name,
        phone: lead.phone,
        loanType: lead.loanType || 'Personal Loan',
        status: lead.status,
        notes: lead.notes,
        source: 'OmniDim Voice AI'
      };

      // 1. HubSpot Integration
      if (process.env.HUBSPOT_PORTAL_ID && process.env.HUBSPOT_FORM_ID) {
        try {
          await axios.post(
            https://api.hsforms.com/submissions/v3/integration/submit//,
            {
              fields: [
                { name: "firstname", value: integrationPayload.name },
                { name: "phone", value: integrationPayload.phone },
                { name: "loan_type", value: integrationPayload.loanType }
              ]
            }
          );
        } catch (e) { console.error("HubSpot Sync Error", e); }
      }

      // 2. Zapier / Google Sheets Integration
      if (process.env.ZAPIER_WEBHOOK_URL || process.env.GOOGLE_SHEET_APP_SCRIPT_URL) {
        const targetUrl = process.env.ZAPIER_WEBHOOK_URL || process.env.GOOGLE_SHEET_APP_SCRIPT_URL;
        if (targetUrl) {
          try {
            await axios.post(targetUrl, integrationPayload);
          } catch (e) { console.error("Zapier/Sheets Sync Error", e); }
        }
      }

      // 3. Twilio / AiSensy WhatsApp Message
      // Since it's Contacted, we send the welcome message
      if (isCompleted) {
        try {
          // Internal call to our own Whatsapp Webhook or Service
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://avani-ai-crm.vercel.app';
          await axios.post(${appUrl}/api/whatsapp-webhook, {
            event: 'send_template',
            phone: integrationPayload.phone,
            name: integrationPayload.name,
            template: 'avani_loan_intro'
          });
        } catch (e) { console.error("WhatsApp Trigger Error", e); }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing OmniDim AI webhook:", error);
    return NextResponse.json({ success: false, error: "Webhook processing failed" }, { status: 500 });
  }
}
