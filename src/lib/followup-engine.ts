import connectToDatabase from '@/lib/db';
import { Conversation } from '@/models/Conversation';
import { Lead } from '@/models/Lead';
import { WorkflowTrigger } from '@/models/WorkflowTrigger';
import { ProviderRouter } from '@/lib/provider-router';
import { ConversationStateManager } from '@/lib/orchestrator/state-manager';

export interface DripStep {
  day: number;
  minHoursElapsed: number;
  requiredFollowUpCount: number;
  templateName: string;
  defaultText: string;
  stageName: string;
}

export const AVANI_DRIP_SCHEDULE: DripStep[] = [
  {
    day: 1,
    minHoursElapsed: 24,
    requiredFollowUpCount: 0,
    templateName: 'drip_day_1_eligibility',
    stageName: 'DRIP_DAY_1',
    defaultText: 'Namaste {{name}}! Sachin Shinde from AVANI LOAN SERVICES here. Have you checked your loan eligibility? We compare 40+ partner banks & NBFCs to find you the best interest rates. Reply YES to explore your options!'
  },
  {
    day: 3,
    minHoursElapsed: 72,
    requiredFollowUpCount: 1,
    templateName: 'drip_day_3_product_info',
    stageName: 'DRIP_DAY_3',
    defaultText: 'Hello {{name}}, AVANI LOAN SERVICES offers end-to-end guidance for Personal, Business, Home, and Mortgage Loans with transparent processing and zero upfront fees. Do you have 2 minutes to discuss your requirement?'
  },
  {
    day: 7,
    minHoursElapsed: 168, // 7 * 24
    requiredFollowUpCount: 2,
    templateName: 'drip_day_7_assistance',
    stageName: 'DRIP_DAY_7',
    defaultText: 'Namaste {{name}}, preparing loan documents can be overwhelming. AVANI LOAN SERVICES provides a simple digital checklist for PAN, Aadhaar, and Bank Statements. Reply ADVISOR to speak directly with our team!'
  },
  {
    day: 10,
    minHoursElapsed: 240, // 10 * 24
    requiredFollowUpCount: 3,
    templateName: 'drip_day_10_checklist',
    stageName: 'DRIP_DAY_10',
    defaultText: 'Hello {{name}}, checking in from AVANI LOAN SERVICES. Are you still actively planning for your loan? Reply with your preferred loan amount, or reply NO if you would like us to pause updates.'
  },
  {
    day: 15,
    minHoursElapsed: 360, // 15 * 24
    requiredFollowUpCount: 4,
    templateName: 'drip_day_15_advisor_status',
    stageName: 'DRIP_DAY_15',
    defaultText: 'Namaste {{name}}, this is our final follow-up from AVANI LOAN SERVICES regarding your loan consultation. If you need any assistance in the future, reach Sachin Shinde at +91 72491 08474 or visit www.avanifinserv.com. Reply STOP to unsubscribe.'
  }
];

export class FollowUpEngine {

  /**
   * Evaluates if a lead satisfies strict STOP conditions.
   * Returns true if follow-up MUST BE STOPPED.
   */
  static isStopConditionMet(lead: any, conversation?: any): { stop: boolean; reason?: string } {
    // Stop Condition 1: Customer has explicitly opted out
    if (lead.isOptedOut || lead.status === 'OPTED_OUT' || lead.consentStatus === 'DENIED' || lead.consentStatus === 'WITHDRAWN') {
      return { stop: true, reason: 'CUSTOMER_OPTED_OUT' };
    }

    // Stop Condition 2: DPDP Consent not granted
    if (lead.consentStatus && lead.consentStatus !== 'GRANTED') {
      return { stop: true, reason: 'CONSENT_NOT_GRANTED' };
    }

    // Stop Condition 3: Customer replied (inbound interaction since creation)
    const hasRepliedInConv = conversation && (conversation.customerReplied || conversation.currentStage === 'CUSTOMER_REPLIED');
    const hasInboundInteractions = lead.interactions && lead.interactions.some((i: any) => i.direction === 'inbound' || i.direction === 'INBOUND');
    if (hasRepliedInConv || hasInboundInteractions || lead.status === 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP') {
      return { stop: true, reason: 'CUSTOMER_ALREADY_REPLIED' };
    }

    // Stop Condition 4: Terminal status (Closed, Approved, Disbursed, Rejected, Not Interested)
    const terminalStatuses = [
      'Approved', 'Disbursed', 'Closed', 'Rejected', 'Not Interested', 
      'Invalid Lead', 'Customer Declined', 'CUSTOMER_DECLINED', 
      'CLOSED', 'APPROVED', 'REJECTED'
    ];
    if (terminalStatuses.includes(lead.status)) {
      return { stop: true, reason: `LEAD_TERMINAL_STATUS_${lead.status}` };
    }

    // Stop Condition 5: Human advisor assigned or handed off
    if (conversation?.advisorStatus === 'HANDED_OFF' || lead.assignedAgent?.status === 'ACTIVE' || lead.status === 'QUALIFIED_HUMAN') {
      return { stop: true, reason: 'HUMAN_ADVISOR_HANDOFF' };
    }

    return { stop: false };
  }

