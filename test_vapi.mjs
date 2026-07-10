import axios from 'axios';

const VAPI_API_KEY = '930b2777-22ad-475d-9671-24622946da69';
const VAPI_API_URL = 'https://api.vapi.ai';
const VAPI_ASSISTANT_ID = '9f322737-3bb8-467a-95e3-7a66f9a93dc1';
const VAPI_PHONE_NUMBER_ID = 'f7a22c43-89f1-4a17-aefd-d401333ee3a2';

async function testCall() {
  try {
    const response = await axios.post(
      `${VAPI_API_URL}/call/phone`,
      {
        customer: {
          number: '+917391916356',
          name: 'Test Customer',
        },
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        assistantId: VAPI_ASSISTANT_ID,
        assistantOverrides: {
          firstMessageMode: "assistant-speaks-first",
          firstMessage: "This is a test call.",
        }
      },
      {
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log("Success:", response.data);
  } catch (error) {
    console.error("Vapi Error:", error?.response?.data || error.message);
  }
}

testCall();
