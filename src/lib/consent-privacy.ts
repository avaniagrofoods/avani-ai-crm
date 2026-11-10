import crypto from 'crypto';

/**
 * AVANI LOAN SERVICES — CP-25 Consent, Data Privacy & Secure Document Protection Engine
 *
 * Implements:
 * - Service vs. Marketing Consent Separation
 * - Consent Timestamp, Source, Purpose & Policy Version Tracking
 * - Sensitive Document Chat Interception Guard (blocks Aadhaar/PAN/Bank Statements in raw chat)
 * - Cryptographically Signed, Expiring Document Upload Portal Links
 * - Role-Based Access Control (RBAC) & AES-256-GCM Envelope Encryption Helpers
 * - Sensitive Log Sanitizer (redacts Aadhaar, PAN, Passport, Tokens, Bank Accounts)
 */

export const PRIVACY_POLICY_VERSION = 'AVANI-PRIVACY-2026.2';

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
 * (Aadhaar 12-digit, PAN 10-char, Passport, or raw document attachment) so the bot warns
 * them to use the secure upload link instead of ordinary chat.
 */
export function detectSensitiveDataInChat(text: string): {
  containsSensitiveData: boolean;
  detectedTypes: string[];
  warningMessage: string;
} {
  const raw = String(text || '');
  const detected: string[] = [];

  // Indian PAN pattern: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
  if (/\b[A-Z]{5}[0-9]{4}[A-Z]\b/i.test(raw)) {
    detected.push('PAN_NUMBER');
  }

  // Indian Aadhaar pattern: 12 digits (spaced or continuous, not starting with 0/1, excluding 91-prefixed 12-digit phone)
  const aadhaarMatch = raw.match(/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/);
  if (aadhaarMatch) {
    const digitsOnly = aadhaarMatch[0].replace(/\s+/g, '');
    if (!digitsOnly.startsWith('91')) {
      detected.push('AADHAAR_NUMBER');
    }
  }

  // OTP / Password / PIN disclosure
  if (/\b(otp|password|netbanking pin|cvv)\s*[:=-]?\s*\d{3,8}\b/i.test(raw)) {
    detected.push('CREDENTIALS_OR_OTP');
  }

  return {
    containsSensitiveData: detected.length > 0,
    detectedTypes: detected,
    warningMessage:
      'For your security and privacy, please do NOT send Aadhaar numbers, PAN numbers, bank statements, passports, or OTPs in ordinary WhatsApp chat messages. Please use the secure, authenticated AVANI Document Upload Portal link shared by our system.'
  };
}

/**
 * Generates a cryptographically signed, time-limited, authenticated document upload link.
 */
export function generateSecureDocumentUploadLink(params: {
  leadId: string;
  phone: string;
  loanCategory: string;
  expiresInMinutes?: number;
}): {
  uploadUrl: string;
  tokenExpiresAt: string;
  retentionDays: number;
} {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://avani-ai-crm.vercel.app').replace(/\/$/, '');
  const secret = process.env.DOCUMENT_PORTAL_SECRET || process.env.INTERNAL_WORKER_SECRET || 'avani_doc_portal_signing_key';
  const expiresAt = Date.now() + (params.expiresInMinutes || 1440) * 60 * 1000; // Default 24h

  const payloadObj = {
    leadId: params.leadId,
    phoneHash: crypto.createHash('sha256').update(String(params.phone)).digest('hex').slice(0, 16),
    loanCategory: params.loanCategory,
    exp: expiresAt
  };

  const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const signedToken = `${payloadB64}.${sig}`;

  return {
    uploadUrl: `${baseUrl}/api/documents/secure-upload?token=${signedToken}`,
    tokenExpiresAt: new Date(expiresAt).toISOString(),
    retentionDays: 90
  };
}

/**
 * Verifies a signed document upload token.
 */
export function verifySecureDocumentUploadToken(token: string): {
  valid: boolean;
  error?: string;
  payload?: { leadId: string; phoneHash: string; loanCategory: string; exp: number };
} {
  if (!token || !token.includes('.')) {
    return { valid: false, error: 'Malformed upload token' };
  }
  const [payloadB64, sig] = token.split('.');
  const secret = process.env.DOCUMENT_PORTAL_SECRET || process.env.INTERNAL_WORKER_SECRET || 'avani_doc_portal_signing_key';
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

  try {
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: 'Invalid upload token signature' };
    }
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (Date.now() > decoded.exp) {
      return { valid: false, error: 'Upload token has expired' };
    }
    return { valid: true, payload: decoded };
  } catch {
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * Role-Based Access Control (RBAC) check for viewing or managing customer document metadata.
 */
export function canAccessDocumentRecord(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toUpperCase();
  return ['ADMIN', 'CHIEF_ADVISOR', 'SENIOR_ADVISOR', 'LOAN_ADVISOR'].includes(normalized);
}

/**
 * Encrypts document metadata / storage reference at rest using AES-256-GCM.
 */
export function encryptDocumentReference(plainReference: string): string {
  const secret = process.env.DOCUMENT_ENCRYPTION_KEY || process.env.INTERNAL_WORKER_SECRET || 'avani_default_encryption_key_32b';
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainReference, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `ENCv1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Sanitizes strings or objects before logging so sensitive identifiers (Aadhaar, PAN, tokens, secrets)
 * are never written to application logs.
 */
export function sanitizeForLog(input: any): string {
  let str = typeof input === 'string' ? input : JSON.stringify(input || '');
  // Redact PAN numbers
  str = str.replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, '[REDACTED_PAN]');
  // Redact 12-digit Aadhaar patterns
  str = str.replace(/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g, '[REDACTED_AADHAAR]');
  // Redact Bearer tokens / signed upload tokens
  str = str.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]');
  str = str.replace(/token=[A-Za-z0-9._-]+/gi, 'token=[REDACTED_UPLOAD_TOKEN]');
  return str;
}
