import mongoose from 'mongoose';
import { getDatabase } from '@/lib/db';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import { processOutgoingZapierPayload } from '@/app/api/omnidim-webhook/route';

/**
 * Validates whether the incoming customer message is structurally valid 
 * or random gibberish text based on standard context flags.
 */
function isInputGibberish(text: string): boolean {
  const cleanText = text.trim();
  // Flag short, random keyboard mashes (e.g., "asdf", "xyz", "ok", ".")
  if (cleanText.length < 3 && !/^\d+$/.test(cleanText)) return true;
  if (/^[a-zA-Z]{1,3}$/.test(cleanText) && !["PL", "BL", "HL", "CA", "YES", "NO"].includes(cleanText.toUpperCase())) return true;
  return false;
}

/**
 * Parses inbound message traffic, handles missing profile correction values,
 * and tracks retry thresholds before handing off to a human agent.
 */
export async function handleInboundCorrectionWorkflow(userPhone10Digit: string, incomingText: string): Promise<boolean> {
  const db = await getDatabase(userPhone10Digit);
  const leadsCollection = db.collection('leads');

  const lead = await leadsCollection.findOne({ phone: userPhone10Digit });
  if (!lead || lead.currentWorkflowState !== "awaiting_correction") {
    return false; // Return false to indicate this wasn't handled by correction workflow
  }

  const correctionContext = lead.pendingCorrectionLog || {};
  const currentFieldMissing = correctionContext.targetField; 
  let currentRetryCount = correctionContext.retryCount || 0;

  if (isInputGibberish(incomingText)) {
    currentRetryCount += 1;

    if (currentRetryCount >= 2) {
      await leadsCollection.updateOne(
        { _id: lead._id },
        {
          $set: {
            currentWorkflowState: "requires_human_agent",
            "assignedAgent.status": "urgent_flag",
            updatedAt: new Date()
          },
          $push: {
            interactions: {
              interactionId: new mongoose.Types.ObjectId(),
              type: "bot_handover",
              text: `Chat transferred to live agent due to continuous invalid inputs. Final input: "${incomingText}"`,
              timestamp: new Date()
            }
          }
        }
      );

      const humanHandoverMessage = `Hi ${lead.name || "Customer"},\n\nWe are matching you with a representative. \n\nOur system couldn't verify that detail automatically. Our founder, Sachin Shinde, or an expert loan consultant from our Ausa Road, Latur office will review your message history and contact you directly.\n\n*Avani Finserv - Personal Consultation*`;
      await sendAiSensyWhatsApp({ destination: userPhone10Digit, userName: lead.name || "Customer", text: humanHandoverMessage }, `CHATBOT_ROUTER_HANDOVER_${Date.now()}_${userPhone10Digit}`);
      return true;
    }

    await leadsCollection.updateOne(
      { _id: lead._id },
      { $set: { "pendingCorrectionLog.retryCount": currentRetryCount, updatedAt: new Date() } }
    );

    const rePromptMessage = `Sorry, we couldn't process that response. Please enter a valid name or description to update your profile properly.\n\n👉 Please reply explicitly with your correct information.`;
    await sendAiSensyWhatsApp({ destination: userPhone10Digit, userName: lead.name || "Customer", text: rePromptMessage }, `CHATBOT_ROUTER_REPROMPT_${Date.now()}_${userPhone10Digit}`);
    return true;
  }

  const updateQuery: any = {
    $set: {
      currentWorkflowState: "eligibility_calculated",
      updatedAt: new Date()
    },
    $unset: {
      pendingCorrectionLog: ""
    },
    $push: {
      interactions: {
        interactionId: new mongoose.Types.ObjectId(),
        type: "whatsapp_correction_catch",
        direction: "inbound",
        text: incomingText,
        timestamp: new Date(),
        status: "processed"
      }
    }
  };

  if (currentFieldMissing) {
    updateQuery.$set[`financialProfile.${currentFieldMissing}`] = incomingText.trim();
  }

  await leadsCollection.updateOne({ _id: lead._id }, updateQuery);
  const updatedLead = await leadsCollection.findOne({ _id: lead._id });

  const finalizedSuccessMessage = `Thank you! Your profile details have been successfully verified.\n\nWe have forwarded your completed file to our underwriting desk. \n\nOur estimated calculation parameters for your profile are now active in the CRM dashboard view panel. An executive will get back to you shortly.\n\n*Avani Finserv - Fast & Secure Approvals*`;
  await sendAiSensyWhatsApp({ destination: userPhone10Digit, userName: updatedLead?.name || "Customer", text: finalizedSuccessMessage }, `CHATBOT_ROUTER_SUCCESS_${Date.now()}_${userPhone10Digit}`);

  try {
    const loanType = updatedLead?.financialProfile?.loanType || updatedLead?.loanType || "Personal Loan";
    
    // We mock the original integration Payload format for Zapier
    const integrationPayload: any = {
      eventId: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      sourceSystem: "Avani AI CRM Pipeline (Correction Catch)",
      fullName: updatedLead?.name,
      mobileNumber: updatedLead?.phone,
      city: updatedLead?.city || "Unknown",
      leadProfile: {
        fullName: updatedLead?.name,
        mobileNumber: updatedLead?.phone,
        city: updatedLead?.city || "Unknown"
      },
      financialRequirements: updatedLead?.financialProfile || { loanType },
      productSpecificFields: updatedLead?.financialProfile || {}
    };

    await processOutgoingZapierPayload(loanType, integrationPayload, updatedLead);
  } catch (e) {
    console.error("Error re-triggering Zapier post-correction:", e);
  }

  return true;
}
