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
    try {
      const agentId = this.selectAgentId(options.language);
      let formattedPhone = options.phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.length === 10 ? '+91' + formattedPhone : '+' + formattedPhone;
      }

      const payload = {
        agent_id: agentId,
        to_number: formattedPhone,
        phone_number: formattedPhone,
        customer_name: options.customerName,
        language: options.language || "mr"
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
