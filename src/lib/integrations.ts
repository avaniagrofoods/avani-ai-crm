import axios from 'axios';

export async function logToGoogleSheets(lead: any) {
  const url = process.env.GOOGLE_SHEET_APP_SCRIPT_URL;
  if (!url) return;
  try {
    await axios.post(url, {
      name: lead.name,
      phone: lead.phone,
      loanType: lead.loanType,
      status: lead.status,
      requestedAmount: lead.requestedAmount,
      summary: lead.callSummary
    });
  } catch (error) {
    console.error("Google Sheets logging error:", error);
  }
}

export async function syncToHubSpot(lead: any) {
  const portalId = process.env.HUBSPOT_PORTAL_ID;
  const formId = process.env.HUBSPOT_FORM_ID;
  if (!portalId || !formId) return;

  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`;
  
  try {
    await axios.post(url, {
      fields: [
        { name: "firstname", value: lead.name },
        { name: "phone", value: lead.phone },
        { name: "message", value: `Loan Type: ${lead.loanType} | Status: ${lead.status} | Amount: ${lead.requestedAmount || 'N/A'}` }
      ]
    });
  } catch (error: any) {
    console.error("HubSpot sync error:", error?.response?.data || error.message);
  }
}

export async function triggerMakeWebhook(lead: any) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) return;
  try {
    await axios.post(url, lead);
  } catch (error) {
    console.error("Make.com Webhook error:", error);
  }
}

export async function triggerPabblyWebhook(lead: any) {
  const url = "https://hook.pabbly.com/api/webhook/6a080bc1e6a8ff432d89bea8/6a0811cf22f0d1bfa6095a6d";
  try {
    await axios.post(url, lead);
  } catch (error) {
    console.error("Pabbly Webhook error:", error);
  }
}

export async function sendMissedCallWhatsApp(phone: string, name: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || "+917249108474";
  
  if (!accountSid || !authToken) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const message = `Hello ${name}, we tried calling you from Avani Finserv regarding your loan inquiry but couldn't connect. Are you still looking for a loan? Reply YES to continue chatting with our AI assistant.`;
  const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  const data = new URLSearchParams({
    To: `whatsapp:${formattedPhone}`,
    From: `whatsapp:${twilioWhatsApp}`,
    Body: message
  });

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    await axios.post(url, data.toString(), {
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  } catch (error: any) {
    console.error("Twilio Missed Call WA error:", error?.response?.data || error.message);
  }
}

export async function sendWhatsAppChecklist(phone: string, name: string, loanType: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  // Use the 9175635165 number for the final docs message
  const twilioWhatsApp = "+919175635165";
  
  if (!accountSid || !authToken) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const message = `Hello ${name}, thank you for your interest in a ${loanType} from Avani Loan Services! Please upload your PAN card, Aadhar card, and other required documents securely here: https://www.avanifinserv.com/documents`;

  const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  const data = new URLSearchParams({
    To: `whatsapp:${formattedPhone}`,
    From: `whatsapp:${twilioWhatsApp}`,
    Body: message
  });

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    await axios.post(url, data.toString(), {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  } catch (error: any) {
    console.error("Twilio WhatsApp error:", error?.response?.data || error.message);
  }
}
