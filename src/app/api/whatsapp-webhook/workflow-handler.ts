import mongoose from 'mongoose';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';
import { resolveTenureAndThresholds } from '@/lib/financials';
import { Lead } from '@/models/Lead';
import { getDatabase } from '@/lib/db';

/**
 * Main handler to process incoming webhook interactive payloads
 * @param {string} userPhoneNumber - Cleaned sender mobile phone string
 * @param {string} buttonTitle - Text content of interactive selection
 * @param {string} buttonId - ID of the interactive selection if available
 */
export async function handleInboundButtonWorkflow(userPhoneNumber: string, buttonTitle: string, buttonId: string = ""): Promise<boolean> {
  // Try to connect to DB via fault-tolerant wrapper
  await getDatabase(userPhoneNumber);

  if (buttonTitle === "Check Eligibility" || buttonTitle.toLowerCase().includes("check eligibility")) {
    await processEligibility(userPhoneNumber, buttonTitle, buttonId);
    return true;
  } else if (buttonTitle === "Apply Now" || buttonTitle.toLowerCase().includes("apply now")) {
    await processApplyNow(userPhoneNumber, buttonTitle, buttonId);
    return true;
  } else if (buttonTitle === "Talk To Expert" || buttonTitle.toLowerCase().includes("expert") || buttonTitle.toLowerCase().includes("talk")) {
    await processTalkToExpert(userPhoneNumber, buttonTitle, buttonId);
    return true;
  } else {
    // Other button types not explicitly defined in the webhook blueprint
    console.log(`Unmapped text/button received: ${buttonTitle}`);
    await logInteraction(userPhoneNumber, buttonTitle, buttonId, "unmapped_input");
    return false;
  }
}

async function logInteraction(phone: string, text: string, buttonId: string, workflowState: string, additionalUpdates: any = {}) {
  let lead = await Lead.findOne({ phone: phone });
  
  if (!lead) {
    lead = new Lead({
      name: "Valued Customer",
      phone: phone,
      financialProfile: {
        loanType: "Personal Loan",
        requestedLoanAmount: 1000000,
        preferredTenureYears: null
      }
    });
  }

  lead.currentWorkflowState = workflowState;
  
  // Apply additional updates dynamically
  if (additionalUpdates.assignedAgent) lead.assignedAgent = additionalUpdates.assignedAgent;
  if (additionalUpdates.emiCalculationLog) lead.emiCalculationLog = additionalUpdates.emiCalculationLog;

  lead.interactions.push({
    interactionId: new mongoose.Types.ObjectId(),
    type: "whatsapp_interactive",
    direction: "inbound",
    buttonId: buttonId,
    text: text,
    timestamp: new Date(),
    status: "processed_by_bot"
  });

  await lead.save();
  return lead;
}

async function processApplyNow(phone: string, text: string, buttonId: string) {
  const lead = await logInteraction(phone, text, buttonId, "awaiting_application");
  
  const loanType = lead.financialProfile?.loanType || "Personal Loan";
  // Determine application link based on loanType
  const applyLink = `https://avani-ai-crm.vercel.app/apply?type=${encodeURIComponent(loanType)}&phone=${encodeURIComponent(phone)}`;

  const responseText = `Hi ${lead.name || "Customer"},\n\nGreat choice! You can begin your application for a ${loanType} immediately by clicking the link below:\n\n${applyLink}\n\nOur agents will receive your application instantly.`;
  await sendAiSensyWhatsApp({ destination: phone, userName: lead.name || 'Customer', text: responseText });
}

async function processTalkToExpert(phone: string, text: string, buttonId: string) {
  const lead = await logInteraction(phone, text, buttonId, "requires_human_agent", {
    assignedAgent: {
      name: "Sachin Shinde",
      email: "enquiry@avanifinserv.com",
      status: "urgent_flag"
    }
  });

  const responseText = `Hi ${lead.name || "Customer"},\n\nI have notified our business experts. Sachin Shinde or a representative from our Latur office will reach out to you at ${phone} very shortly.\n\nThank you for choosing Avani Loan Services.`;
  await sendAiSensyWhatsApp({ destination: phone, userName: lead.name || 'Customer', text: responseText });
}

async function processEligibility(phone: string, text: string, buttonId: string) {
  // 1. Fetch user profile from MongoDB or create fallback
  let lead = await logInteraction(phone, text, buttonId, "eligibility_calculated");

  // Extract financial profiles with standard structural defaults
  const profile = lead.financialProfile || {};
  const loanType = profile.loanType || "Personal Loan";
  const requestedAmount = profile.requestedLoanAmount || 1000000;
  const userPreferredYears = profile.preferredTenureYears;

  // 2. Map standard annual base rates used by Avani Loan Services
  const baseRates: Record<string, number> = {
    "Home Loan": 8.5,
    "Education Loan (India)": 9.2,
    "Mortgage Loan": 9.5,
    "Education Loan (Global Studies)": 10.2,
    "Personal Loan": 10.5,
    "Doctor Loan": 11.0,
    "Business Loan": 14.0
  };
  const annualRate = baseRates[loanType] || 10.5;

  // 3. Resolve timeline allocations via threshold rule rules
  const { resolvedYears, ruleApplied, isFallback } = resolveTenureAndThresholds(requestedAmount, userPreferredYears);
  const totalMonths = resolvedYears * 12;

  // 4. Calculate Mathematical EMI Projections
  const monthlyRate = (annualRate / 12) / 100;
  const emiNumerator = requestedAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths);
  const emiDenominator = Math.pow(1 + monthlyRate, totalMonths) - 1;
  
  const calculatedEmi = Math.round(emiNumerator / emiDenominator);
  const totalRepayment = Math.round(calculatedEmi * totalMonths);
  const totalInterestPayable = Math.round(totalRepayment - requestedAmount);

  // 5. Commit calculations and pipeline logs directly into MongoDB
  lead.emiCalculationLog = {
    calculatedEmi,
    totalInterestPayable,
    totalRepayment,
    resolvedTenureMonths: totalMonths,
    resolvedTenureYears: resolvedYears,
    appliedThresholdRule: ruleApplied,
    usingFallbackDefault: isFallback,
    calculatedAt: new Date()
  };
  await lead.save();

  // 6. Format currency values cleanly into Indian Numbering System standards
  const formatINR = (num: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);

  // 7. Compose output message payload block
  const personalizedText = 
`Hi ${lead.name || "Customer"},

Here is your real-time pre-qualification assessment from AVANI LOAN SERVICES:

🔹 Requested Loan: ${formatINR(requestedAmount)}
🔹 Loan Category: ${loanType}
🔹 Expected EMI: ${formatINR(calculatedEmi)}/month
🔹 Est. Interest Rate: ${annualRate}% p.a.
🔹 Tenure Duration: ${resolvedYears} Years (${totalMonths} Months)

Total Repayment (Principal + Interest): ${formatINR(totalRepayment)}
Total Interest Component: ${formatINR(totalInterestPayable)}

To finalize your documentation verification at our Ausa Road, Latur office, please reply with 'YES' or click 'Talk to Expert'.

*Avani Finserv - Fast & Secure Approvals*`;

  // 8. Call AiSensy Dynamic text composition function pipeline
  await sendAiSensyWhatsApp({ destination: phone, userName: lead.name || 'Customer', text: personalizedText });
}
