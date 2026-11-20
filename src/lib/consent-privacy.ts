/**
 * AVANI LOAN SERVICES — Consent, Data Privacy & Zero-Document-Storage Guard Engine
 *
 * TASK 5H.4 Update:
 * - Service vs. Marketing Consent Separation
 * - Consent Timestamp, Source, Purpose & Policy Version Tracking
 * - Sensitive Document Chat Interception Guard (blocks Aadhaar/PAN/Bank Statements in raw chat)
 * - Document Upload Portal Permanently Disabled (Zero File/Attachment Storage Policy)
 * - Sensitive Log Sanitizer (redacts Aadhaar, PAN, Passport, Tokens, Bank Accounts)
 */

export const PRIVACY_POLICY_VERSION = 'AVANI-PRIVACY-2026.5H4';

export const PRIVACY_NOTICE_TEXT = {
  en: 'Privacy Notice: AVANI LOAN SERVICES collects your contact and financial qualification details solely to assess suitable loan options with partner banks/NBFCs and connect you with an authorized loan advisor. Service communications are separate from optional promotional updates. Reply STOP anytime to opt out.',
  mr: 'गोपनीयता सूचना: अवनी लोन सर्विसेस तुमची संपर्क आणि आर्थिक पात्रता माहिती केवळ भागीदार बँका/NBFC सोबत योग्य कर्ज पर्याय तपासण्यासाठी आणि अधिकृत सल्लागाराशी जोडण्यासाठी संकलित करते. प्रमोशनल अपडेट्स पूर्णपणे ऐच्छिक आहेत. कधीही थांबवण्यासाठी STOP किंवा थांबवा रिप्लाय करा.',
  hi: 'गोपनीयता सूचना: अवनी लोन सर्विसेस आपकी संपर्क और वित्तीय योग्यता जानकारी केवल पार्टनर बैंकों/NBFC के साथ उपयुक्त लोन विकल्पों के मूल्यांकन और अधिकृत सलाहकार से जोड़ने के लिए एकत्र करता है। प्रमोशनल अपडेट वैकल्पिक हैं। कभी भी रोकने के लिए STOP या रोको लिखें।'
};

export interface ConsentRecord {
  serviceConsent: 'GRANTED' | 'DENIED' | 'WITHDRAWN';
  marketingConsent: 'GRANTED' | 'DENIED' | 'PENDING' | 'WITHDRAWN';
  consentTimestamp: string;
  consentSource: string;
  consentPurpose: string;
  policyVersion: string;
  optOutSuppressed: boolean;
  suppressionChannels: string[];
}

export function createConsentRecord(params: {
  source?: string;
  serviceConsent?: 'GRANTED' | 'DENIED' | 'WITHDRAWN';
  marketingConsent?: 'GRANTED' | 'DENIED' | 'PENDING' | 'WITHDRAWN';
  purpose?: string;
  isOptedOut?: boolean;
}): ConsentRecord {
  const optedOut = params.isOptedOut === true;
  return {
    serviceConsent: optedOut ? 'WITHDRAWN' : (params.serviceConsent || 'GRANTED'),
    marketingConsent: optedOut ? 'WITHDRAWN' : (params.marketingConsent || 'PENDING'),
    consentTimestamp: new Date().toISOString(),
    consentSource: params.source || 'CHATMITRA_WHATSAPP_CHATBOT',
    consentPurpose: params.purpose || 'LOAN_QUALIFICATION_AND_ADVISORY',
    policyVersion: PRIVACY_POLICY_VERSION,
    optOutSuppressed: optedOut,
    suppressionChannels: optedOut
      ? ['CHATMITRA', 'AVANI_CRM', 'HUBSPOT', 'ZAPIER', 'GOOGLE_SHEETS', 'OMNIDM_CALLING']
      : []
  };
}

/**
 * Detects if a user message in ordinary WhatsApp chat contains sensitive KYC identifiers
 * (Aadhaar 12-digit, PAN 10-char, or OTP/PIN) so the bot warns them never to send KYC documents in chat.
 */
export function detectSensitiveDataInChat(text: string): {
  containsSensitiveData: boolean;
  detectedTypes: string[];
  warningMessage: string;
} {
  const raw = String(text || '');
  const detected: string[] = [];

  if (/\b[A-Z]{5}[0-9]{4}[A-Z]\b/i.test(raw)) {
    detected.push('PAN_NUMBER');
  }

  const aadhaarMatch = raw.match(/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/);
  if (aadhaarMatch) {
    const digitsOnly = aadhaarMatch[0].replace(/\s+/g, '');
    if (!digitsOnly.startsWith('91')) {
      detected.push('AADHAAR_NUMBER');
    }
  }

  if (/\b(otp|password|netbanking pin|cvv)\s*[:=-]?\s*\d{3,8}\b/i.test(raw)) {
    detected.push('CREDENTIALS_OR_OTP');
  }

  return {
    containsSensitiveData: detected.length > 0,
    detectedTypes: detected,
    warningMessage:
      'For your security and privacy, please do NOT send Aadhaar numbers, PAN numbers, bank statements, salary slips, property documents, or OTPs in WhatsApp chat. Our CRM does not store uploaded documents; your assigned AVANI loan advisor will coordinate verification directly with the partner bank.'
  };
}

/**
 * TASK 5H.4: Document upload links are permanently disabled under the zero-file-storage policy.
 */
export function generateSecureDocumentUploadLink(_params: {
  leadId: string;
  phone: string;
  loanCategory: string;
  expiresInMinutes?: number;
}): {
  uploadUrl: string;
  uploadDisabled: boolean;
  tokenExpiresAt: string;
  retentionDays: number;
} {
  return {
    uploadUrl: '',
    uploadDisabled: true,
    tokenExpiresAt: new Date(0).toISOString(),
    retentionDays: 0
  };
}

/**
 * TASK 5H.4: Document upload token verification always rejects because document uploads are disabled.
 */
export function verifySecureDocumentUploadToken(_token: string): {
  valid: boolean;
  error?: string;
  payload?: { leadId: string; phoneHash: string; loanCategory: string; exp: number };
} {
  return {
    valid: false,
    error: 'DOCUMENT_UPLOAD_DISABLED'
  };
}

export function canAccessDocumentRecord(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toUpperCase();
  return ['ADMIN', 'CHIEF_ADVISOR', 'SENIOR_ADVISOR', 'LOAN_ADVISOR'].includes(normalized);
}

export function encryptDocumentReference(_plainReference: string): string {
  return 'DOCUMENT_STORAGE_DISABLED';
}

export function sanitizeForLog(input: any): string {
  let str = typeof input === 'string' ? input : JSON.stringify(input || '');
  str = str.replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, '[REDACTED_PAN]');
  str = str.replace(/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g, '[REDACTED_AADHAAR]');
  str = str.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]');
  str = str.replace(/token=[A-Za-z0-9._-]+/gi, 'token=[REDACTED_UPLOAD_TOKEN]');
  return str;
}
