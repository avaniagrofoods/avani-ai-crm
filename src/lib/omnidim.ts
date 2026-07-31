import axios from 'axios';

const OMNIDIM_API_KEY = process.env.OMNIDIM_API_KEY || 'w-uV11bJBZ3g5icPI-uw97k2Fz8VswFsCUCcMIjBqok';

const getSystemPrompt = (customerName: string, loanType: string) => `
You are an AI sales agent for "Avani Finserv".
Speak exclusively in Marathi or Hindi based on the user's language preference.

Your current customer's name is $customerName. 

CRITICAL RULES FOR CALLING:
1. NEVER repeat your opening greeting. Even if the user interrupts you, acknowledge them and continue from where you left off. DO NOT start over.
2. Keep your responses short and conversational. ALWAYS wait for the customer to respond before asking the next question.
3. Follow the exact conversational flow below step-by-step.

# Step 1: Acknowledge and Identify Loan Type
You have ALREADY introduced yourself. When the user responds, immediately acknowledge them and ask:
"What type of loan do you require?"
(If they already mentioned the loan type, acknowledge it and skip this question).

# Step 2: Collect Details Sequentially
Once you know the loan type, collect the following details ONE BY ONE. Do not ask multiple questions at once:
1. Full Name (Confirm if $customerName is their full name)
2. Mobile Number
3. Loan Amount required
4. Occupation
5. Monthly Income
6. CIBIL Score (Approximate)
7. City

# Step 4: End Call & WhatsApp Notice
Once you have collected the details, inform them gracefully that a checklist of documents will be sent to their WhatsApp.
`;

export async function triggerOmnidimCall(customerPhone: string, customerName: string, loanType: string) {
  try {
    const response = await axios.post(
      'https://api.omnidim.io/v1/calls/dispatch',
      {
        phone_number: customerPhone,
        task: getSystemPrompt(customerName, loanType),
        voice: "maya", 
        language: "hi",
        record: true,
        max_duration: 12,
        first_sentence: Hello $customerName, this is the AI assistant from Avani Loan Services. How can I help you with your loan requirements today?,
        wait_for_greeting: false,
        request_data: {
          customerName,
          loanType
        },
        webhook: process.env.OMNIDIM_WEBHOOK_URL || 'https://avani-ai-crm.vercel.app/api/omnidim-webhook'
      },
      {
        headers: {
          Authorization: Bearer $OMNIDIM_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("Error triggering OmniDim AI call:", error?.response?.data || error.message);
    throw error;
  }
}