  /**
   * Instant Day 0 Welcome Trigger on new lead registration.
   */
  static async triggerDay0Welcome(lead: any): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    await connectToDatabase();

    const stopCheck = this.isStopConditionMet(lead);
    if (stopCheck.stop) {
      console.log(`[FollowUpEngine] Day 0 Welcome suppressed for lead ${lead.leadId}: ${stopCheck.reason}`);
      return { success: false, error: stopCheck.reason };
    }

    const templateName = 'Avani_Loan_Welcome';
    const customerName = lead.name || 'Valued Customer';
    const cleanPhone = lead.phone;

    const idempotencyKey = `CHATMITRA:DRIP_DAY_0:${lead.leadId || cleanPhone}:${templateName}`;

    const existingTrigger = await WorkflowTrigger.findOne({ idempotencyKey });
    if (existingTrigger) {
      console.log(`[FollowUpEngine] Day 0 Welcome already sent for lead ${lead.leadId}. Skipping.`);
      return { success: true, providerMessageId: existingTrigger.providerMessageId };
    }

    const eventId = `EVT_WELCOME_${Date.now()}_${lead.leadId || 'ANON'}`;
    await WorkflowTrigger.create({
      eventId,
      leadId: lead.leadId,
      stage: 'DAY_0_WELCOME',
      triggerType: 'EXPLICIT_WORKFLOW_TRIGGER',
      templateName,
      provider: process.env.WHATSAPP_PROVIDER || 'CHATMITRA',
      correlationId: `CORR_D0_${Date.now()}`,
      idempotencyKey,
      status: 'PENDING'
    });

    const dispatchRes = await ProviderRouter.dispatchMessage({
      phone: cleanPhone,
      name: customerName,
      templateName,
      templateParams: [customerName, lead.loanType || 'Loan Consultation'],
      messageText: `Namaste ${customerName}! Welcome to AVANI LOAN SERVICES. We have received your inquiry for ${lead.loanType || 'a loan'}. As an authorized loan consultancy, we help you secure the best loan options from 40+ partner banks & NBFCs with zero upfront fees. An advisor will review your eligibility shortly.`,
      campaignId: 'AVANI_DAY0_WELCOME',
      leadId: lead.leadId,
      journeyStage: 'WELCOME'
    });

    if (dispatchRes.success) {
      await WorkflowTrigger.updateOne(
        { eventId },
        { 
          $set: { 
            status: 'PROCESSED', 
            providerMessageId: dispatchRes.providerMessageId,
            processedAt: new Date() 
          } 
        }
      );

      await Lead.updateOne(
        { _id: lead._id },
        { 
          $set: { 
            status: 'WHATSAPP_SENT',
            lastInteractionAt: new Date(),
            updatedAt: new Date()
          } 
        }
      );
    } else {
      await WorkflowTrigger.updateOne(
        { eventId },
        { $set: { status: 'FAILED', processedAt: new Date() } }
      );
    }

