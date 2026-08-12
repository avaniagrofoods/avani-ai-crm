import axios from 'axios';

export interface DispatchCallOptions {
  phoneNumber: string;
  customerName: string;
  loanType?: string;
  language?: 'mr' | 'hi' | 'en';
  customTask?: string;
  city?: string;
  profession?: string;
  loanRequirement?: string;
}

export interface DispatchCallResult {
  success: boolean;
  callId?: string;
  provider: string;
  rawResponse?: any;
  error?: string;
}

export interface IVoiceProvider {
  name: string;
  dispatchCall(options: DispatchCallOptions): Promise<DispatchCallResult>;
}

export class OmniDMVoiceProvider implements IVoiceProvider {
  name = 'OmniDM';

  private apiKey: string;
  private defaultAgentId: string;
  private marathiAgentId: string;
  private englishAgentId: string;

  constructor() {
    // Strip any leading/trailing whitespace or periods from API key
    this.apiKey = (process.env.OMNIDIM_API_KEY || 'w-uV11bJBZ3g5icPI-uw97k2Fz8VswFsCUCcMIjBqok').replace(/\.+$/, '').trim();
    this.defaultAgentId = (process.env.OMNIDIM_DEFAULT_AGENT_ID || '229425').trim();
    this.marathiAgentId = (process.env.OMNIDIM_MARATHI_AGENT_ID || '229425').trim();
    this.englishAgentId = (process.env.OMNIDIM_ENGLISH_AGENT_ID || '228450').trim();
  }

  private selectAgentId(language?: 'mr' | 'hi' | 'en'): string {
    if (language === 'mr') return this.marathiAgentId;
    if (language === 'en' || language === 'hi') return this.englishAgentId;
    return this.defaultAgentId;
  }

  async dispatchCall(options: DispatchCallOptions): Promise<DispatchCallResult> {
    if (process.env.OMNIDM_LIVE_ENABLED !== 'true') {
      console.log("[OmniDM Provider] Live calling disabled (OMNIDM_LIVE_ENABLED != true).");
      return {
        success: false,
        error: "OmniDM integration READY — live calling disabled pending recharge.",
        provider: this.name,
        rawResponse: { status: "DISABLED_PENDING_RECHARGE" }
      };
    }

    try {
      const agentId = this.selectAgentId(options.language);
      let formattedPhone = options.phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.length === 10 ? '+91' + formattedPhone : '+' + formattedPhone;
      }

      const advancedPrompt = `
CRITICAL: You are AVANI, a professional multilingual AI loan qualification assistant for AVANI LOAN SERVICES. 
You MUST auto-detect the language spoken by the customer (Marathi, Hindi, or English) and reply fluently in that exact SAME language. Do not switch languages unnecessarily.

INSTRUCTIONS:
You must ask ONE question at a time. Do not dump all questions at once.
Confirm important captured information.
Never invent eligibility, guarantee loan approval, or promise a sanctioned amount.
Explain that final approval depends on lender policy and document verification.
Collect missing information before moving to the next stage.

CONVERSATION SEQUENCE:
STEP 1: Introduce AVANI LOAN SERVICES.
STEP 2: Confirm customer's name.
STEP 3: Confirm email address. (Mobile is already known).
STEP 4: Confirm city. (City and Employment are separate).
STEP 5: Identify employment/profession. (Options: Salaried, Self Employed, Business Owner, Doctor/Medical Professional, Chartered Accountant, Other Professional, Student, Farmer, Pensioner, Other).
STEP 6: Ask monthly income range. (Options: 25K-50K, 50K-1L, 1L-2L, Above 2L).
STEP 7: Ask required loan amount.
STEP 8: Identify loan product. (Options: Personal Loan, Business Loan, Doctor Loan, Home Loan, Mortgage/LAP, Education Loan).
STEP 9: Dynamically generate the document checklist based on Employment and Loan Product. 
- Salaried/Personal: Aadhaar, PAN, Last 3 months salary slips, Last 6 months bank statements, Form 16, Employee ID.
- Business/Self Employed: PAN, Aadhaar, GST Certificate, Business Registration/Udyam, Last 2 years ITR, Last 12 months bank statements.
- Doctor: Degree/Registration Certificate, PAN, Aadhaar, Last 2 years ITR, Last 6-12 months bank statements.
- CA: Certificate of Practice, ICAI Membership, PAN, Aadhaar, Last 2 years ITR, Bank statements.
- Education: Admission Letter, Academic Certificates, Aadhaar, PAN, Co-applicant income documents.
- Home Loan: Property Documents (Sale Agreement, Title Deed, NOC, Tax Receipts) + Income Documents based on Salaried or Business.
STEP 10: Ask whether customer wants WhatsApp document submission, callback, consultation, or eligibility assistance.
STEP 11: End call politely.

If customer changes product/profession, recalculate the required checklist.
`;

      const payload = {
        agent_id: agentId,
        to_number: formattedPhone,
        phone_number: formattedPhone,
        customer_name: options.customerName,
        language: options.language || "mr",
        variables: {
          name: options.customerName,
          loan_type: options.loanType || "Personal Loan",
          city: options.city || "",
          profession: options.profession || "",
          Loan_requirement: options.loanRequirement || "",
          system_prompt: advancedPrompt
        }
      };

      const response = await axios.post(
        'https://omnidim.io/api/v1/calls/dispatch',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (response.data && (response.data.success || response.data.requestId || response.data.status === 'dispatched')) {
        return {
          success: true,
          callId: String(response.data.requestId || response.data.id || 'omnidim_' + Date.now()),
          provider: this.name,
          rawResponse: response.data
        };
      }

      return {
        success: false,
        error: response.data?.error || response.data?.message || 'OmniDM Voice Dispatch Failed',
        provider: this.name,
        rawResponse: response.data
      };
    } catch (error: any) {
      const errMsg = error?.response?.data?.error_description || error?.response?.data?.error || error.message;
      console.error(`[OmniDM Provider Error]:`, errMsg);
      return {
        success: false,
        error: errMsg,
        provider: this.name
      };
    }
  }
}

export const defaultVoiceService = new OmniDMVoiceProvider();
