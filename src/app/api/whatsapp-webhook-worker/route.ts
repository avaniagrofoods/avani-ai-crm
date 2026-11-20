import { NextResponse } from 'next/server';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import { sendChatMitraMessage, classifyLoanCategory } from '@/lib/chatmitra';
import { AgentEngine } from '@/lib/ai-agent';
import { OptOutEngine } from '@/lib/optout-engine';
import { normalizeMessageStatus, canTransitionStatus } from '@/lib/message-status';
import { constantTimeEqualStrings } from '@/lib/auth';
import { evaluateWebhookReplyPolicy, maskPhoneForLog } from '@/lib/safeguards';
import {
  CrmSheetsService,
  SheetsCrmError,
  webhookEventRepository,
  messageEventRepository,
  customerRepository,
  leadRepository
} from '@/lib/google-sheets';

const MEDIA_MESSAGE_TYPES = new Set(['document', 'image', 'audio', 'video', 'sticker']);

export async function POST(request: Request) {
  try {
    const workerSecret = process.env.INTERNAL_WORKER_SECRET?.trim();
    const authHeader = request.headers.get('x-worker-auth')?.trim();
    if (!workerSecret || !authHeader || !constantTimeEqualStrings(authHeader, workerSecret)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const payload = await request.json();
    const { eventId, correlationId } = payload;

    // 1. Google Sheets Connectivity Guard (Zero MongoDB Fallback)
    await CrmSheetsService.assertHealthy();

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing eventId' }, { status: 400 });
    }

    // 2. Atomic Lease / Idempotency Check against WEBHOOK_EVENTS
    let existingEvent = await webhookEventRepository.findById(eventId);
    if (
      existingEvent &&
      (existingEvent.processing_status === 'COMPLETED' ||
        existingEvent.processing_status === 'PROCESSING' ||
        existingEvent.processing_status === 'ARCHIVED_HISTORICAL')
    ) {
      console.log(`[Worker] Lease for ${eventId} already claimed/completed (${existingEvent.processing_status}). Bypassing.`);
      return NextResponse.json({ success: true, bypassed: true });
    }

    if (!existingEvent) {
      const reg = await webhookEventRepository.registerWebhookEventIdempotent({
        event_id: eventId,
        provider: payload.provider || 'ChatMitra',
        event_type: payload.eventType || 'INBOUND_MESSAGE',
        rawPayloadForHashOnly: payload
      });
      existingEvent = reg.record;
    }

    await webhookEventRepository.markWebhookStatus({
      event_id: eventId,
      processing_status: 'PROCESSING'
    });

    try {
      const mergedPayload = {
        ...(payload && typeof payload === 'object' ? payload : {}),
        archiveOnly:
          payload?.archiveOnly === true ||
          payload?.archiveOnly === 'true' ||
          payload?.data?.archiveOnly === true ||
          payload?.data?.archiveOnly === 'true',
        suppressAutoReply:
          payload?.suppressAutoReply === true ||
          payload?.suppressAutoReply === 'true' ||
          payload?.data?.suppressAutoReply === true ||
          payload?.data?.suppressAutoReply === 'true'
      };

      const replyPolicy = evaluateWebhookReplyPolicy({
        eventId,
        provider: existingEvent?.provider || payload?.provider,
        payload: mergedPayload,
        inboxRecord: existingEvent
      });

      if (replyPolicy.archiveOnly) {
        await webhookEventRepository.markWebhookStatus({
          event_id: eventId,
          processing_status: 'ARCHIVED_HISTORICAL'
        });
        return NextResponse.json({
          success: true,
          archivedOnly: true,
          suppressed: true,
          outboundDispatched: false
        });
      }

      if (payload.eventType === 'STATUS_UPDATE') {
        const { msgId, statusStr } = payload.data || {};
        if (!msgId || !statusStr) {
          console.warn(`[Worker] Missing msgId or statusStr for STATUS_UPDATE on event ${eventId}`);
          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'COMPLETED'
          });
          return NextResponse.json({ success: true, bypassed: true });
        }

        const formattedStatus = normalizeMessageStatus(statusStr, 'outbound');
        const existingMsg = await messageEventRepository.findByProviderMessageId(msgId);
        const nextStatus =
          !existingMsg || canTransitionStatus(existingMsg.delivery_status as any, formattedStatus)
            ? formattedStatus
            : existingMsg.delivery_status;

        await messageEventRepository.recordMessageEvent({
          event_id: existingMsg?.event_id || `MSG_${msgId}`,
          customer_id: existingMsg?.customer_id || 'UNKNOWN',
          provider: payload.provider || existingMsg?.provider || 'ChatMitra',
          message_type: existingMsg?.message_type || 'TEXT',
          direction: existingMsg?.direction || 'outbound',
          delivery_status: nextStatus,
          provider_message_id: msgId
        });

        await webhookEventRepository.markWebhookStatus({
          event_id: eventId,
          processing_status: 'COMPLETED'
        });
        return NextResponse.json({ success: true });
      }

      if (payload.eventType === 'INBOUND_MESSAGE') {
        const { message, fromPhone, msgId, profileName } = payload.data || {};
        if (!message || !msgId) {
          throw new Error('Missing message or msgId in INBOUND_MESSAGE payload');
        }

        const msgType = String(message.type || 'text').toLowerCase();

        // TASK 5H.4 ZERO-DOCUMENT-STORAGE GUARD:
        // Inbound media/document attachments are strictly ignored; never download, never store mediaId, never create Document records.
        if (MEDIA_MESSAGE_TYPES.has(msgType)) {
          const customer = fromPhone ? await customerRepository.findByMobile(fromPhone) : null;
          await messageEventRepository.recordMessageEvent({
            event_id: `MSG_${msgId}`,
            customer_id: customer?.customer_id || 'UNKNOWN',
            provider: payload.provider || 'ChatMitra',
            message_type: 'MEDIA_IGNORED',
            direction: 'inbound',
            delivery_status: 'MEDIA_ATTACHMENT_IGNORED',
            provider_message_id: msgId
          });
          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'COMPLETED'
          });
          return NextResponse.json({
            success: true,
            mediaRejected: true,
            documentCreated: false,
            message: 'Document and media attachment persistence is disabled under Task 5H.4.'
          });
        }

        let incomingText = '';
        if (msgType === 'text') {
          incomingText = message.text?.body || '';
        } else if (msgType === 'button') {
          incomingText = message.button?.text || message.button?.payload || '';
        } else if (msgType === 'interactive') {
          incomingText =
            message.interactive?.button_reply?.title ||
            message.interactive?.list_reply?.title ||
            message.interactive?.button_reply?.id ||
            '';
        } else if (typeof message === 'string') {
          incomingText = message;
        } else if (message.text && typeof message.text === 'string') {
          incomingText = message.text;
        }

        if (!incomingText) {
          incomingText = 'Namaste, I want to apply for a loan';
        }

        const classifiedLoan = classifyLoanCategory(incomingText);
        const { customer, lead, hydrated } = await CrmSheetsService.registerOrUpdateCustomerLead({
          name: profileName || 'Customer',
          phone: fromPhone,
          loanCategory: classifiedLoan.category,
          leadSource: 'WHATSAPP_INBOUND'
        });

        await messageEventRepository.recordMessageEvent({
          event_id: `MSG_${msgId}`,
          customer_id: customer.customer_id,
          provider: payload.provider || 'ChatMitra',
          message_type: 'TEXT',
          direction: 'inbound',
          delivery_status: 'RECEIVED',
          provider_message_id: msgId
        });

        // Opt-Out Keywords (DPDP Act Compliance: STOP, UNSUBSCRIBE, थांबवा, रोकें)
        if (OptOutEngine.isOptOutMessage(incomingText)) {
          console.log(`[Worker] Opt-out keyword detected for ${maskPhoneForLog(fromPhone)}. Suppressing lead.`);
          await OptOutEngine.processOptOut({
            leadId: lead.lead_id,
            phone: fromPhone,
            messageText: incomingText,
            eventId,
            suppressAcknowledgement: true
          });

          const optOutAck =
            'You have been successfully unsubscribed from AVANI LOAN SERVICES updates. You will not receive any further automated messages. To re-subscribe, text START or contact Sachin Shinde at +91 72491 08474.';
          const isChatMitra = payload.provider === 'ChatMitra' || process.env.ACTIVE_WHATSAPP_PROVIDER === 'chatmitra';

          if (!replyPolicy.canSendAnyProviderMessage) {
            console.log(`[Worker] Outbound provider dispatch suppressed (${replyPolicy.suppressionReason}) for ${maskPhoneForLog(fromPhone)}.`);
          } else if (isChatMitra) {
            await sendChatMitraMessage({ toPhone: fromPhone, messageText: optOutAck, correlationId });
          } else {
            await sendAiSensyWhatsApp({ destination: fromPhone, userName: profileName || 'Customer', text: optOutAck }, correlationId);
          }

          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'COMPLETED'
          });
          return NextResponse.json({ success: true, optedOut: true });
        }

        // DPDP Guard: If already opted out, suppress AI replies
        if (hydrated.isOptedOut) {
          console.log(`[Worker DPDP Guard] Contact ${maskPhoneForLog(fromPhone)} is opted out. AI replies suppressed.`);
          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'COMPLETED'
          });
          return NextResponse.json({ success: true, optedOutSuppressed: true });
        }

        if (!replyPolicy.canTriggerAutoReply) {
          await leadRepository.upsertLead({
            lead_id: lead.lead_id,
            customer_id: customer.customer_id,
            loan_category: lead.loan_category,
            requested_amount: lead.requested_amount,
            lead_status: 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP',
            lead_source: lead.lead_source,
            assigned_advisor_id: lead.assigned_advisor_id,
            priority: lead.priority
          });
        } else {
          const syntheticConversation = {
            conversationId: `CONV_${lead.lead_id}`,
            leadId: lead.lead_id,
            customerPhone: fromPhone,
            currentStage: lead.lead_status,
            currentState: lead.lead_status,
            optOutStatus: false,
            language: /[\u0900-\u097F]/.test(incomingText) ? 'hi' : 'en',
            context: {
              fullName: customer.customer_name,
              city: customer.city,
              loanProduct: lead.loan_category
            },
            history: [{ role: 'user', text: incomingText, timestamp: new Date() }]
          };

          const { nextQuestion, updatedState } = await AgentEngine.processMessage(syntheticConversation, incomingText);

          await leadRepository.upsertLead({
            lead_id: lead.lead_id,
            customer_id: customer.customer_id,
            loan_category: syntheticConversation.context?.loanProduct || lead.loan_category,
            requested_amount: lead.requested_amount,
            lead_status: updatedState || lead.lead_status,
            lead_source: lead.lead_source,
            assigned_advisor_id: lead.assigned_advisor_id,
            priority: lead.priority
          });

          const isChatMitra = payload.provider === 'ChatMitra' || process.env.ACTIVE_WHATSAPP_PROVIDER === 'chatmitra';
          if (!replyPolicy.canSendAnyProviderMessage) {
            console.log(`[Worker] Outbound provider dispatch suppressed (${replyPolicy.suppressionReason}) for ${maskPhoneForLog(fromPhone)}.`);
          } else if (isChatMitra) {
            await sendChatMitraMessage({
              toPhone: fromPhone,
              messageText: nextQuestion,
              leadId: lead.lead_id,
              correlationId
            });
          } else {
            await sendAiSensyWhatsApp(
              {
                destination: fromPhone,
                userName: profileName || 'Valued Customer',
                text: nextQuestion
              },
              correlationId
            );
          }
        }
      }

      await webhookEventRepository.markWebhookStatus({
        event_id: eventId,
        processing_status: 'COMPLETED'
      });
      return NextResponse.json({ success: true });
    } catch (executionError: any) {
      console.error(`[Worker Execution Error for ${payload?.eventId}]:`, executionError);
      await webhookEventRepository.markWebhookStatus({
        event_id: eventId,
        processing_status: 'FAILED',
        error_code: executionError instanceof SheetsCrmError ? executionError.code : 'WORKER_EXECUTION_ERROR'
      }).catch(() => {});
      if (executionError instanceof SheetsCrmError) {
        return NextResponse.json(
          { success: false, error: executionError.code, message: executionError.message },
          { status: executionError.httpStatus }
        );
      }
      return NextResponse.json({ success: false, error: 'Execution failed, marked FAILED' }, { status: 500 });
    }
  } catch (err: any) {
    if (err instanceof SheetsCrmError) {
      return NextResponse.json(
        { success: false, error: err.code, message: err.message },
        { status: err.httpStatus }
      );
    }
    console.error('Worker Global Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
