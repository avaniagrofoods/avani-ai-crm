import { sendAiSensyWhatsApp } from './aisensy';
import connectToDatabase from './db';
import { Message } from '@/models/Message';
import { ProviderLedger } from '@/models/ProviderLedger';
import axios from 'axios';

export interface DispatchMessageOptions {
  phone: string;
  name: string;
  templateName: string;
  templateParams?: string[];
  provider?: 'AISENSY' | 'META_CLOUD';
  campaignId?: string;
  leadId?: string;
  journeyStage?: string;
}

export interface DispatchResult {
  success: boolean;
  provider: 'AISENSY' | 'META_CLOUD';
  providerMessageId?: string;
  status: string;
  error?: string;
  idempotencyKey: string;
  isDuplicate?: boolean;
}

export class ProviderRouter {
  static async dispatchMessage(options: DispatchMessageOptions): Promise<DispatchResult> {
    await connectToDatabase();

    const selectedProvider = options.provider || 'AISENSY';
    const campaignId = options.campaignId || `CMP-${Date.now()}`;
    const journeyStage = options.journeyStage || 'INITIAL_BROADCAST';
    
    // Normalize phone number
    let cleanPhone = options.phone.trim().replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.length === 10 ? '+91' + cleanPhone : '+' + cleanPhone;
    }

    const idempotencyKey = `${selectedProvider}:${campaignId}:${options.leadId || cleanPhone}:${options.templateName}:${journeyStage}`;

    // 1. Check for existing reservation / idempotency lock
    const existingMsg = await Message.findOne({ idempotencyKey });
    if (existingMsg) {
      console.log(`[ProviderRouter] Idempotency lock hit for key: ${idempotencyKey}`);
      return {
        success: true,
        provider: selectedProvider,
        providerMessageId: existingMsg.providerMessageId,
        status: existingMsg.status || 'API_ACCEPTED',
        idempotencyKey,
        isDuplicate: true
      };
    }

    // 2. Execute Dispatch based on Provider
    if (selectedProvider === 'AISENSY') {
      const res = await sendAiSensyWhatsApp({
        destination: cleanPhone,
        userName: options.name,
        templateName: options.templateName,
        templateParams: options.templateParams || [options.name]
      }, `${campaignId}_${Date.now()}`);

      if (res.success && res.messageId) {
        // Record Message reservation atomically
        await Message.create({
          idempotencyKey,
          leadId: options.leadId,
          phone: cleanPhone,
          direction: 'OUTBOUND',
          provider: 'AiSensy',
          providerMessageId: res.messageId,
          templateName: options.templateName,
          status: 'API_ACCEPTED'
        }).catch(e => console.warn(`Message record error: ${e.message}`));

        await ProviderLedger.create({
          campaignId,
          leadId: options.leadId,
          provider: 'AISENSY',
          operation: 'BROADCAST_DISPATCH',
          providerMessageId: res.messageId,
          status: 'API_ACCEPTED',
          completedAt: new Date()
        }).catch(e => console.warn(`ProviderLedger record error: ${e.message}`));

        return {
          success: true,
          provider: 'AISENSY',
          providerMessageId: res.messageId,
          status: 'API_ACCEPTED',
          idempotencyKey
        };
      }

      const failureReason = res.error || 'AiSensy Dispatch Failed';
      const statusLabel = failureReason.toLowerCase().includes('balance') ? 'BALANCE_BLOCKED' : 'API_FAILED';

      await Message.create({
        idempotencyKey,
        leadId: options.leadId,
        phone: cleanPhone,
        direction: 'OUTBOUND',
        provider: 'AiSensy',
        templateName: options.templateName,
        status: statusLabel,
        failureReason
      }).catch(() => {});

      return {
        success: false,
        provider: 'AISENSY',
        status: statusLabel,
        error: failureReason,
        idempotencyKey
      };
    } else {
      // META_CLOUD Provider Route
      const metaToken = process.env.WHATSAPP_TOKEN || process.env.META_ACCESS_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID;

      if (!metaToken || !phoneId) {
        return {
          success: false,
          provider: 'META_CLOUD',
          status: 'API_FAILED',
          error: 'Meta Cloud credentials not configured',
          idempotencyKey
        };
      }

      try {
        const url = `https://graph.facebook.com/v25.0/${phoneId}/messages`;
        const res = await axios.post(
          url,
          {
            messaging_product: 'whatsapp',
            to: cleanPhone.replace('+', ''),
            type: 'template',
            template: {
              name: options.templateName,
              language: { code: 'en' },
              components: [
                {
                  type: 'body',
                  parameters: (options.templateParams || [options.name]).map(p => ({ type: 'text', text: p }))
                }
              ]
            }
          },
          {
            headers: { 'Authorization': `Bearer ${metaToken}`, 'Content-Type': 'application/json' },
            timeout: 10000
          }
        );

        const wamid = res.data?.messages?.[0]?.id;

        if (wamid) {
          await Message.create({
            idempotencyKey,
            leadId: options.leadId,
            phone: cleanPhone,
            direction: 'OUTBOUND',
            provider: 'MetaCloud',
            providerMessageId: wamid,
            templateName: options.templateName,
            status: 'API_ACCEPTED'
          }).catch(() => {});

          return {
            success: true,
            provider: 'META_CLOUD',
            providerMessageId: wamid,
            status: 'API_ACCEPTED',
            idempotencyKey
          };
        }

        return {
          success: false,
          provider: 'META_CLOUD',
          status: 'API_FAILED',
          error: 'No message ID returned from Meta Cloud API',
          idempotencyKey
        };
      } catch (err: any) {
        const errMsg = err?.response?.data?.error?.message || err.message;
        return {
          success: false,
          provider: 'META_CLOUD',
          status: 'API_FAILED',
          error: errMsg,
          idempotencyKey
        };
      }
    }
  }
}
