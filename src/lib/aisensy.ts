import axios from 'axios';

export interface AiSensyMessagePayload {
  destination: string;
  userName: string;
  templateName: string;
  templateParams?: string[];
  tags?: string[];
}

export interface AiSensyResponse {
  success: boolean;
  messageId?: string;
  rawResponse?: any;
  error?: string;
}

export async function sendAiSensyWhatsApp(payload: AiSensyMessagePayload): Promise<AiSensyResponse> {
  const apiKey = (process.env.AISENCY_WABA_API_KEY || '').trim();

  let phone = payload.destination.trim();
  if (!phone.startsWith('+')) {
    phone = phone.length === 10 ? '+91' + phone : '+' + phone;
  }

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

  // Fallback to Meta Official WhatsApp API
  const metaToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1147494668457940';

  if (metaToken && phoneId) {
    try {
      const cleanPhone = phone.replace('+', '');
      const metaRes = await axios.post(
        `https://graph.facebook.com/v19.0/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: {
            body: `Namaste ${payload.userName}! Thank you for contacting AVANI LOAN SERVICES (Latur). We offer Personal, Business, Home, Doctor, CA & Education Loans with 48h approval.\n\nWebsite: https://www.avanifinserv.com/\nWhatsApp: +91 91756 35165`
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
      console.error('[Meta WhatsApp Fallback Error]:', metaErr?.response?.data || metaErr.message);
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
