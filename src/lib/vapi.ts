import axios from 'axios';

const VAPI_API_KEY = process.env.VAPI_API_KEY || '006036f2-b1ee-44de-9abd-117cb4298681';
const VAPI_API_URL = process.env.VAPI_API_URL || 'https://api.vapi.ai';
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID || '9f322737-3bb8-467a-95e3-7a66f9a93dc1';
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID || 'f7a22c43-89f1-4a17-aefd-d401333ee3a2';

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
        // Inject variables so the Vapi dashboard prompt can use {{name}} and {{loanType}}
        // We do NOT hardcode the system prompt or voice here, so that any changes made
        // in the Vapi Dashboard (like adding tools or editing the prompt) take effect immediately.
        assistantOverrides: {
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
