import axios from 'axios';
import crypto from 'crypto';

/**
 * AVANI AI CRM — Official ChatMitra WhatsApp Platform Integration Adapter
 * 
 * Provides unified, provider-independent WhatsApp dispatch, inbound webhook verification,
 * canonical Indian loan qualification, and payload validation.
 * 
 * Supports ChatMitra official API with full backwards-compatibility aliases for ChatMantra.
 */

export const CHATMITRA_BASE_URL = process.env.CHATMITRA_BASE_URL || process.env.CHATMANTRA_BASE_URL || 'https://api.chatmitra.com';
export const CHATMITRA_BACKEND_URL = process.env.CHATMITRA_BACKEND_URL || process.env.CHATMANTRA_BACKEND_URL || 'https://backend.chatmitra.com';

// Aliases for ChatMantra compatibility
export const CHATMANTRA_BASE_URL = CHATMITRA_BASE_URL;
export const CHATMANTRA_BACKEND_URL = CHATMITRA_BACKEND_URL;

export interface ChatMitraPayload {
  toPhone: string;
  messageText?: string;
  templateName?: string;
  templateParams?: string[];
  language?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'video';
  leadId?: string;
  correlationId?: string;
}

export type ChatMantraPayload = ChatMitraPayload;

export interface ChatMitraResponse {
  success: boolean;
  messageId?: string;
  provider: string;
  status: string;
  rawResponse?: any;
  error?: string;
}

export type ChatMantraResponse = ChatMitraResponse;

export interface InboundLoanClassification {
  category: string;
  template: string;
  confidence: number;
}

export interface PayloadValidationResult {
  valid: boolean;
  error?: string;
  msgId?: string;
  fromPhone?: string;
  eventName?: string;
  text?: string;
  profileName?: string;
}

/**
 * Validates HMAC-SHA256 signature from ChatMitra / ChatMantra webhooks.
 * Official header: X-Webhook-Signature (plain hex or sha256= prefix).
 * Also supports Meta-style X-Hub-Signature-256.
 * Uses crypto.timingSafeEqual to protect against timing attacks.
 */
