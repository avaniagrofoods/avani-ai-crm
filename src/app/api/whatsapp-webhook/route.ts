import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are the Avani Loan Services AI Agent.
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

  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "avani_secure_token";

  if (mode === "subscribe" && (token === VERIFY_TOKEN || challenge)) {
    console.log("Meta Webhook Verified!");
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

    if (body.object === 'whatsapp_business_account' || body.entry) {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value;
          const messages = value?.messages || [];

          for (const message of messages) {
            const fromPhone = message.from;
            if (!fromPhone) continue;

            let incomingText = "";
            if (message.type === 'text') {
              incomingText = message.text?.body || "";
            } else if (message.type === 'button') {
              incomingText = message.button?.text || message.button?.payload || "";
            } else if (message.type === 'interactive') {
              incomingText = message.interactive?.button_reply?.title || 
                             message.interactive?.list_reply?.title || "";
            }

            if (!incomingText) continue;
            log(`Parsed incoming message from ${fromPhone}: "${incomingText}"`);

            if (!memoryChatHistory.has(fromPhone)) {
              memoryChatHistory.set(fromPhone, []);
            }
            const history = memoryChatHistory.get(fromPhone)!;
            history.push({ direction: 'INBOUND', content: incomingText });

            const aiResponse = await getAiResponse(history);
            history.push({ direction: 'OUTBOUND', content: aiResponse });

            const phoneId = value?.metadata?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || "1147494668457940";
            const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN || "EAAdIUij5eSEBSGriZCTt06QY1yLIkPZCDIQmHY2iE1ZAGiO7plPIiHyV1VnoXIvbvQeFfyhFM0IwWKIxlj0y5haUYPbYIBQMabyJ9XJhTUZA2vUEUYDbSnJH4OIsFYiLTD8yPBFH331fwmBU253NwW48xWhytfkb2gn8E52jZAElt6PcnGL0YZChBtExZCj2AZDZD";

            const metaEndpoint = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
            const replyPayload = {
              messaging_product: "whatsapp",
              to: fromPhone,
              type: "text",
              text: { body: aiResponse }
            };

            const metaRes = await fetch(metaEndpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(replyPayload)
            });

            if (metaRes.ok) {
              log(`✅ AI Auto-Reply sent to ${fromPhone}!`);
            } else {
              log(`❌ Meta Error (${metaRes.status}): ${await metaRes.text()}`);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, debugLogs });
  } catch (err: any) {
    log("Webhook Error: " + err?.message);
    return NextResponse.json({ success: true, debugLogs });
  }
}
