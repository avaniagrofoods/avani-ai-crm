import axios from 'axios';
import connectToDatabase from '@/lib/db';
import { Message } from '@/models/Message';
import mongoose from 'mongoose';

export interface AiSensyMessagePayload {
  destination: string;
  userName: string;
  templateName?: string;
  templateParams?: string[];
  tags?: string[];
  text?: string;
  leadId?: mongoose.Types.ObjectId | string;
  contactId?: mongoose.Types.ObjectId | string;
  broadcastId?: mongoose.Types.ObjectId | string;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface AiSensyResponse {
  success: boolean;
  messageId?: string;
  rawResponse?: any;
  error?: string;
  status?: string; // 'Sent', 'Unknown', 'Failed'
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
export async function sendAiSensyWhatsApp(payload: AiSensyMessagePayload, existingMessageId: string): Promise<AiSensyResponse> {
  const omnidmKey = (process.env.OMNIDIM_API_KEY || 'w-uV11bJBZ3g5icPI-uw97k2Fz8VswFsCUCcMIjBqok.').trim();
  const apiKey = (process.env.AISENCY_WABA_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNjcwZjk0ZDBjMzlmNTdlYWE2Nzk5ZiIsIm5hbWUiOiJBVkFOSSBMT0FOIFNFUlZJQ0UiLCJhcHBOYW1lIjoiQWlTZW5zeSIsImNsaWVudElkIjoiNmE2NzBmOTRkMGMzOWY1N2VhYTY3OTlhIiwiYWN0aXZlUGxhbiI6IkJBU0lDX1FVQVJURVJMWSIsImlhdCI6MTc4NjM2MTY5Nn0.zUbuZSCFRH5ZZo_pqBVMfqaHXLKbGEFC5mPOse1bW5M.').trim();
  const automationNumber = process.env.WABA_AUTOMATION_NUMBER || '+917249108474';

  let phone = payload.destination.trim();
  if (!phone.startsWith('+')) {
    phone = phone.length === 10 ? '+91' + phone : '+' + phone;
  }

  console.log(`[WhatsApp Dispatch] Sending to ${phone} from Automation WABA: ${automationNumber}`);

  // MOCK PROVIDER SAFETY GATE
  if (process.env.PROVIDER_MODE === 'mock') {
    const mockMsgId = 'mock_wamid_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    try {
      await connectToDatabase();
      const { ProviderLedger } = require('@/models/ProviderLedger');
      await ProviderLedger.create({
        correlationId: payload.correlationId || 'none',
        idempotencyKey: payload.idempotencyKey || 'none',
        provider: 'MockProvider',
        operation: 'send_whatsapp',
        requestHash: payload.templateName || payload.text?.substring(0, 50) || 'unknown',
        providerMessageId: mockMsgId,
        httpStatus: 200,
        result: 'MOCK_SUCCESS',
        completedAt: new Date()
      });
      console.log(`[Provider MOCK] Safety gate triggered. Logged to ledger: ${mockMsgId}`);
      if (existingMessageId) {
        await updateMessage(existingMessageId, mockMsgId, 'MockProvider', 'Sent');
      }
    } catch (e: any) {
      console.error("[Provider MOCK Error] Ledger failure:", e.message);
    }
    return { success: true, messageId: mockMsgId, status: 'Sent' };
  }

  // 1. Primary: AiSensy WABA Campaign API (Since WABA is registered on AiSensy)
  if (apiKey && !payload.text) {
    try {
      const response = await axios.post(
        'https://backend.aisensy.com/campaign/t1/api/v2',
        {
          apiKey: apiKey,
          campaignName: payload.templateName || 'avani_loan_intro_v2',
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
        const msgId = response.data.submitted_message_id || 'aisensy_' + Date.now();
        await updateMessage(existingMessageId, msgId, 'AiSensy', 'Sent');
        return {
          success: true,
          messageId: msgId,
          rawResponse: response.data,
          status: 'Sent'
        };
      }
    } catch (error: any) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout');
      const status = isTimeout ? 'Unknown' : 'Failed';
      const rawErr = error?.response?.data || error.message;
      const errStr = typeof rawErr === 'object' ? JSON.stringify(rawErr) : String(rawErr);
      await updateMessage(existingMessageId, 'aisensy_err_' + Date.now(), 'AiSensy', status, errStr);
      console.warn(`[AiSensy API Warning]: ${status}`, rawErr);
      if (isTimeout) return { success: false, error: 'Network timeout', status: 'Unknown' };
    }
  }

  // 2. Secondary Fallback: OmniDM Campaign #22 API
  const omnidmRes = await sendOmniDMWhatsApp(phone, payload.userName);
  if (omnidmRes.success) {
    const msgId = omnidmRes.data?.id || 'omnidim_wa_' + Date.now();
    await updateMessage(existingMessageId, msgId, 'OmniDM', 'Sent');
    return {
      success: true,
      messageId: msgId,
      rawResponse: omnidmRes.data,
      status: 'Sent'
    };
  }

  // 3. Fallback: Meta Cloud API v25.0
  let metaToken = (process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN || "EAAdIUij5eSEBSNfoyNAcIPxkPjzbha5MGRon34ydzNaZALXi5UViIJgLsOEQ9qScR0s8cT7gyQGvbsrfQiiJM9cmiS46rFj7zJ6qig77AQi06zaK2XudDekrYhfB5395nVFfljYVZCl2eiZCm5TUQFeOEq8kRsCu3gtlzINBO9QGdzUZBUVHJ8ZBdwswgygZDZD").trim();
  let phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '1147494668457940').trim();

  try {
    const { query } = require('./postgres');
    if (query) {
      const result = await query('SELECT "whatsappToken", "whatsappPhoneNumberId" FROM "Workspace" LIMIT 1');
      if (result && result.rows && result.rows.length > 0) {
        if (result.rows[0].whatsappToken) metaToken = result.rows[0].whatsappToken;
        if (result.rows[0].whatsappPhoneNumberId) phoneId = result.rows[0].whatsappPhoneNumberId;
      }
    }
  } catch (e) {
    console.warn("Could not fetch DB credentials for Meta fallback", e);
  }

  if (metaToken && phoneId) {
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      let dataPayload: any = {
        messaging_product: 'whatsapp',
        to: cleanPhone
      };

      if (payload.templateName) {
        dataPayload.type = 'template';
        dataPayload.template = {
          name: payload.templateName,
          language: { code: 'en' }
        };
        if (payload.templateParams && payload.templateParams.length > 0) {
          dataPayload.template.components = [
            {
              type: "body",
              parameters: payload.templateParams.map(param => ({
                type: "text",
                text: String(param)
              }))
            }
          ];
        }
      } else {
        dataPayload.type = 'text';
        dataPayload.text = {
          body: payload.text || `Namaste ${payload.userName}! I can provide you with detailed information about personal, business, home, doctor, and educational loans within 5 minutes. Please share your name, location, profession or nature of employment (e.g., salaried, businessperson, doctor, CA, etc.), and the type of loan you require.`
        };
      }

      const metaRes = await axios.post(
        `https://graph.facebook.com/v25.0/${phoneId}/messages`,
        dataPayload,
        {
          headers: {
            'Authorization': `Bearer ${metaToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const msgId = metaRes.data?.messages?.[0]?.id || 'meta_' + Date.now();
      await updateMessage(existingMessageId, msgId, 'Meta', 'Sent');
      return {
        success: true,
        messageId: msgId,
        rawResponse: metaRes.data,
        status: 'Sent'
      };
    } catch (metaErr: any) {
      const isTimeout = metaErr.code === 'ECONNABORTED' || metaErr.message?.toLowerCase().includes('timeout');
      const status = isTimeout ? 'Unknown' : 'Failed';
      const rawErr = metaErr?.response?.data?.error?.message || metaErr.message;
      const errStr = typeof rawErr === 'object' ? JSON.stringify(rawErr) : String(rawErr);
      await updateMessage(existingMessageId, 'meta_err_' + Date.now(), 'Meta', status, errStr);
      return {
        success: false,
        error: errStr,
        status: status
      };
    }
  }

  return {
    success: false,
    error: 'No valid WhatsApp provider API keys configured'
  };
}

async function updateMessage(dbMessageId: string, providerMessageId: string, provider: string, status: string, error?: string) {
  await connectToDatabase();
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database unavailable during message logging. System halting to prevent degraded state inconsistencies.');
  }

  await Message.findByIdAndUpdate(dbMessageId, {
    $set: {
      providerMessageId: providerMessageId,
      provider: provider,
      status: status,
      failureReason: error,
      sentAt: status === 'Sent' ? new Date() : undefined,
      failedAt: status === 'Failed' ? new Date() : undefined
    }
  });
}
