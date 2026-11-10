import { sendAiSensyWhatsApp } from './aisensy';
import { sendChatMitraMessage } from './chatmitra';
import connectToDatabase from './db';
import { Message } from '@/models/Message';
import { ProviderLedger } from '@/models/ProviderLedger';
import axios from 'axios';

export interface DispatchMessageOptions {
  phone: string;
  name: string;
  templateName?: string;
  templateParams?: string[];
  messageText?: string;
  provider?: 'AISENSY' | 'META_CLOUD' | 'CHATMITRA' | 'CHATMANTRA';
  campaignId?: string;
  leadId?: string;
  journeyStage?: string;
}

export interface DispatchResult {
  success: boolean;
  provider: 'AISENSY' | 'META_CLOUD' | 'CHATMITRA' | 'CHATMANTRA';
  providerMessageId?: string;
  status: string;
  error?: string;
  idempotencyKey: string;
  isDuplicate?: boolean;
}

export class ProviderRouter {
  static async dispatchMessage(options: DispatchMessageOptions): Promise<DispatchResult> {
    await connectToDatabase();

    // Central Provider Selection: Check option override, then process.env.WHATSAPP_PROVIDER, defaulting to CHATMITRA
    const configuredDefault = (process.env.WHATSAPP_PROVIDER || process.env.DEFAULT_WHATSAPP_PROVIDER || 'CHATMITRA').toUpperCase();
    const candidateProvider = (options.provider || configuredDefault) as 'AISENSY' | 'META_CLOUD' | 'CHATMITRA' | 'CHATMANTRA';
    const selectedProvider: 'AISENSY' | 'META_CLOUD' | 'CHATMITRA' | 'CHATMANTRA' = 
      ['CHATMITRA', 'CHATMANTRA', 'AISENSY', 'META_CLOUD'].includes(candidateProvider) 
        ? candidateProvider 
        : 'CHATMITRA';

    const campaignId = options.campaignId || `CMP-${Date.now()}`;
    const journeyStage = options.journeyStage || 'INITIAL_BROADCAST';
    const effectiveTemplate = options.templateName || (options.messageText ? 'direct_text_message' : 'avani_loan_intro_v2');
    
    // Normalize phone number
    let cleanPhone = options.phone.trim().replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.length === 10 ? '+91' + cleanPhone : '+' + cleanPhone;
    }

    const idempotencyKey = `${selectedProvider}:${campaignId}:${options.leadId || cleanPhone}:${effectiveTemplate}:${journeyStage}`;

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
        templateName: effectiveTemplate,
        templateParams: options.templateParams || [options.name],
        text: options.messageText
      }, `${campaignId}_${Date.now()}`);

      if (res.success && res.messageId) {
        // Record Message reservation atomically
        await Message.create({
          idempotencyKey,
          leadId: options.leadId,
          phone: cleanPhone,
          recipientPhone: cleanPhone,
          senderPhone: 'AVANI_OFFICIAL',
          direction: 'OUTBOUND',
          channel: 'WhatsApp',
          provider: 'AiSensy',
          providerMessageId: res.messageId,
          templateName: effectiveTemplate,
          text: options.messageText || (options.templateName ? `[Template: ${options.templateName}]` : ''),
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
        templateName: effectiveTemplate,
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
    } else if (selectedProvider === 'CHATMITRA' || selectedProvider === 'CHATMANTRA') {
      // CHATMITRA / CHATMANTRA Provider Route
      const res = await sendChatMitraMessage({
        toPhone: cleanPhone,
        templateName: options.templateName,
        templateParams: options.templateParams || [options.name],
        messageText: options.messageText,
        leadId: options.leadId,
        correlationId: campaignId
      });

      if (res.success && res.messageId) {
        await Message.create({
          idempotencyKey,
          leadId: options.leadId,
          phone: cleanPhone,
          recipientPhone: cleanPhone,
          senderPhone: 'AVANI_OFFICIAL',
          direction: 'OUTBOUND',
          channel: 'WhatsApp',
          provider: 'ChatMitra',
          providerMessageId: res.messageId,
          templateName: effectiveTemplate,
          text: options.messageText || (options.templateName ? `[Template: ${options.templateName}]` : ''),
          status: 'API_ACCEPTED'
        }).catch((e: any) => console.warn(`Message record error: ${e.message}`));

        await ProviderLedger.create({
          campaignId,
          leadId: options.leadId,
          provider: 'CHATMITRA',
          operation: 'BROADCAST_DISPATCH',
          providerMessageId: res.messageId,
          status: 'API_ACCEPTED',
          completedAt: new Date()
        }).catch((e: any) => console.warn(`ProviderLedger record error: ${e.message}`));

        return {
          success: true,
          provider: 'CHATMITRA',
          providerMessageId: res.messageId,
          status: 'API_ACCEPTED',
          idempotencyKey
        };
      }

      const failureReason = res.error || 'ChatMitra Dispatch Failed';
      await Message.create({
        idempotencyKey,
        leadId: options.leadId,
        phone: cleanPhone,
        recipientPhone: cleanPhone,
        senderPhone: 'AVANI_OFFICIAL',
        direction: 'OUTBOUND',
        channel: 'WhatsApp',
        provider: 'ChatMitra',
        templateName: effectiveTemplate,
        text: options.messageText || (options.templateName ? `[Template: ${options.templateName}]` : ''),
        status: 'API_FAILED',
        failureReason
      }).catch(() => {});

      return {
        success: false,
        provider: 'CHATMITRA',
        status: 'API_FAILED',
        error: failureReason,
        idempotencyKey
      };
    } else {
      // META_CLOUD Provider Route
      // Respect Provider Mock Safety Gate
      if (process.env.PROVIDER_MODE === 'mock') {
        const mockWamid = `mock_meta_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await Message.create({
          idempotencyKey,
          leadId: options.leadId,
          phone: cleanPhone,
          recipientPhone: cleanPhone,
          senderPhone: 'AVANI_OFFICIAL',
          direction: 'OUTBOUND',
          channel: 'WhatsApp',
          provider: 'MetaCloud_Mock',
          providerMessageId: mockWamid,
          templateName: effectiveTemplate,
          text: options.messageText || (options.templateName ? `[Template: ${options.templateName}]` : ''),
          status: 'API_ACCEPTED'
        }).catch(() => {});

        await ProviderLedger.create({
          campaignId,
          leadId: options.leadId,
          provider: 'META_CLOUD',
          operation: 'BROADCAST_DISPATCH',
          providerMessageId: mockWamid,
          status: 'API_ACCEPTED',
          completedAt: new Date()
        }).catch(() => {});

        return {
          success: true,
          provider: 'META_CLOUD',
          providerMessageId: mockWamid,
          status: 'API_ACCEPTED',
          idempotencyKey
        };
      }

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
              name: effectiveTemplate,
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
            templateName: effectiveTemplate,
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
