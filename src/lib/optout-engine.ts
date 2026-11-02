import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';
import { Conversation } from '@/models/Conversation';
import { WorkflowTrigger } from '@/models/WorkflowTrigger';
import { ProviderRouter } from '@/lib/provider-router';
import { ConversationStateManager } from '@/lib/orchestrator/state-manager';

export class OptOutEngine {
  /**
   * Checks if incoming message text contains opt-out intent across English, Marathi, and Hindi.
   */
  static isOptOutMessage(text: string): boolean {
    if (!text) return false;
    const lower = text.trim().toLowerCase();

    const optOutPhrases = [
      // English
      'stop', 'unsubscribe', 'no more', 'do not message', 'don\'t message',
      'remove me', 'cancel', 'opt out', 'opt-out', 'pause messages', 'block',
      // Marathi
      'थांबवा', 'नको', 'बंद करा', 'मेसेज पाठवू नका', 'संदेश थांबवा',
      'nako', 'nakaye', 'thamba', 'thambwa', 'band kara',
      // Hindi
      'रोको', 'बंद करो', 'संदेश मत भेजो', 'हटाओ', 'मैसेज मत करो',
      'roko', 'band karo', 'mat bhejo', 'hatao'
    ];

    return optOutPhrases.some(phrase => lower === phrase || lower.includes(phrase));
  }

  static async processOptOut(params: {
    leadId?: string;
    phone: string;
    messageText: string;
    eventId?: string;
  }) {
    await connectToDatabase();

    const optOutAt = new Date();
    let cleanPhone = params.phone.trim().replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.length === 10 ? '+91' + cleanPhone : '+' + cleanPhone;
    }

    // 1. Update all matching Leads
    const leadQuery: any = {
      phone: { $in: [cleanPhone, cleanPhone.replace('+91', ''), cleanPhone.replace('+', '')] }
    };
    if (params.leadId) {
      leadQuery.$or = [{ leadId: params.leadId }, { phone: cleanPhone }];
    }

    await Lead.updateMany(leadQuery, {
      $set: {
        isOptedOut: true,
        status: 'OPTED_OUT',
        consentStatus: 'DENIED',
        optedOutAt: optOutAt,
        optOutSource: 'WHATSAPP_INBOUND',
        optOutMessage: params.messageText,
        updatedAt: optOutAt
      }
    });

    // 2. Update all matching Contacts
    await Contact.updateMany(
      { phone: { $in: [cleanPhone, cleanPhone.replace('+91', ''), cleanPhone.replace('+', '')] } },
      {
        $set: {
          optedIn: false,
          updatedAt: optOutAt
        }
      }
    );

    // 3. Update Conversation Status
    if (params.leadId) {
      await ConversationStateManager.transitionStage(params.leadId, 'OPTED_OUT', 'CUSTOMER_OPTED_OUT', {
        optOutStatus: true
      });
      await Conversation.updateOne(
        { conversationId: `CONV_${params.leadId}` },
        { $set: { optOutStatus: true, currentStage: 'OPTED_OUT' } }
      );
    }

    // 4. Cancel Pending Workflows & Scheduled Follow-ups
    const workflowQuery: any = { status: 'PENDING' };
    if (params.leadId) workflowQuery.leadId = params.leadId;
    await WorkflowTrigger.updateMany(workflowQuery, {
      $set: { status: 'SUPPRESSED_CUSTOMER_OPTED_OUT', processedAt: optOutAt }
    });

    // 5. Send Approved Opt-Out Acknowledgement Template via ProviderRouter
    const dispatchRes = await ProviderRouter.dispatchMessage({
      phone: cleanPhone,
      name: 'Customer',
      templateName: 'opt_out_acknowledgement',
      templateParams: [],
      messageText: 'You have been successfully unsubscribed from AVANI LOAN SERVICES updates. You will not receive further promotional messages. If this was a mistake, reply START anytime.',
      campaignId: 'OPTOUT_ACK_CAMPAIGN',
      leadId: params.leadId,
      journeyStage: 'OPTED_OUT'
    });

    return {
      success: true,
      phone: cleanPhone,
      leadId: params.leadId,
      status: 'OPTED_OUT',
      optOutAt,
      acknowledged: dispatchRes.success,
      providerMessageId: dispatchRes.providerMessageId
    };
  }
}
