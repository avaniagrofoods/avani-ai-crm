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

          let rawPhone = leadPhone || change.value?.phone_number || "+919175635165";
          const formattedPhone = rawPhone.replace(/[^0-9]/g, '');
          const normalizedPhone = formattedPhone.length === 10 ? '+91' + formattedPhone : (formattedPhone.startsWith('91') && formattedPhone.length === 12 ? '+' + formattedPhone : '+' + formattedPhone);

          // Resolve Approved Template
          const lt = (loanType || '').toLowerCase();
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

          const sourceTag = formId ? (change.value?.platform === 'instagram' ? 'INSTAGRAM_LEAD_FORM' : 'FACEBOOK_LEAD_FORM') : 'FACEBOOK_LEAD_FORM';
          const correlationId = `META-LEAD-${Date.now()}-${Math.random().toString(36).substring(7)}`;

          // Save / Upsert Lead into CRM Database with Zero Duplication
          let leadRecord: any;
          try {
            leadRecord = await Lead.findOneAndUpdate(
              { phone: normalizedPhone },
              {
                $set: {
                  name: leadName,
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
                  leadId: `AVL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*1000000).toString().padStart(6,'0')}`,
                  source: sourceTag,
                  leadSource: 'Meta Lead Ads',
                  status: 'NEW',
                  correlationId: correlationId,
                  createdAt: new Date()
                }
              },
              { upsert: true, new: true }
            );
          } catch (dbErr: any) {
            console.warn("DB Save warning:", dbErr.message);
          }

          // Automated Outbound WhatsApp Welcome via AiSensy Campaign API
          try {
            const aiSensyRes = await sendAiSensyWhatsApp({
              destination: normalizedPhone,
              userName: leadName,
              templateName: templateName,
              templateParams: [leadName, canonicalLoanType],
              tags: [canonicalLoanType.replace(/\s+/g, '_').toUpperCase(), sourceTag]
            }, `META_WEBHOOK_${Date.now()}_${normalizedPhone}`);

            if (aiSensyRes.success && leadRecord) {
              await Lead.findByIdAndUpdate(leadRecord._id, { 
                $set: { 
                  status: 'WHATSAPP_SENT',
                  aiSensyMessageId: aiSensyRes.messageId,
                  whatsappMessageId: aiSensyRes.messageId,
                  lastContactAt: new Date()
                } 
              });
            }
          } catch (waErr: any) { console.error("AiSensy Welcome error:", waErr.message); }

          // Voice Call Schedule (Guarded by OMNIDM_LIVE_ENABLED)
          if (process.env.OMNIDM_LIVE_ENABLED === 'true') {
            try {
              await defaultVoiceService.dispatchCall({
                phoneNumber: normalizedPhone,
                customerName: leadName,
                loanType: canonicalLoanType,
                language: 'hi'
              });
            } catch (voiceErr: any) { console.error("OmniDM Call error:", voiceErr.message); }
          }

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
