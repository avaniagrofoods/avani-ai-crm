import {
  composeMultiBranchChecklist,
  formatChecklistForWhatsApp,
  NON_LENDER_ADVISORY_DISCLAIMER
} from './loan-checklists';
import {
  PRIVACY_NOTICE_TEXT,
  createConsentRecord,
  detectSensitiveDataInChat,
  generateSecureDocumentUploadLink
} from './consent-privacy';
import { normalizeIndianPhone } from './phone';

/**
 * AVANI LOAN SERVICES — CP-25 ChatMitra Pro Chatbot Conversation Flow & Qualification Engine
 *
 * Implements:
 * - Step 1: Welcome Message & Language Selection (English, मराठी, हिंदी)
 * - Step 2: Basic Customer Information (Full Name, Mobile Number, Email, City, Applicant Category)
 * - Step 3: Monthly Income Range (5 canonical options; non-binding)
 * - Step 4: Loan Requirement (11 options) & Required Funding Amount (INR)
 * - Step 5: 8-Branch Applicant & Product Qualification + Multi-Section Document Checklists
 * - Section 22: 17 Canonical Tags & 20 Custom Attributes within ChatMitra Pro Entitlements
 * - Section 15: Structured AI Conversation Audit Record
 */

export const CHATMITRA_PRO_CANONICAL_TAGS = [
  'NEW_LEAD',
  'QUALIFIED',
  'UNQUALIFIED',
  'HUMAN_HANDOFF',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_RECEIVED',
  'FOLLOWUP_REQUIRED',
  'PERSONAL_LOAN',
  'BUSINESS_LOAN',
  'DOCTOR_LOAN',
  'CA_LOAN',
  'HOME_LOAN',
  'MORTGAGE_LOAN',
  'EDUCATION_LOAN',
  'SCHOOL_FUNDING',
  'COLLEGE_FUNDING',
  'OPTED_OUT'
] as const;

export type ChatMitraCanonicalTag = (typeof CHATMITRA_PRO_CANONICAL_TAGS)[number];

export const CHATMITRA_PRO_CUSTOM_ATTRIBUTES = [
  'preferred_language',
  'full_name',
  'mobile_number',
  'email',
  'city',
  'applicant_type',
  'professional_type',
  'monthly_income_range',
  'loan_category',
  'required_loan_amount',
  'amount_currency',
  'education_destination',
  'co_applicant_type',
  'business_vintage',
  'existing_obligations',
  'collateral_available',
  'preferred_callback_time',
  'consent_status',
  'qualification_status',
  'crm_lead_id'
] as const;

export const STEP1_WELCOME_MESSAGE = `Welcome to AVANI LOAN SERVICES!

We help individuals, professionals, doctors, business owners and students explore suitable loan options.

I can help you identify your loan requirement and share the relevant document checklist.

Please select your preferred language.`;

export const LANGUAGE_OPTIONS = ['English', 'मराठी', 'हिंदी'] as const;

export const APPLICANT_CATEGORY_OPTIONS = [
  'Salaried',
  'Self Employed',
  'Business Owner',
  'Professional'
] as const;

export const MONTHLY_INCOME_OPTIONS = [
  '₹25,000–₹50,000',
  '₹50,000–₹1,00,000',
  '₹1,00,000–₹2,00,000',
  'Above ₹2,00,000',
  'Prefer to discuss with an advisor'
] as const;

export const LOAN_CATEGORY_OPTIONS = [
  'Personal Loan',
  'Business Loan',
  'Doctor Loan',
  'Chartered Accountant Loan',
  'Home Loan',
  'Mortgage Loan / Loan Against Property',
  'Education Loan — India',
  'Education Loan — Abroad',
  'School Funding',
  'College Funding',
  'Other / Not Sure'
] as const;

export interface AIConversationAuditRecord {
  inputMessageRef: string;
  detectedLanguage: 'en' | 'mr' | 'hi';
  detectedLoanCategory: string;
  extractedQualificationFields: Record<string, any>;
  aiResponseRef: string;
  handoffDecision: 'CONTINUE_BOT' | 'HUMAN_ADVISOR_HANDOFF' | 'OPTED_OUT_SUPPRESSED';
  timestamp: string;
  modelVersion: string;
}

