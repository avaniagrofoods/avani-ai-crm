/**
 * Centralized Runtime Safeguard Policy & Authorization Helpers (CP-26.8)
 *
 * Fail-closed security primitives shared across messaging routes, provider
 * adapters, voice calling services, webhook workers, and scheduled jobs:
 *   1. Bulk broadcast authorization (BULK_BROADCAST_ENABLED + PROVIDER_MODE)
 *   2. Authorized test recipient enforcement (AUTHORIZED_TEST_PHONE_CANONICAL)
 *   3. Webhook inbound auto-reply & archival suppression policy
 */

export interface CanonicalPhoneResult {
  valid: boolean;
  canonicalDigits?: string;
  e164?: string;
  raw10?: string;
  masked: string;
  reason?: string;
}

export interface RecipientAuthorizationResult {
  allowed: boolean;
  status: number;
  error?: string;
  reason: string;
  message: string;
  targetE164?: string;
  targetCanonicalDigits?: string;
  targetMasked: string;
}

export interface BulkBroadcastPolicyResult {
  allowed: boolean;
  status: number;
  error?: string;
  message?: string;
  providerMode: string;
  bulkBroadcastEnabled: boolean;
}

export interface WebhookReplyPolicyInput {
  eventId?: string;
  provider?: string;
  payload?: {
    archiveOnly?: unknown;
    suppressAutoReply?: unknown;
    provider?: string;
    data?: {
      archiveOnly?: unknown;
      suppressAutoReply?: unknown;
      provider?: string;
    };
  } | null;
  inboxRecord?: {
    status?: string;
    provider?: string;
    archiveOnly?: unknown;
    suppressAutoReply?: unknown;
  } | null;
  env?: NodeJS.ProcessEnv;
}

export interface WebhookReplyPolicyResult {
  archiveOnly: boolean;
  suppressAutoReply: boolean;
  autoReplyFlagEnabled: boolean;
  chatmitraAutoReplyEnabled: boolean;
  whatsappInboundAiReplyEnabled: boolean;
  aisensyInboundWebhookEnabled: boolean;
  canSendAnyProviderMessage: boolean;
  canTriggerAutoReply: boolean;
  suppressionReason:
    | 'ARCHIVE_ONLY'
    | 'SUPPRESS_AUTO_REPLY'
    | 'AUTO_REPLY_DISABLED'
    | 'WHATSAPP_AI_REPLY_DISABLED'
    | 'AISENSY_INBOUND_DISABLED'
    | 'ALLOWED';
}

/**
 * Redact phone number to last 4 digits so logs and error responses avoid raw PII.
 */
export function maskPhoneForLog(input: unknown): string {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `****${digits.slice(-4)}`;
}

/**
 * Normalizes and validates phone numbers deterministically across Indian and
 * international E.164 formats. Rejects ambiguous, malformed, or alphabetic values.
 */
export function parseCanonicalPhone(input: unknown): CanonicalPhoneResult {
  const masked = maskPhoneForLog(input);
  if (typeof input !== 'string' && typeof input !== 'number') {
    return { valid: false, masked, reason: 'EMPTY_OR_NON_STRING' };
  }

  const trimmed = String(input).trim();
  if (!trimmed) {
    return { valid: false, masked, reason: 'EMPTY_PHONE' };
  }

  // Reject unexpected characters outside digits and standard formatting symbols
  if (!/^[+\d\s\-().]+$/.test(trimmed)) {
    return { valid: false, masked, reason: 'INVALID_CHARACTERS' };
  }

  // '+' may only appear as a single leading prefix
  if (trimmed.indexOf('+', 1) !== -1) {
    return { valid: false, masked, reason: 'MISPLACED_PLUS' };
  }

  const hasLeadingPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return { valid: false, masked, reason: 'NO_DIGITS' };
  }

  // Normalize IDD '00' international prefix when no leading '+'
  if (!hasLeadingPlus && digits.startsWith('00')) {
    digits = digits.slice(2);
    if (!digits) {
      return { valid: false, masked, reason: 'EMPTY_AFTER_IDD' };
    }
    return classifyDigitsAsCanonical(digits, true, masked);
  }

  return classifyDigitsAsCanonical(digits, hasLeadingPlus, masked);
}

