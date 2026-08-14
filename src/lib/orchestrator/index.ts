import connectToDatabase from '@/lib/db';
import { ConversationStateManager } from './state-manager';
import { WorkflowTrigger } from '@/models/WorkflowTrigger';
import { Lead } from '@/models/Lead';
import { Template } from '@/models/Template';
import { ProviderRouter } from '@/lib/provider-router';

export class ConversationOrchestrator {
  static async handleInboundEvent(params: {
    eventId: string;
    leadId: string;
    phone: string;
    triggerType: 'CUSTOMER_INBOUND' | 'BUTTON_REPLY' | 'LEAD_AD_EVENT' | 'EXPLICIT_WORKFLOW_TRIGGER';
    stage: string;
    templateName?: string;
    correlationId: string;
    payload?: any;
  }) {
    await connectToDatabase();

    const idempotencyKey = ConversationStateManager.generateIdempotencyKey(
      params.leadId,
      params.stage,
      params.templateName || 'NONE',
      params.phone
    );

    // Check duplicate trigger
    const existingTrigger = await WorkflowTrigger.findOne({ idempotencyKey });
    if (existingTrigger) {
      console.log(`[Orchestrator] Duplicate trigger detected for idempotencyKey: ${idempotencyKey}. Skipping.`);
      return { success: true, status: 'SKIPPED_DUPLICATE', trigger: existingTrigger };
    }

    const triggerRecord = await WorkflowTrigger.create({
      eventId: params.eventId,
      leadId: params.leadId,
      stage: params.stage,
      triggerType: params.triggerType,
      templateName: params.templateName,
      provider: 'AiSensy',
      correlationId: params.correlationId,
      idempotencyKey,
      status: 'PENDING',
      metadata: params.payload || {}
    });

    // Ensure conversation exists
    const conv = await ConversationStateManager.getOrCreateConversation(params.leadId, params.phone);

    // Verify Opt-Out Status
    if (conv.optOutStatus) {
      console.log(`[Orchestrator] Lead ${params.leadId} is opted-out. Aborting workflow.`);
      await WorkflowTrigger.updateOne({ eventId: params.eventId }, { $set: { status: 'FAILED' } });
      return { success: false, reason: 'OPTED_OUT' };
    }

    // Process Trigger Transition
    let targetStage = conv.currentStage;
    if (params.triggerType === 'LEAD_AD_EVENT') {
      targetStage = 'WELCOME';
    } else if (params.triggerType === 'BUTTON_REPLY' || params.triggerType === 'CUSTOMER_INBOUND') {
      if (conv.currentStage === 'NEW_LEAD' || conv.currentStage === 'WELCOME') {
        targetStage = 'QUALIFICATION';
      }
    }

    await ConversationStateManager.transitionStage(params.leadId, targetStage, 'INBOUND_PROCESSED');

    await WorkflowTrigger.updateOne(
      { eventId: params.eventId },
      { $set: { status: 'PROCESSED', processedAt: new Date() } }
    );

    return {
      success: true,
      status: 'PROCESSED',
      leadId: params.leadId,
      currentStage: targetStage,
      triggerId: triggerRecord.eventId
    };
  }
}