export function verifyChatMitraSignature(
  rawBody: string | Buffer,
  signatureHeader?: string | null,
  secret?: string
): boolean {
  if (!signatureHeader || !secret) return false;
  try {
    const rawString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = crypto.createHmac('sha256', secret).update(rawString).digest('hex');
    const clean = signatureHeader.replace(/^sha256=/, '').trim();
    
    if (clean.length !== expected.length) {
      return false;
    }

    const cleanBuf = Buffer.from(clean, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    if (cleanBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(cleanBuf, expectedBuf);
  } catch {
    return false;
  }
}

export const verifyChatMantraSignature = verifyChatMitraSignature;

/**
 * Normalizes Indian mobile numbers to 91XXXXXXXXXX format for ChatMitra / WABA API.
 */
export function formatChatMitraPhone(phone: string): string {
  const clean = String(phone || '').replace(/[^0-9]/g, '');
  if (clean.length === 10) return `91${clean}`;
  if (clean.startsWith('91') && clean.length === 12) return clean;
  if (clean.startsWith('0') && clean.length === 11) return `91${clean.slice(1)}`;
  return clean;
}

export const formatChatMantraPhone = formatChatMitraPhone;

/**
 * Identifies and classifies loan products from customer inbound messages
 * Supporting AVANI LOAN SERVICES 10 canonical categories (Workflow 2):
 * 1. Personal Loan
 * 2. Business Loan
 * 3. Doctor Loan
 * 4. CA Professional Loan
 * 5. Home Loan
 * 6. Mortgage Loan / LAP
 * 7. Education Loan — India
 * 8. Education Loan — Global Studies
 * 9. School Funding
 * 10. College Funding
 */
export function classifyLoanCategory(text: string): InboundLoanClassification {
  const lower = (text || '').toLowerCase().trim();

  // 1. Doctor Loan
  if (/(\bdoctor\b|\bmbbs\b|\bclinic\b|\bhospital\b|\bmedical practice\b|\bpharma\b|\bmd\b|\bdr\b|\bbds\b|\bbams\b|\bbhms\b|डॉक्टर|दवाखाना|रुग्णालय)/i.test(lower)) {
    return { category: 'Doctor Loan', template: 'doctor_loan_offer', confidence: 0.95 };
  }

  // 2. CA Professional Loan
  if (/(\bca\b|\bchartered accountant\b|\bicai\b|\bcop\b|\baudit firm\b|\btax audit\b|\bca loan\b|\bca professional\b|चार्टर्ड अकाउंटंट|सीए)/i.test(lower)) {
    return { category: 'CA Professional Loan', template: 'ca_professional_loan_welcome', confidence: 0.95 };
  }

  // 3. Education Loan — Global Studies
  if (/(\babroad\b|\boverseas\b|\busa\b|\buk\b|\bcanada\b|\bgermany\b|\baustralia\b|\bms abroad\b|\bgre\b|\bielts\b|\btoefl\b|परदेशात शिक्षण|विदेश पढ़ाई)/i.test(lower)) {
    return { category: 'Education Loan — Global Studies', template: 'education_loan_abroad_welcome', confidence: 0.93 };
  }

  // 4. Education Loan — India
  if (/(\btuition\b|\beducation loan\b|\bstudent loan\b|\bcollege fees\b|\bengineering fees\b|\bmba fees\b|\buniversity fees\b|\bstudy\b|\beducation\b|\bneet\b|\bjee\b|\biim\b|\biit\b|शिक्षण कर्ज|एजुकेशन लोन)/i.test(lower)) {
    return { category: 'Education Loan — India', template: 'education_loan_india_welcome', confidence: 0.90 };
  }

  // 5. School Funding
  if (/(\bschool\b|\bschool funding\b|\bschool loan\b|\bcbse school\b|\bicse school\b|\bschool campus\b|\bk-12\b|\btrust school\b|शाळा|स्कूल)/i.test(lower)) {
    return { category: 'School Funding', template: 'school_owner_funding_welcome', confidence: 0.94 };
  }

  // 6. College Funding
  if (/(\bcollege\b|\bcollege funding\b|\bcollege loan\b|\buniversity campus\b|\bengineering college\b|\bmedical college\b|\bpolytechnic\b|\baicte\b|\bugc\b|महाविद्यालय|कॉलेज)/i.test(lower)) {
    return { category: 'College Funding', template: 'college_funding_welcome', confidence: 0.94 };
  }

  // 7. Mortgage Loan / LAP
  if (/(\blap\b|\bmortgage\b|\bproperty\b|\bagainst property\b|\bcommercial property\b|\bplot\b|मॉर्गिज|प्रॉपर्टी कर्ज)/i.test(lower)) {
    return { category: 'Mortgage Loan / LAP', template: 'lap_loan_welcome', confidence: 0.91 };
  }

  // 8. Home Loan
  if (/(\bhome\b|\bflat\b|\bhouse\b|\bconstruction\b|\bresidential\b|\bplot purchase\b|\bapartment\b|गृहकर्ज|घर खरेदी|होम लोन)/i.test(lower)) {
    return { category: 'Home Loan', template: 'home_loan_welcome', confidence: 0.90 };
  }

  // 9. Business Loan
  if (/(\bbusiness\b|\bmsme\b|\bgst\b|\bworking capital\b|\bod\b|\bcc\b|\bmachinery\b|\bfirm\b|\btrade\b|\bpvt ltd\b|व्यापार कर्ज|बिझनेस)/i.test(lower)) {
    return { category: 'Business Loan', template: 'business_loan_welcome', confidence: 0.88 };
  }

  // 10. Default: Personal Loan
  return { category: 'Personal Loan', template: 'Avani_Loan_Welcome', confidence: 0.75 };
}

/**
 * Dispatch message via ChatMitra REST API.
 * Respects strict safety gates:
 * - When PROVIDER_MODE !== 'live' or API key is absent, executes in isolated mock mode.
 * - Prevents sending messages to real customers during development/testing.
 */
export async function sendChatMitraMessage(payload: ChatMitraPayload): Promise<ChatMitraResponse> {
  const providerMode = process.env.PROVIDER_MODE || 'mock';
  const apiKey = (process.env.CHATMITRA_API_KEY || process.env.CHATMANTRA_API_KEY || '').trim();
  const formattedPhone = formatChatMitraPhone(payload.toPhone);

  // Safety Gate: Mock Mode / Sandbox
  if (providerMode !== 'live' || !apiKey) {
    const mockId = `CM-MOCK-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return {
      success: true,
      messageId: mockId,
      provider: 'ChatMitra_Mock',
      status: 'API_ACCEPTED',
      rawResponse: {
        id: mockId,
        mode: 'mock_safety_gate',
        recipient: formattedPhone,
        template: payload.templateName || null,
        messagePreview: payload.messageText ? payload.messageText.substring(0, 50) : null
      }
    };
  }

  // MANDATORY SAFETY INVARIANT: Single-recipient clamp for live testing
  // Under NO circumstances can a live message be sent to any number other than the authorized test contact
  const AUTHORIZED_TEST_PHONE_CANONICAL = '919175635165';
  if (providerMode === 'live' && formattedPhone !== AUTHORIZED_TEST_PHONE_CANONICAL) {
    console.error(`[ChatMitra Safety Clamp] Blocked live dispatch attempt to unauthorized recipient: ${formattedPhone}`);
    return {
      success: false,
      provider: 'ChatMitra_SafetyClamp',
      status: 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT',
      error: `Safety invariant: Live dispatch is strictly restricted to authorized test contact +91 91756 35165. Attempted dispatch to ${formattedPhone} was blocked.`
    };
  }

  try {
    let res: any;
    const idempotencyKey = payload.correlationId || `CM-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    };

    if (payload.templateName) {
      // Official ChatMitra Developer API for Templates
      res = await axios.post(
        `${CHATMITRA_BACKEND_URL}/developer/api/send_message`,
        {
          recipient_mobile_number: formattedPhone,
          messages: [
            {
              kind: 'template',
              template: {
                name: payload.templateName,
                language: payload.language || 'en',
                components: [
                  {
                    type: 'body',
                    parameters: (payload.templateParams || []).map((p, idx) => ({
                      type: 'text',
                      parameter_name: `param_${idx + 1}`,
                      text: String(p).replace(/[#*~_]/g, '') // Sanitize per ChatMitra text guidelines
                    }))
                  }
                ]
              }
            }
          ]
        },
        {
          headers,
          timeout: 10000
        }
      );
    } else {
      res = await axios.post(
        `${CHATMITRA_BACKEND_URL}/developer/api/send_message`,
        {
          recipient_mobile_number: formattedPhone,
          messages: [
            {
              kind: 'raw',
              payload: {
                type: 'text',
                text: {
                  body: payload.messageText || ''
                }
              }
            }
          ]
        },
        {
          headers,
          timeout: 10000
        }
      );
    }

    const messageId = res.data?.id || res.data?.messages?.[0]?.id || `CM-${Date.now()}`;
    return {
      success: true,
      messageId,
      provider: 'ChatMitra_Live',
      status: 'API_ACCEPTED',
      rawResponse: res.data
    };
  } catch (err: any) {
    const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    const isTimeout = err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout');
    return {
      success: false,
      provider: 'ChatMitra',
      status: isTimeout ? 'TIMEOUT' : 'FAILED',
      error: errorDetails
    };
  }
}

export const sendChatMantraMessage = sendChatMitraMessage;

/**
 * Convenience helper to dispatch an approved WhatsApp template via ChatMitra
 */
export async function sendChatMitraTemplate(
  phone: string,
  templateName: string,
  params: string[] = [],
  language: string = 'en'
): Promise<ChatMitraResponse> {
  return sendChatMitraMessage({
    toPhone: phone,
    templateName,
    templateParams: params,
    language
  });
}

/**
 * Strict inbound payload validation guard
 * Verifies that required identifiers and sender details exist before processing.
 */
export function validateChatMitraInboundPayload(body: any): PayloadValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Payload must be a non-empty JSON object' };
  }

  const eventName = body.event || body.type;

  // 1. Status update payload validation
  if (
    eventName === 'message.status.updated' ||
    eventName === 'message.sent' ||
    eventName === 'message.delivered' ||
    eventName === 'message.read' ||
    eventName === 'message.failed'
  ) {
    const msgId = body.messageId || body.id || body.data?.id;
    if (!msgId) {
      return { valid: false, error: 'Missing messageId in status callback payload', eventName };
    }
    return { valid: true, msgId, eventName };
  }

  // 2. Inbound message payload validation
  const rawFrom = body.from || body.recipient_mobile_number || body.phoneNumber || body.phone || body.messages?.[0]?.from;
  if (!rawFrom) {
    return { valid: false, error: 'Missing sender phone number in message payload' };
  }
  const fromPhone = formatChatMitraPhone(String(rawFrom));
  if (!fromPhone || fromPhone.length < 10) {
    return { valid: false, error: 'Invalid sender phone number format' };
  }

  const msgId = body.id || body.messageId || body.messages?.[0]?.id;
  if (!msgId) {
    return { valid: false, error: 'Missing message identifier in inbound message payload' };
  }

  const text = body.text?.body || (typeof body.text === 'string' ? body.text : '') || (typeof body.message === 'string' ? body.message : '') || body.messages?.[0]?.text?.body || '';
  const profileName = body.profile?.name || body.name || body.contacts?.[0]?.profile?.name || 'Customer';

  return {
    valid: true,
    msgId: String(msgId),
    fromPhone,
    eventName: eventName || 'message.received',
    text,
    profileName
  };
}

export const validateChatMantraInboundPayload = validateChatMitraInboundPayload;

/**
 * Validates the ChatMitra configuration in active process.env
 */
export function validateChatMitraConfig(): { valid: boolean; missing: string[]; configured: Record<string, boolean> } {
  const apiKey = (process.env.CHATMITRA_API_KEY || process.env.CHATMANTRA_API_KEY || '').trim();
  const secret = (process.env.CHATMITRA_WEBHOOK_SECRET || process.env.CHATMANTRA_WEBHOOK_SECRET || '').trim();
  const verifyToken = (process.env.CHATMITRA_VERIFY_TOKEN || process.env.CHATMANTRA_VERIFY_TOKEN || '').trim();
  
  const missing: string[] = [];
  if (!apiKey) missing.push('CHATMITRA_API_KEY');
  if (!secret) missing.push('CHATMITRA_WEBHOOK_SECRET');
  if (!verifyToken) missing.push('CHATMITRA_VERIFY_TOKEN');

  return {
    valid: missing.length === 0,
    missing,
    configured: {
      apiKey: !!apiKey,
      webhookSecret: !!secret,
      verifyToken: !!verifyToken,
      baseUrl: !!(process.env.CHATMITRA_BASE_URL || process.env.CHATMANTRA_BASE_URL)
    }
  };
}
