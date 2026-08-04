import { NextResponse } from 'next/server';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';

const SYSTEM_PROMPT = `You are the Avani Loan Services AI Agent (Owner: Sachin Shinde, Latur).
Your goal is to collect loan requirements from the user step-by-step in a conversational manner.

# Rules:
1. ALWAYS ask ONLY ONE question at a time. Never dump multiple questions at once.
2. Be polite, professional, and use concise language. Support English, Hindi, and Marathi based on user language.
3. First, ask what type of loan they need if they haven't specified: Personal, Business, Doctor, CA, Home, or Education.
4. Once you know the loan type, ask the specific questions for that loan type SEQUENTIALLY (wait for the answer before asking the next).

# Loan Fields to Collect:
- **Personal Loan:** Full Name -> Mobile Number -> City -> Employment Type (Salaried/Business/Professional) -> Monthly Income -> Required Loan Amount.
- **Business Loan:** Business Name -> City -> Owner Name -> Mobile Number -> Turnover -> Loan Amount.
- **Doctor Loan:** Doctor Name -> Specialization -> Clinic/Hospital Name -> Loan Requirement.
- **CA Loan:** CA Name -> Firm Name -> Mobile Number -> Loan Requirement.
- **Home Loan:** Property Location -> Property Value -> Loan Amount Needed.
- **Education Loan:** Student Name -> Course -> Country -> University -> Loan Amount.
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

    // Support internal dispatch event from Broadcast UI
    if (body.event === 'send_template' || body.phone) {
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
    if (body.object === 'whatsapp_business_account' || body.entry || body.destination) {
      const entries = body.entry || [body];
      for (const entry of entries) {
        const changes = entry?.changes || [entry];
        for (const change of changes) {
          const value = change?.value || change;
          const messages = value?.messages || (body.message ? [body.message] : []);

          for (const message of messages) {
            const fromPhone = message.from || body.destination || body.phone;
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
            }

            if (!incomingText) {
              incomingText = "Namaste, I want to apply for a loan";
            }
            log(`Parsed incoming message from ${fromPhone}: "${incomingText}"`);

            if (!memoryChatHistory.has(fromPhone)) {
              memoryChatHistory.set(fromPhone, []);
            }
            const history = memoryChatHistory.get(fromPhone)!;
            history.push({ direction: 'INBOUND', content: incomingText });

            const aiResponse = await getAiResponse(history);
            history.push({ direction: 'OUTBOUND', content: aiResponse });

            // Dispatch auto-reply back via AiSensy WABA Gateway
            log(`Dispatching AI Auto-Reply to ${fromPhone} via AiSensy...`);
            const replyRes = await sendAiSensyWhatsApp({
              destination: fromPhone,
              userName: 'Valued Customer',
              templateName: 'Avani_Loan_Welcome'
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

    return NextResponse.json({ success: true, debugLogs });
  } catch (err: any) {
    log("Webhook Error: " + err?.message);
    return NextResponse.json({ success: false, error: err?.message, debugLogs }, { status: 500 });
  }
}
