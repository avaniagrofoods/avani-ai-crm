import axios from 'axios';

export interface AiSensyMessagePayload {
  destination: string;
  userName: string;
  templateName?: string;
  templateParams?: string[];
  tags?: string[];
}

export interface AiSensyResponse {
  success: boolean;
  messageId?: string;
  rawResponse?: any;
  error?: string;
}

/**
 * Triggers OmniDM WhatsApp Campaign API (Campaign #22)
 */
export async function sendOmniDMWhatsApp(phone: string, name: string): Promise<any> {
  const omnidmKey = (process.env.OMNIDIM_API_KEY || 'w-uV11bJBZ3g5icPI-uw97k2Fz8VswFsCUCcMIjBqok.').trim();

  let formattedPhone = phone.trim();
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = formattedPhone.length === 10 ? '+91' + formattedPhone : '+' + formattedPhone;
  }

  try {
    const res = await axios.post(
      'https://omnidim.io/api/v1/whatsapp/campaign/22/contact',
      {
        phone_number: formattedPhone,
        "$name": name || 'Valued Customer'
      },
      {
        headers: {
          'Authorization': `Bearer ${omnidmKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    console.log(`[OmniDM WhatsApp Campaign 22 Success] Phone: ${formattedPhone}`, res.data);
    return { success: true, data: res.data };
  } catch (err: any) {
    console.warn(`[OmniDM WhatsApp Campaign 22 Warning]:`, err?.response?.data || err.message);
    return { success: false, error: err?.response?.data || err.message };
  }
}

/**
 * Primary WABA Dispatcher using AiSensy Official API + OmniDM & Meta Cloud Fallbacks
 */
export async function sendAiSensyWhatsApp(payload: AiSensyMessagePayload): Promise<AiSensyResponse> {
  const apiKey = (process.env.AISENCY_WABA_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNjcwZjk0ZDBjMzlmNTdlYWE2Nzk5ZiIsIm5hbWUiOiJBVkFOSSBMT0FOIFNFUlZJQ0UiLCJhcHBOYW1lIjoiQWlTZW5zeSIsImNsaWVudElkIjoiNmE2NzBmOTRkMGMzOWY1N2VhYTY3OTlhIiwiYWN0aXZlUGxhbiI6IkZSRUVfRk9SRVZFUiIsImlhdCI6MTc4NTEzOTA5Mn0.m0yF5dd541YlK4J0UcTa5WEIPCrnW-qQaQ7mX1MOO7w').trim();

  let phone = payload.destination.trim();
  if (!phone.startsWith('+')) {
    phone = phone.length === 10 ? '+91' + phone : '+' + phone;
  }

  // 1. Primary: AiSensy WABA Campaign API (Since WABA is registered on AiSensy)
  if (apiKey) {
    try {
      const response = await axios.post(
        'https://backend.aisensy.com/campaign/t1/api/v2',
        {
          apiKey: apiKey,
          campaignName: payload.templateName || 'Avani_Loan_Welcome',
          destination: phone,
          userName: payload.userName,
          templateParams: payload.templateParams && payload.templateParams.length === 1 ? payload.templateParams : [payload.userName],
          source: 'AVANI AI CRM',
          tags: payload.tags || ['Lead', 'Avani_Finserv']
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      if (response.data && (response.data.success === "true" || response.data.success === true || response.data.submitted_message_id)) {
        return {
          success: true,
          messageId: response.data.submitted_message_id || 'aisensy_' + Date.now(),
          rawResponse: response.data
        };
      }
    } catch (error: any) {
      console.warn('[AiSensy API Warning]:', error?.response?.data || error.message);
    }
  }

  // 2. Secondary Fallback: OmniDM Campaign #22 API
  const omnidmRes = await sendOmniDMWhatsApp(phone, payload.userName);
  if (omnidmRes.success) {
    return {
      success: true,
      messageId: omnidmRes.data?.id || 'omnidim_wa_' + Date.now(),
      rawResponse: omnidmRes.data
    };
  }

  // 3. Fallback: Meta Cloud API v25.0
  const metaToken = (process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN || "EAAdIUij5eSEBSPNXXeehEPuB6hf7UvNfezzV0Lh5kSZC17tdQG6gxLeWGKTFuh7cbZCjH80wZBFKfSsLpvaTbdp0J4x8aXoxDqxm17R3Vcv9ZBqyCU1yZBe7ADVHEhokTn11sI6nYU2WfEymwW4jW447n2AvH4bCwZCfBWVj9ATM9Seq2OczKZABY6eKTI6wgZDZD").trim();
  const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '1147494668457940').trim();

  if (metaToken && phoneId) {
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const metaRes = await axios.post(
        `https://graph.facebook.com/v25.0/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: {
            body: `Namaste ${payload.userName}! I can provide you with detailed information about personal, business, home, doctor, and educational loans within 5 minutes. Please share your name, location, profession or nature of employment (e.g., salaried, businessperson, doctor, CA, etc.), and the type of loan you require.`
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${metaToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return {
        success: true,
        messageId: metaRes.data?.messages?.[0]?.id || 'meta_' + Date.now(),
        rawResponse: metaRes.data
      };
    } catch (metaErr: any) {
      return {
        success: false,
        error: metaErr?.response?.data?.error?.message || metaErr.message
      };
    }
  }

  return {
    success: false,
    error: 'No valid WhatsApp provider API keys configured'
  };
}
