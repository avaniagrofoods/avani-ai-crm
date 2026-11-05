import { NextResponse } from 'next/server';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import { sendChatMitraMessage, classifyLoanCategory } from '@/lib/chatmitra';
import { FollowUpEngine } from '@/lib/followup-engine';
import { normalizeIndianPhone } from '@/lib/phone';
import connectToDatabase from '@/lib/db';
import { Message } from '@/models/Message';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';
import { Document } from '@/models/Document';
import { WebhookInbox } from '@/models/WebhookInbox';
import { Conversation } from '@/models/Conversation';
import { AgentEngine } from '@/lib/ai-agent';
import { OptOutEngine } from '@/lib/optout-engine';
import { normalizeMessageStatus, canTransitionStatus } from '@/lib/message-status';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    const workerSecret = process.env.INTERNAL_WORKER_SECRET || 'dev_secret_only';
    const authHeader = request.headers.get('x-worker-auth');
    if (authHeader !== workerSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const { eventId, correlationId } = payload;
    
    const conn = await connectToDatabase();
    if (!conn || mongoose.connection.readyState !== 1) {
      console.warn(`[Worker] Database unavailable: cannot process event ${eventId}. Returning HTTP 503.`);
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline: worker cannot acquire lease.' },
        { status: 503 }
      );
    }

    // 1. Atomic Lease Claim
    const lock = await WebhookInbox.findOneAndUpdate(
      { 
        eventId, 
        $or: [
          { status: 'RECEIVED' },
          { status: 'FAILED' },
          { status: 'PROCESSING', leaseExpiresAt: { $lt: new Date() } }
        ]
      },
      { 
        $set: { 
          status: 'PROCESSING', 
          processingStartedAt: new Date(), 
          leaseExpiresAt: new Date(Date.now() + 5 * 60000) 
        },
        $inc: { attemptCount: 1 }
      },
      { new: true }
    );

    if (!lock) {
      console.log(`[Worker] Lease for ${eventId} could not be acquired (likely duplicate or concurrent). Bypassing execution.`);
      return NextResponse.json({ success: true, bypassed: true });
    }

    try {
      if (payload.eventType === 'STATUS_UPDATE') {
        const { msgId, statusStr, statusObj } = payload.data || {};
        if (!msgId || !statusStr) {
           console.warn(`[Worker] Missing msgId or statusStr for STATUS_UPDATE. Payload:`, payload);
           return NextResponse.json({ success: true, bypassed: true });
        }
        const formattedStatus = normalizeMessageStatus(statusStr, 'outbound');
        const existingMsg = await Message.findOne({ providerMessageId: msgId });

        const updateData: any = {};
        // Guard against out-of-order delivery callback downgrades (e.g. READ -> DELIVERED)
        if (!existingMsg || canTransitionStatus(existingMsg.status, formattedStatus)) {
          updateData.status = formattedStatus;
        }

        if (formattedStatus === 'DELIVERED') {
          if (!existingMsg?.deliveredAt) updateData.deliveredAt = new Date();
        } else if (formattedStatus === 'READ') {
          if (!existingMsg?.readAt) updateData.readAt = new Date();
        } else if (formattedStatus === 'FAILED') {
          updateData.failedAt = new Date();
          updateData.failureReason = statusObj?.errors?.[0]?.title || statusObj?.failureReason || 'Provider Delivery Failure';
        }

        const updatedMsg = await Message.findOneAndUpdate(
          { providerMessageId: msgId },
          { $set: updateData },
          { new: true }
        );

        if (updatedMsg && updatedMsg.leadId) {
            await Lead.findByIdAndUpdate(updatedMsg.leadId, {
              $set: { lastInteractionAt: new Date() }
            });
        }
      } else if (payload.eventType === 'INBOUND_MESSAGE') {
        const { message, fromPhone, msgId, profileName } = payload.data || {};
        if (!message || !msgId) {
          throw new Error("Missing message or msgId in INBOUND_MESSAGE payload");
        }
        
        let incomingText = "";
        let mediaId = "";
        let mediaType = "";
        
        if (message.type === 'text') {
          incomingText = message.text?.body || "";
        } else if (message.type === 'button') {
          incomingText = message.button?.text || message.button?.payload || "";
        } else if (message.type === 'interactive') {
          incomingText = message.interactive?.button_reply?.title || 
                         message.interactive?.list_reply?.title || 
                         message.interactive?.button_reply?.id || "";
        } else if (message.type === 'document' || message.type === 'image') {
          mediaId = message[message.type]?.id || "";
          mediaType = message.type;
          incomingText = `[User uploaded ${message.type}]`;
        } else if (typeof message === 'string') {
          incomingText = message;
        } else if (message.text && typeof message.text === 'string') {
          incomingText = message.text;
        }

        if (!incomingText) incomingText = "Namaste, I want to apply for a loan";

        const classifiedLoan = classifyLoanCategory(incomingText);
        let leadId = null;
        let lead = null;
        try {
          lead = await Lead.findOneAndUpdate(
            { phone: fromPhone },
            { 
              $set: { 
                phone: fromPhone, 
                lastInteractionAt: new Date(),
                loanType: classifiedLoan.category
              },
              $setOnInsert: { 
                name: profileName || 'Customer', 
                leadSource: 'WhatsApp Inbound', 
                status: 'New',
                leadId: `AVL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*1000000).toString().padStart(6,'0')}`,
                correlationId: correlationId,
                consentStatus: 'GRANTED',
                consentPurpose: 'LOAN_ELIGIBILITY_PROCESSING',
                consentTimestamp: new Date(),
                preferredLanguage: /[\u0900-\u097F]/.test(incomingText) ? (incomingText.includes('आहे') ? 'Marathi' : 'Hindi') : 'English'
              }
            },
            { new: true, upsert: true }
          );
          leadId = lead._id;

          // Also upsert Contact so the inbound sender appears in CRM Inbox
          await Contact.findOneAndUpdate(
            { phone: fromPhone },
            { 
              $set: { phone: fromPhone, updatedAt: new Date() },
              $setOnInsert: { 
                name: profileName || 'Customer', 
                optedIn: true, 
                leadId: leadId 
              }
            },
            { new: true, upsert: true }
          ).catch((cErr: any) => console.warn(`[Worker Contact Upsert Warning]: ${cErr.message}`));

          // Check if message already exists (idempotency guard)
          const existingMessage = await Message.findOne({
            $or: [
              { messageId: msgId },
              { providerMessageId: msgId }
            ]
          });

          if (!existingMessage) {
            await Message.create({
              messageId: msgId,
              providerMessageId: msgId,
              leadId: leadId ? leadId.toString() : undefined,
              phone: fromPhone,
              senderPhone: fromPhone,
              recipientPhone: process.env.META_PHONE_NUMBER_ID || 'AVANI_OFFICIAL',
              direction: 'inbound',
              provider: payload.provider || 'WhatsApp',
              text: incomingText,
              status: 'RECEIVED',
              correlationId: correlationId,
              sentAt: new Date(),
              deliveredAt: new Date()
            });
          }
        } catch (dbErr: any) {
          console.error(`[Worker DB Error] Failed to upsert lead/message: ${dbErr.message}`);
          throw dbErr;
        }

        if (mediaId && leadId) {
          await Document.create({
            leadId: leadId,
            documentType: 'Unknown',
            fileUrl: mediaId,
            status: 'UPLOADED',
            uploadedAt: new Date()
          }).catch((e: any) => console.warn(`Doc insert error: ${e.message}`));
          
          incomingText = `[User uploaded media ID ${mediaId}]`;
        }

        // LOAD OR CREATE CONVERSATION
        let conversation = await Conversation.findOne({ customerPhone: fromPhone });
        if (!conversation) {
          conversation = new Conversation({
            conversationId: `CONV-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            leadId: leadId || 'UNKNOWN',
            customerPhone: fromPhone,
            currentStage: 'NEW_LEAD',
            currentState: 'NEW_LEAD',
            language: 'en',
            context: {}
          });
        }
        
        conversation.history.push({ role: 'user', text: incomingText, timestamp: new Date() });
        conversation.lastInboundMessageId = msgId;

        // Check for Opt-Out Keywords (DPDP Act Compliance: STOP, UNSUBSCRIBE, थांबवा, रोकें)
        const isOptOut = OptOutEngine.isOptOutMessage(incomingText);
        if (isOptOut) {
          console.log(`[Worker] Opt-out keyword detected for ${fromPhone}. Suppressing lead.`);
          await OptOutEngine.processOptOut({
            leadId: lead?.leadId,
            phone: fromPhone,
            messageText: incomingText,
            eventId
          }).catch((err: any) => console.warn(`[Worker OptOutEngine Error]: ${err.message}`));
          if (lead) {
            await Lead.findByIdAndUpdate(lead._id, {
              $set: {
                isOptedOut: true,
                optedOutAt: new Date(),
                status: 'OPTED_OUT',
                consentStatus: 'WITHDRAWN',
                lastInteractionAt: new Date()
              }
            });
            await FollowUpEngine.cancelPendingFollowUps(lead.leadId);
          }
          if (conversation) {
            conversation.optOutStatus = true;
            conversation.currentState = 'OPTED_OUT';
            conversation.currentStage = 'OPTED_OUT';
            await conversation.save();
          }

          const optOutAck = "You have been successfully unsubscribed from AVANI LOAN SERVICES updates. You will not receive any further automated messages. To re-subscribe, text START or contact Sachin Shinde at +91 72491 08474.";
          const isChatMitra = payload.provider === 'ChatMitra' || process.env.ACTIVE_WHATSAPP_PROVIDER === 'chatmitra';
          if (isChatMitra) {
            await sendChatMitraMessage({ toPhone: fromPhone, messageText: optOutAck, correlationId });
          } else {
            await sendAiSensyWhatsApp({ destination: fromPhone, userName: profileName || 'Customer', text: optOutAck }, correlationId);
          }

          await WebhookInbox.updateOne(
            { eventId },
            { $set: { status: 'COMPLETED', processedAt: new Date() }, $unset: { leaseExpiresAt: 1 } }
          );
          return NextResponse.json({ success: true, optedOut: true });
        }

        // DPDP Act Guard: If contact is ALREADY opted out, do NOT trigger automated AI replies or promotional workflows
        const isCurrentlyOptedOut = conversation.optOutStatus === true || 
                                    conversation.currentStage === 'OPTED_OUT' || 
                                    conversation.currentState === 'OPTED_OUT' ||
                                    lead?.isOptedOut === true ||
                                    lead?.status === 'OPTED_OUT';

        if (isCurrentlyOptedOut) {
          console.log(`[Worker DPDP Guard] Contact ${fromPhone} is opted out. Inbound message persisted to CRM Inbox; automated AI replies suppressed.`);
          await conversation.save();
          await WebhookInbox.updateOne(
            { eventId },
            { $set: { status: 'COMPLETED', processedAt: new Date() }, $unset: { leaseExpiresAt: 1 } }
          );
          return NextResponse.json({ success: true, optedOutSuppressed: true });
        }

        // FEATURE FLAG GUARD: Inbound AI auto-reply control (supports ChatMitra, WhatsApp, AiSensy, and test event prefixes)
        const isInboundAiEnabled = process.env.CHATMITRA_INBOUND_AUTO_REPLY_ENABLED === 'true' ||
                                   process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED === 'true' ||
                                   process.env.AISENSY_INBOUND_WEBHOOK_ENABLED === 'true' || 
                                   eventId.startsWith('SYNTHETIC_') || 
                                   eventId.startsWith('TEST_') || 
                                   eventId.startsWith('INTEGRATION_');

        if (!isInboundAiEnabled) {
          console.log(`[Worker] Safe Operating Mode: Inbound AI auto-reply is disabled (CHATMITRA_INBOUND_AUTO_REPLY_ENABLED=false / AISENSY_INBOUND_WEBHOOK_ENABLED=false). Preserved for Human Live Chat.`);
          if (lead) {
            await Lead.findByIdAndUpdate(lead._id, { 
              $set: { 
                status: 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP',
                lastInteractionAt: new Date() 
              } 
            });
          }
          await conversation.save();
        } else {
          // INVOKE AI AGENT ENGINE (Enabled for Synthetic Tests & Future PRO Plan)
          const { nextQuestion, updatedState } = await AgentEngine.processMessage(conversation, incomingText);
          
          conversation.history.push({ role: 'model', text: nextQuestion, timestamp: new Date() });
          await conversation.save();

          // Update Lead state
          if (lead) {
              const updates: any = { 
                  aiAgentStatus: updatedState,
                  currentWorkflowState: updatedState
              };
              // Merge valid context back to Lead
              if (conversation.context) {
                if (conversation.context.fullName) updates.name = conversation.context.fullName;
                if (conversation.context.email) updates.email = conversation.context.email;
                if (conversation.context.city) updates.city = conversation.context.city;
                if (conversation.context.employmentType) updates.employmentType = conversation.context.employmentType;
                if (conversation.context.profession) updates.profession = conversation.context.profession;
                if (conversation.context.monthlyIncome) updates.monthlyIncomeRange = conversation.context.monthlyIncome;
                if (conversation.context.loanProduct) updates.loanType = conversation.context.loanProduct;
                if (conversation.context.loanAmount) updates.requestedAmount = conversation.context.loanAmount;
              }
              
              await Lead.findByIdAndUpdate(lead._id, { $set: updates });

              // DOWNSTREAM SYNC
              if (updatedState === 'LEAD_QUALIFIED' || updatedState === 'DOCUMENTS_PENDING') {
                  const leadData = await Lead.findById(lead._id).lean();
                  try {
                    const { syncToHubSpot, syncToZapier, logToGoogleSheets } = require('@/lib/integrations');
                    syncToHubSpot(leadData).catch(() => {});
                    syncToZapier(leadData).catch(() => {});
                    logToGoogleSheets(leadData).catch(() => {});
                  } catch(e) {}
              }
          }

          // Dispatch outbound WhatsApp reply based on provider
          const isChatMitra = payload.provider === 'ChatMitra' || process.env.ACTIVE_WHATSAPP_PROVIDER === 'chatmitra';
          if (isChatMitra) {
            await sendChatMitraMessage({
              toPhone: fromPhone,
              messageText: nextQuestion,
              leadId: lead?._id?.toString(),
              correlationId
            });
          } else {
            await sendAiSensyWhatsApp({
              destination: fromPhone,
              userName: profileName || 'Valued Customer',
              text: nextQuestion
            }, correlationId);
          }
        }
      }

      // Mark as COMPLETED
      await WebhookInbox.updateOne(
        { eventId }, 
        { $set: { status: 'COMPLETED', processedAt: new Date() }, $unset: { leaseExpiresAt: 1 } }
      );
      return NextResponse.json({ success: true });
      
    } catch (executionError: any) {
      console.error(`[Worker Execution Error for ${payload?.eventId}]:`, executionError);
      if (payload?.eventId) {
        await WebhookInbox.updateOne(
          { eventId: payload.eventId },
          { 
            $set: { 
              status: 'FAILED', 
              lastError: executionError.message 
            },
            $unset: { leaseExpiresAt: 1 }
          }
        );
      }
      return NextResponse.json({ success: false, error: 'Execution failed, marked FAILED' }, { status: 500 });
    }

  } catch (err: any) {
    console.error("Worker Global Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
