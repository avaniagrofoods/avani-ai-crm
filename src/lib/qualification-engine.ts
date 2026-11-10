/**
 * AVANI LOAN SERVICES — Transparent Lead Qualification Engine (CP-26.2)
 * 
 * Computes a deterministic 0–100 score based on 7 transparent factors:
 * 1. Applicant contactability (max 15)
 * 2. Loan requirement clarity (max 15)
 * 3. Required amount and purpose (max 15)
 * 4. Income / business financials (max 20)
 * 5. Document readiness (max 15)
 * 6. Applicant interest & responsiveness (max 10)
 * 7. Follow-up engagement (max 10)
 * 
 * DISCLAIMER: This score is an internal CRM prioritization metric.
 * It is NOT a bank credit decision, CIBIL score, or guarantee of loan approval.
 */

export interface QualificationFactors {
  contactability: number;     // max 15
  clarity: number;           // max 15
  amountPurpose: number;     // max 15
  incomeFinancials: number;  // max 20
  docReadiness: number;      // max 15
  responsiveness: number;    // max 10
  followUpEngagement: number;// max 10
  notes: string;
}

export interface QualificationResult {
  score: number;
  tier: 'HIGH_PRIORITY' | 'QUALIFIED' | 'NEEDS_FURTHER_INFO' | 'LOW_PRIORITY';
  tierLabel: string;
  breakdown: QualificationFactors;
  reasoning: string[];
}

export class QualificationEngine {
  public static calculateScore(lead: any, conversation?: any, docs?: any): QualificationResult {
    const breakdown: QualificationFactors = {
      contactability: 0,
      clarity: 0,
      amountPurpose: 0,
      incomeFinancials: 0,
      docReadiness: 0,
      responsiveness: 0,
      followUpEngagement: 0,
      notes: ''
    };

    const reasoning: string[] = [];

    // 1. Applicant contactability (max 15)
    // Valid phone (+10), name (+3), email/city (+2)
    if (lead.phone && lead.phone.length >= 10) {
      breakdown.contactability += 10;
      reasoning.push('Valid verified mobile number (+10)');
    }
    if (lead.name && lead.name !== 'Customer') {
      breakdown.contactability += 3;
      reasoning.push('Applicant full name provided (+3)');
    }
    if (lead.city || lead.email) {
      breakdown.contactability += 2;
      reasoning.push('Location/Email identified (+2)');
    }
    breakdown.contactability = Math.min(15, breakdown.contactability);

    // 2. Loan requirement clarity (max 15)
    // Product identified (+10), specific tenure or loan subtype (+5)
    if (lead.loanType) {
      breakdown.clarity += 10;
      reasoning.push(`Specific loan category identified: ${lead.loanType} (+10)`);
    }
    if (lead.preferredTenure || lead.preferredTenureYears || lead.employmentType) {
      breakdown.clarity += 5;
      reasoning.push('Tenure or employment profile clarified (+5)');
    }
    breakdown.clarity = Math.min(15, breakdown.clarity);

    // 3. Required amount and purpose (max 15)
    const amount = Number(lead.requiredLoanAmount) || parseFloat(String(lead.requestedAmount || '').replace(/[^0-9.]/g, '')) || 0;
    if (amount > 0) {
      breakdown.amountPurpose += 10;
      reasoning.push(`Loan requirement amount specified: ₹${amount.toLocaleString('en-IN')} (+10)`);
    }
    if (lead.loanPurpose || (conversation?.history && conversation.history.some((h: any) => /purpose|clinic|equipment|flat|house|business|study/i.test(h.text || '')))) {
      breakdown.amountPurpose += 5;
      reasoning.push('Loan purpose clarified (+5)');
    }
    breakdown.amountPurpose = Math.min(15, breakdown.amountPurpose);

    // 4. Income / business financials (max 20)
    const income = Number(lead.monthlyIncome) || Number(lead.annualIncome) || 0;
    if (income > 0 || lead.monthlyIncomeRange) {
      breakdown.incomeFinancials += 12;
      reasoning.push('Monthly income / turnover disclosed (+12)');
    }
    if (lead.cibilScore && lead.cibilScore >= 650) {
      breakdown.incomeFinancials += 8;
      reasoning.push(`Healthy reported CIBIL score: ${lead.cibilScore} (+8)`);
    } else if (lead.employmentType === 'Doctor / Medical Professional' || lead.employmentType === 'Chartered Accountant') {
      breakdown.incomeFinancials += 8;
      reasoning.push('High-credit profile professional (+8)');
    } else if (income > 50000) {
      breakdown.incomeFinancials += 8;
      reasoning.push('Strong disposable income tier (+8)');
    }
    breakdown.incomeFinancials = Math.min(20, breakdown.incomeFinancials);

    // 5. Document readiness (max 15)
    const receivedDocs = docs?.receivedDocuments?.length || (lead.documentsReceived ? 3 : 0);
    if (receivedDocs >= 3) {
      breakdown.docReadiness += 15;
      reasoning.push('Core KYC and financial documents received (+15)');
    } else if (receivedDocs > 0) {
      breakdown.docReadiness += 8;
      reasoning.push('Partial documents submitted (+8)');
    } else if (lead.documentStatus === 'DOCUMENTS_READY') {
      breakdown.docReadiness += 5;
      reasoning.push('Applicant confirmed documents are ready (+5)');
    }
    breakdown.docReadiness = Math.min(15, breakdown.docReadiness);

    // 6. Applicant interest & responsiveness (max 10)
    const historyCount = conversation?.history?.length || 0;
    if (historyCount >= 3) {
      breakdown.responsiveness += 10;
      reasoning.push('High engagement: multiple conversational interactions (+10)');
    } else if (historyCount >= 1) {
      breakdown.responsiveness += 6;
      reasoning.push('Direct response received from applicant (+6)');
    }
    breakdown.responsiveness = Math.min(10, breakdown.responsiveness);

    // 7. Follow-up engagement (max 10)
    const followUps = lead.followUpTasks || [];
    const completedFollowUps = followUps.filter((t: any) => t.status === 'COMPLETED').length;
    if (completedFollowUps >= 1) {
      breakdown.followUpEngagement += 10;
      reasoning.push('Advisor follow-up interaction successfully conducted (+10)');
    } else if (lead.status === 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP' || lead.stage === 'CONTACTED') {
      breakdown.followUpEngagement += 5;
      reasoning.push('Active lead in follow-up queue (+5)');
    }
    breakdown.followUpEngagement = Math.min(10, breakdown.followUpEngagement);

    // Total Score
    const totalScore = Math.min(100, Math.max(0, 
      breakdown.contactability +
      breakdown.clarity +
      breakdown.amountPurpose +
      breakdown.incomeFinancials +
      breakdown.docReadiness +
      breakdown.responsiveness +
      breakdown.followUpEngagement
    ));

    let tier: QualificationResult['tier'] = 'LOW_PRIORITY';
    let tierLabel = 'Incomplete / Low-Priority Lead';

    if (totalScore >= 80) {
      tier = 'HIGH_PRIORITY';
      tierLabel = 'High-Priority Lead';
    } else if (totalScore >= 60) {
      tier = 'QUALIFIED';
      tierLabel = 'Qualified Lead';
    } else if (totalScore >= 40) {
      tier = 'NEEDS_FURTHER_INFO';
      tierLabel = 'Needs Further Information';
    }

    breakdown.notes = reasoning.join(' | ');

    return {
      score: totalScore,
      tier,
      tierLabel,
      breakdown,
      reasoning
    };
  }
}
