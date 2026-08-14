import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { ConversationStateManager } from './state-manager';
import { WorkflowTrigger } from '@/models/WorkflowTrigger';
import { ProviderRouter } from '@/lib/provider-router';

export class WelcomeFlowEngine {
  static async triggerWelcomeFlow(params: {
    phone: string;
    name?: string;
    email?: string;
    city?: string;
    loanType?: string;
    source?: string;
    language?: string;
    correlationId: string;
  }) {
    await connectToDatabase();

    const cleanPhone = params.phone.replace(/[^0-9]/g, '');
    const normalizedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

    // 1. Resolve or Create Canonical Lead
    let lead = await Lead.findOne({ phone: normalizedPhone });
    if (!lead) {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await Lead.countDocuments();
      const leadId = `AVL-${today}-${String(count + 1).padStart(6, '0')}`;

      lead = await Lead.create({
        leadId,
        phone: normalizedPhone,
        name: params.name || 'Valued Customer',
        email: params.email || '',
        city: params.city || '',
        loanType: params.loanType || 'PERSONAL_LOAN',
        source: params.source || 'META_LEAD_AD',
        pipelineStage: 'NEW_LEAD'
      });
    }

    const leadId = lead.leadId;
    const product = params.loanType || lead.loanType || 'PERSONAL_LOAN';

    // 2. Select Approved Template
    let welcomeTemplateName = 'avani_loan_intro_v2';
    if (product === 'DOCTOR_LOAN') welcomeTemplateName = 'doctor_loan_offer';
    else if (product === 'BUSINESS_LOAN') welcomeTemplateName = 'business_loan_fast_approval';
    else if (product === 'EDUCATION_LOAN_GLOBAL') welcomeTemplateName = 'education_loan_global';

    // 3. Check Idempotency
    const idempotencyKey = ConversationStateManager.generateIdempotencyKey(
      leadId,
      'WELCOME',
      welcomeTemplateName,
      normalizedPhone
    );

    const existingTrigger = await WorkflowTrigger.findOne({ idempotencyKey });
    if (existingTrigger) {
      console.log(`[WelcomeFlowEngine] Welcome trigger already processed for lead ${leadId}. Skipping duplicate.`);
      return { success: true, status: 'SKIPPED_DUPLICATE', leadId, templateName: welcomeTemplateName };
    }

    // 4. Record Workflow Trigger
    const eventId = `EVT_WELCOME_${Date.now()}`;
    await WorkflowTrigger.create({
      eventId,
      leadId,
      stage: 'WELCOME',
      triggerType: 'LEAD_AD_EVENT',
      templateName: welcomeTemplateName,
      provider: 'AiSensy',
      correlationId: params.correlationId,
      idempotencyKey,
      status: 'PENDING'
    });

    // 5. Dispatch Welcome WhatsApp Message via ProviderRouter
    const dispatchRes = await ProviderRouter.dispatchMessage({
      phone: normalizedPhone,
      name: lead.name || 'Valued Customer',
      templateName: welcomeTemplateName,
      templateParams: [lead.name || 'Valued Customer'],
      provider: 'AISENSY',
      campaignId: 'WELCOME_CAMPAIGN_v2',
      leadId,
      journeyStage: 'WELCOME'
    });

    // 6. Update Conversation & Lead State
    await ConversationStateManager.getOrCreateConversation(leadId, normalizedPhone);
    await ConversationStateManager.transitionStage(leadId, 'WELCOME', 'AWAITING_CUSTOMER_RESPONSE', {
      product,
      leadScore: 60
    });

    await WorkflowTrigger.updateOne(
      { eventId },
      { $set: { status: dispatchRes.success ? 'PROCESSED' : 'FAILED', processedAt: new Date() } }
    );

    return {
      success: dispatchRes.success,
      leadId,
      phone: normalizedPhone,
      templateName: welcomeTemplateName,
      providerMessageId: dispatchRes.providerMessageId,
      currentStage: 'WELCOME',
      status: 'AWAITING_CUSTOMER_RESPONSE'
    };
  }
}
