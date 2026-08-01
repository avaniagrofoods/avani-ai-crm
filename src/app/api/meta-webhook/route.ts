import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import { defaultVoiceService } from '@/lib/voice-provider';
import axios from 'axios';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.OMNIDIM_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "PWiRWHRQxNcR-dkCofM5dL2CxbkRQnUu";

  if (mode === "subscribe" && (token === VERIFY_TOKEN || token === "avani_secure_token")) {
    console.log("✅ Meta Lead Ads Webhook Verified!");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("📩 Meta Lead Ads Webhook Received:", JSON.stringify(body).substring(0, 400));

    await connectToDatabase();

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field === 'leadgen') {
          const leadgenId = change.value?.leadgen_id;
          const formId = change.value?.form_id;
          const adId = change.value?.ad_id;

          console.log(`[Meta Lead Ad] Received leadgen_id: ${leadgenId}, form_id: ${formId}`);

          let leadName = "Meta Lead";
          let leadPhone = "";
          let loanType = "Personal Loan";
          let email = "";

          // Fetch full lead details from Meta Graph API
          const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN;
          if (token && leadgenId) {
            try {
              const metaRes = await axios.get(`https://graph.facebook.com/v19.0/${leadgenId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });

              const fieldData = metaRes.data?.field_data || [];
              for (const field of fieldData) {
                const fname = field.name?.toLowerCase();
                const val = field.values?.[0] || "";

                if (fname.includes("full_name") || fname.includes("name")) leadName = val;
                if (fname.includes("phone") || fname.includes("mobile")) leadPhone = val;
                if (fname.includes("email")) email = val;
                if (fname.includes("loan") || fname.includes("service")) loanType = val;
              }
            } catch (graphErr: any) {
              console.warn("Could not fetch Meta Lead details from Graph API:", graphErr?.response?.data || graphErr.message);
            }
          }

          if (!leadPhone) {
            leadPhone = change.value?.phone_number || "+919175635165";
          }

          // Save Lead into CRM Database
          let leadRecord: any;
          try {
            leadRecord = await Lead.create({
              name: leadName,
              phone: leadPhone,
              email: email || 'enquiry@avanifinserv.com',
              loanType: loanType || 'Personal Loan',
              status: 'New Lead',
              notes: `Meta Lead Ad (Form: ${formId || 'Instant Form'}, Ad: ${adId || 'N/A'})`
            });
          } catch (dbErr) {
            console.warn("DB Save warning:", dbErr);
          }

          // Phase 8 Automated Workflow Execution
          // 1. WhatsApp Welcome via AiSensy / Meta
          try {
            await sendAiSensyWhatsApp({
              destination: leadPhone,
              userName: leadName,
              templateName: 'Avani_Loan_Welcome',
              templateParams: [leadName, loanType]
            });
          } catch (waErr) { console.error("AiSensy Welcome error:", waErr); }

          // 2. OmniDM AI Voice Call Schedule
          try {
            await defaultVoiceService.dispatchCall({
              phoneNumber: leadPhone,
              customerName: leadName,
              loanType: loanType,
              language: 'hi'
            });
          } catch (voiceErr) { console.error("OmniDM Call error:", voiceErr); }

          // 3. Google Sheets & Zapier & HubSpot Sync
          const syncPayload = {
            name: leadName,
            phone: leadPhone,
            email: email || 'enquiry@avanifinserv.com',
            loanType: loanType,
            status: 'New Lead',
            source: 'Meta Lead Ads Instant Form',
            timestamp: new Date().toISOString()
          };

          const sheetUrl = process.env.GOOGLE_SHEET_APP_SCRIPT_URL;
          if (sheetUrl) {
            axios.post(sheetUrl, syncPayload).catch(e => console.error("Sheet sync error", e));
          }

          const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
          if (zapierUrl) {
            axios.post(zapierUrl, syncPayload).catch(e => console.error("Zapier sync error", e));
          }

          const makeUrl = process.env.MAKE_WEBHOOK_URL;
          if (makeUrl) {
            axios.post(makeUrl, syncPayload).catch(e => console.error("Make sync error", e));
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: "Meta Webhook processed" });
  } catch (error: any) {
    console.error("Meta Webhook Error:", error);
    return NextResponse.json({ success: true, error: error.message });
  }
}
