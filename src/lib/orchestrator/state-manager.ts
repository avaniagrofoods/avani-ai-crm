import connectToDatabase from '@/lib/db';
import { Conversation, IConversation } from '@/models/Conversation';
import { Lead } from '@/models/Lead';
import { WorkflowTrigger } from '@/models/WorkflowTrigger';

export class ConversationStateManager {
  static async getOrCreateConversation(leadId: string, phone: string): Promise<IConversation> {
    await connectToDatabase();

    const conversationId = `CONV_${leadId}`;
    let conv = await Conversation.findOne({ conversationId });

    if (!conv) {
      conv = await Conversation.create({
        conversationId,
        leadId,
        customerPhone: phone,
        currentStage: 'NEW_LEAD',
        currentSubStage: 'INIT',
        qualificationStatus: 'PENDING',
        documentStatus: 'PENDING',
        advisorStatus: 'UNASSIGNED',
        applicationStatus: 'DRAFT',
        optOutStatus: false,
        leadScore: 50
      });
    }

    return conv;
  }

  static async transitionStage(
    leadId: string,
    targetStage: IConversation['currentStage'],
    subStage?: string,
    meta?: any
  ): Promise<IConversation | null> {
    await connectToDatabase();

    const conversationId = `CONV_${leadId}`;
    const updateData: any = {
      currentStage: targetStage,
      updatedAt: new Date()
    };

    if (subStage) updateData.currentSubStage = subStage;
    if (meta?.product) updateData.product = meta.product;
    if (meta?.qualificationStatus) updateData.qualificationStatus = meta.qualificationStatus;
    if (meta?.documentStatus) updateData.documentStatus = meta.documentStatus;
    if (meta?.leadScore !== undefined) updateData.leadScore = meta.leadScore;

    const updated = await Conversation.findOneAndUpdate(
      { conversationId },
      { $set: updateData },
      { new: true }
    );

    // Sync Lead status in CRM Single Source of Truth
    if (updated) {
      await Lead.updateOne(
        { leadId },
        { $set: { pipelineStage: targetStage, updatedAt: new Date() } }
      );
    }

    return updated;
  }

  static generateIdempotencyKey(leadId: string, stage: string, templateName: string, phone: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `trig_${leadId}_${stage}_${templateName}_${cleanPhone}`;
  }
}
