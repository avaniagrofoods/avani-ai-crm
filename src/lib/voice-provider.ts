import axios from 'axios';

export interface DispatchCallOptions {
  phoneNumber: string;
  customerName: string;
  loanType?: string;
  language?: 'mr' | 'hi' | 'en';
  customTask?: string;
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
  private defaultAgentId: number;
  private marathiAgentId: number;
  private englishAgentId: number;
  private webhookUrl: string;

  constructor() {
    this.apiKey = (process.env.OMNIDIM_API_KEY || 'w-uV11bJBZ3g5icPI-uw97k2Fz8VswFsCUCcMIjBqok.').trim();
    this.defaultAgentId = parseInt(process.env.OMNIDIM_DEFAULT_AGENT_ID || '207978', 10);
    this.marathiAgentId = parseInt(process.env.OMNIDIM_MARATHI_AGENT_ID || '229425', 10);
    this.englishAgentId = parseInt(process.env.OMNIDIM_ENGLISH_AGENT_ID || '228450', 10);
    this.webhookUrl = process.env.OMNIDIM_CALLBACK_URL || 'https://avani-ai-crm.vercel.app/api/omnidim-webhook';
  }

  private selectAgentId(language?: 'mr' | 'hi' | 'en'): number {
    if (language === 'mr') return this.marathiAgentId;
    if (language === 'en' || language === 'hi') return this.englishAgentId;
    return this.defaultAgentId;
  }

  async dispatchCall(options: DispatchCallOptions): Promise<DispatchCallResult> {
    try {
      const agentId = this.selectAgentId(options.language);
      let formattedPhone = options.phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.length === 10 ? '+91' + formattedPhone : '+' + formattedPhone;
      }

      const task = options.customTask || `You are an AI Agent for AVANI LOAN SERVICES (Owner: Sachin Shinde, Latur).
Your objective is to qualify ${options.customerName} for a ${options.loanType || 'Personal Loan'}.
Collect requirements step-by-step: Full Name, Loan Amount, Monthly Income, Employment Type, and City.
Be polite and professional. Offer documents checklist on WhatsApp after call.`;

      const payload = {
        agent_id: agentId,
        phone_number: formattedPhone,
        task,
        voice: "maya",
        language: options.language || "hi",
        record: true,
        max_duration: 12,
        first_sentence: `Namaste ${options.customerName}, I am calling from Avani Loan Services regarding your ${options.loanType || 'loan'} application.`,
        request_data: {
          customerName: options.customerName,
          loanType: options.loanType || 'Personal Loan'
        },
        webhook: this.webhookUrl
      };

      const response = await axios.post(
        'https://api.omnidim.io/v1/calls/dispatch',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return {
        success: true,
        callId: response.data?.call_id || response.data?.id || 'omnidim_' + Date.now(),
        provider: this.name,
        rawResponse: response.data
      };
    } catch (error: any) {
      console.warn(`[OmniDM Provider Warning] Primary dispatch attempt:`, error?.response?.data || error.message);

      // Retry fallback with standard OmniDM endpoint if primary returns fallback status
      try {
        const fallbackRes = await axios.post(
          'https://omnidim.io/api/v1/calls/dispatch',
          {
            agent_id: this.defaultAgentId,
            phone_number: options.phoneNumber,
            request_data: { customerName: options.customerName, loanType: options.loanType }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        return {
          success: true,
          callId: fallbackRes.data?.call_id || 'omnidim_fallback_' + Date.now(),
          provider: this.name,
          rawResponse: fallbackRes.data
        };
      } catch (fallbackErr: any) {
        console.error(`[OmniDM Provider Error]`, fallbackErr?.response?.data || fallbackErr.message);
        return {
          success: false,
          provider: this.name,
          error: fallbackErr?.response?.data?.message || fallbackErr.message || error.message
        };
      }
    }
  }
}

export class VoiceAIService {
  private provider: IVoiceProvider;

  constructor() {
    // Provider abstraction switchable via environment variable
    const providerName = (process.env.VOICE_AI_PROVIDER || 'omnidim').toLowerCase();

    if (providerName === 'omnidim') {
      this.provider = new OmniDMVoiceProvider();
    } else {
      this.provider = new OmniDMVoiceProvider(); // default to OmniDM
    }
  }

  async dispatchCall(options: DispatchCallOptions): Promise<DispatchCallResult> {
    return this.provider.dispatchCall(options);
  }
}

export const defaultVoiceService = new VoiceAIService();
