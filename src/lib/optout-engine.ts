import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';
import { Conversation } from '@/models/Conversation';
import { WorkflowTrigger } from '@/models/WorkflowTrigger';
import { ProviderRouter } from '@/lib/provider-router';
import { ConversationStateManager } from '@/lib/orchestrator/state-manager';

export class OptOutEngine {
  /**
   * Builds canonical phone variants (+91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX, 0XXXXXXXXXX)
   * so opt-out suppression works uniformly regardless of how a phone number was stored.
   */
  static getPhoneVariants(phone: string): { cleanPhone: string; raw10: string; variants: string[] } {
    const trimmed = String(phone || '').trim();
    const rawDigits = trimmed.replace(/\D/g, '');
    const raw10 = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;
    let cleanPhone = trimmed.replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.length === 10 ? '+91' + cleanPhone : (raw10.length === 10 ? '+91' + raw10 : '+' + cleanPhone);
    }
    const variants = Array.from(new Set([
      trimmed,
      cleanPhone,
      cleanPhone.replace('+91', ''),
      cleanPhone.replace('+', ''),
      ...(raw10.length === 10 ? [raw10, `+91${raw10}`, `91${raw10}`, `0${raw10}`] : []),
    ])).filter(Boolean);
    return { cleanPhone, raw10, variants };
  }

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
    suppressAcknowledgement?: boolean;
  }) {
    await connectToDatabase();

    const optOutAt = new Date();
    const { cleanPhone, raw10, variants: phoneVariants } = this.getPhoneVariants(params.phone);

    // 1. Update all matching Leads across phone variants, normalizedMobile, and leadId
    const leadOrClauses: any[] = [
      { phone: { $in: phoneVariants } },
    ];
    if (raw10.length === 10) {
      leadOrClauses.push({ normalizedMobile: raw10 });
    }
    if (params.leadId) {
      leadOrClauses.push({ leadId: params.leadId });
    }
    const leadQuery: any = { $or: leadOrClauses };

    const matchingLeads = await Lead.find(leadQuery, { leadId: 1 }).lean();
    const matchingLeadIds = Array.from(new Set([
      ...(params.leadId ? [params.leadId] : []),
      ...matchingLeads.map((l: any) => l.leadId).filter(Boolean),
    ]));

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

    // 2. Update all matching Contacts across phone variants
    await Contact.updateMany(
      { phone: { $in: phoneVariants } },
      {
        $set: {
          optedIn: false,
          updatedAt: optOutAt
        }
      }
    );

    // 3. Update Conversation Status across phone variants and matching leadIds
    for (const lid of matchingLeadIds) {
      await ConversationStateManager.transitionStage(lid, 'OPTED_OUT', 'CUSTOMER_OPTED_OUT', {
        optOutStatus: true
      });
    }
    const convOrClauses: any[] = [{ customerPhone: { $in: phoneVariants } }];
    if (matchingLeadIds.length > 0) {
      convOrClauses.push({ leadId: { $in: matchingLeadIds } });
      convOrClauses.push({ conversationId: { $in: matchingLeadIds.map(id => `CONV_${id}`) } });
    }
    await Conversation.updateMany(
      { $or: convOrClauses },
      { $set: { optOutStatus: true, currentStage: 'OPTED_OUT', currentState: 'OPTED_OUT' } }
    );

    // 4. Cancel Pending Workflows & Scheduled Follow-ups for all matching leadIds
    if (matchingLeadIds.length > 0) {
      await WorkflowTrigger.updateMany(
        { status: 'PENDING', leadId: { $in: matchingLeadIds } },
        { $set: { status: 'SUPPRESSED_CUSTOMER_OPTED_OUT', processedAt: optOutAt } }
      );
    }

    // 5. Send Approved Opt-Out Acknowledgement Template via ProviderRouter (unless suppressed)
    if (params.suppressAcknowledgement) {
      return {
        success: true,
        phone: cleanPhone,
        leadId: params.leadId,
        status: 'OPTED_OUT',
        optOutAt,
        acknowledged: false,
        suppressed: true
      };
    }

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