export function validateEmailFormat(email: string): boolean {
  const clean = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean);
}

export function validateAndNormalizeMobile(phone: string): {
  valid: boolean;
  e164?: string;
  tenDigit?: string;
} {
  const normalized = normalizeIndianPhone(phone);
  if (!normalized) {
    return { valid: false };
  }
  const digits = normalized.replace(/\D/g, '');
  const tenDigit = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.slice(-10);
  if (!/^[6-9]\d{9}$/.test(tenDigit)) {
    return { valid: false };
  }
  return {
    valid: true,
    e164: `+91${tenDigit}`,
    tenDigit
  };
}

export function mapLoanCategoryToTag(loanCategory?: string): ChatMitraCanonicalTag | null {
  const c = (loanCategory || '').toLowerCase();
  if (c.includes('doctor')) return 'DOCTOR_LOAN';
  if (c.includes('chartered') || c.includes('ca ')) return 'CA_LOAN';
  if (c.includes('school')) return 'SCHOOL_FUNDING';
  if (c.includes('college')) return 'COLLEGE_FUNDING';
  if (c.includes('education')) return 'EDUCATION_LOAN';
  if (c.includes('mortgage') || c.includes('lap') || c.includes('against property')) return 'MORTGAGE_LOAN';
  if (c.includes('home')) return 'HOME_LOAN';
  if (c.includes('business')) return 'BUSINESS_LOAN';
  if (c.includes('personal')) return 'PERSONAL_LOAN';
  return null;
}

export function computeChatMitraTags(context: Record<string, any>): ChatMitraCanonicalTag[] {
  const tags = new Set<ChatMitraCanonicalTag>();
  if (context.optOutStatus || context.consent_status === 'WITHDRAWN') {
    tags.add('OPTED_OUT');
    return Array.from(tags);
  }

  tags.add('NEW_LEAD');
  const productTag = mapLoanCategoryToTag(context.loan_category || context.loanProduct);
  if (productTag) tags.add(productTag);

  if (context.qualification_status === 'QUALIFIED') {
    tags.add('QUALIFIED');
    tags.add('DOCUMENTS_PENDING');
    tags.add('FOLLOWUP_REQUIRED');
  } else if (context.qualification_status === 'UNQUALIFIED') {
    tags.add('UNQUALIFIED');
  }

  if (context.handoffDecision === 'HUMAN_ADVISOR_HANDOFF' || context.currentState === 'HUMAN_HANDOFF') {
    tags.add('HUMAN_HANDOFF');
    tags.add('FOLLOWUP_REQUIRED');
  }

  if (context.documents_received === true) {
    tags.delete('DOCUMENTS_PENDING');
    tags.add('DOCUMENTS_RECEIVED');
  }

  return Array.from(tags);
}

export function buildChatMitraCustomAttributes(context: Record<string, any>): Record<string, any> {
  const attrs: Record<string, any> = {
    preferred_language: context.preferred_language || context.language || 'English',
    full_name: context.full_name || context.fullName || '',
    mobile_number: context.mobile_number || context.mobile || '',
    email: context.email || '',
    city: context.city || '',
    applicant_type: context.applicant_type || context.employmentType || '',
    professional_type: context.professional_type || context.profession || '',
    monthly_income_range: context.monthly_income_range || context.monthlyIncome || '',
    loan_category: context.loan_category || context.loanProduct || '',
    required_loan_amount: context.required_loan_amount || context.loanAmount || '',
    amount_currency: 'INR',
    education_destination: context.education_destination || '',
    co_applicant_type: context.co_applicant_type || '',
    business_vintage: context.business_vintage || '',
    existing_obligations: context.existing_obligations || '',
    collateral_available: context.collateral_available || '',
    preferred_callback_time: context.preferred_callback_time || '',
    consent_status: context.consent_status || 'GRANTED',
    qualification_status: context.qualification_status || 'PENDING',
    crm_lead_id: context.crm_lead_id || ''
  };

  // Enforce strict 20-attribute ceiling
  const sanitized: Record<string, any> = {};
  for (const key of CHATMITRA_PRO_CUSTOM_ATTRIBUTES) {
    sanitized[key] = attrs[key] ?? '';
  }
  return sanitized;
}

