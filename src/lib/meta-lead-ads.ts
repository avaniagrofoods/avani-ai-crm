import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { ConversationStateManager } from '@/lib/orchestrator/state-manager';
import { WelcomeFlowEngine } from '@/lib/orchestrator/welcome-flow';

export interface MetaLeadPayload {
  metaLeadId: string;
  formId?: string;
  pageId?: string;
  campaignId?: string;
  campaignName?: string;
  adSetId?: string;
  adSetName?: string;
  adId?: string;
  adName?: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  product?: string;
  sourcePlatform: 'FACEBOOK' | 'INSTAGRAM' | 'META_LEAD_AD';
}

export class MetaLeadAdsEngine {
  static async processIncomingLead(payload: MetaLeadPayload) {
    await connectToDatabase();

    const cleanPhone = payload.phone.replace(/[^0-9]/g, '');
    const normalizedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

    // 1. Zero-Duplicate Inspection
    let existingLead = await Lead.findOne({
      $or: [{ metaLeadId: payload.metaLeadId }, { phone: normalizedPhone }]
    });

    if (existingLead && existingLead.metaLeadId === payload.metaLeadId) {
      console.log(`[MetaLeadAdsEngine] Lead with metaLeadId ${payload.metaLeadId} already exists. Skipping.`);
      return { success: true, isDuplicate: true, leadId: existingLead.leadId };
    }

    // 2. Canonical Lead Resolution
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await Lead.countDocuments();
    const leadId = existingLead?.leadId || `AVL-${today}-${String(count + 1).padStart(6, '0')}`;
    const product = payload.product || existingLead?.loanType || 'PERSONAL_LOAN';

    if (existingLead) {
      await Lead.updateOne(
        { leadId },
        {
          $set: {
            metaLeadId: payload.metaLeadId,
            sourcePlatform: payload.sourcePlatform,
            source: payload.sourcePlatform,
            campaign: payload.campaignName || 'META_LEAD_AD_CAMPAIGN',
            campaignId: payload.campaignId,
            adSet: payload.adSetName || payload.adSetId,
            ad: payload.adName || payload.adId,
            updatedAt: new Date()
          }
        }
      );
    } else {
      existingLead = await Lead.create({
        leadId,
        phone: normalizedPhone,
        name: payload.name,
        email: payload.email || '',
        city: payload.city || '',
        loanType: product,
        sourcePlatform: payload.sourcePlatform,
        source: payload.sourcePlatform,
        campaign: payload.campaignName || 'META_LEAD_AD_CAMPAIGN',
        campaignId: payload.campaignId,
        adSet: payload.adSetName || payload.adSetId,
        ad: payload.adName || payload.adId,
        metaLeadId: payload.metaLeadId,
        pipelineStage: 'NEW_LEAD'
      });
    }

    // 3. Trigger Welcome Flow (Sends Approved Welcome Template & Creates Conversation)
    const welcomeResult = await WelcomeFlowEngine.triggerWelcomeFlow({
      phone: normalizedPhone,
      name: payload.name,
      email: payload.email,
      city: payload.city,
      loanType: product,
      source: payload.sourcePlatform,
      correlationId: `CORR_META_${payload.metaLeadId}`
    });

    return {
      success: true,
      leadId,
      phone: normalizedPhone,
      sourcePlatform: payload.sourcePlatform,
      metaLeadId: payload.metaLeadId,
      welcomeSent: welcomeResult.success,
      providerMessageId: welcomeResult.providerMessageId
    };
  }
}
