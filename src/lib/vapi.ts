import axios from 'axios';

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_API_URL = process.env.VAPI_API_URL || 'https://api.vapi.ai';
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

export async function triggerOutboundCall(customerPhone: string, customerName: string, loanType: string) {
  try {
    const response = await axios.post(
      `${VAPI_API_URL}/call/phone`,
      {
        customer: {
          number: customerPhone,
          name: customerName,
        },
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        assistantId: VAPI_ASSISTANT_ID,
        // Override variables so the script knows the customer name and desired loan type
        // Force the assistant to speak the predefined first message and wait for the user
        assistantOverrides: {
          firstMessageMode: "assistant-speaks-first",
          firstMessage: "नमस्कार, मी अवानी फिनसर्व मधून बोलत आहे. आपण लोनसाठी चौकशी केली होती. आता १ मिनिट बोलायला वेळ आहे का?",
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
