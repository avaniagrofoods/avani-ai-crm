/**
 * APR-009 STAGE 5H — AVANI AI AGENT COMPLIANCE, KNOWLEDGE RETRIEVAL & CRM HANDOFF ENGINE
 *
 * Guarantees:
 * - Approved AVANI LOAN SERVICES knowledge-base retrieval only (no hallucinated bank terms)
 * - Enquiry classification, lead qualification progress, follow-up recommendations, human escalation
 * - Consent-aware communication (autoContactAllowed is ALWAYS false; opted-out customers suppressed)
 * - Deterministic compliance guardrail prohibiting guaranteed approvals, invented interest rates,
 *   invented eligibility decisions, fabricated customer data, or unauthorized financial commitments
 * - Safe error recovery with audit trail generation
 */

import {
  ADVISOR_CONTACT,
  ADVISORY_DISCLAIMER,
  AgentEngine,
  CANONICAL_LOAN_PRODUCTS
} from './ai-agent';

export type EnquiryClassification =
  | 'LOAN_INFORMATION'
  | 'LEAD_QUALIFICATION'
  | 'DOCUMENT_GUIDANCE'
  | 'HUMAN_ESCALATION'
  | 'PROHIBITED_COMMITMENT_QUERY'
  | 'OPT_OUT_OR_DECLINE'
  | 'GENERAL_SUPPORT';

export interface ApprovedKnowledgeEntry {
  id: string;
  product: string;
  keywords: string[];
  summary: string;
  advisoryNote: string;
}