function classifyDigitsAsCanonical(
  digits: string,
  hasInternationalPrefix: boolean,
  masked: string
): CanonicalPhoneResult {
  // Reject all-zero or obviously synthetic zeroed strings
  if (/^0+$/.test(digits)) {
    return { valid: false, masked, reason: 'ALL_ZEROS' };
  }

  // Indian 10-digit mobile: must start with 6-9
  if (!hasInternationalPrefix && digits.length === 10) {
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return { valid: false, masked, reason: 'INVALID_INDIAN_10_DIGIT' };
    }
    return {
      valid: true,
      canonicalDigits: `91${digits}`,
      e164: `+91${digits}`,
      raw10: digits,
      masked
    };
  }

  // Indian 11-digit trunk '0' + 10-digit mobile
  if (!hasInternationalPrefix && digits.length === 11 && digits.startsWith('0')) {
    const raw10 = digits.slice(1);
    if (!/^[6-9]\d{9}$/.test(raw10)) {
      return { valid: false, masked, reason: 'INVALID_INDIAN_TRUNK_PHONE' };
    }
    return {
      valid: true,
      canonicalDigits: `91${raw10}`,
      e164: `+91${raw10}`,
      raw10,
      masked
    };
  }

  // Explicit Indian E.164 (with or without leading +): 91 + 10-digit [6-9] mobile
  if (digits.startsWith('91') && digits.length === 12) {
    const raw10 = digits.slice(2);
    if (!/^[6-9]\d{9}$/.test(raw10)) {
      return { valid: false, masked, reason: 'INVALID_INDIAN_COUNTRY_NUMBER' };
    }
    return {
      valid: true,
      canonicalDigits: digits,
      e164: `+${digits}`,
      raw10,
      masked
    };
  }

  // Non-Indian international E.164 numbers require explicit '+' or '00' prefix
  // and 8..15 total digits not starting with '0' (and not malformed '91...' length != 12)
  if (hasInternationalPrefix) {
    if (digits.startsWith('91')) {
      return { valid: false, masked, reason: 'INVALID_INDIAN_LENGTH' };
    }
    if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) {
      return { valid: false, masked, reason: 'INVALID_E164_LENGTH' };
    }
    return {
      valid: true,
      canonicalDigits: digits,
      e164: `+${digits}`,
      masked
    };
  }

  return { valid: false, masked, reason: 'UNSUPPORTED_OR_MALFORMED_PHONE' };
}

/**
 * Validates and resolves the configured authorized test phone from environment.
 * Fails closed when absent or malformed. Never falls back to hardcoded numbers.
 */
export function getConfiguredAuthorizedTestPhone(
  env: NodeJS.ProcessEnv = process.env
): CanonicalPhoneResult {
  const raw = env.AUTHORIZED_TEST_PHONE_CANONICAL;
  if (typeof raw !== 'string' || !raw.trim()) {
    return {
      valid: false,
      masked: '****',
      reason: 'AUTHORIZED_TEST_PHONE_NOT_CONFIGURED'
    };
  }

  const parsed = parseCanonicalPhone(raw);
  if (!parsed.valid) {
    return {
      valid: false,
      masked: '****',
      reason: 'AUTHORIZED_TEST_PHONE_MALFORMED'
    };
  }

  return parsed;
}

/**
 * Centralized fail-closed recipient authorization check shared by direct
 * messaging routes, WhatsApp provider adapters, fallbacks, and voice callers.
 */
export function evaluateAuthorizedTestRecipient(
  targetPhone: unknown,
  env: NodeJS.ProcessEnv = process.env
): RecipientAuthorizationResult {
  const configured = getConfiguredAuthorizedTestPhone(env);
  if (!configured.valid || !configured.canonicalDigits) {
    return {
      allowed: false,
      status: 403,
      error: 'LIVE_DISPATCH_RESTRICTED',
      reason: configured.reason || 'AUTHORIZED_TEST_PHONE_NOT_CONFIGURED',
      message: 'Safety invariant: Authorized test recipient configuration is missing or invalid; live dispatch blocked.',
      targetMasked: maskPhoneForLog(targetPhone)
    };
  }

  const candidate = parseCanonicalPhone(targetPhone);
  if (!candidate.valid || !candidate.canonicalDigits) {
    return {
      allowed: false,
      status: 400,
      error: 'INVALID_PHONE',
      reason: candidate.reason || 'INVALID_RECIPIENT_PHONE',
      message: 'Valid phone number is required.',
      targetMasked: candidate.masked
    };
  }

  if (candidate.canonicalDigits !== configured.canonicalDigits) {
    return {
      allowed: false,
      status: 403,
      error: 'LIVE_DISPATCH_RESTRICTED',
      reason: 'RECIPIENT_NOT_AUTHORIZED',
      message: 'Safety invariant: Live dispatch is strictly restricted to the configured authorized test recipient.',
      targetE164: candidate.e164,
      targetCanonicalDigits: candidate.canonicalDigits,
      targetMasked: candidate.masked
    };
  }

  return {
    allowed: true,
    status: 200,
    reason: 'AUTHORIZED_RECIPIENT_MATCH',
    message: 'Authorized test recipient verified.',
    targetE164: candidate.e164,
    targetCanonicalDigits: candidate.canonicalDigits,
    targetMasked: candidate.masked
  };
}

