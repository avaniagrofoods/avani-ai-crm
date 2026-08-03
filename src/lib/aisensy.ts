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
 * Spec: POST https://omnidim.io/api/v1/whatsapp/campaign/22/contact
 * Authorization: Bearer w-uV11bJBZ3g5icPI-uw97k2Fz8VswFsCUCcMIjBqok.
 * Payload: { "phone_number": "+919876543210", "$name": "Sample 1" }
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
 * Multi-provider WhatsApp dispatcher:
 * 1. OmniDM Campaign #22 API (Official Omnidim WhatsApp)
 * 2. AiSensy WABA API
 * 3. Meta Graph WhatsApp Official API (v25.0 / v19.0)
 */
export async function sendAiSensyWhatsApp(payload: AiSensyMessagePayload): Promise<AiSensyResponse> {
  const apiKey = (process.env.AISENCY_WABA_API_KEY || '').trim();

  let phone = payload.destination.trim();
  if (!phone.startsWith('+')) {
    phone = phone.length === 10 ? '+91' + phone : '+' + phone;
  }

  // 1. OmniDM WhatsApp Campaign API
  const omnidmRes = await sendOmniDMWhatsApp(phone, payload.userName);
  if (omnidmRes.success) {
    return {
      success: true,
      messageId: omnidmRes.data?.id || 'omnidim_wa_' + Date.now(),
      rawResponse: omnidmRes.data
    };
  }

  // 2. AiSensy WABA Campaign API
  if (apiKey) {
    try {
      const response = await axios.post(
        'https://backend.aisensy.com/campaign/t1/api/v2',
        {
          apiKey: apiKey,
          campaignName: payload.templateName || 'Avani_Loan_Welcome',
          destination: phone,
          userName: payload.userName,
          templateParams: payload.templateParams || [payload.userName, 'AVANI LOAN SERVICES'],
          source: 'AVANI AI CRM',
          tags: payload.tags || ['Lead', 'Avani_Finserv']
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      return {
        success: true,
        messageId: response.data?.messageId || response.data?.id || 'aisensy_' + Date.now(),
        rawResponse: response.data
      };
    } catch (error: any) {
      console.warn('[AiSensy API Warning]:', error?.response?.data || error.message);
    }
  }

  // 3. Fallback to Meta Official WhatsApp API (v25.0 / v19.0)
  const metaToken = (process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN || "EAAdIUij5eSEBSIp6Ai6MbYok1taDXSYFxMddZCKK0Pk4dZCNUPkWLJkbOSxOkEeteUrFTM6Auuc24JBedbwJwP62y05eiHVTJLVjzrZAZBeZA7vjlCUY2QV30qSq3SAiIVvJZBUaDmlO4odoJa2KB5s9KFUdaCWIuRyZAbKppuZBTK9qGEL7EBqy7UkpjxFscgZDZD").trim();
  const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '1147494668457940').trim();

  if (metaToken && phoneId) {
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const messageBody = `Namaste ${payload.userName}! I can provide you with detailed information about personal, business, home, doctor, and educational loans within 5 minutes. Please share your name, location, profession or nature of employment (e.g., salaried, businessperson, doctor, CA, etc.), and the type of loan you require.\n\nWebsite: https://www.avanifinserv.com/\nWhatsApp: +91 91756 35165`;

      const metaRes = await axios.post(
        `https://graph.facebook.com/v25.0/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: {
            body: messageBody
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
      console.error('[Meta WhatsApp v25.0 Error]:', metaErr?.response?.data || metaErr.message);

      // Retry with v19.0 fallback if v25.0 fails
      try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const metaRes19 = await axios.post(
          `https://graph.facebook.com/v19.0/${phoneId}/messages`,
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
          messageId: metaRes19.data?.messages?.[0]?.id || 'meta_v19_' + Date.now(),
          rawResponse: metaRes19.data
        };
      } catch (fallbackErr: any) {
        return {
          success: false,
          error: fallbackErr?.response?.data?.error?.message || metaErr?.response?.data?.error?.message || metaErr.message
        };
      }
    }
  }

  return {
    success: false,
    error: 'No valid WhatsApp provider API keys configured'
  };
}
