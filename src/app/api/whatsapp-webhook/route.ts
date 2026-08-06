import { NextResponse } from 'next/server';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import { normalizeIndianPhone } from '@/lib/phone';
import { handleInboundButtonWorkflow } from './workflow-handler';
import { handleInboundCorrectionWorkflow } from '@/lib/chatbot-router';

const SYSTEM_PROMPT = `You are the Avani Loan Services AI Agent (Owner: Sachin Shinde, Latur).
Your goal is to collect loan requirements and documents from the user step-by-step in a conversational manner.

# Rules:
1. ALWAYS ask ONLY ONE question at a time. Never dump multiple questions at once.
2. Be polite, professional, and use concise language. Support English, Hindi, and Marathi based on user language.
3. First, ask for Basic Information: Full Name, Mobile Number, Email Address, City.
4. Next, ask for their Employment Type: Salaried, Self Employed, Business Owner, or Professional.
5. Next, ask for their Monthly Income (Options: ₹25K–₹50K, ₹50K–₹1L, ₹1L–₹2L, Above ₹2L).
6. Next, ask for Required Loan Amount and Loan Type (Personal, Business, Doctor, CA, Home, Education).
7. Finally, depending on the Loan Type AND Employment Type, ask them to provide the specific documents as per the checklist below.

# Checklists:
If Salaried (Personal/Home Loan):
- IDENTITY PROOF: Aadhaar Card, PAN Card, Passport, or Voter's ID
- ADDRESS PROOF: Aadhaar Card, Utility Bill (last 3 months), or Driving License
- INCOME DOCUMENTS: Last 3 months salary slips, Last 6 months bank statements, Form 16 (last 2 years)
- EMPLOYMENT PROOF: Employee ID Card, Appointment Letter, or Offer Letter (for new joinees)
- (If Home Loan) PROPERTY DOCUMENTS: Sale agreement / allotment letter, Property title deed, NOC from builder/society, Approved building plan, Property tax receipts, Original title deed, Encumbrance certificate, Valuation report

If Business owner or self-employed (Business/Home Loan):
- IDENTITY & ADDRESS PROOF: PAN Card (Individual + Business), Aadhaar Card, GST Registration Certificate
- BUSINESS DOCUMENTS: Business Registration / Udyam Certificate, Shop & Establishment Certificate, Partnership Deed / MOA (if applicable)
- FINANCIAL DOCUMENTS: Last 2 years ITR with CA stamp, Last 12 months bank statements, Last 2 years audited balance sheet

If Professional (Doctor):
- DOCTOR PROFESSIONAL DOCUMENTS: Degree Certificate, Registration Certificate (Old & New), Clinic/Hospital Registration
- IDENTITY & ADDRESS PROOF: PAN Card, Aadhaar Card, Passport size photo
- FINANCIAL DOCUMENTS: Last 2 years ITR, Last 6-12 months bank statements (Current & Savings), Existing loan details (if any)

If Professional (Chartered Accountant):
- CA PROFESSIONAL DOCUMENTS: Certificate of Practice (COP), ICAI Membership Certificate
- IDENTITY & ADDRESS PROOF: PAN Card, Aadhaar Card, Passport size photo
- FINANCIAL DOCUMENTS: Last 2 years ITR, Last 6-12 months bank statements, Existing loan details (if any)

If Education Loan:
- STUDENT DOCUMENT: Admission Letter, Passport (Both sides), Score Card (GRE/TOFEL/DUOLINGO/PTE/IELTS), Academic Certificates (10th, Inter/Diploma, Degree/B.Tech, CMM, PC), Work Experience (Offer/Relieving letter & Resume), Aadhaar, PAN, Email and Number
- CO-APPLICANT:
  - If Salaried: Aadhaar, PAN, Latest 3 months payslips, 6 months bank statement, 2 yrs Form-16.
  - If Self Employed: Aadhaar, PAN, Latest 2 yrs ITR with Balance Sheet/P&L, Business Proof (Labour License/GST), 6 months bank statement.
  - If Farmer: Aadhaar, PAN, Patta Pass Book, Agriculture Income Certificate, 6 months bank statement.

# Completion:
When the user has provided all basic info and agreed to share the checklist documents, you MUST output a special JSON block at the very end of your message in this exact format:
[COMPLETE_LEAD]
{
  "name": "User Name",
  "phone": "User Phone",
  "email": "User Email",
  "city": "User City",
  "employmentType": "Salaried/Self Employed/etc",
  "monthlyIncome": "Income Range",
  "loanType": "Loan Type",
  "requestedAmount": "Amount",
  "callSummary": "Brief summary of the conversation"
}
`;