/**
 * Centralized fail-closed bulk dispatch safeguard rule:
 *   1. BULK_BROADCAST_ENABLED must explicitly equal 'true' (even in mock mode).
 *   2. PROVIDER_MODE === 'live' always blocks consumer bulk broadcasts.
 */
export function evaluateBulkBroadcastPolicy(
  env: NodeJS.ProcessEnv = process.env
): BulkBroadcastPolicyResult {
  const providerMode = (env.PROVIDER_MODE || 'mock').trim().toLowerCase();
  const bulkBroadcastEnabled = env.BULK_BROADCAST_ENABLED === 'true';

  if (!bulkBroadcastEnabled) {
    return {
      allowed: false,
      status: 403,
      error: 'BROADCAST_DISABLED',
      message: 'Safety invariant: Bulk broadcast messaging is disabled by BULK_BROADCAST_ENABLED policy.',
      providerMode,
      bulkBroadcastEnabled: false
    };
  }

  if (providerMode === 'live') {
    return {
      allowed: false,
      status: 403,
      error: 'BROADCAST_DISABLED',
      message: 'Safety invariant: Bulk broadcast messaging is strictly disabled in production live mode to protect consumers.',
      providerMode,
      bulkBroadcastEnabled: true
    };
  }

  return {
    allowed: true,
    status: 200,
    providerMode,
    bulkBroadcastEnabled: true
  };
}

function isTruthyFlag(val: unknown): boolean {
  return val === true || val === 'true';
}

/**
 * Centralized fail-closed webhook worker suppression & auto-reply policy:
 *   - Enforces archiveOnly=true and suppressAutoReply=true from EITHER payload OR persisted WebhookInbox record.
 *   - Never permits eventId prefixes (SYNTHETIC_, TEST_, INTEGRATION_, etc.) to bypass safeguards.
 *   - Requires explicit CHATMITRA_INBOUND_AUTO_REPLY_ENABLED === 'true',
 *     WHATSAPP_INBOUND_AI_REPLY_ENABLED === 'true', and
 *     AISENSY_INBOUND_WEBHOOK_ENABLED === 'true'.
 *   - Any absent or non-'true' value fails closed and blocks inbound automation.
 */
