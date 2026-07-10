import axios from 'axios';

const VAPI_API_KEY = '930b2777-22ad-475d-9671-24622946da69';
const VAPI_API_URL = 'https://api.vapi.ai';
const VAPI_ASSISTANT_ID = '9f322737-3bb8-467a-95e3-7a66f9a93dc1';
const VAPI_PHONE_NUMBER_ID = 'f7a22c43-89f1-4a17-aefd-d401333ee3a2';

async function testCall(phone, name) {
  try {
    const response = await axios.post(
      `${VAPI_API_URL}/call/phone`,
      {
        customer: {
          number: phone,
          name: name,
        },
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        assistantId: VAPI_ASSISTANT_ID,
        assistantOverrides: {
          firstMessageMode: "assistant-speaks-first",
          firstMessage: "This is a test call.",
          voice: {
            provider: "11labs",
            voiceId: "FUfBrNit0NNZAwb58KWH",
            model: "eleven_turbo_v2_5",
            language: "mr"
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
    console.log(`Success for ${phone}:`, response.data.id);
  } catch (error) {
    console.error(`Vapi Error for ${phone}:`, error?.response?.data || error.message);
  }
}

async function run() {
  await testCall('+917391916356', 'Santosh sude');
  await testCall('+917620276106', 'Amol Jagtap');
  await testCall('+917219053645', 'Sachin');
}

run();
