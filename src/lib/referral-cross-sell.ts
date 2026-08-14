import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Conversation } from '@/models/Conversation';
import { CrossSellOpportunity } from '@/models/CrossSellOpportunity';
import { ProviderRouter } from '@/lib/provider-router';
import { ConversationStateManager } from '@/lib/orchestrator/state-manager';

export class ReferralCrossSellEngine {
  static determineCrossSellTarget(sourceProduct: string): { targetProduct: string; template: string; reason: string } {
    switch (sourceProduct) {
      case 'DOCTOR_LOAN':
        return {
          targetProduct: 'DOCTOR_CLINIC_SETUP',
          template: 'doctor_clinic_setup_funding',
          reason: 'Doctor loan customer eligible for Clinic Setup & Equipment Funding'
        };
      case 'BUSINESS_LOAN':
        return {
          targetProduct: 'WORKING_CAPITAL',
          template: 'working_capital_loan',
          reason: 'Business loan customer eligible for Working Capital & Machinery Loan'
        };
      case 'PERSONAL_LOAN':
        return {
          targetProduct: 'HOME_LOAN',
          template: 'home_loan_honda_rate',
          reason: 'Personal loan customer eligible for Home Loan Balance Transfer'
        };
      case 'EDUCATION_LOAN_INDIA':
        return {
          targetProduct: 'EDUCATION_LOAN_GLOBAL',
          template: 'education_loan_global',
          reason: 'Domestic education loan customer eligible for Overseas Global Studies Funding'
        };
      default:
        return {
          targetProduct: 'MORTGAGE_LOAN',
          template: 'mortgage_loan_lap_offer',
          reason: 'Customer eligible for Loan Against Property (LAP)'
        };
    }
  }

  static async createReferralLead(params: {
    referringLeadId: string;
    refereeName: string;
    refereePhone: string;
    loanType?: string;
  }) {
    await connectToDatabase();

    const cleanPhone = params.refereePhone.replace(/[^0-9]/g, '');
    const normalizedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await Lead.countDocuments();
    const leadId = `AVL-REF-${today}-${String(count + 1).padStart(6, '0')}`;

    const referralLead = await Lead.create({
      leadId,
      phone: normalizedPhone,
      name: params.refereeName,
      loanType: params.loanType || 'PERSONAL_LOAN',
      source: 'CUSTOMER_REFERRAL',
      referringLeadId: params.referringLeadId,
      pipelineStage: 'NEW_LEAD'
    });

    await ConversationStateManager.transitionStage(params.referringLeadId, 'REFERRAL', 'REFERRAL_CREATED');

    return referralLead;
  }

  static async triggerCrossSellOpportunity(leadId: string) {
    await connectToDatabase();

    const lead = await Lead.findOne({ leadId });
    const conv = await Conversation.findOne({ conversationId: `CONV_${leadId}` });

    if (!lead || !conv || conv.optOutStatus) {
      console.log(`[ReferralCrossSellEngine] Lead ${leadId} is opted out or missing. Aborting cross-sell.`);
      return { success: false, reason: 'OPTED_OUT_OR_MISSING' };
    }

    const sourceProduct = conv.product || lead.loanType || 'PERSONAL_LOAN';
    const rec = this.determineCrossSellTarget(sourceProduct);

    // Duplicate Check
    const existingOpp = await CrossSellOpportunity.findOne({ leadId, targetProduct: rec.targetProduct });
    if (existingOpp) {
      console.log(`[ReferralCrossSellEngine] Cross-sell opportunity already exists for lead ${leadId}. Skipping.`);
      return { success: true, isDuplicate: true, opportunity: existingOpp };
    }

    const opp = await CrossSellOpportunity.create({
      leadId,
      sourceProduct,
      targetProduct: rec.targetProduct,
      reason: rec.reason,
      score: 80,
      status: 'IDENTIFIED',
      template: rec.template
    });

    // Dispatch Approved Cross-Sell Template via ProviderRouter
    const dispatchRes = await ProviderRouter.dispatchMessage({
      phone: lead.phone,
      name: lead.name || 'Valued Customer',
      templateName: rec.template,
      templateParams: [lead.name || 'Valued Customer'],
      provider: 'AISENSY',
      campaignId: 'CROSS_SELL_CAMPAIGN',
      leadId,
      journeyStage: 'CROSS_SELL'
    });

    if (dispatchRes.success) {
      opp.status = 'COMMUNICATED';
      await opp.save();
      await ConversationStateManager.transitionStage(leadId, 'CROSS_SELL', 'CROSS_SELL_COMMUNICATED');
    }

    return {
      success: dispatchRes.success,
      leadId,
      sourceProduct,
      targetProduct: rec.targetProduct,
      templateName: rec.template,
      providerMessageId: dispatchRes.providerMessageId
    };
  }
}
