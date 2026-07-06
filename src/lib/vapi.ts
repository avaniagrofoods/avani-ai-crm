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
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID || 'd710a085-0a9b-45bc-ab03-d40bdcab095d',
        assistantId: VAPI_ASSISTANT_ID,
        // Override variables so the script knows the customer name and desired loan type
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