    return dispatchRes;
  }

  /**
   * Processes the multi-step drip sequence across Day 1, 3, 7, 10, 15.
   */
  static async processDripFollowUps(limit: number = 50) {
    await connectToDatabase();

    const now = new Date();
    const processedResults = [];

    // Query active leads that haven't opted out and have less than 5 follow-ups
    const candidateLeads = await Lead.find({
      isOptedOut: { $ne: true },
      consentStatus: { $ne: 'DENIED' },
      status: { 
        $nin: [
          'Approved', 'Disbursed', 'Closed', 'Rejected', 'Not Interested', 
          'Invalid Lead', 'Customer Declined', 'OPTED_OUT', 'CUSTOMER_DECLINED'
        ] 
      },
      followUpCount: { $lt: 5 }
    }).limit(limit);

    for (const lead of candidateLeads) {
      // Find associated conversation if available
      const conversation = await Conversation.findOne({
        $or: [
          { leadId: lead.leadId },
          { customerPhone: lead.phone }
        ]
      });

      // 1. Strict Stop Condition Check
      const stopCheck = this.isStopConditionMet(lead, conversation);
      if (stopCheck.stop) {
        console.log(`[FollowUpEngine] Follow-up suppressed for lead ${lead.leadId} (${lead.phone}): ${stopCheck.reason}`);
        continue;
      }

      // 2. Determine eligible drip step based on hours since creation and current followUpCount
      const leadCreatedTime = lead.createdAt ? new Date(lead.createdAt).getTime() : now.getTime();
      const hoursSinceCreation = (now.getTime() - leadCreatedTime) / (1000 * 60 * 60);

      // Find the next eligible drip step
      const currentCount = lead.followUpCount || 0;
      const targetStep = AVANI_DRIP_SCHEDULE.find(
        step => step.requiredFollowUpCount === currentCount && hoursSinceCreation >= step.minHoursElapsed
      );

      if (!targetStep) {
        // Not yet time for next follow up
        continue;
      }

      const templateName = targetStep.templateName;
      const idempotencyKey = `CHATMITRA:DRIP_DAY_${targetStep.day}:${lead.leadId || lead.phone}:${templateName}`;

      // Idempotency lock check
      const existingTrigger = await WorkflowTrigger.findOne({ idempotencyKey });
      if (existingTrigger) {
        console.log(`[FollowUpEngine] Drip Day ${targetStep.day} already dispatched for ${lead.phone}. Skipping.`);
        continue;
      }

      const eventId = `EVT_DRIP_D${targetStep.day}_${Date.now()}_${lead.leadId || 'ANON'}`;
      await WorkflowTrigger.create({
        eventId,
        leadId: lead.leadId,
        stage: targetStep.stageName,
        triggerType: 'EXPLICIT_WORKFLOW_TRIGGER',
        templateName,
        provider: process.env.WHATSAPP_PROVIDER || 'CHATMITRA',
        correlationId: `CORR_D${targetStep.day}_${Date.now()}`,
        idempotencyKey,
        status: 'PENDING'
      });

      const customerName = lead.name || 'Valued Customer';
      const textMessage = targetStep.defaultText.replace('{{name}}', customerName);

      const dispatchRes = await ProviderRouter.dispatchMessage({
        phone: lead.phone,
        name: customerName,
        templateName,
        templateParams: [customerName],
        messageText: textMessage,
        campaignId: `AVANI_DRIP_DAY_${targetStep.day}`,
        leadId: lead.leadId,
        journeyStage: targetStep.stageName
      });

      if (dispatchRes.success) {
        await WorkflowTrigger.updateOne(
          { eventId },
          { 
            $set: { 
              status: 'PROCESSED', 
              providerMessageId: dispatchRes.providerMessageId,
              processedAt: new Date() 
            } 
          }
        );

        // Advance followUpCount on Lead
        const newCount = currentCount + 1;
        const updateFields: any = {
          followUpCount: newCount,
          lastInteractionAt: new Date(),
          followUpStatus: `DRIP_DAY_${targetStep.day}_SENT`,
          updatedAt: new Date()
        };

        // If completed final drip (Day 15), mark status as No Response if still untouched
        if (targetStep.day === 15) {
          updateFields.status = 'No Response';
        }

        await Lead.updateOne({ _id: lead._id }, { $set: updateFields });

        processedResults.push({
          leadId: lead.leadId,
          phone: lead.phone,
          dripDay: targetStep.day,
          template: templateName,
          success: true,
          providerMessageId: dispatchRes.providerMessageId
        });
      } else {
        await WorkflowTrigger.updateOne(
          { eventId },
          { $set: { status: 'FAILED', processedAt: new Date() } }
        );
        processedResults.push({
          leadId: lead.leadId,
          phone: lead.phone,
          dripDay: targetStep.day,
          template: templateName,
          success: false,
          error: dispatchRes.error
        });
      }
    }

    return {
      success: true,
      processedCount: processedResults.length,
      results: processedResults
    };
  }

  /**
   * Cancels all pending follow-up triggers when a customer responds.
   */
  static async cancelPendingFollowUps(leadId: string, phone?: string) {
    await connectToDatabase();

    const query: any = { status: 'PENDING' };
    if (leadId) query.leadId = leadId;

    await WorkflowTrigger.updateMany(query, {
      $set: { status: 'SUPPRESSED_CUSTOMER_REPLIED', processedAt: new Date() }
    });

    if (phone) {
      await Lead.updateMany(
        { phone },
        { 
          $set: { 
            status: 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP',
            lastInteractionAt: new Date(),
            updatedAt: new Date()
          } 
        }
      );
    }

    return { success: true, leadId, canceled: true };
  }
}