export const APPROVED_KNOWLEDGE_BASE: readonly ApprovedKnowledgeEntry[] = [
  {
    id: 'KB-PERSONAL',
    product: 'Personal Loan',
    keywords: ['personal loan', 'salaried', 'पर्सनल लोन', 'वैयक्तिक'],
    summary: 'Personal Loan advisory for salaried and eligible professionals with transparent documentation guidance across partner banks and NBFCs.',
    advisoryNote: 'Loan amount, tenure, and rate are decided solely by the sanctioning bank/NBFC after KYC, income, and CIBIL credit review.'
  },
  {
    id: 'KB-BUSINESS',
    product: 'Business Loan',
    keywords: ['business loan', 'व्यापार कर्ज', 'बिझनेस', 'व्यापार'],
    summary: 'Business Loan consultancy supporting business expansion, machinery purchase, and capacity enhancement through partner lenders.',
    advisoryNote: 'Eligibility and pricing are determined solely by partner lenders based on GST, ITR, audited balance sheets, and banking conduct.'
  },
  {
    id: 'KB-DOCTOR',
    product: 'Doctor Loan',
    keywords: ['doctor', 'doctor loan', 'mbbs', 'md', 'bds', 'clinic', 'hospital', 'डॉक्टर'],
    summary: 'Specialized Doctor Loan advisory for registered medical practitioners, clinics, diagnostic centers, and medical equipment financing.',
    advisoryNote: 'Requires valid medical degree and Medical Council registration; sanction terms rest exclusively with partner banks/NBFCs.'
  },
  {
    id: 'KB-HOME',
    product: 'Home Loan',
    keywords: ['home loan', 'flat', 'house', 'housing', 'construction', 'गृहकर्ज', 'होम लोन'],
    summary: 'Home Loan advisory for property purchase, home construction, renovation, and balance transfer through leading partner banks.',
    advisoryNote: 'Final sanction, LTV, and interest rate depend on partner bank underwriting, property legal/technical valuation, and applicant credit profile.'
  },
  {
    id: 'KB-MORTGAGE',
    product: 'Mortgage Loan',
    keywords: ['mortgage', 'mortgage loan', 'मॉर्गिज'],
    summary: 'Mortgage Loan advisory for unencumbered residential, commercial, and industrial properties with competitive terms.',
    advisoryNote: 'Subject to clear 30-year title chain, legal scrutiny, property valuation, and partner lender credit underwriting.'
  },
  {
    id: 'KB-LAP',
    product: 'Loan Against Property (LAP)',
    keywords: ['lap', 'loan against property', 'against property', 'प्रॉपर्टी कर्ज', 'प्रॉपर्टी तारण कर्ज'],
    summary: 'Loan Against Property (LAP) guidance enabling long-tenure liquidity against residential, commercial, or industrial real estate.',
    advisoryNote: 'Sanction and disbursal are subject to partner bank credit policies, property valuation, and verified repayment capacity.'
  },
  {
    id: 'KB-WORKING-CAPITAL',
    product: 'Working Capital Loan',
    keywords: ['working capital', 'od limit', 'cc limit', 'cash credit', 'overdraft', 'वर्किंग कॅपिटल'],
    summary: 'Working Capital advisory including Cash Credit (CC) limits, Overdraft (OD) facilities, and trade finance solutions.',
    advisoryNote: 'Limits are assessed by partner banks against audited turnover, stock/debtors statements, and financial ratios.'
  },
  {
    id: 'KB-MSME',
    product: 'MSME Loan',
    keywords: ['msme', 'msme loan', 'udyam', 'udyog aadhar', 'small business loan', 'उद्योग आधार', 'लघु उद्योग'],
    summary: 'MSME Loan consultancy connecting micro, small, and medium enterprises with priority-sector lending schemes and partner institutions.',
    advisoryNote: 'Lender terms, government interest subsidies, and collateral requirements depend on Udyam registration, business vintage, and lender policy.'
  },
  {
    id: 'KB-PROFESSIONAL',
    product: 'Professional Loan',
    keywords: ['professional loan', 'ca loan', 'chartered accountant', 'lawyer', 'architect', 'icai', 'व्यावसायिक कर्ज'],
    summary: 'Customized Professional Loan advisory for Chartered Accountants, Company Secretaries, Architects, and Advocates.',
    advisoryNote: 'Requires proof of professional practice certificate/membership; loan approval and terms rest solely with partner financial institutions.'
  },
  {
    id: 'KB-EDU-INDIA',
    product: 'Education Loan — India',
    keywords: ['education loan', 'college', 'tuition', 'student loan', 'शिक्षण कर्ज', 'एजुकेशन लोन'],
    summary: 'Domestic Education Loan guidance for recognized Indian universities, colleges, engineering, medical, and management courses.',
    advisoryNote: 'Sanction terms depend on institution accreditation, entrance merit, co-applicant income, and partner bank policy.'
  },
  {
    id: 'KB-EDU-ABROAD',
    product: 'Education Loan — Abroad',
    keywords: ['abroad', 'overseas', 'global', 'i-20', 'cas', 'foreign study', 'परदेश', 'विदेश'],
    summary: 'Overseas Education Loan advisory for accredited international universities in the US, UK, Canada, Europe, Australia, and worldwide.',
    advisoryNote: 'Final loan sanction and forex disbursement terms are subject to partner lender underwriting and university offer letter verification.'
  },
  {
    id: 'KB-INSTITUTIONAL',
    product: 'School and College Institutional Funding',
    keywords: ['school funding', 'college funding', 'institutional funding', 'trust', 'society', 'campus', 'शाळा', 'महाविद्यालय'],
    summary: 'Institutional funding advisory for recognized schools, colleges, higher-education institutes, and educational trusts/societies.',
    advisoryNote: 'Any preliminary funding estimate is indicative only and not a confirmed sanction, commitment, or revenue figure.'
  },
  {
    id: 'KB-OFFICIAL-CONTACT',
    product: 'AVANI LOAN SERVICES Official Contact',
    keywords: ['contact', 'office', 'address', 'latur', 'sachin', 'advisor', 'phone', 'email'],
    summary: `AVANI LOAN SERVICES (Latur, Maharashtra — PIN 413512) · Founder & Chief Loan Advisor: ${ADVISOR_CONTACT.name} · Official Email: info@avanifinserv.com · Website: ${ADVISOR_CONTACT.website}`,
    advisoryNote: ADVISORY_DISCLAIMER
  }
];

const PROHIBITED_OUTPUT_PATTERNS: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(100%|guaranteed|assured|confirmed)\s+(loan\s+)?(approval|sanction|disbursal)\b/i, reason: 'PROHIBITED_APPROVAL_GUARANTEE' },
  { pattern: /\b(guaranteed|fixed|locked|promised)\s+(interest\s+)?rate\s+of\s+\d+(\.\d+)?%/i, reason: 'PROHIBITED_INVENTED_INTEREST_RATE' },
  { pattern: /\byou\s+are\s+(already\s+)?(pre-?approved|guaranteed\s+eligible)\b/i, reason: 'PROHIBITED_INVENTED_ELIGIBILITY' },
  { pattern: /\bwe\s+(hereby\s+)?(commit|promise|guarantee)\s+(to\s+)?(sanction|disburse|approve)\b/i, reason: 'PROHIBITED_FINANCIAL_COMMITMENT' }
];

export function retrieveApprovedKnowledge(query: string): ApprovedKnowledgeEntry[] {
  const lower = String(query || '').toLowerCase();
  if (!lower.trim()) return [APPROVED_KNOWLEDGE_BASE[APPROVED_KNOWLEDGE_BASE.length - 1]];
  const matches = APPROVED_KNOWLEDGE_BASE.filter((entry) =>
    entry.keywords.some((kw) => lower.includes(kw.toLowerCase()))
  );
  if (matches.length === 0) {
    return [APPROVED_KNOWLEDGE_BASE[APPROVED_KNOWLEDGE_BASE.length - 1]];
  }
  return matches.slice(0, 3);
}

