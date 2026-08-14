import connectToDatabase from '@/lib/db';
import { Conversation } from '@/models/Conversation';
import { Lead } from '@/models/Lead';
import { WorkflowTrigger } from '@/models/WorkflowTrigger';
import { ProviderRouter } from '@/lib/provider-router';
import { ConversationStateManager } from '@/lib/orchestrator/state-manager';

export class FollowUpEngine {
  static async processScheduledFollowUps() {
    await connectToDatabase();

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find conversations awaiting response for > 24 hours
    const staleConvs = await Conversation.find({
      currentStage: { $in: ['WELCOME', 'PRODUCT_SELECTION', 'QUALIFICATION', 'DOCUMENT_COLLECTION'] },
      optOutStatus: false,
      advisorStatus: { $ne: 'HANDED_OFF' },
      $or: [
        { nextActionAt: { $lte: now } },
        { lastOutboundAt: { $lte: twentyFourHoursAgo } }
      ]
    }).limit(10);

    const processedResults = [];

    for (const conv of staleConvs) {
      // Determine Follow-Up Template
      let templateName = 'drip_day_3_followup';
      if (conv.currentStage === 'DOCUMENT_COLLECTION') {
        templateName = conv.product === 'DOCTOR_LOAN' ? 'doctor_loan_doc_checklist' : 'personal_loan_doc_reminder';
      }

      const idempotencyKey = ConversationStateManager.generateIdempotencyKey(
        conv.leadId,
        'FOLLOW_UP',
        templateName,
        conv.customerPhone
      );

      const existingTrigger = await WorkflowTrigger.findOne({ idempotencyKey });
      if (existingTrigger) {
        console.log(`[FollowUpEngine] Follow-up lock hit for lead ${conv.leadId}. Skipping.`);
        continue;
      }

      const eventId = `EVT_FOLLOWUP_${Date.now()}_${conv.leadId}`;
      await WorkflowTrigger.create({
        eventId,
        leadId: conv.leadId,
        stage: 'REENGAGEMENT',
        triggerType: 'EXPLICIT_WORKFLOW_TRIGGER',
        templateName,
        provider: 'AiSensy',
        correlationId: `CORR_FOLLOWUP_${Date.now()}`,
        idempotencyKey,
        status: 'PENDING'
      });

      // Dispatch Follow-up WhatsApp Message
      const lead = await Lead.findOne({ leadId: conv.leadId });
      const dispatchRes = await ProviderRouter.dispatchMessage({
        phone: conv.customerPhone,
        name: lead?.name || 'Valued Customer',
        templateName,
        templateParams: [lead?.name || 'Valued Customer'],
        provider: 'AISENSY',
        campaignId: 'FOLLOWUP_CAMPAIGN_v2',
        leadId: conv.leadId,
        journeyStage: 'REENGAGEMENT'
      });

      if (dispatchRes.success) {
        await ConversationStateManager.transitionStage(conv.leadId, 'REENGAGEMENT', 'FOLLOW_UP_SENT');
        await WorkflowTrigger.updateOne({ eventId }, { $set: { status: 'PROCESSED', processedAt: new Date() } });
      }

      processedResults.push({
        leadId: conv.leadId,
        templateName,
        success: dispatchRes.success,
        providerMessageId: dispatchRes.providerMessageId
      });
    }

    return {
      success: true,
      processedCount: processedResults.length,
      results: processedResults
    };
  }

  static async cancelPendingFollowUps(leadId: string) {
    await connectToDatabase();

    // Cancel pending follow-up triggers when customer responds
    await WorkflowTrigger.updateMany(
      { leadId, stage: 'REENGAGEMENT', status: 'PENDING' },
      { $set: { status: 'SKIPPED_DUPLICATE' } }
    );

    await Conversation.updateOne(
      { leadId: `CONV_${leadId}` },
      { $unset: { nextActionAt: 1 } }
    );

    return { success: true, leadId, canceled: true };
  }
}
