import axios from 'axios';

const BLAND_API_KEY = process.env.BLAND_API_KEY || '';
const BLAND_ENCRYPTED_KEY = process.env.BLAND_ENCRYPTED_KEY || '';

const SYSTEM_PROMPT = `
You are an AI sales agent for "Avani Loan Services" (अवनी लोन सर्व्हिसेस). 
Speak exclusively in Marathi or Hindi, based on what the user prefers.

First message: "नमस्कार, मैं अवनी फ़नसरवाधपूर्ण बोलता है. आमचा संसदीर पर सत्या व्याख्या व्यावसायिक, ग्रहcar, अन्य तारन करजा से do अन्य CA यानचासाटी विशेष कर्ज योजना उपलब्ध है. यावी, सर्व बिस्तर महिती धनिया साटी, मियापकत एक minute wear खे शक का?"

Your goal:
1. Greet the customer and verify if they are interested in personal, business, home, or mortgage loans.
2. If interested, collect their approximate monthly income and desired loan amount.
3. If they say yes to proceeding, say: "Our specialist will contact you on WhatsApp right now." and end the call.

Do NOT read out loud any internal variables or structured JSON.
Keep your responses conversational and natural.
`;

export async function triggerBlandCall(customerPhone: string, customerName: string, loanType: string) {
  try {
    const response = await axios.post(
      'https://api.bland.ai/v1/calls',
      {
        phone_number: customerPhone,
        task: SYSTEM_PROMPT,
        voice: "maya", // 'maya' is excellent for Multilingual/Indian languages
        language: "hi", // Forces engine to accommodate Hindi/Marathi phonetics
        record: true,
        max_duration: 12,
        request_data: {
          customerName,
          loanType
        },
        webhook: 'https://avani-ai-crm.onrender.com/api/bland-webhook'
      },
      {
        headers: {
          Authorization: BLAND_API_KEY,
          encrypted_key: BLAND_ENCRYPTED_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("Error triggering Bland AI call:", error?.response?.data || error.message);
    throw error;
  }
}