export function classifyCustomerEnquiry(text: string): EnquiryClassification {
  const raw = String(text || '');
  const lower = raw.toLowerCase();

  if (/\b(stop|unsubscribe|opt\s*-?out|not interested|decline|do not contact)\b/i.test(lower) || /नको|नहीं चाहिए|बंद करा/.test(raw)) {
    return 'OPT_OUT_OR_DECLINE';
  }
  if (/\b(advisor|human|sachin|shinde|call me|speak to|agent)\b/i.test(lower) || /सल्लागार|बात करनी|बोलणे/.test(raw)) {
    return 'HUMAN_ESCALATION';
  }
  if (
    /\b(guarantee|100%|confirm approval|sure shot|exact interest rate|promise rate|instant sanction)\b/i.test(lower) ||
    /नक्की मिळेल का|पक्का मिलेगा/.test(raw)
  ) {
    return 'PROHIBITED_COMMITMENT_QUERY';
  }
  if (/\b(document|checklist|itr|pan|aadhaar|kyc|bank statement)\b/i.test(lower)) {
    return 'DOCUMENT_GUIDANCE';
  }
  if (/\b(apply|eligib|income|salary|turnover|lakh|crore|loan amount)\b/i.test(lower)) {
    return 'LEAD_QUALIFICATION';
  }
  if (
    CANONICAL_LOAN_PRODUCTS.some((p) => lower.includes(p.toLowerCase().split(' ')[0])) ||
    /\b(home|business|personal|mortgage|lap|doctor|education|school|college)\b/i.test(lower)
  ) {
    return 'LOAN_INFORMATION';
  }
  return 'GENERAL_SUPPORT';
}

export function enforceComplianceGuardrails(draftResponse: string): {
  safeResponse: string;
  violationsBlocked: string[];
  disclaimerAppended: boolean;
} {
  let safe = String(draftResponse || '').trim();
  const violationsBlocked: string[] = [];

  for (const rule of PROHIBITED_OUTPUT_PATTERNS) {
    if (rule.pattern.test(safe)) {
      violationsBlocked.push(rule.reason);
      safe = safe.replace(rule.pattern, '[subject to partner bank underwriting and verification]');
    }
  }

  let disclaimerAppended = false;
  if (violationsBlocked.length > 0 && !safe.includes('NOT act as a direct lender')) {
    safe = `${safe}\n\n${ADVISORY_DISCLAIMER}`;
    disclaimerAppended = true;
  }

  return { safeResponse: safe, violationsBlocked, disclaimerAppended };
}

export interface FollowupRecommendation {
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  nextStep: string;
  suggestedFollowupHours: number;
  requiresHumanEscalation: boolean;
  missingFields: string[];
  autoContactAllowed: false;
}

export function generateFollowupRecommendation(
  context: Record<string, unknown> = {},
  classification: EnquiryClassification = 'GENERAL_SUPPORT'
): FollowupRecommendation {
  const requiredFields = ['fullName', 'mobile', 'city', 'employmentType', 'monthlyIncome', 'loanProduct', 'loanAmount'];
  const missingFields = requiredFields.filter((k) => !context[k]);

  if (classification === 'OPT_OUT_OR_DECLINE') {
    return {
      priority: 'LOW',
      nextStep: 'SUPPRESS_ALL_OUTBOUND_CONTACT_AND_LOG_OPTOUT',
      suggestedFollowupHours: 0,
      requiresHumanEscalation: false,
      missingFields,
      autoContactAllowed: false
    };
  }

  if (classification === 'HUMAN_ESCALATION' || classification === 'PROHIBITED_COMMITMENT_QUERY') {
    return {
      priority: 'HIGH',
      nextStep: `ASSIGN_TO_HUMAN_ADVISOR (${ADVISOR_CONTACT.name}) — Manual consultation only after verified consent`,
      suggestedFollowupHours: 2,
      requiresHumanEscalation: true,
      missingFields,
      autoContactAllowed: false
    };
  }

  if (missingFields.length === 0) {
    return {
      priority: 'HIGH',
      nextStep: 'ADVISOR_DOCUMENT_REVIEW_AND_LENDER_MATCHING',
      suggestedFollowupHours: 4,
      requiresHumanEscalation: true,
      missingFields,
      autoContactAllowed: false
    };
  }

  return {
    priority: 'MEDIUM',
    nextStep: `COLLECT_REMAINING_QUALIFICATION_FIELDS (${missingFields.slice(0, 3).join(', ')})`,
    suggestedFollowupHours: 24,
    requiresHumanEscalation: false,
    missingFields,
    autoContactAllowed: false
  };
}