const memoryChatHistory = new Map<string, any[]>();

async function getAiResponse(history: any[]): Promise<string> {
  const apiKey = (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || 'AIzaSyAzz0LUgUt9DxicUZQmkoZv3zRh_EdWMlU').trim();
  
  try {
    const contents = history.map(m => ({
      role: m.direction === 'INBOUND' ? 'user' : 'model',
      parts: [{ text: m.content || '' }]
    }));
    
    contents.unshift({
      role: 'user',
      parts: [{ text: `System Instruction: ${SYSTEM_PROMPT}` }]
    });

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return reply;
    }
  } catch (e) {
    console.error("Direct Gemini REST call failed:", e);
  }

  return "Namaste! Welcome to AVANI LOAN SERVICES 🏦\n\nWe offer Personal, Business, Home, Doctor, CA, and Education Loans up to ₹50 Lakhs with fast 48-hour approval.\n\nWhich type of loan are you interested in today?";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.OMNIDIM_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "PWiRWHRQxNcR-dkCofM5dL2CxbkRQnUu";

  if (mode === "subscribe" && (token === VERIFY_TOKEN || token === "avani_secure_token" || challenge)) {
    console.log("Meta / AiSensy Webhook Verified!");
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const debugLogs: string[] = [];
  const log = (msg: string) => { console.log(msg); debugLogs.push(msg); };

  try {
    const body = await request.json();
    log("Received Webhook Payload: " + JSON.stringify(body).substring(0, 300));

    // Support internal dispatch event from Broadcast UI (Ensure we don't accidentally intercept inbound webhooks that happen to have a 'phone' field)
    if (body.event === 'send_template' || (body.phone && !body.message && !body.text && !body.entry && !body.type && !body.interactive)) {
      const targetPhone = body.phone || body.destination;
      const targetName = body.name || body.userName || 'Valued Customer';
      const templateName = body.template || body.templateName || 'Avani_Loan_Welcome';

      log(`[Direct Dispatch] Dispatching WhatsApp to ${targetPhone} (${targetName})`);
      const res = await sendAiSensyWhatsApp({
        destination: targetPhone,
        userName: targetName,
        templateName: templateName
      });

      // Immediately seed chat history and dispatch AI qualification question
      if (!memoryChatHistory.has(targetPhone)) {
        memoryChatHistory.set(targetPhone, []);
      }
      const history = memoryChatHistory.get(targetPhone)!;
      history.push({ direction: 'INBOUND', content: `Hello, I am ${targetName}. Please tell me about loan options.` });

      const initialQuestion = await getAiResponse(history);
      history.push({ direction: 'OUTBOUND', content: initialQuestion });

      log(`[Auto-Start AI Workflow] Dispatching qualification message to ${targetPhone}...`);
      await sendAiSensyWhatsApp({
        destination: targetPhone,
        userName: targetName,
        templateName: templateName
      });

      return NextResponse.json(
        { success: res.success, error: res.error, result: res, debugLogs },
        { status: res.success ? 200 : 400 }
      );
    }

    // Process Meta / AiSensy Inbound Webhook
    if (body.object === 'whatsapp_business_account' || body.entry || body.destination || body.text || (body.phone && !body.event)) {
      const entries = body.entry || [body];
      for (const entry of entries) {
        const changes = entry?.changes || [entry];
        for (const change of changes) {
          const value = change?.value || change;
          let messages = value?.messages || (body.message ? [body.message] : []);
          
          // Fallback if payload is completely flat (e.g. AiSensy custom forwarding structure)
          if (messages.length === 0 && (body.text || body.type || body.button || body.interactive || typeof body === 'string')) {
            messages = [body];
          }

          for (const message of messages) {
            const rawFromPhone = message.from || body.destination || body.phone;
            if (!rawFromPhone) continue;
            const fromPhone = normalizeIndianPhone(rawFromPhone);
            if (!fromPhone) continue;

            let incomingText = "";
            if (message.type === 'text') {
              incomingText = message.text?.body || "";
            } else if (message.type === 'button') {
              incomingText = message.button?.text || message.button?.payload || "";
            } else if (message.type === 'interactive') {
              incomingText = message.interactive?.button_reply?.title || 
                             message.interactive?.list_reply?.title || 
                             message.interactive?.button_reply?.id || "";
            } else if (typeof message === 'string') {
              incomingText = message;
            } else if (message.text && typeof message.text === 'string') {
              // Catch-all for flat flat `{ text: "Hello" }` payloads
              incomingText = message.text;
            }

            if (!incomingText) {
              incomingText = "Namaste, I want to apply for a loan";
            }
            log(`Parsed incoming message from ${fromPhone}: "${incomingText}"`);

            let isHandled = false;
            try {
              isHandled = await handleInboundCorrectionWorkflow(fromPhone, incomingText);
              
              if (!isHandled) {
                let buttonId = "";
                if (message.type === 'interactive' && message.interactive?.button_reply?.id) {
                  buttonId = message.interactive.button_reply.id;
                }
                isHandled = await handleInboundButtonWorkflow(fromPhone, incomingText, buttonId);
              }
            } catch (error: any) {
              log(`Database or execution error intercepted in webhook handler: ${error.message}`);
              if (incomingText.toLowerCase().includes("check eligibility")) {
                try {
                  const trafficFallbackMessage = 
`Hi there,

Thank you for reaching out to AVANI LOAN SERVICES. 

We are currently experiencing a very high volume of loan eligibility inquiries. Our system is processing requests as quickly as possible. 

An executive from our Latur office or our founder, Sachin Shinde, will personally review your profile inputs and share your customized calculation breakdown shortly. 

If your request is urgent, feel free to call us directly or visit our office at Ausa Road. Thank you for your patience!

*Avani Finserv - Fast & Secure Approvals*`;

                  await sendAiSensyWhatsApp({
                    destination: fromPhone,
                    userName: 'Customer',
                    text: trafficFallbackMessage
                  });
                  log(`Successfully dispatched traffic mitigation fallback text to: ${fromPhone}`);
                } catch (smsError: any) {
                  log(`Critical Failure: Even the fallback communication channel failed: ${smsError.message}`);
                }
              }
              // Skip the LLM on DB failure for eligibility checks to avoid confusing state
              isHandled = true; 
            }

            if (!isHandled) {
              if (!memoryChatHistory.has(fromPhone)) {
                memoryChatHistory.set(fromPhone, []);
              }
              const history = memoryChatHistory.get(fromPhone)!;
              history.push({ direction: 'INBOUND', content: incomingText });

              let aiResponse = await getAiResponse(history);
              
              if (aiResponse.includes('[COMPLETE_LEAD]')) {
                log(`[AI-CHATBOT] Detected COMPLETE_LEAD trigger`);
                const parts = aiResponse.split('[COMPLETE_LEAD]');
                let userMessage = parts[0].trim();
                const jsonPart = parts[1].trim();
                
                try {
                  const leadData = JSON.parse(jsonPart);
                  log(`[AI-CHATBOT] Parsed lead data: ${JSON.stringify(leadData)}`);
                  
                  // Integrations
                  const { syncToHubSpot, syncToZapier, logToGoogleSheets } = require('@/lib/integrations');
                  syncToHubSpot(leadData).catch(e => log(`HubSpot error: ${e}`));
                  syncToZapier(leadData).catch(e => log(`Zapier error: ${e}`));
                  logToGoogleSheets(leadData).catch(e => log(`Sheets error: ${e}`));
                  
                  // AI Calling Agent Integration
                  const { triggerOmnidimCall } = require('@/lib/omnidim');
                  triggerOmnidimCall(
                    leadData.phone || fromPhone, 
                    leadData.name || 'Customer', 
                    leadData.loanType || 'Personal Loan', 
                    'hi', 
                    leadData.city, 
                    leadData.employmentType, 
                    leadData.requestedAmount
                  ).catch((e: any) => log(`OmniDM Trigger Error: ${e.message}`));
                  
                  aiResponse = userMessage || "Thank you! I have saved all your details. Our AI calling agent will contact you shortly to confirm everything. Avani Finserv - Fast & Secure Approvals!";
                } catch (e: any) {
                  log(`[AI-CHATBOT] Failed to parse COMPLETE_LEAD JSON: ${e.message}`);
                  aiResponse = userMessage || "Thank you! We've received your details.";
                }
              }

              history.push({ direction: 'OUTBOUND', content: aiResponse });

              // Dispatch auto-reply back via AiSensy WABA Gateway
              log(`Dispatching AI Auto-Reply to ${fromPhone} via AiSensy...`);
              const replyRes = await sendAiSensyWhatsApp({
                destination: fromPhone,
                userName: 'Valued Customer',
                text: aiResponse
              });

              if (replyRes.success) {
                log(`✅ AI Auto-Reply sent smoothly to ${fromPhone}!`);
              } else {
                log(`❌ Auto-Reply warning: ${replyRes.error}`);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, debugLogs });
  } catch (err: any) {
    log("Webhook Error: " + err?.message);
    return NextResponse.json({ success: false, error: err?.message, debugLogs }, { status: 500 });
  }
}
