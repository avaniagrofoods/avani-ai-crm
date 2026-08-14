import connectToDatabase from '@/lib/db';
import { ConversationStateManager } from '@/lib/orchestrator/state-manager';
import { Lead } from '@/models/Lead';
import { Conversation } from '@/models/Conversation';
import { ProviderRouter } from '@/lib/provider-router';

export interface AdvisorTaskData {
  leadId: string;
  customerName: string;
  phone: string;
  product: string;
  qualificationSummary: string;
  leadScore: number;
  documentsStatus: string;
  customerRequest: string;
  preferredContactTime?: string;
  conversationSummary: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  assignedAdvisor: string;
  createdAt: Date;
}

export class AdvisorHandoffEngine {
  static shouldTriggerHandoff(text: string, leadScore = 50, documentStatus = 'PENDING'): boolean {
    const lower = text.toLowerCase();
    const keywords = ['person', 'advisor', 'human', 'call', 'talk', 'complaint', 'exception', 'manager', 'lender'];

    const requestedHuman = keywords.some(kw => lower.includes(kw));
    const scoreThresholdHit = leadScore >= 80;
    const docsComplete = documentStatus === 'COMPLETE';

    return requestedHuman || scoreThresholdHit || docsComplete;
  }

  static async executeHandoff(params: {
    leadId: string;
    phone: string;
    customerRequest: string;
    reason?: string;
  }) {
    await connectToDatabase();

    const lead = await Lead.findOne({ leadId: params.leadId });
    const conv = await Conversation.findOne({ conversationId: `CONV_${params.leadId}` });

    const priority = (conv?.leadScore || 50) >= 75 ? 'HIGH' : 'MEDIUM';
    const assignedAdvisor = 'Senior Loan Advisor (Sachin Shinde)';

    const taskData: AdvisorTaskData = {
      leadId: params.leadId,
      customerName: lead?.name || 'Valued Customer',
      phone: params.phone,
      product: conv?.product || lead?.loanType || 'PERSONAL_LOAN',
      qualificationSummary: `Score: ${conv?.leadScore || 50}/100 | Status: ${conv?.qualificationStatus || 'QUALIFIED'}`,
      leadScore: conv?.leadScore || 50,
      documentsStatus: conv?.documentStatus || 'PENDING',
      customerRequest: params.customerRequest,
      preferredContactTime: '10:00 AM - 6:00 PM IST',
      conversationSummary: `Customer requested human advisor handoff. Reason: ${params.reason || params.customerRequest}`,
      priority,
      assignedAdvisor,
      createdAt: new Date()
    };

    // Transition Stage to ADVISOR_HANDOFF
    await ConversationStateManager.transitionStage(params.leadId, 'ADVISOR_HANDOFF', 'HUMAN_HANDOFF_ACTIVE', {
      advisorStatus: 'HANDED_OFF',
      assignedAdvisor
    });

    // Send Customer Support Human Handoff Approved Template via ProviderRouter
    const dispatchRes = await ProviderRouter.dispatchMessage({
      phone: params.phone,
      name: lead?.name || 'Valued Customer',
      templateName: 'customer_support_human_handoff',
      templateParams: [lead?.name || 'Valued Customer', assignedAdvisor],
      provider: 'AISENSY',
      campaignId: 'HUMAN_HANDOFF_CAMPAIGN',
      leadId: params.leadId,
      journeyStage: 'ADVISOR_HANDOFF'
    });

    return {
      success: true,
      leadId: params.leadId,
      aiConversationStatus: 'HANDOFF',
      crmStatus: 'IN_PROGRESS',
      assignedAdvisor,
      priority,
      taskData,
      whatsappNotified: dispatchRes.success
    };
  }
}