export async function handleCrmAssistedTurn(params: {
  conversation?: Record<string, unknown>;
  text: string;
  consentStatus?: 'GRANTED' | 'DENIED' | 'WITHDRAWN' | 'PENDING';
  isOptedOut?: boolean;
}) {
  const safeConversation: Record<string, unknown> = {
    currentState: 'NEW',
    language: 'en',
    context: {},
    ...(params.conversation || {})
  };

  const classification = classifyCustomerEnquiry(params.text);
  const knowledgeEntries = retrieveApprovedKnowledge(params.text);

  // Strict Consent & Opt-Out Gate BEFORE generating outbound communication
  const consentUpper = String(params.consentStatus || 'PENDING').toUpperCase();
  if (params.isOptedOut === true || consentUpper === 'DENIED' || consentUpper === 'WITHDRAWN' || classification === 'OPT_OUT_OR_DECLINE') {
    const auditRecord = AgentEngine.createAuditRecord({
      detectedLanguage: (safeConversation.language as 'en' | 'mr' | 'hi') || 'en',
      detectedLoanCategory: String((safeConversation.context as Record<string, unknown>)?.loanProduct || 'General'),
      extractedQualificationFields: {},
      handoffDecision: 'CONTINUE_BOT'
    });
    return {
      success: true,
      classification: 'OPT_OUT_OR_DECLINE' as EnquiryClassification,
      consentSuppressed: true,
      autoContactAllowed: false as const,
      replyText: 'Customer communication suppressed due to opt-out or withdrawn/denied consent. Do not initiate outbound contact.',
      updatedState: 'CUSTOMER_DECLINED',
      knowledgeReferences: [],
      compliance: { violationsBlocked: [], disclaimerAppended: false },
      followupRecommendation: generateFollowupRecommendation(safeConversation.context as Record<string, unknown>, 'OPT_OUT_OR_DECLINE'),
      crmHandoffNotes: null,
      auditRecord
    };
  }

  try {
    const engineResult = await AgentEngine.processMessage(safeConversation, params.text);
    const kbSummary = knowledgeEntries[0]
      ? `\n\n[Approved Advisory Info — ${knowledgeEntries[0].product}]: ${knowledgeEntries[0].summary} ${knowledgeEntries[0].advisoryNote}`
      : '';

    const rawReply =
      classification === 'LOAN_INFORMATION' || classification === 'PROHIBITED_COMMITMENT_QUERY'
        ? `${engineResult.nextQuestion}${kbSummary}`
        : engineResult.nextQuestion;

    const compliance = enforceComplianceGuardrails(rawReply);
    const ctx = (safeConversation.context as Record<string, unknown>) || {};
    const followupRecommendation = generateFollowupRecommendation(ctx, classification);
    const crmHandoffNotes = AgentEngine.prepareAdvisorHandoffNotes(ctx);
    const auditRecord = AgentEngine.createAuditRecord({
      detectedLanguage: (safeConversation.language as 'en' | 'mr' | 'hi') || 'en',
      detectedLoanCategory: String(ctx.loanProduct || knowledgeEntries[0]?.product || 'General'),
      extractedQualificationFields: ctx,
      handoffDecision: followupRecommendation.requiresHumanEscalation ? 'HUMAN_ADVISOR_HANDOFF' : 'CONTINUE_BOT'
    });

    return {
      success: true,
      classification,
      consentSuppressed: false,
      autoContactAllowed: false as const,
      replyText: compliance.safeResponse,
      updatedState: engineResult.updatedState,
      knowledgeReferences: knowledgeEntries.map((k) => ({ id: k.id, product: k.product })),
      compliance,
      followupRecommendation,
      crmHandoffNotes,
      auditRecord
    };
  } catch (err: unknown) {
    console.error('[AVANI AI Agent] Safe error recovery triggered:', err instanceof Error ? err.message : 'unknown');
    return {
      success: true,
      recoveredFromError: true,
      classification,
      consentSuppressed: false,
      autoContactAllowed: false as const,
      replyText: `Thank you for contacting AVANI LOAN SERVICES. Our advisor ${ADVISOR_CONTACT.name} will assist you with accurate guidance. ${ADVISORY_DISCLAIMER}`,
      updatedState: 'HUMAN_HANDOFF',
      knowledgeReferences: knowledgeEntries.map((k) => ({ id: k.id, product: k.product })),
      compliance: { violationsBlocked: [], disclaimerAppended: true },
      followupRecommendation: generateFollowupRecommendation({}, 'HUMAN_ESCALATION'),
      crmHandoffNotes: AgentEngine.prepareAdvisorHandoffNotes({}),
      auditRecord: AgentEngine.createAuditRecord({ handoffDecision: 'HUMAN_ADVISOR_HANDOFF' })
    };
  }
}
