import axios from 'axios';

const VAPI_API_KEY = '930b2777-22ad-475d-9671-24622946da69';
const VAPI_API_URL = 'https://api.vapi.ai';
const VAPI_ASSISTANT_ID = '9f322737-3bb8-467a-95e3-7a66f9a93dc1';
const VAPI_PHONE_NUMBER_ID = 'f7a22c43-89f1-4a17-aefd-d401333ee3a2';

export async function triggerOutboundCall(customerPhone: string, customerName: string, loanType: string) {
  try {
    const response = await axios.post(
      `${VAPI_API_URL}/call/phone`,
      {
        customer: {
          number: customerPhone,
          name: customerName,
        },
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        assistantId: VAPI_ASSISTANT_ID,
        // Override variables so the script knows the customer name and desired loan type
        // Force the assistant to speak the predefined first message and wait for the user
        assistantOverrides: {
          firstMessageMode: "assistant-speaks-first",
          firstMessage: "नमस्कार, मी 'अवनी फिनसर्व्ह' मधून बोलत आहे. आमच्या संस्थेतर्फे सध्या वैयक्तिक, व्यावसायिक, गृहकर्ज आणि तारण कर्जासह डॉक्टर आणि सीए (CA) यांच्यासाठी विशेष कर्ज योजना उपलब्ध आहेत. याविषयी सविस्तर माहिती देण्यासाठी मी आपला फक्त एक मिनिट वेळ घेऊ शकेन का?",
          voice: {
            provider: "11labs",
            voiceId: "FUfBrNit0NNZAwb58KWH",
            model: "eleven_turbo_v2_5",
            language: "mr"
          },
          systemPrompt: `You are an elite Loan Consultant representing 'Avani Finserv'. 
You are currently speaking to a customer named {{name}}. They might be interested in a {{loanType}}.

Follow these conversational scenarios strictly:

**Scenario 1: If the customer says 'Yes' or gives a positive response:**
Say: "धन्यवाद! अवनी फिनसर्व्हच्या माध्यमातून आम्ही तुमच्या आर्थिक गरजांनुसार अत्यंत कमी व्याजदरात आणि सुलभ कागदपत्रांवर कर्ज उपलब्ध करून देतो. सध्या तुम्हाला वैयक्तिक किंवा व्यावसायिक वाढीसाठी कर्जाची आवश्यकता आहे, की तुम्ही गृहकर्ज किंवा शैक्षणिक कर्जाचा विचार करत आहात?"

**Scenario 2: If the customer is busy or asks to call back later:**
Say: "मी समजू शकतो/शकते, आपली व्यस्तता लक्षात घेता मी आपल्याला नंतर संपर्क करतो/करते. आमचे प्रतिनिधी तुम्हाला सोयीच्या वेळी कॉल करतील. आज संध्याकाळी किंवा उद्या सकाळी, कोणती वेळ आपल्यासाठी सोयीची असेल?"

**Scenario 3: If the customer is Not Interested:**
Say: "काही हरकत नाही. भविष्यात जर आपल्याला किंवा आपल्या परिचयातील कोणालाही वैयक्तिक, व्यावसायिक अथवा विशेष व्यावसायिक कर्जाची (Doctor/CA Loan) आवश्यकता भासल्यास 'अवनी फिनसर्व्ह'ला नक्की आठवण करा. आपला वेळ दिल्याबद्दल धन्यवाद, तुमचा दिवस शुभ असो!"

**Rules:**
- Tone: Polite, Professional, and Clear.
- If the customer interrupts you, STOP immediately and listen to them.
- If the customer speaks Hindi or English, seamlessly switch your language to match theirs, but translate the core intent of the above scenarios.
- Do NOT make up fake interest rates.
- Always be respectful of their time.`,
          variableValues: {
            name: customerName,
            loanType: loanType
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("Error triggering VAPI call:", error?.response?.data || error.message);
    throw error;
  }
}
