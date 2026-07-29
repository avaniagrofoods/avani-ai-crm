import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Received CallKaro AI Webhook:", JSON.stringify(body));

    const { call_id, phone_number, customer_name, transcript, status, duration, call_analysis } = body;

    let phone = phone_number || body.to || body.phone;
    if (phone && !phone.startsWith('+')) {
      phone = phone.length === 10 ? '+91' + phone : '+' + phone;
    }

    try {
      await connectToDatabase();
      if (phone && process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('localhost')) {
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
    } catch (dbErr) {
      console.warn("DB Update notice in CallKaro Webhook:", dbErr);
    }

    // Trigger Meta / AiSensy WhatsApp Followup Template if requested
    if (phone && (status === 'completed' || status === 'COMPLETED' || !status)) {
      const metaToken = process.env.WHATSAPP_TOKEN || "EAAdIUij5eSEBSGriZCTt06QY1yLIkPZCDIQmHY2iE1ZAGiO7plPIiHyV1VnoXIvbvQeFfyhFM0IwWKIxlj0y5haUYPbYIBQMabyJ9XJhTUZA2vUEUYDbSnJH4OIsFYiLTD8yPBFH331fwmBU253NwW48xWhytfkb2gn8E52jZAElt6PcnGL0YZChBtExZCj2AZDZD";
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "1147494668457940";

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
        console.log(`✅ Sent WhatsApp template follow-up to ${phone}`);
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
