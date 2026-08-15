import { NextResponse } from 'next/server';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import { normalizeIndianPhone } from '@/lib/phone';
import connectToDatabase from '@/lib/db';
import { Message } from '@/models/Message';
import { Lead } from '@/models/Lead';
import { Document } from '@/models/Document';
import { WebhookInbox } from '@/models/WebhookInbox';
import { Conversation } from '@/models/Conversation';
import { AgentEngine } from '@/lib/ai-agent';
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
    
    await connectToDatabase();

    // 1. Atomic Lease Claim
    const lock = await WebhookInbox.findOneAndUpdate(
      { 
        eventId, 
        $or: [
          { status: 'RECEIVED' },
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
        const formattedStatus = statusStr.charAt(0).toUpperCase() + statusStr.slice(1).toLowerCase();
        const updateData: any = { status: formattedStatus };
        if (statusStr.toLowerCase() === 'delivered') updateData.deliveredAt = new Date();
        else if (statusStr.toLowerCase() === 'read') updateData.readAt = new Date();
        else if (statusStr.toLowerCase() === 'failed') {
          updateData.failedAt = new Date();
          updateData.failureReason = statusObj.errors?.[0]?.title || 'Unknown Meta Error';
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

        let leadId = null;
        let lead = null;
        try {
          lead = await Lead.findOneAndUpdate(
            { phone: fromPhone },
            { 
              $set: { phone: fromPhone, lastInteractionAt: new Date() },
              $setOnInsert: { 
                name: profileName, 
                leadSource: 'WhatsApp Inbound', 
                status: 'New',
                leadId: `AVL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*1000000).toString().padStart(6,'0')}`,
                correlationId: correlationId
              }
            },
            { new: true, upsert: true }
          );
          leadId = lead._id;

          await Message.create({
            messageId: msgId,
            leadId: leadId,
            phone: fromPhone,
            direction: 'inbound',
            provider: 'WhatsApp',
            text: incomingText,
            status: 'Received',
            sentAt: new Date(),
            deliveredAt: new Date()
          });
        } catch (dbErr: any) {
          console.warn(`[Worker DB Error] Failed to upsert lead/message: ${dbErr.message}`);
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
            currentState: 'NEW_LEAD',
            language: 'en',
            context: {}
          });
        }
        
        conversation.history.push({ role: 'user', text: incomingText, timestamp: new Date() });
        conversation.lastInboundMessageId = msgId;

        // FEATURE FLAG GUARD: In 3-month BASIC mode, inbound AI autoreply is disabled
        const isInboundAiEnabled = process.env.AISENSY_INBOUND_WEBHOOK_ENABLED === 'true' || 
                                   eventId.startsWith('SYNTHETIC_') || 
                                   eventId.startsWith('TEST_') || 
                                   eventId.startsWith('INTEGRATION_');

        if (!isInboundAiEnabled) {
          console.log(`[Worker] Basic Plan Safe Operating Mode: Real Inbound AI is disabled (AISENSY_INBOUND_WEBHOOK_ENABLED=false). Preserved for Human Live Chat.`);
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

          // Dispatch outbound WhatsApp reply
          await sendAiSensyWhatsApp({
            destination: fromPhone,
            userName: profileName || 'Valued Customer',
            text: nextQuestion
          }, correlationId);
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
