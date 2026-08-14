import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Conversation } from '@/models/Conversation';
import { WorkflowTrigger } from '@/models/WorkflowTrigger';
import { ProviderRouter } from '@/lib/provider-router';
import { ConversationStateManager } from '@/lib/orchestrator/state-manager';

export class OptOutEngine {
  static isOptOutMessage(text: string): boolean {
    if (!text) return false;
    const lower = text.trim().toLowerCase();
    const optOutPhrases = [
      'stop',
      'unsubscribe',
      'no more',
      'do not message',
      'don\'t message',
      'remove me',
      'cancel',
      'opt out',
      'opt-out',
      'nako',
      'nakaye'
    ];

    return optOutPhrases.some(phrase => lower === phrase || lower.includes(phrase));
  }

  static async processOptOut(params: {
    leadId: string;
    phone: string;
    messageText: string;
    eventId: string;
  }) {
    await connectToDatabase();

    const optOutAt = new Date();

    // 1. Update Lead Status
    await Lead.updateOne(
      { leadId: params.leadId },
      {
        $set: {
          optOutStatus: true,
          pipelineStage: 'OPTED_OUT',
          optOutAt,
          optOutSource: 'WHATSAPP_INBOUND',
          optOutMessage: params.messageText,
          optOutEventId: params.eventId,
          updatedAt: optOutAt
        }
      }
    );

    // 2. Update Conversation Status
    await ConversationStateManager.transitionStage(params.leadId, 'OPTED_OUT', 'CUSTOMER_OPTED_OUT', {
      optOutStatus: true
    });

    await Conversation.updateOne(
      { conversationId: `CONV_${params.leadId}` },
      { $set: { optOutStatus: true } }
    );

    // 3. Cancel Pending Workflows & Scheduled Follow-ups
    await WorkflowTrigger.updateMany(
      { leadId: params.leadId, status: 'PENDING' },
      { $set: { status: 'SKIPPED_DUPLICATE' } }
    );

    // 4. Send Approved Opt-Out Acknowledgement Template (opt_out_acknowledgement)
    const dispatchRes = await ProviderRouter.dispatchMessage({
      phone: params.phone,
      name: 'Customer',
      templateName: 'opt_out_acknowledgement',
      templateParams: [],
      provider: 'AISENSY',
      campaignId: 'OPTOUT_ACK_CAMPAIGN',
      leadId: params.leadId,
      journeyStage: 'OPTED_OUT'
    });

    return {
      success: true,
      leadId: params.leadId,
      status: 'OPTED_OUT',
      optOutAt,
      acknowledged: dispatchRes.success,
      providerMessageId: dispatchRes.providerMessageId
    };
  }
}