/**
 * Evaluates a step-by-step chatbot turn or full profile qualification,
 * returning the next prompt/checklist, updated state, tags, custom attributes, and AI audit record.
 */
export function evaluateChatbotFlowStep(params: {
  inputMessage: string;
  inputMessageId?: string;
  whatsappContactId?: string;
  verifiedPhone?: string;
  context?: Record<string, any>;
}): {
  replyText: string;
  nextStep: string;
  updatedContext: Record<string, any>;
  tags: ChatMitraCanonicalTag[];
  customAttributes: Record<string, any>;
  checklist?: ReturnType<typeof composeMultiBranchChecklist>;
  secureUploadLink?: string;
  auditRecord: AIConversationAuditRecord;
} {
  const ctx: Record<string, any> = { ...(params.context || {}) };
  const text = String(params.inputMessage || '').trim();
  const lower = text.toLowerCase();

  if (!ctx.chatbot_started_at) {
    ctx.chatbot_started_at = new Date().toISOString();
    ctx.channel = 'WhatsApp';
    ctx.whatsapp_contact_id = params.whatsappContactId || params.verifiedPhone || '';
  }

  // Default mobile number from verified WhatsApp sender if not yet populated
  if (!ctx.mobile_number && params.verifiedPhone) {
    const norm = validateAndNormalizeMobile(params.verifiedPhone);
    if (norm.valid && norm.e164) {
      ctx.mobile_number = norm.e164;
      ctx.mobile = norm.tenDigit;
    }
  }

  // 1. Sensitive Data Guard in ordinary WhatsApp chat
  const sensitiveCheck = detectSensitiveDataInChat(text);
  if (sensitiveCheck.containsSensitiveData) {
    const portal = generateSecureDocumentUploadLink({
      leadId: ctx.crm_lead_id || 'PENDING_LEAD',
      phone: ctx.mobile_number || params.verifiedPhone || '919175635165',
      loanCategory: ctx.loan_category || 'Loan Inquiry'
    });
    const reply = `${sensitiveCheck.warningMessage}\n\nSecure Upload Link: ${portal.uploadUrl}`;
    return {
      replyText: reply,
      nextStep: ctx.currentStep || 'SECURITY_INTERCEPT',
      updatedContext: ctx,
      tags: computeChatMitraTags(ctx),
      customAttributes: buildChatMitraCustomAttributes(ctx),
      secureUploadLink: portal.uploadUrl,
      auditRecord: {
        inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
        detectedLanguage: (ctx.language as any) || 'en',
        detectedLoanCategory: ctx.loan_category || 'Pending',
        extractedQualificationFields: { sensitiveDataBlocked: sensitiveCheck.detectedTypes },
        aiResponseRef: `RESP-${Date.now()}`,
        handoffDecision: 'CONTINUE_BOT',
        timestamp: new Date().toISOString(),
        modelVersion: 'avani-cp25-flow-v1'
      }
    };
  }

  // 2. Language detection / selection
  if (lower === 'english' || lower === '1') {
    ctx.preferred_language = 'English';
    ctx.language = 'en';
  } else if (text.includes('मराठी') || lower === 'marathi' || lower === '2') {
    ctx.preferred_language = 'मराठी';
    ctx.language = 'mr';
  } else if (text.includes('हिंदी') || lower === 'hindi' || lower === '3') {
    ctx.preferred_language = 'हिंदी';
    ctx.language = 'hi';
  } else if (!ctx.preferred_language) {
    if (/[\u0900-\u097F]/.test(text)) {
      const isMarathi = text.includes('आहे') || text.includes('मला') || text.includes('कर्ज') || text.includes('पाहिजे');
      ctx.preferred_language = isMarathi ? 'मराठी' : 'हिंदी';
      ctx.language = isMarathi ? 'mr' : 'hi';
    }
  }

  // 3. Human Advisor Handoff Trigger
  if (
    /\b(advisor|human|agent|call me|expert|speak to sachin|talk to sachin|connect with sachin)\b/i.test(lower) ||
    text.includes('सल्लागार') ||
    text.includes('सलाहकार') ||
    text.includes('बात करनी')
  ) {
    ctx.handoffDecision = 'HUMAN_ADVISOR_HANDOFF';
    ctx.currentState = 'HUMAN_HANDOFF';
    const handoffReply =
      `I am connecting your inquiry with our Founder & Chief Loan Advisor, Sachin Shinde (+91 72491 08474). Our advisor will review your requirement and assist you via ChatMitra Live Chat or phone.\n\n_${NON_LENDER_ADVISORY_DISCLAIMER}_`;
    return {
      replyText: handoffReply,
      nextStep: 'HUMAN_ADVISOR_HANDOFF',
      updatedContext: ctx,
      tags: computeChatMitraTags(ctx),
      customAttributes: buildChatMitraCustomAttributes(ctx),
      auditRecord: {
        inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
        detectedLanguage: (ctx.language as any) || 'en',
        detectedLoanCategory: ctx.loan_category || 'General Inquiry',
        extractedQualificationFields: { ...ctx },
        aiResponseRef: `RESP-${Date.now()}`,
        handoffDecision: 'HUMAN_ADVISOR_HANDOFF',
        timestamp: new Date().toISOString(),
        modelVersion: 'avani-cp25-flow-v1'
      }
    };
  }

  // 4. Step 1: Welcome Message if language not yet selected
  if (!ctx.preferred_language) {
    return {
      replyText: `${STEP1_WELCOME_MESSAGE}\n\n1. English\n2. मराठी\n3. हिंदी\n\n_${PRIVACY_NOTICE_TEXT.en}_`,
      nextStep: 'STEP_1_WELCOME_LANGUAGE',
      updatedContext: ctx,
      tags: computeChatMitraTags(ctx),
      customAttributes: buildChatMitraCustomAttributes(ctx),
      auditRecord: {
        inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
        detectedLanguage: 'en',
        detectedLoanCategory: 'Unclassified',
        extractedQualificationFields: {},
        aiResponseRef: `RESP-${Date.now()}`,
        handoffDecision: 'CONTINUE_BOT',
        timestamp: new Date().toISOString(),
        modelVersion: 'avani-cp25-flow-v1'
      }
    };
  }

  // Record consent when user proceeds past Step 1
  if (!ctx.consentRecord) {
    ctx.consentRecord = createConsentRecord({
      source: 'CHATMITRA_WHATSAPP_CHATBOT',
      serviceConsent: 'GRANTED',
      marketingConsent: 'PENDING'
    });
    ctx.consent_status = 'GRANTED';
  }

  // 5. Step 2: Basic Customer Information (in strict order: Full Name -> Mobile -> Email -> City -> Applicant Category)
  if (!ctx.full_name) {
    return {
      replyText: 'Please share your *Full Name* as per your official records.',
      nextStep: 'STEP_2_COLLECT_FULL_NAME',
      updatedContext: ctx,
      tags: computeChatMitraTags(ctx),
      customAttributes: buildChatMitraCustomAttributes(ctx),
      auditRecord: {
        inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
        detectedLanguage: (ctx.language as any) || 'en',
        detectedLoanCategory: ctx.loan_category || 'Pending',
        extractedQualificationFields: ctx,
        aiResponseRef: `RESP-${Date.now()}`,
        handoffDecision: 'CONTINUE_BOT',
        timestamp: new Date().toISOString(),
        modelVersion: 'avani-cp25-flow-v1'
      }
    };
  }

  if (!ctx.mobile_number) {
    return {
      replyText: 'Please share your *10-digit Mobile Number*.',
      nextStep: 'STEP_2_COLLECT_MOBILE',
      updatedContext: ctx,
      tags: computeChatMitraTags(ctx),
      customAttributes: buildChatMitraCustomAttributes(ctx),
      auditRecord: {
        inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
        detectedLanguage: (ctx.language as any) || 'en',
        detectedLoanCategory: ctx.loan_category || 'Pending',
        extractedQualificationFields: ctx,
        aiResponseRef: `RESP-${Date.now()}`,
        handoffDecision: 'CONTINUE_BOT',
        timestamp: new Date().toISOString(),
        modelVersion: 'avani-cp25-flow-v1'
      }
    };
  }

  if (!ctx.email) {
    return {
      replyText: 'Please share your *Email Address* for loan checklist and application updates.',
      nextStep: 'STEP_2_COLLECT_EMAIL',
      updatedContext: ctx,
      tags: computeChatMitraTags(ctx),
      customAttributes: buildChatMitraCustomAttributes(ctx),
      auditRecord: {
        inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
        detectedLanguage: (ctx.language as any) || 'en',
        detectedLoanCategory: ctx.loan_category || 'Pending',
        extractedQualificationFields: ctx,
        aiResponseRef: `RESP-${Date.now()}`,
        handoffDecision: 'CONTINUE_BOT',
        timestamp: new Date().toISOString(),
        modelVersion: 'avani-cp25-flow-v1'
      }
    };
  }

  if (!ctx.city) {
    return {
      replyText: 'Which *City* are you currently located in?',
      nextStep: 'STEP_2_COLLECT_CITY',
      updatedContext: ctx,
      tags: computeChatMitraTags(ctx),
      customAttributes: buildChatMitraCustomAttributes(ctx),
      auditRecord: {
        inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
        detectedLanguage: (ctx.language as any) || 'en',
        detectedLoanCategory: ctx.loan_category || 'Pending',
        extractedQualificationFields: ctx,
        aiResponseRef: `RESP-${Date.now()}`,
        handoffDecision: 'CONTINUE_BOT',
        timestamp: new Date().toISOString(),
        modelVersion: 'avani-cp25-flow-v1'
      }
    };
  }

  if (!ctx.applicant_type) {
    return {
      replyText:
        'Please select your *Applicant Category*:\n1. Salaried\n2. Self Employed\n3. Business Owner\n4. Professional (Doctor / CA / Other)',
      nextStep: 'STEP_2_COLLECT_APPLICANT_CATEGORY',
      updatedContext: ctx,
      tags: computeChatMitraTags(ctx),
      customAttributes: buildChatMitraCustomAttributes(ctx),
      auditRecord: {
        inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
        detectedLanguage: (ctx.language as any) || 'en',
        detectedLoanCategory: ctx.loan_category || 'Pending',
        extractedQualificationFields: ctx,
        aiResponseRef: `RESP-${Date.now()}`,
        handoffDecision: 'CONTINUE_BOT',
        timestamp: new Date().toISOString(),
        modelVersion: 'avani-cp25-flow-v1'
      }
    };
  }

  // 6. Step 3: Monthly Income
  if (!ctx.monthly_income_range) {
    return {
      replyText:
        'What is your approximate monthly income?\n1. ₹25,000–₹50,000\n2. ₹50,000–₹1,00,000\n3. ₹1,00,000–₹2,00,000\n4. Above ₹2,00,000\n5. Prefer to discuss with an advisor',
      nextStep: 'STEP_3_COLLECT_MONTHLY_INCOME',
      updatedContext: ctx,
      tags: computeChatMitraTags(ctx),
      customAttributes: buildChatMitraCustomAttributes(ctx),
      auditRecord: {
        inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
        detectedLanguage: (ctx.language as any) || 'en',
        detectedLoanCategory: ctx.loan_category || 'Pending',
        extractedQualificationFields: ctx,
        aiResponseRef: `RESP-${Date.now()}`,
        handoffDecision: 'CONTINUE_BOT',
        timestamp: new Date().toISOString(),
        modelVersion: 'avani-cp25-flow-v1'
      }
    };
  }

  // 7. Step 4: Loan Requirement & Amount
  if (!ctx.loan_category) {
    return {
      replyText:
        'Which loan are you looking for?\n1. Personal Loan\n2. Business Loan\n3. Doctor Loan\n4. Chartered Accountant Loan\n5. Home Loan\n6. Mortgage Loan / Loan Against Property\n7. Education Loan — India\n8. Education Loan — Abroad\n9. School Funding\n10. College Funding\n11. Other / Not Sure',
      nextStep: 'STEP_4_COLLECT_LOAN_CATEGORY',
      updatedContext: ctx,
      tags: computeChatMitraTags(ctx),
      customAttributes: buildChatMitraCustomAttributes(ctx),
      auditRecord: {
        inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
        detectedLanguage: (ctx.language as any) || 'en',
        detectedLoanCategory: 'Pending',
        extractedQualificationFields: ctx,
        aiResponseRef: `RESP-${Date.now()}`,
        handoffDecision: 'CONTINUE_BOT',
        timestamp: new Date().toISOString(),
        modelVersion: 'avani-cp25-flow-v1'
      }
    };
  }

  if (!ctx.required_loan_amount) {
    return {
      replyText:
        'Approximately how much funding do you require (in INR)? You may enter a numeric amount or reply "Discuss with advisor".',
      nextStep: 'STEP_4_COLLECT_LOAN_AMOUNT',
      updatedContext: ctx,
      tags: computeChatMitraTags(ctx),
      customAttributes: buildChatMitraCustomAttributes(ctx),
      auditRecord: {
        inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
        detectedLanguage: (ctx.language as any) || 'en',
        detectedLoanCategory: ctx.loan_category,
        extractedQualificationFields: ctx,
        aiResponseRef: `RESP-${Date.now()}`,
        handoffDecision: 'CONTINUE_BOT',
        timestamp: new Date().toISOString(),
        modelVersion: 'avani-cp25-flow-v1'
      }
    };
  }

  // 8. Step 5+: Compose Multi-Branch Checklist + Secure Document Upload Link
  ctx.amount_currency = 'INR';
  ctx.qualification_status = 'QUALIFIED';

  const composed = composeMultiBranchChecklist({
    applicantType: ctx.applicant_type,
    profession: ctx.professional_type || ctx.profession,
    loanCategory: ctx.loan_category,
    educationDestination: ctx.education_destination,
    coApplicantType: ctx.co_applicant_type,
    additionalIncome: ctx.additional_income,
    includeCollateralAndFamily: ctx.include_collateral_family,
    includeConsentedReferences: ctx.include_consented_references
  });

  if (composed.professionalType) {
    ctx.professional_type = composed.professionalType;
  }

  const portal = generateSecureDocumentUploadLink({
    leadId: ctx.crm_lead_id || `AVL-${Date.now()}`,
    phone: ctx.mobile_number,
    loanCategory: ctx.loan_category
  });

  const checklistFormatted = formatChecklistForWhatsApp(composed);
  const fullReply = [
    checklistFormatted,
    '',
    '*Secure Document Submission:*',
    'For your privacy, please do not send Aadhaar, PAN, passports, or bank statements directly in chat. Use your secure, encrypted upload portal link below:',
    portal.uploadUrl,
    '',
    'Reply *ADVISOR* anytime to speak with Sachin Shinde (+91 72491 08474).'
  ].join('\n');

  return {
    replyText: fullReply,
    nextStep: 'STEP_5_CHECKLIST_AND_ADVISOR_ROUTING',
    updatedContext: ctx,
    tags: computeChatMitraTags(ctx),
    customAttributes: buildChatMitraCustomAttributes(ctx),
    checklist: composed,
    secureUploadLink: portal.uploadUrl,
    auditRecord: {
      inputMessageRef: params.inputMessageId || `MSG-${Date.now()}`,
      detectedLanguage: (ctx.language as any) || 'en',
      detectedLoanCategory: composed.loanCategory,
      extractedQualificationFields: buildChatMitraCustomAttributes(ctx),
      aiResponseRef: `RESP-${Date.now()}`,
      handoffDecision: 'HUMAN_ADVISOR_HANDOFF',
      timestamp: new Date().toISOString(),
      modelVersion: 'avani-cp25-flow-v1'
    }
  };
}