export function evaluateWebhookReplyPolicy(
  input: WebhookReplyPolicyInput
): WebhookReplyPolicyResult {
  const env = input.env || process.env;
  const archiveOnly =
    isTruthyFlag(input.payload?.archiveOnly) ||
    isTruthyFlag(input.payload?.data?.archiveOnly) ||
    isTruthyFlag(input.inboxRecord?.archiveOnly) ||
    input.inboxRecord?.status === 'ARCHIVED_HISTORICAL';

  const suppressAutoReply =
    isTruthyFlag(input.payload?.suppressAutoReply) ||
    isTruthyFlag(input.payload?.data?.suppressAutoReply) ||
    isTruthyFlag(input.inboxRecord?.suppressAutoReply);

  const chatmitraAutoReplyEnabled = env.CHATMITRA_INBOUND_AUTO_REPLY_ENABLED === 'true';
  const whatsappInboundAiReplyEnabled = env.WHATSAPP_INBOUND_AI_REPLY_ENABLED === 'true';
  const aisensyInboundWebhookEnabled = env.AISENSY_INBOUND_WEBHOOK_ENABLED === 'true';

  // Determine provider context if specified or inferred from eventId/inboxRecord
  const rawProvider = String(
    input.provider ||
    input.inboxRecord?.provider ||
    input.payload?.provider ||
    input.payload?.data?.provider ||
    input.eventId ||
    ''
  ).toLowerCase();

  const isChatMitra = rawProvider.includes('chatmitra') || rawProvider.includes('chatmantra') || rawProvider.startsWith('cm-');
  const isAiSensy = rawProvider.includes('aisensy');
  const isMeta = rawProvider.includes('meta');

  if (archiveOnly) {
    return {
      archiveOnly: true,
      suppressAutoReply,
      autoReplyFlagEnabled: false,
      chatmitraAutoReplyEnabled,
      whatsappInboundAiReplyEnabled,
      aisensyInboundWebhookEnabled,
      canSendAnyProviderMessage: false,
      canTriggerAutoReply: false,
      suppressionReason: 'ARCHIVE_ONLY'
    };
  }

  if (suppressAutoReply) {
    return {
      archiveOnly: false,
      suppressAutoReply: true,
      autoReplyFlagEnabled: false,
      chatmitraAutoReplyEnabled,
      whatsappInboundAiReplyEnabled,
      aisensyInboundWebhookEnabled,
      canSendAnyProviderMessage: false,
      canTriggerAutoReply: false,
      suppressionReason: 'SUPPRESS_AUTO_REPLY'
    };
  }

  // Global requirement for all inbound AI WhatsApp replies
  if (!whatsappInboundAiReplyEnabled) {
    return {
      archiveOnly: false,
      suppressAutoReply: false,
      autoReplyFlagEnabled: false,
      chatmitraAutoReplyEnabled,
      whatsappInboundAiReplyEnabled: false,
      aisensyInboundWebhookEnabled,
      canSendAnyProviderMessage: true,
      canTriggerAutoReply: false,
      suppressionReason: 'WHATSAPP_AI_REPLY_DISABLED'
    };
  }

  // Provider-specific evaluation:
  // ChatMitra inbound auto-reply requires CHATMITRA_INBOUND_AUTO_REPLY_ENABLED === 'true'
  if (isChatMitra) {
    if (!chatmitraAutoReplyEnabled) {
      return {
        archiveOnly: false,
        suppressAutoReply: false,
        autoReplyFlagEnabled: false,
        chatmitraAutoReplyEnabled: false,
        whatsappInboundAiReplyEnabled: true,
        aisensyInboundWebhookEnabled,
        canSendAnyProviderMessage: true,
        canTriggerAutoReply: false,
        suppressionReason: 'AUTO_REPLY_DISABLED'
      };
    }
    return {
      archiveOnly: false,
      suppressAutoReply: false,
      autoReplyFlagEnabled: true,
      chatmitraAutoReplyEnabled: true,
      whatsappInboundAiReplyEnabled: true,
      aisensyInboundWebhookEnabled,
      canSendAnyProviderMessage: true,
      canTriggerAutoReply: true,
      suppressionReason: 'ALLOWED'
    };
  }

  // AiSensy or Meta inbound automation requires AISENSY_INBOUND_WEBHOOK_ENABLED === 'true'
  if (isAiSensy || isMeta) {
    if (!aisensyInboundWebhookEnabled) {
      return {
        archiveOnly: false,
        suppressAutoReply: false,
        autoReplyFlagEnabled: false,
        chatmitraAutoReplyEnabled,
        whatsappInboundAiReplyEnabled: true,
        aisensyInboundWebhookEnabled: false,
        canSendAnyProviderMessage: true,
        canTriggerAutoReply: false,
        suppressionReason: 'AISENSY_INBOUND_DISABLED'
      };
    }
    return {
      archiveOnly: false,
      suppressAutoReply: false,
      autoReplyFlagEnabled: true,
      chatmitraAutoReplyEnabled,
      whatsappInboundAiReplyEnabled: true,
      aisensyInboundWebhookEnabled: true,
      canSendAnyProviderMessage: true,
      canTriggerAutoReply: true,
      suppressionReason: 'ALLOWED'
    };
  }

  // Generic / unspecified provider context: check both flags
  if (!chatmitraAutoReplyEnabled) {
    return {
      archiveOnly: false,
      suppressAutoReply: false,
      autoReplyFlagEnabled: false,
      chatmitraAutoReplyEnabled,
      whatsappInboundAiReplyEnabled: true,
      aisensyInboundWebhookEnabled,
      canSendAnyProviderMessage: true,
      canTriggerAutoReply: false,
      suppressionReason: 'AUTO_REPLY_DISABLED'
    };
  }

  if (!aisensyInboundWebhookEnabled) {
    return {
      archiveOnly: false,
      suppressAutoReply: false,
      autoReplyFlagEnabled: false,
      chatmitraAutoReplyEnabled: true,
      whatsappInboundAiReplyEnabled: true,
      aisensyInboundWebhookEnabled,
      canSendAnyProviderMessage: true,
      canTriggerAutoReply: false,
      suppressionReason: 'AISENSY_INBOUND_DISABLED'
    };
  }

  return {
    archiveOnly: false,
    suppressAutoReply: false,
    autoReplyFlagEnabled: true,
    chatmitraAutoReplyEnabled: true,
    whatsappInboundAiReplyEnabled: true,
    aisensyInboundWebhookEnabled: true,
    canSendAnyProviderMessage: true,
    canTriggerAutoReply: true,
    suppressionReason: 'ALLOWED'
  };
}

/**
 * Centralized cross-collection opt-out & consent suppression check.
 * Rejects outbound messaging or calling if Lead is opted-out / consent denied / withdrawn
 * or if Contact has optedIn === false.
 */
export function isLeadOrContactOptedOut(lead?: any, contact?: any): boolean {
  return Boolean(
    lead?.isOptedOut === true ||
    lead?.status === 'OPTED_OUT' ||
    lead?.consentStatus === 'DENIED' ||
    lead?.consentStatus === 'WITHDRAWN' ||
    contact?.optedIn === false
  );
}
