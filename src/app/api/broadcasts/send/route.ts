import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import { triggerOmnidimCall } from '@/lib/omnidim';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';
import { Message } from '@/models/Message';
import { Call } from '@/models/Call';
import { Broadcast } from '@/models/Broadcast';

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const { phone, name, templateName, loanType, broadcastId, testMode, broadcastType, idempotencyKey } = body;
    const normalizedPhone = phone;
    let leadId = null;
    let dbMode = "test";

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required.' }, { status: 400 });
    }

    if (mongoose.connection.readyState !== 1 && !testMode) {
      return NextResponse.json({ success: false, error: 'TEST/DEGRADED MODE: Database unavailable, halting production broadcast to prevent duplicates.' }, { status: 503 });
    }

    // Idempotency: Atomic Reservation
    let reservedMessageId = null;
    let messageIdString = `mock-${Date.now()}`;
    
    if (idempotencyKey && mongoose.connection.readyState === 1 && !testMode) {
      try {
        const leaseExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minute lease
        const newMessage = await Message.create({
          messageId: `wa_out_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          idempotencyKey: idempotencyKey,
          phone: normalizedPhone,
          direction: 'outbound',
          status: 'Processing',
          processingStartedAt: new Date(),
          processingAttempt: 1,
          leaseExpiresAt: leaseExpiresAt,
          templateName: templateName,
          broadcastId: broadcastId
        });
        reservedMessageId = newMessage._id;
        messageIdString = newMessage.messageId;
      } catch (err: any) {
        if (err.code === 11000) {
          // E11000 Duplicate Key Error - Idempotency lock hit
          const existingMessage = await Message.findOne({ idempotencyKey });
          if (existingMessage) {
            let currentStatus = existingMessage.status;
            
            // Check for stale PROCESSING lease
            if (currentStatus === 'Processing' && existingMessage.leaseExpiresAt && new Date() > existingMessage.leaseExpiresAt) {
              currentStatus = 'Unknown';
              // We mark it UNKNOWN because we don't know if the provider received it before the original process died.
              await Message.updateOne({ _id: existingMessage._id }, { $set: { status: 'Unknown' } });
            }

            return NextResponse.json({
              success: true,
              messageId: existingMessage.messageId,
              callId: existingMessage.messageId,
              result: { status: 'Already ' + currentStatus },
              mode: 'production',
              idempotencyHit: true
            });
          }
        } else {
          console.warn("DB Create idempotency lock error:", err);
          return NextResponse.json({ success: false, error: 'Database reservation failed' }, { status: 500 });
        }
      }
    }

    // Upsert Lead to ensure they exist in CRM before sending the broadcast
    try {
      if (mongoose.connection.readyState === 1 && !testMode) {
        const existingLead = await Lead.findOne({ phone: normalizedPhone });
        let leadIdToUse = existingLead?.leadId || `ALS-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
        
        const lead = await Lead.findOneAndUpdate(
          { phone: normalizedPhone },
          { 
            $set: { 
              name: name || 'Valued Customer', 
              phone: normalizedPhone, 
              loanType: loanType || 'Personal Loan',
              leadSource: 'Broadcast CSV',
              updatedAt: new Date()
            },
            $setOnInsert: {
              leadId: leadIdToUse,
              createdAt: new Date()
            }
          },
          { new: true, upsert: true }
        );
        leadId = lead._id;

        await Contact.findOneAndUpdate(
          { phone: normalizedPhone },
          { 
            $set: { 
              name: name || 'Valued Customer', 
              phone: normalizedPhone, 
              leadId: lead._id, 
              updatedAt: new Date()
            } 
          },
          { new: true, upsert: true }
        );
        dbMode = "production";
      }
    } catch (e) {
      console.warn("DB find/create lead error:", e);
    }

    // Dispatch Logic
    let success = false;
    let msgId = `mock-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    let errorMsg = '';
    let result = null;
    const isVoice = broadcastType === 'voice';

    if (testMode || process.env.BROADCAST_TEST_MODE === 'true') {
      // In TEST mode, simulate dispatch success
      success = true;
    } else {
      if (isVoice) {
        try {
          const response = await triggerOmnidimCall(
            phone, 
            name || 'Valued Customer', 
            loanType || 'Personal Loan'
          );
          success = true;
          msgId = response.call_id || `mock-${Date.now()}`;
          result = response;
        } catch (e: any) {
          success = false;
          errorMsg = e.message;
        }
      } else {
        // Send the WhatsApp Template via AiSensy dispatch
        const response = await sendAiSensyWhatsApp({
          destination: phone,
          userName: name || 'Valued Customer',
          templateName: templateName,
          leadId: leadId,
          broadcastId: broadcastId,
          text: '', // Ensure text is empty so it sends a template
          idempotencyKey: idempotencyKey
        }, reservedMessageId || '');
        success = response.success;
        if (success || response.status === 'Unknown') {
          msgId = response.messageId || messageIdString;
          result = response;
          // If UNKNOWN, we consider the dispatch successful from the API caller perspective 
          // (we didn't fail definitely, so we don't abort the broadcast run entirely)
          success = true;
        } else {
          errorMsg = response.error || 'Unknown AiSensy Error';
        }
      }
    }

    if (success) {
      try {
        if (mongoose.connection.readyState === 1) {
          if (broadcastType === 'whatsapp') {
            // If we reserved it, we need to update leadId if it was newly created
            if (reservedMessageId && leadId) {
              await Message.findByIdAndUpdate(reservedMessageId, { leadId });
            }
          } else {
            await Call.create({
              callId: msgId,
              providerCallId: msgId,
              leadId,
              phone: normalizedPhone,
              provider: 'OmniDM',
              status: testMode ? 'Test' : 'Initiated',
              initiatedAt: new Date(),
              broadcastId: broadcastId
            });
          }

          if (broadcastId) {
            await Broadcast.findByIdAndUpdate(broadcastId, {
              $inc: { queuedCount: 1, sentCount: 1 }
            });
          }
        }
      } catch (e) {
        console.warn("DB Create message/call error:", e);
      }

      return NextResponse.json({
        success: true,
        messageId: msgId,
        callId: msgId,
        result: result,
        mode: dbMode
      });
    } else {
      if (broadcastId) {
        await Broadcast.findByIdAndUpdate(broadcastId, { $inc: { failedCount: 1 } });
      }
      return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
