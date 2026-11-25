import { AVANI_PRODUCT_DETAILS_MESSAGE } from './chatbot-flow-engine';
import { classifyLoanCategory } from './chatmitra';

const GEMINI_API_KEY = (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 8000;

export const CANONICAL_LOAN_PRODUCTS = [
  'Personal Loan',
  'Business Loan',
  'Doctor Loan',
  'Home Loan',
  'Mortgage Loan',
  'Education Loan — India',
  'Education Loan — Abroad',
  'Loan Against Property (LAP)',
  'Working Capital Loan',
  'MSME Loan',
  'Professional Loan',
  'School and College Institutional Funding'
] as const;

export type CanonicalLoanProduct = (typeof CANONICAL_LOAN_PRODUCTS)[number];

export const ADVISORY_DISCLAIMER = 
  "AVANI LOAN SERVICES is an authorized loan advisory and consultancy firm and does NOT act as a direct lender or bank. Loan sanction, interest rates, and disbursal are at the sole discretion of partner banks and NBFCs based on eligibility, documentation, and credit verification.";

export const ADVISOR_CONTACT = {
  name: 'Sachin Shinde',
  role: 'Founder & Chief Loan Advisor',
  phone: '+91 72491 08474',
  website: 'https://www.avanifinserv.com/'
};

export interface AgentContext {
  fullName?: string;
  mobile?: string;
  email?: string;
  city?: string;
  loanProduct?: string;
  loanAmount?: string;
  employmentType?: string;
  monthlyIncome?: string;
  businessType?: string;
  businessVintage?: string;
  monthlyTurnover?: string;
  profession?: string;
  medicalQualification?: string;
  practiceType?: string;
  propertyType?: string;
  propertyLocation?: string;
  approximatePropertyValue?: string;
  institutionType?: string;
  fundingPurpose?: string;
  authorizedRole?: string;
  destinationOrCourse?: string;
  coApplicantIncome?: string;
  consentGranted?: boolean;
  documentsRequired?: string[];
  [key: string]: any;
}

export interface ConversationState {
  currentState: string;
  language: 'en' | 'mr' | 'hi';
  context: AgentContext;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}

export class AgentEngine {

  /**
   * Safe server-side Gemini invocation with AbortController timeout and rate-limit guard.
   */
  static async callGeminiWithTimeout(prompt: string, expectJson: boolean = false): Promise<string | null> {
    if (process.env.PROVIDER_MODE === 'mock' || !GEMINI_API_KEY) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const bodyPayload: any = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      };
      if (expectJson) {
        bodyPayload.generationConfig = { responseMimeType: 'application/json' };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal
      });

      if (res.status === 429) {
        console.warn('[Gemini AI Engine] Rate limit (HTTP 429) encountered. Falling back to deterministic knowledge base.');
        return null;
      }

      if (!res.ok) {
        console.warn(`[Gemini AI Engine] API returned status ${res.status}. Falling back to deterministic knowledge base.`);
        return null;
      }

      const data = await res.json();
      if (data.error) {
        console.error('[Gemini AI Engine] Error returned in payload:', data.error);
        return null;
      }

      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('abort');
      if (isAbort) {
        console.warn(`[Gemini AI Engine] Request timed out after ${GEMINI_TIMEOUT_MS}ms. Triggering fallback.`);
      } else {
        console.warn(`[Gemini AI Engine] Network error: ${err?.message || 'unknown'}. Triggering fallback.`);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Main conversational entry point: Processes incoming message and returns the next response & updated state.
   */
  static async processMessage(conversation: ConversationState | any, text: string) {
    if (!conversation.context) conversation.context = {};
    if (!conversation.language) conversation.language = 'en';
    if (!conversation.currentState) conversation.currentState = 'NEW';

    const cleanText = (text || '').trim();

    // 0. Sensitive Data Guard (Never collect passwords, OTPs, or full bank credentials)
    if (/(password|otp|cvv|pin|one time password|atm pin|पासवर्ड|ओटीपी)/i.test(cleanText)) {
      const warning = await this.translateText(
        "AVANI LOAN SERVICES will NEVER ask for passwords, OTPs, ATM PINs, or bank account credentials. For your safety, please never share sensitive security information.",
        conversation.language
      );
      return { nextQuestion: warning, updatedState: conversation.currentState };
    }

    // 1. Regulatory Guarantee & Interest Rate Claims Guard
    const lowerText = cleanText.toLowerCase();
    if (lowerText.includes('guarantee') || lowerText.includes('100%') || lowerText.includes('नक्की मिळेल का') || lowerText.includes('पक्का मिलेगा')) {
      const disclaimerMsg = await this.translateText(
        `At AVANI LOAN SERVICES, we provide transparent advisory across 40+ partner banks and NBFCs. Final sanction and terms depend strictly on lender underwriting and credit eligibility. No consultant can ethically promise guaranteed approval.\n\n${ADVISORY_DISCLAIMER}`,
        conversation.language
      );
      return { nextQuestion: disclaimerMsg, updatedState: conversation.currentState };
    }

    // 2. Extract entities and detect intent/language
    const extraction = await this.extractEntities(conversation, cleanText);

    // Update language if detected
    if (extraction.language && ['en', 'mr', 'hi'].includes(extraction.language)) {
      conversation.language = extraction.language;
    }

    // Handle Decline / Opt-out
    if (extraction.intent === 'DECLINE') {
      conversation.currentState = 'CUSTOMER_DECLINED';
      const msg = await this.translateText(
        "No problem at all. We have recorded your preference. Please feel free to reach out to AVANI LOAN SERVICES whenever you require loan advisory assistance.",
        conversation.language
      );
      return { nextQuestion: msg, updatedState: 'CUSTOMER_DECLINED' };
    }

    // Handle Human Advisor Handover
    if (extraction.intent === 'HUMAN_HANDOFF') {
      conversation.currentState = 'HUMAN_HANDOFF';
      const msg = await this.translateText(
        `I am handing your request over to our Founder & Chief Loan Advisor, Sachin Shinde (+91 72491 08474). He will personally review your requirements and connect with you shortly.\n\n${AVANI_PRODUCT_DETAILS_MESSAGE}\n\nYou can also visit www.avanifinserv.com.`,
        conversation.language
      );
      return { nextQuestion: msg, updatedState: 'HUMAN_HANDOFF' };
    }

    // Update context with newly extracted fields
    if (extraction.extractedData) {
      Object.assign(conversation.context, extraction.extractedData);
    }

    // 3. Determine Next State based on loan category-specific workflow
    const nextState = this.determineNextState(conversation.context, conversation.currentState);
    conversation.currentState = nextState;

    // 4. Generate Next Question or Document Checklist
    let nextQuestion = "";
    if (nextState === 'DOCUMENT_GUIDANCE') {
      const docList = this.getDocumentsForProfile(
        conversation.context.employmentType || '',
        conversation.context.profession || '',
        conversation.context.loanProduct || ''
      );
      conversation.context.documentsRequired = docList;
      conversation.currentState = 'QUALIFICATION_COMPLETE';

      const docListString = docList.map((d: string) => "• " + d).join('\n');
      nextQuestion = await this.translateText(
        `Thank you, ${conversation.context.fullName || 'Valued Customer'}! Your preliminary enquiry for ${conversation.context.loanProduct || 'a loan'} (${conversation.context.city || 'India'}) has been successfully registered with AVANI LOAN SERVICES.\n\nRequired Document Checklist:\n${docListString}\n\n${ADVISORY_DISCLAIMER}\n\nOur Chief Loan Advisor, Sachin Shinde (+91 72491 08474), will connect with you to review the best lender options across our 40+ partner banks.`,
        conversation.language
      );
    } else if (nextState === 'QUALIFICATION_COMPLETE') {
      nextQuestion = await this.translateText(
        "Your enquiry details have been recorded. Our Chief Loan Advisor, Sachin Shinde (+91 72491 08474), will reach out to you shortly. You may also reply 'ADVISOR' anytime for immediate assistance.",
        conversation.language
      );
    } else {
      nextQuestion = await this.generateQuestionForState(nextState, conversation.language, conversation.context);
    }

    return { nextQuestion, updatedState: conversation.currentState };
  }

  /**
   * Evaluates sequential qualification state machine:
   * 1. Collects core baseline applicant contact & profile details (FullName, Mobile, Email, City, Employment, Income, LoanProduct, LoanAmount).
   * 2. When baseline is satisfied or when deep-dive is active, evaluates Category-Specific Qualification Workflow (Section 6).
   * 3. Transitions to DOCUMENT_GUIDANCE when required information is gathered.
   */
  static determineNextState(context: AgentContext, currentState: string): string {
    if (!context) return 'COLLECT_FULL_NAME';

    // 1. Core baseline fields (preserves backward compatibility and foundation contracts)
    if (!context.fullName) return 'COLLECT_FULL_NAME';
    if (!context.mobile) return 'COLLECT_MOBILE';
    if (!context.email) return 'COLLECT_EMAIL';
    if (!context.city) return 'COLLECT_CITY';
    if (!context.employmentType) return 'COLLECT_EMPLOYMENT';
    if (!context.monthlyIncome) return 'COLLECT_MONTHLY_INCOME';
    if (!context.loanProduct) return 'COLLECT_LOAN_PRODUCT';
    if (!context.loanAmount) return 'COLLECT_LOAN_AMOUNT';

    if (currentState === 'DOCUMENT_GUIDANCE' || currentState === 'DOCUMENTS_PENDING' || currentState === 'QUALIFICATION_COMPLETE') {
      return currentState;
    }

    if (currentState === 'COLLECT_LOAN_AMOUNT') {
      return 'DOCUMENT_GUIDANCE';
    }

    // 2. Category-Specific Qualification Logic (Section 6)
    return this.determineCategoryNextState(context, currentState);
  }

  /**
   * Category-Specific Sequential Qualification Logic (Section 5 & 6)
   */
  static determineCategoryNextState(context: AgentContext, currentState?: string): string {
    if (!context) return 'COLLECT_LOAN_PRODUCT';
    if (!context.loanProduct) return 'COLLECT_LOAN_PRODUCT';
    if (!context.loanAmount) return 'COLLECT_LOAN_AMOUNT';

    const prod = (context.loanProduct || '').toLowerCase();

    // 1. Doctor Loan Flow
    if (prod.includes('doctor')) {
      if (!context.medicalQualification) return 'COLLECT_DOCTOR_QUALIFICATION';
      if (!context.practiceType) return 'COLLECT_DOCTOR_PRACTICE_TYPE';
    }
    // 2. Business Loan / Working Capital / MSME Flow
    else if (prod.includes('business') || prod.includes('working capital') || prod.includes('msme')) {
      if (!context.businessType) return 'COLLECT_BUSINESS_TYPE';
      if (!context.businessVintage) return 'COLLECT_BUSINESS_VINTAGE';
      if (!context.monthlyTurnover) return 'COLLECT_MONTHLY_TURNOVER';
    }
    // 3. Home Loan Flow
    else if (prod.includes('home loan')) {
      if (!context.propertyType) return 'COLLECT_HOME_PROPERTY_TYPE';
      if (!context.approximatePropertyValue) return 'COLLECT_PROPERTY_VALUE';
    }
    // 4. Mortgage / LAP Flow
    else if (prod.includes('mortgage') || prod.includes('property') || prod.includes('lap')) {
      if (!context.propertyType) return 'COLLECT_LAP_PROPERTY_TYPE';
      if (!context.approximatePropertyValue) return 'COLLECT_PROPERTY_VALUE';
    }
    // 5. School and College Institutional Funding Flow
    else if (prod.includes('school') || prod.includes('college') || prod.includes('institutional')) {
      if (!context.institutionType) return 'COLLECT_INSTITUTION_TYPE';
      if (!context.fundingPurpose) return 'COLLECT_FUNDING_PURPOSE';
      if (!context.authorizedRole) return 'COLLECT_AUTHORIZED_ROLE';
    }
    // 6. Education Loan (India & Abroad)
    else if (prod.includes('education')) {
      if (!context.destinationOrCourse) return 'COLLECT_EDUCATION_DESTINATION';
      if (!context.coApplicantIncome) return 'COLLECT_COAPPLICANT_INCOME';
    }
    // 7. Professional Loan (CA / Lawyer / Architect)
    else if (prod.includes('professional') || prod.includes('ca professional') || prod.includes('ca loan')) {
      if (!context.profession) return 'COLLECT_PROFESSION';
      if (!context.businessVintage) return 'COLLECT_PRACTICE_VINTAGE';
    }
    // 8. Personal Loan (Default)
    else {
      if (!context.employmentType) return 'COLLECT_EMPLOYMENT';
      if (!context.monthlyIncome) return 'COLLECT_MONTHLY_INCOME';
    }

    return 'DOCUMENT_GUIDANCE';
  }

  /**
   * Generates single, clear, category-specific question in customer's preferred language.
   */
  static async generateQuestionForState(state: string, language: string, context?: AgentContext): Promise<string> {
    let q = "";
    switch (state) {
      case 'COLLECT_LOAN_PRODUCT':
        q = "Welcome to AVANI LOAN SERVICES! Which loan product are you looking for? (Personal Loan, Business Loan, Doctor Loan, Home Loan, Mortgage / LAP, Education Loan, Working Capital / MSME, Professional Loan, or School/College Funding)";
        break;
      case 'COLLECT_LOAN_AMOUNT':
        q = `What is your approximate required loan amount for your ${context?.loanProduct || 'loan'}? (e.g., ₹10 Lakhs, ₹50 Lakhs, ₹1 Crore)`;
        break;

      // Personal Loan
      case 'COLLECT_EMPLOYMENT':
        q = "What is your employment type? (Salaried, Self-Employed, or Professional)";
        break;
      case 'COLLECT_MONTHLY_INCOME':
        q = "What is your approximate monthly take-home salary or income range? (₹25K–₹50K, ₹50K–₹1L, ₹1L–₹2L, or Above ₹2L)";
        break;

      // Business Loan / Working Capital / MSME
      case 'COLLECT_BUSINESS_TYPE':
        q = "What is your business type or nature of activity? (e.g., Manufacturing, Trading, Retail, Services)";
        break;
      case 'COLLECT_BUSINESS_VINTAGE':
        q = "How many years has your business been established? (e.g., Less than 2 years, 2–5 years, Above 5 years)";
        break;
      case 'COLLECT_MONTHLY_TURNOVER':
        q = "What is your approximate annual or monthly turnover? (e.g., ₹50 Lakhs annual, ₹2 Crore annual)";
        break;

      // Doctor Loan
      case 'COLLECT_DOCTOR_QUALIFICATION':
        q = "What is your medical qualification? (e.g., MBBS, MD, MS, BDS, MDS, BAMS, BHMS)";
        break;
      case 'COLLECT_DOCTOR_PRACTICE_TYPE':
        q = "What is your current practice setup? (Self-owned Clinic/Hospital, Consultant, or Salaried in a Hospital)";
        break;

      // Home Loan
      case 'COLLECT_HOME_PROPERTY_TYPE':
        q = "Is this for a new property purchase, resale flat, or self-construction?";
        break;
      case 'COLLECT_PROPERTY_VALUE':
        q = "What is the approximate market value or purchase cost of the property?";
        break;

      // Mortgage / LAP
      case 'COLLECT_LAP_PROPERTY_TYPE':
        q = "What type of property will be offered as security? (Residential, Commercial, or Industrial)";
        break;

      // Institutional Funding
      case 'COLLECT_INSTITUTION_TYPE':
        q = "What type of educational institution is this funding for? (K-12 School, Degree College, Polytechnic, or Educational Trust)";
        break;
      case 'COLLECT_FUNDING_PURPOSE':
        q = "What is the primary funding purpose? (Campus Expansion, New Building Infrastructure, or Working Capital)";
        break;
      case 'COLLECT_AUTHORIZED_ROLE':
        q = "What is your designation in the institution? (Trustee, Chairman, Director, or Principal)";
        break;

      // Education Loan
      case 'COLLECT_EDUCATION_DESTINATION':
        q = "Which course and country or university are you planning for? (e.g., MS in USA, MBA in India, Medical)";
        break;
      case 'COLLECT_COAPPLICANT_INCOME':
        q = "What is your co-applicant's (parent/guardian) primary income source or occupation?";
        break;

      // Professional Loan
      case 'COLLECT_PROFESSION':
        q = "What is your profession? (Chartered Accountant, Architect, Company Secretary, or Advocate)";
        break;
      case 'COLLECT_PRACTICE_VINTAGE':
        q = "How many years have you been in active professional practice with a valid Certificate of Practice?";
        break;

      // Common Details
      case 'COLLECT_CITY':
        q = "Which city do you currently reside in or operate from?";
        break;
      case 'COLLECT_FULL_NAME':
        q = "May I please know your full name?";
        break;
      case 'COLLECT_MOBILE':
        q = "Please share your 10-digit mobile number so Chief Advisor Sachin Shinde can share your customized loan proposal.";
        break;

      default:
        q = "Welcome to AVANI LOAN SERVICES! How can we assist you with your loan requirements today?";
    }

    return await this.translateText(q, language);
  }

  /**
   * Entity & Intent Extraction Engine
   */
  static async extractEntities(conversation: any, text: string): Promise<{
    language: 'en' | 'mr' | 'hi';
    intent: 'ANSWER' | 'DECLINE' | 'HUMAN_HANDOFF';
    extractedData: AgentContext;
  }> {
    const prompt = `You are an intent and entity extractor for AVANI LOAN SERVICES (India).
Analyze the customer's message and extract information in strict JSON.

Current State: ${conversation?.currentState || 'NEW'}
Context: ${JSON.stringify(conversation?.context || {})}
Language History: ${conversation?.language || 'en'}

Rules:
1. language: 'en', 'mr' (Marathi), 'hi' (Hindi).
2. intent:
   - 'DECLINE' (not interested, stop, opt-out, cancel)
   - 'HUMAN_HANDOFF' (wants to speak to advisor/Sachin Shinde/human, urgent complaint)
   - 'ANSWER' (providing info or asking normal enquiry)
3. extractedData: only include explicitly mentioned fields:
   - fullName, mobile (10-digit), email, city
   - loanProduct: one of ["Personal Loan", "Business Loan", "Doctor Loan", "Home Loan", "Mortgage Loan", "Education Loan — India", "Education Loan — Abroad", "Loan Against Property (LAP)", "Working Capital Loan", "MSME Loan", "Professional Loan", "School and College Institutional Funding"]
   - loanAmount: numeric string (e.g. "2500000" for 25 Lakhs)
   - employmentType, monthlyIncome, businessType, businessVintage, monthlyTurnover, profession
   - medicalQualification, practiceType, propertyType, approximatePropertyValue, institutionType, fundingPurpose, authorizedRole, destinationOrCourse, coApplicantIncome

Customer Message: "${text}"

Respond with ONLY valid JSON, no markdown codeblocks.`;

    // Try Gemini API first
    const geminiRaw = await this.callGeminiWithTimeout(prompt, true);
    if (geminiRaw) {
      try {
        const clean = geminiRaw.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        return {
          language: parsed.language || 'en',
          intent: parsed.intent || 'ANSWER',
          extractedData: parsed.extractedData || {}
        };
      } catch (e) {
        console.warn('[Gemini AI Engine] JSON parse error on Gemini output, falling back to deterministic extraction.');
      }
    }

    // Deterministic Rule-Based Fallback
    const lower = text.toLowerCase();
    const extracted: AgentContext = {};
    let lang: 'en' | 'mr' | 'hi' = 'en';

    if (/[\u0900-\u097F]/.test(text)) {
      lang = (text.includes("आहे") || text.includes("काय") || text.includes("पाहिजे") || text.includes("मिळेल") || text.includes("करा")) ? 'mr' : 'hi';
    }

    // Handover check
    if (lower.includes("advisor") || lower.includes("shinde") || text.includes("सल्लागार") || lower.includes("human") || text.includes("बात करनी") || text.includes("बोलणे") || lower.includes("call me")) {
      return { language: lang, intent: 'HUMAN_HANDOFF', extractedData: {} };
    }

    // Decline / Opt-out check
    if (lower.includes("not interested") || lower.includes("decline") || lower.includes("stop") || lower.includes("unsubscribe") || text.includes("नको") || text.includes("नहीं चाहिए")) {
      return { language: lang, intent: 'DECLINE', extractedData: {} };
    }

    // Product Category Detection via ChatMitra classifier
    const classified = classifyLoanCategory(text);
    if (classified && classified.confidence >= 0.85) {
      extracted.loanProduct = classified.category;
    }

    // Specific category fallbacks
    if (lower.includes("doctor") || text.includes("डॉक्टर") || lower.includes("mbbs") || lower.includes("clinic")) {
      extracted.loanProduct = "Doctor Loan";
      extracted.profession = "Doctor";
    } else if (lower.includes("professional loan") || lower.includes("ca loan") || lower.includes("chartered") || lower.includes("icai") || text.includes("सीए")) {
      extracted.loanProduct = "Professional Loan";
      extracted.profession = "Chartered Accountant";
    } else if (lower.includes("school") || lower.includes("college") || lower.includes("trust") || text.includes("शाळा") || text.includes("कॉलेज")) {
      extracted.loanProduct = "School and College Institutional Funding";
    } else if (lower.includes("abroad") || lower.includes("overseas") || lower.includes("foreign") || text.includes("परदेश") || text.includes("विदेश")) {
      extracted.loanProduct = "Education Loan — Abroad";
    } else if (lower.includes("education loan") || lower.includes("student loan") || text.includes("शिक्षण कर्ज")) {
      extracted.loanProduct = "Education Loan — India";
    } else if (lower.includes("lap") || lower.includes("against property") || lower.includes("mortgage") || text.includes("मॉर्गिज")) {
      extracted.loanProduct = "Loan Against Property (LAP)";
    } else if (lower.includes("home loan") || lower.includes("flat") || lower.includes("house") || text.includes("होम लोन") || text.includes("गृहकर्ज")) {
      extracted.loanProduct = "Home Loan";
    } else if (lower.includes("working capital") || lower.includes("od limit") || lower.includes("cc limit")) {
      extracted.loanProduct = "Working Capital Loan";
    } else if (lower.includes("msme") || lower.includes("udyam")) {
      extracted.loanProduct = "MSME Loan";
    } else if (lower.includes("business loan") || text.includes("बिझनेस") || text.includes("व्यापार")) {
      extracted.loanProduct = "Business Loan";
    } else if (lower.includes("personal loan") || text.includes("पर्सनल लोन") || text.includes("वैयक्तिक")) {
      extracted.loanProduct = "Personal Loan";
    }

    // City extraction
    if (lower.includes("pune") || text.includes("पुणे")) extracted.city = "Pune";
    else if (lower.includes("mumbai") || text.includes("मुंबई")) extracted.city = "Mumbai";
    else if (lower.includes("latur") || text.includes("लातूर")) extracted.city = "Latur";
    else if (lower.includes("nagpur") || text.includes("नागपूर")) extracted.city = "Nagpur";
    else if (lower.includes("nashik") || text.includes("नाशिक")) extracted.city = "Nashik";
    else if (lower.includes("aurangabad") || lower.includes("chhatrapati sambhajinagar") || text.includes("संभाजीनगर")) extracted.city = "Chhatrapati Sambhajinagar";

    // Amount extraction
    if (text.includes("10 लाख") || lower.includes("10 lakh") || lower.includes("1000000")) extracted.loanAmount = "1000000";
    else if (text.includes("20 लाख") || lower.includes("20 lakh") || lower.includes("2000000")) extracted.loanAmount = "2000000";
    else if (text.includes("25 लाख") || lower.includes("25 lakh") || lower.includes("2500000")) extracted.loanAmount = "2500000";
    else if (text.includes("30 लाख") || lower.includes("30 lakh") || lower.includes("3000000")) extracted.loanAmount = "3000000";
    else if (text.includes("50 लाख") || lower.includes("50 lakh") || lower.includes("5000000")) extracted.loanAmount = "5000000";
    else if (text.includes("1 कोटी") || lower.includes("1 crore") || lower.includes("10000000")) extracted.loanAmount = "10000000";

    // Mobile Number extraction (Indian 10-digit starting with 6, 7, 8, or 9)
    const phoneMatch = text.match(/(?:(?:\+|0)?91[\s-]?)?([6-9]\d{9})\b/);
    if (phoneMatch) {
      extracted.mobile = phoneMatch[1];
    }

    // Name extraction (supports Dr., Mr., initials, and Marathi/Hindi names)
    const nameMatch = text.match(/(?:my name is|i am|नाव|नाम|naam)\s+([A-Za-z\u0900-\u097F\.]+(?:\s+[A-Za-z\u0900-\u097F\.]+)?)/i);
    if (nameMatch) {
      extracted.fullName = nameMatch[1].trim();
    }

    return { language: lang, intent: 'ANSWER', extractedData: extracted };
  }

  /**
   * Multilingual Translation & Localization Engine
   */
  static async translateText(text: string, language: string): Promise<string> {
    if (language === 'en') return text;

    // Deterministic pre-translated templates for common dialogs
    if (language === 'mr') {
      if (text.includes("What is your approximate required loan amount")) {
        return "तुम्हाला अंदाजे किती कर्जाची आवश्यकता आहे? (उदा. ₹१० लाख, ₹५० लाख, ₹१ कोटी)";
      }
      if (text.includes("May I please know your full name?")) {
        return "कृपया आपले पूर्ण नाव सांगा?";
      }
      if (text.includes("Which city do you currently reside in")) {
        return "तुम्ही सध्या कोणत्या शहरात राहता किंवा व्यवसाय करता?";
      }
      if (text.includes("What is your employment type?")) {
        return "तुमचा रोजगाराचा प्रकार कोणता आहे? (पगारदार / सॅलरीड, स्वयंरोजगार, किंवा व्यावसायिक)";
      }
      if (text.includes("monthly take-home salary")) {
        return "तुमचे अंदाजे मासिक उत्पन्न किती आहे? (₹२५ हजार–₹५० हजार, ₹५० हजार–₹१ लाख, ₹१ लाख–₹२ लाख, किंवा ₹२ लाखांपेक्षा जास्त)";
      }
      if (text.includes("Please share your 10-digit mobile number")) {
        return "कृपया तुमचा १०-अंकी मोबाईल नंबर शेअर करा, जेणेकरून मुख्य सल्लागार सचिन शिंदे तुमच्याशी संपर्क साधू शकतील.";
      }
      if (text.includes("handing your request over to our Founder")) {
        return `तुमची विनंती आमचे संस्थापक आणि मुख्य कर्ज सल्लागार सचिन शिंदे (+91 72491 08474) यांच्याकडे सोपवली आहे. ते लवकरच तुमच्याशी संपर्क साधतील.\n\nअधिक माहितीसाठी www.avanifinserv.com ला भेट द्या.`;
      }
      if (text.includes("Welcome to AVANI LOAN SERVICES! Which loan product")) {
        return "अवनी लोन सर्व्हिसेसमध्ये आपले स्वागत आहे! तुम्हाला कोणत्या कर्जाची आवश्यकता आहे? (पर्सनल लोन, बिझनेस लोन, डॉक्टर लोन, होम लोन, मॉर्गिज / LAP, एज्युकेशन लोन, वर्किंग कॅपिटल, किंवा संस्थात्मक शाळा/कॉलेज फंडिंग)";
      }
    } else if (language === 'hi') {
      if (text.includes("What is your approximate required loan amount")) {
        return "आपको लगभग कितने लोन की आवश्यकता है? (उदा. ₹10 लाख, ₹50 लाख, ₹1 करोड़)";
      }
      if (text.includes("May I please know your full name?")) {
        return "कृपया आपका पूरा नाम बताएं?";
      }
      if (text.includes("Which city do you currently reside in")) {
        return "आप वर्तमान में किस शहर में रहते हैं या व्यवसाय करते हैं?";
      }
      if (text.includes("What is your employment type?")) {
        return "आपका रोजगार प्रकार क्या है? (वेतनभोगी / सैलरीड, स्वरोजगार, या पेशेवर)";
      }
      if (text.includes("monthly take-home salary")) {
        return "आपकी मासिक आय कितनी है? (₹25 हजार–₹50 हजार, ₹50 हजार–₹1 लाख, ₹1 लाख–₹2 लाख, या ₹2 लाख से अधिक)";
      }
      if (text.includes("Please share your 10-digit mobile number")) {
        return "कृपया अपना 10-अंकों का मोबाइल नंबर साझा करें ताकि मुख्य सलाहकार सचिन शिंदे आपसे संपर्क कर सकें।";
      }
      if (text.includes("handing your request over to our Founder")) {
        return `आपका अनुरोध हमारे संस्थापक और मुख्य लोन सलाहकार सचिन शिंदे (+91 72491 08474) को सौंप दिया गया है। वे जल्द ही आपसे संपर्क करेंगे।\n\nअधिक जानकारी के लिए www.avanifinserv.com देखें।`;
      }
      if (text.includes("Welcome to AVANI LOAN SERVICES! Which loan product")) {
        return "अवनी लोन सर्विसेज में आपका स्वागत है! आपको किस लोन की आवश्यकता है? (पर्सनल लोन, बिजनेस लोन, डॉक्टर लोन, होम लोन, मॉर्गेज / LAP, एजुकेशन लोन, वर्किंग कैपिटल, या स्कूल/कॉलेज फंडिंग)";
      }
    }

    // Try Gemini translation if API key is configured
    const prompt = `Translate the following text to ${language === 'mr' ? 'Marathi' : 'Hindi'} with a professional, respectful, polite tone for AVANI LOAN SERVICES:\n\n"${text}"\n\nProvide ONLY the translated text, no explanation.`;
    const translated = await this.callGeminiWithTimeout(prompt, false);
    if (translated) {
      return translated;
    }

    return text;
  }

  /**
   * Comprehensive Document Checklist for all 12 Categories
   */
  static getDocumentsForProfile(employmentType: string, profession: string, loanProduct: string): string[] {
    const prod = (loanProduct || '').toLowerCase();

    // 1. Doctor Loan
    if (prod.includes('doctor') || profession === 'Doctor') {
      return [
        'Degree Certificate (MBBS / MD / BDS / BAMS)',
        'State / National Medical Council Registration Certificate',
        'Clinic / Hospital Registration Proof',
        'PAN Card & Aadhaar Card of Doctor',
        'Last 2 years Income Tax Returns (ITR) with Computation of Income',
        'Last 12 months Bank Statements (All active accounts)',
        'Sanction letter of existing loans (if any)'
      ];
    }

    // 2. Professional Loan (CA / Lawyer / Architect)
    if (prod.includes('professional') || profession === 'Chartered Accountant' || profession === 'Architect') {
      return [
        'Certificate of Practice (COP) & Professional Council Membership (ICAI / Bar Council / COA)',
        'Degree / Professional Qualification Certificate',
        'PAN Card & Aadhaar Card',
        'Last 2 years ITR with Computation and Audited Financials (if applicable)',
        'Last 12 months Bank Statements',
        'Office Ownership Proof or Registered Lease Agreement'
      ];
    }

    // 3. School and College Institutional Funding
    if (prod.includes('school') || prod.includes('college') || prod.includes('institutional')) {
      return [
        'Trust / Society / Section 8 Entity Registration Certificate & Bylaws',
        'Affiliation & Recognition Certificates (State Board / CBSE / ICSE / AICTE / UGC / NMC)',
        '12A & 80G Certificates (for charitable trusts)',
        'Last 3 years Audited Financial Statements (Balance Sheet, Income & Expenditure)',
        'Student Enrollment Strength & Fee Collection Ledger (last 2 years)',
        'Last 12 months Bank Statements of all Institutional Accounts',
        'Campus Land & Building Title Deeds with Sanctioned Infrastructure Plan'
      ];
    }

    // 4. Education Loan — Abroad
    if (prod.includes('abroad') || prod.includes('global')) {
      return [
        'Foreign University Unconditional Admission Letter / I-20 / CAS with Detailed Fee Schedule',
        'Valid Passport Copy & Academic Visa Documentation',
        'Academic Marksheets & Degree Certificates (10th, 12th, Graduation)',
        'Standardized Entrance Test Scorecard (IELTS / TOEFL / GRE / GMAT)',
        'Student & Co-applicant PAN Card and Aadhaar Card',
        'Co-applicant Income Proof (Latest 3 months salary slips or 2 years ITR)',
        'Co-applicant Last 6–12 months Bank Statement'
      ];
    }

    // 5. Education Loan — India
    if (prod.includes('education')) {
      return [
        'Admission Letter & Fee Schedule from Recognized Indian University / College',
        'Academic Marksheets & Entrance Exam Scorecard (e.g. NEET / JEE / CAT / CET)',
        'Student & Co-applicant PAN Card and Aadhaar Card',
        'Co-applicant Income Proof (3 months salary slips or 2 years ITR)',
        'Co-applicant Last 6 months Bank Statement'
      ];
    }

    // 6. Home Loan
    if (prod.includes('home loan')) {
      return [
        'Registered Agreement to Sale / Allotment Letter / Construction Estimate',
        'Sanctioned Building Plan & Title Chain Documents',
        'Builder / Society NOC & Latest Property Tax Receipt',
        'PAN Card & Aadhaar Card of Applicant & Co-applicant',
        employmentType === 'Salaried'
          ? 'Latest 3 months salary slips & 2 years Form 16'
          : 'Last 3 years ITR with Balance Sheet & Computation',
        'Latest 6 to 12 months Bank Statements'
      ];
    }

    // 7. Mortgage Loan & Loan Against Property (LAP)
    if (prod.includes('mortgage') || prod.includes('property') || prod.includes('lap')) {
      return [
        'Property Title Deeds & 30-Year Chain Search Report',
        'Approved Building Sanction Map & Completion / Occupancy Certificate',
        'Latest Municipal Property Tax Receipts & Society / Builder NOC',
        'PAN Card & Aadhaar Card of Applicant & All Co-owners',
        employmentType === 'Salaried'
          ? 'Latest 3 months salary slips & 2 years Form 16'
          : 'Last 3 years ITR with Balance Sheet & Profit/Loss statement',
        'Latest 12 months Bank Statements (all active accounts)'
      ];
    }

    // 8. Working Capital Loan & MSME Loan
    if (prod.includes('working capital') || prod.includes('msme') || prod.includes('od') || prod.includes('cc')) {
      return [
        'Udyam Registration Certificate & GST Registration Certificate',
        'PAN Card of Business Entity & Promoters / Directors',
        'Aadhaar Card of Promoters / Partners',
        'Last 12 months GST Returns (GSTR-3B & GSTR-1)',
        'Last 2 years Audited Financials (Balance Sheet, P&L, Audit Report)',
        'Last 12 months Primary Bank Statement with Cash Credit / OD statement (if existing)',
        'Stock & Debtors Statement (for CC/OD facilities)'
      ];
    }

    // 9. Business Loan
    if (prod.includes('business') || employmentType === 'Business Owner' || employmentType === 'Self Employed') {
      return [
        'PAN Card of Business Entity & Promoters',
        'Aadhaar Card of Promoters / Partners / Directors',
        'Udyam Certificate & GST Registration Certificate',
        'Last 12 months GST Returns (GSTR-3B / GSTR-1)',
        'Last 2 years Audited Financial Statements with Computation',
        'Last 12 months Primary Bank Statement',
        'Shop Act License / Partnership Deed / MOA & AOA'
      ];
    }

    // 10. Personal Loan (Default for salaried)
    return [
      'Identity Proof: Aadhaar Card & PAN Card',
      'Current Address Proof (Utility Bill / Registered Rent Agreement)',
      'Latest 3 months Salary Slips with Official Seal',
      'Latest 6 months Salary Account Bank Statement',
      'Company ID Card / Appointment Letter'
    ];
  }

  /**
   * Creates an audit trail record for each conversation turn.
   */
  static createAuditRecord(params: {
    inputMessageRef?: string;
    detectedLanguage?: 'en' | 'mr' | 'hi';
    detectedLoanCategory?: string;
    extractedQualificationFields?: Record<string, any>;
    aiResponseRef?: string;
    handoffDecision?: 'CONTINUE_BOT' | 'HUMAN_ADVISOR_HANDOFF';
  }) {
    return {
      inputMessageRef: params.inputMessageRef || `MSG-${Date.now()}`,
      detectedLanguage: params.detectedLanguage || 'en',
      detectedLoanCategory: params.detectedLoanCategory || 'Personal Loan',
      extractedQualificationFields: params.extractedQualificationFields || {},
      aiResponseRef: params.aiResponseRef || `RESP-${Date.now()}`,
      handoffDecision: params.handoffDecision || 'CONTINUE_BOT',
      timestamp: new Date().toISOString(),
      modelVersion: process.env.PROVIDER_MODE === 'mock' || !GEMINI_API_KEY
        ? 'avani-deterministic-cp25-v1'
        : 'gemini-1.5-flash-server'
    };
  }

  /**
   * Formats structured human advisor handover notes as a readable text summary.
   */
  static generateAdvisorHandoffNotes(context: Record<string, any> = {}): string {
    const handoff = this.prepareAdvisorHandoffNotes(context);
    return `=== AVANI ADVISOR HANDOVER NOTES ===
Assigned Advisor: ${handoff.assignedAdvisor} (${handoff.advisorPhone})
Customer: ${handoff.customerSummary}
Loan Product: ${context.loanProduct || 'General Loan Inquiry'}
Required Amount: ${context.loanAmount ? '₹' + context.loanAmount : 'To be determined'}
Qualification Notes: ${context.medicalQualification || context.businessType || context.profession || 'Standard applicant'}
Required Documents:
${handoff.recommendedChecklist.map((d: string) => '- ' + d).join('\n')}
${handoff.advisoryDisclaimer}`;
  }

  /**
   * Formats structured human advisor handover notes.
   */
  static prepareAdvisorHandoffNotes(context: Record<string, any> = {}) {
    const requiredFields = ['fullName', 'mobile', 'city', 'loanProduct', 'loanAmount'];
    const missingFields = requiredFields.filter(f => !context[f]);
    const isApplicationIncomplete = missingFields.length > 0;
    const docsList = this.getDocumentsForProfile(context.employmentType, context.profession, context.loanProduct);

    return {
      assignedAdvisor: ADVISOR_CONTACT.name,
      advisorPhone: ADVISOR_CONTACT.phone,
      customerSummary: `${context.fullName || 'Prospective Applicant'} (${context.mobile || 'Phone Pending'}) — ${context.loanProduct || 'General Loan Inquiry'} in ${context.city || 'India'}`,
      isApplicationIncomplete,
      missingQualificationFields: missingFields,
      recommendedChecklist: docsList,
      disclaimerIncluded: true,
      advisoryDisclaimer: ADVISORY_DISCLAIMER,
      preparedAt: new Date().toISOString()
    };
  }
}
