import axios from 'axios';
import { evaluateAuthorizedTestRecipient } from './safeguards';

const VAPI_API_KEY = process.env.VAPI_API_KEY || '';
const VAPI_API_URL = process.env.VAPI_API_URL || 'https://api.vapi.ai';
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID || '';
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID || '';

export async function triggerOutboundCall(customerPhone: string, customerName: string, loanType: string) {
  if (process.env.PROVIDER_MODE !== 'live' || process.env.OMNIDM_LIVE_ENABLED !== 'true') {
    console.warn(`[VAPI][SAFE-MODE] Outbound call blocked because PROVIDER_MODE=${process.env.PROVIDER_MODE || 'unset'} or OMNIDM_LIVE_ENABLED=${process.env.OMNIDM_LIVE_ENABLED || 'unset'}`);
    return { blocked: true, reason: 'SAFE_MODE_OR_VOICE_DISABLED' };
  }
  const recipientCheck = evaluateAuthorizedTestRecipient(customerPhone);
  if (!recipientCheck.allowed) {
    console.warn(`[VAPI][SAFEGUARD] Outbound call blocked: ${recipientCheck.reason}`);
    return { blocked: true, reason: recipientCheck.reason };
  }
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
