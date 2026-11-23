/**
 * TASK 5H.33 — SHARED MESSAGING, PROVIDER IDENTITY & PERSISTENCE CONTRACT
 *
 * Single source of truth for:
 * - Supported messaging providers and strict fail-closed alias normalization (R-07 / H-01)
 * - Provider message ID validation prohibiting fabricated timestamp IDs (D-02)
 * - Supported worker event types and typed persistence result states (D-03 / Section 14)
 * - Shared typed interfaces separating provider acceptance from CRM persistence
 */

import { createValidationError } from './google-sheets/sheet-error-handler';
import type { CustomerRow, LeadRow, MessageEventRow } from './google-sheets/sheet-schema';

export const CANONICAL_PROVIDER_KEYS = ['META', 'CHATMITRA', 'AISENSY', 'OMNIDM', 'MOCK'] as const;
export type CanonicalProviderKey = (typeof CANONICAL_PROVIDER_KEYS)[number];

export const CANONICAL_PROVIDER_LABELS: Record<CanonicalProviderKey, string> = {
  META: 'Meta',
  CHATMITRA: 'ChatMitra',
  AISENSY: 'AiSensy',
  OMNIDM: 'OmniDM',
  MOCK: 'MockProvider'
};

const SUPPORTED_PROVIDER_ALIASES: Record<string, CanonicalProviderKey> = {
  meta: 'META',
  metacloud: 'META',
  whatsapp: 'META',
  waba: 'META',
  metawaba: 'META',
  chatmitra: 'CHATMITRA',
  chatmantra: 'CHATMITRA',
  cm: 'CHATMITRA',
  chatmitralive: 'CHATMITRA',
  chatmitramock: 'CHATMITRA',
  chatmitrasafetyclamp: 'CHATMITRA',
  aisensy: 'AISENSY',
  omnidm: 'OMNIDM',
  omnidim: 'OMNIDM',
  omnidimension: 'OMNIDM',
  mock: 'MOCK',
  mockprovider: 'MOCK'
};

export interface NormalizedProviderIdentity {
  key: CanonicalProviderKey;
  canonicalName: string;
  rawInput: string;
}

/**
 * Strictly normalizes ONLY explicitly supported provider aliases into an unambiguous
 * uppercase alphanumeric token (zero underscores).
 *
 * Fails closed (`GOOGLE_SHEETS_VALIDATION_FAILED`, HTTP 400) on missing, empty,
 * or unrecognized provider values. Never defaults silently to ChatMitra.
 */
export function normalizeSupportedProvider(provider?: string | null): NormalizedProviderIdentity {
  if (typeof provider !== 'string') {
    throw createValidationError('Explicit supported messaging provider is required.');
  }
  const trimmed = provider.trim();
  if (!trimmed) {
    throw createValidationError('Provider cannot be empty.');
  }
  const compact = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = SUPPORTED_PROVIDER_ALIASES[compact];
  if (!key) {
    throw createValidationError(
      `Unsupported messaging provider "${trimmed.slice(0, 48)}". Supported providers: Meta, ChatMitra, AiSensy, OmniDM, MockProvider.`
    );
  }
  return {
    key,
    canonicalName: CANONICAL_PROVIDER_LABELS[key],
    rawInput: trimmed
  };
}

export function tryNormalizeSupportedProvider(provider?: string | null): NormalizedProviderIdentity | null {
  try {
    return normalizeSupportedProvider(provider);
  } catch {
    return null;
  }
}

export const SUPPORTED_WORKER_EVENT_TYPES = ['INBOUND_MESSAGE', 'STATUS_UPDATE'] as const;
export type SupportedWorkerEventType = (typeof SUPPORTED_WORKER_EVENT_TYPES)[number];

export function isSupportedWorkerEventType(eventType: unknown): eventType is SupportedWorkerEventType {
  return (
    typeof eventType === 'string' &&
    (SUPPORTED_WORKER_EVENT_TYPES as readonly string[]).includes(eventType.trim())
  );
}

/**
 * Explicit typed persistence and processing states shared across webhooks,
 * workers, provider adapters, and reconciliation runners (Task 5H.33 Section 7 & 14).
 *
 * Provider acceptance and CRM persistence are tracked as distinct facts and are
 * never collapsed into a single generic boolean.
 */
export const PERSISTENCE_STATES = [
  'PERSISTED',
  'DUPLICATE_ALREADY_PERSISTED',
  'PENDING_CUSTOMER_IDENTITY',
  'PERSISTENCE_FAILED',
  'PROVIDER_REJECTED',
  'UNKNOWN_PROVIDER_OUTCOME',
  'UNSUPPORTED_EVENT',
  'IGNORED_MEDIA',
  'CONSENT_DENIED',
  'OPTED_OUT_SUPPRESSED',
  'ARCHIVED_HISTORICAL'
] as const;

export type PersistenceState = (typeof PERSISTENCE_STATES)[number];

export type ProviderDispatchOutcome =
  | 'PROVIDER_ACCEPTED'
  | 'PROVIDER_REJECTED'
  | 'UNKNOWN_PROVIDER_OUTCOME'
  | 'BLOCKED_BY_SAFEGUARD'
  | 'MOCK_ACCEPTED';

export interface ProviderMessageIdValidationResult {
  valid: boolean;
  value?: string;
  reason?:
    | 'MISSING_OR_NON_STRING'
    | 'EMPTY_ID'
    | 'FORMULA_PREFIX_BLOCKED'
    | 'INVALID_LENGTH'
    | 'INVALID_FORMAT'
    | 'SENTINEL_PLACEHOLDER'
    | 'FABRICATED_TIMESTAMP_ID';
}

const SENTINEL_MESSAGE_IDS = new Set(['null', 'undefined', 'nan', 'unknown', 'none', 'true', 'false']);
const FABRICATED_TIMESTAMP_ID_REGEX = /^(?:meta|aisensy|omnidim_wa|cm|cm_inbound|inbound)[_-]\d{10,}(?:_[A-Za-z0-9]+)?$/i;
const FORMULA_TRIGGER_REGEX = /^[=+\-@\t\r]/;
const VALID_PROVIDER_MESSAGE_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9._:/+=-]{2,255}$/;

/**
 * Validates a real provider-returned message identifier (D-02).
 * Rejects empty values, malformed tokens, formula prefixes, sentinel placeholders,
 * and fabricated timestamp substitutes (e.g. `meta_1795216644632`).
 */
export function validateProviderMessageId(
  rawId: unknown,
  _provider?: string
): ProviderMessageIdValidationResult {
  if (typeof rawId !== 'string') {
    return { valid: false, reason: 'MISSING_OR_NON_STRING' };
  }
  const trimmed = rawId.trim();
  if (!trimmed) {
    return { valid: false, reason: 'EMPTY_ID' };
  }
  if (FORMULA_TRIGGER_REGEX.test(trimmed)) {
    return { valid: false, reason: 'FORMULA_PREFIX_BLOCKED' };
  }
  if (trimmed.length < 3 || trimmed.length > 256) {
    return { valid: false, reason: 'INVALID_LENGTH' };
  }
  if (SENTINEL_MESSAGE_IDS.has(trimmed.toLowerCase())) {
    return { valid: false, reason: 'SENTINEL_PLACEHOLDER' };
  }
  if (FABRICATED_TIMESTAMP_ID_REGEX.test(trimmed)) {
    return { valid: false, reason: 'FABRICATED_TIMESTAMP_ID' };
  }
  if (!VALID_PROVIDER_MESSAGE_ID_REGEX.test(trimmed)) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }
  return { valid: true, value: trimmed };
}

export const KNOWN_TEXT_MESSAGE_TYPES = new Set(['text', 'button', 'interactive']);
export const KNOWN_MEDIA_MESSAGE_TYPES = new Set([
  'document',
  'image',
  'audio',
  'video',
  'sticker',
  'voice',
  'file',
  'media',
  'attachment',
  'location',
  'contacts',
  'unsupported_media'
]);

const MEDIA_PAYLOAD_OBJECT_FIELDS = [
  'sticker',
  'image',
  'audio',
  'video',
  'document',
  'voice',
  'location',
  'contacts',
  'media',
  'attachment',
  'attachments',
  'file'
] as const;

const MEDIA_URL_FIELDS = ['mediaUrl', 'media_url', 'fileUrl', 'file_url', 'attachmentUrl', 'attachment_url'] as const;

export interface InboundMessageTypeResolution {
  valid: boolean;
  messageType: string;
  isMedia: boolean;
  error?: string;
}

/**
 * Classifies an inbound provider message payload into an explicit text or media/unsupported type.
 *
 * Task 5H.35 F34-04 / F34-03 rules:
 * - Never converts stickers, media, attachments, or unknown non-text types into 'text'.
 * - Rejects malformed media type values or malformed media attachment structures fail-closed.
 * - Never downloads, stores, or forwards customer media URLs/IDs.
 */
export function resolveInboundMessageType(body: any): InboundMessageTypeResolution {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, messageType: 'unsupported_media', isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
  }

  const nestedMsg =
    Array.isArray(body.messages) && body.messages.length > 0 && body.messages[0] && typeof body.messages[0] === 'object'
      ? body.messages[0]
      : body.message && typeof body.message === 'object' && !Array.isArray(body.message)
        ? body.message
        : null;

  const rawTypeValue =
    body.type !== undefined
      ? body.type
      : body.messageType !== undefined
        ? body.messageType
        : nestedMsg?.type;

  if (rawTypeValue !== undefined && rawTypeValue !== null) {
    if (typeof rawTypeValue !== 'string') {
      return { valid: false, messageType: 'unsupported_media', isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
    }
    const trimmedType = rawTypeValue.trim();
    if (!trimmedType || FORMULA_TRIGGER_REGEX.test(trimmedType) || trimmedType.length > 48 || !/^[A-Za-z0-9_-]+$/.test(trimmedType)) {
      return { valid: false, messageType: 'unsupported_media', isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
    }
    const lowerType = trimmedType.toLowerCase();

    if (KNOWN_TEXT_MESSAGE_TYPES.has(lowerType)) {
      // Never allow an attachment or media URL to bypass media policy by declaring type: 'text'
      const presentMediaField = MEDIA_PAYLOAD_OBJECT_FIELDS.find(
        (k) => body[k] !== undefined || nestedMsg?.[k] !== undefined
      );
      const presentMediaUrl = MEDIA_URL_FIELDS.find(
        (k) => body[k] !== undefined || nestedMsg?.[k] !== undefined
      );
      if (!presentMediaField && !presentMediaUrl) {
        return { valid: true, messageType: lowerType, isMedia: false };
      }
      if (presentMediaField) {
        const val = body[presentMediaField] !== undefined ? body[presentMediaField] : nestedMsg?.[presentMediaField];
        if (
          val === null ||
          typeof val === 'number' ||
          typeof val === 'boolean' ||
          (typeof val === 'string' && !val.trim()) ||
          (Array.isArray(val) && val.length === 0)
        ) {
          return { valid: false, messageType: presentMediaField === 'attachments' ? 'attachment' : presentMediaField, isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
        }
        return {
          valid: true,
          messageType: presentMediaField === 'attachments' ? 'attachment' : presentMediaField,
          isMedia: true
        };
      }
      if (presentMediaUrl) {
        const val = body[presentMediaUrl] !== undefined ? body[presentMediaUrl] : nestedMsg?.[presentMediaUrl];
        if (typeof val !== 'string' || !val.trim()) {
          return { valid: false, messageType: 'media', isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
        }
        return { valid: true, messageType: 'media', isMedia: true };
      }
    }

    // Validate structured media payload field when present for the declared media type
    const specificMediaField = body[lowerType] !== undefined ? body[lowerType] : nestedMsg?.[lowerType];
    if (specificMediaField !== undefined) {
      if (
        specificMediaField === null ||
        typeof specificMediaField === 'number' ||
        typeof specificMediaField === 'boolean' ||
        (typeof specificMediaField === 'string' && !specificMediaField.trim()) ||
        (typeof specificMediaField === 'object' && !Array.isArray(specificMediaField) && Object.keys(specificMediaField).length === 0 && lowerType !== 'sticker')
      ) {
        return { valid: false, messageType: lowerType, isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
      }
    }
    // Validate generic media/attachment fields if supplied with invalid primitive values
    for (const field of ['media', 'attachment', 'attachments'] as const) {
      const val = body[field] !== undefined ? body[field] : nestedMsg?.[field];
      if (val !== undefined) {
        if (val === null || typeof val === 'number' || typeof val === 'boolean' || (typeof val === 'string' && !val.trim())) {
          return { valid: false, messageType: lowerType, isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
        }
        if (Array.isArray(val) && val.length === 0) {
          return { valid: false, messageType: lowerType, isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
        }
      }
    }
    for (const urlField of MEDIA_URL_FIELDS) {
      const val = body[urlField] !== undefined ? body[urlField] : nestedMsg?.[urlField];
      if (val !== undefined && (typeof val !== 'string' || !val.trim())) {
        return { valid: false, messageType: lowerType, isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
      }
    }

    if (KNOWN_MEDIA_MESSAGE_TYPES.has(lowerType)) {
      return { valid: true, messageType: lowerType, isMedia: true };
    }

    // Any unknown non-text type MUST NOT be converted into 'text' -> mark as unsupported_media
    return { valid: true, messageType: 'unsupported_media', isMedia: true };
  }

  // No explicit type field: inspect whether media/attachment fields are present
  for (const field of MEDIA_PAYLOAD_OBJECT_FIELDS) {
    const val = body[field] !== undefined ? body[field] : nestedMsg?.[field];
    if (val !== undefined) {
      if (val === null || typeof val === 'number' || typeof val === 'boolean' || (typeof val === 'string' && !val.trim())) {
        return { valid: false, messageType: field === 'attachments' ? 'attachment' : field, isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
      }
      if (Array.isArray(val) && val.length === 0) {
        return { valid: false, messageType: 'attachment', isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
      }
      const mapped = field === 'attachments' ? 'attachment' : field;
      return { valid: true, messageType: mapped, isMedia: true };
    }
  }

  for (const urlField of MEDIA_URL_FIELDS) {
    const val = body[urlField] !== undefined ? body[urlField] : nestedMsg?.[urlField];
    if (val !== undefined) {
      if (typeof val !== 'string' || !val.trim()) {
        return { valid: false, messageType: 'media', isMedia: true, error: 'INVALID_MEDIA_PAYLOAD' };
      }
      return { valid: true, messageType: 'media', isMedia: true };
    }
  }

  return { valid: true, messageType: 'text', isMedia: false };
}

export interface CorrelationContext {
  correlationId: string;
  eventId: string;
  provider: CanonicalProviderKey;
  idempotencyKey?: string;
}

export interface VerifiedCustomerLeadIdentity {
  verified: boolean;
  customerId?: string;
  leadId?: string;
  leadExplicitlyVerified?: boolean;
  customer?: CustomerRow | null;
  lead?: LeadRow | null;
  source?: 'verified_explicit_customer' | 'verified_lead_owner' | 'verified_customer_mobile';
  rejectedCandidateCustomerId: boolean;
  rejectedCandidateLeadId: boolean;
  rejectionReason?:
    | 'MISSING_OR_INVALID_PHONE'
    | 'CUSTOMER_ID_NOT_FOUND'
    | 'CUSTOMER_MOBILE_MISMATCH'
    | 'LEAD_NOT_FOUND'
    | 'LEAD_FOUND_CUSTOMER_NOT_FOUND'
    | 'LEAD_OWNERSHIP_MISMATCH'
    | 'CUSTOMER_NOT_FOUND';
}

export interface ConsentEligibilityResult {
  eligibleForAiReply: boolean;
  isOptedOut: boolean;
  consentStatus: 'GRANTED' | 'DENIED' | 'WITHDRAWN' | 'PENDING' | 'UNKNOWN';
  reason: 'ELIGIBLE' | 'OPTED_OUT' | 'CONSENT_NOT_GRANTED';
}

export interface NormalizedInboundWebhookEvent {
  eventId: string;
  eventType: SupportedWorkerEventType;
  provider: string;
  correlationId: string;
  data: {
    msgId?: string;
    statusStr?: string;
    fromPhone?: string;
    profileName?: string;
    customerId?: string;
    leadId?: string;
    message?: Record<string, unknown>;
    statusObj?: Record<string, unknown>;
    loanClassification?: Record<string, unknown>;
  };
}

export interface OutboundMessageRequest {
  destination: string;
  userName: string;
  templateName?: string;
  templateParams?: string[];
  tags?: string[];
  text?: string;
  customerId?: string;
  leadId?: string | { toString(): string };
  contactId?: string | { toString(): string };
  broadcastId?: string | { toString(): string };
  idempotencyKey?: string;
  correlationId?: string;
}

export interface ProviderSendContractResult {
  success: boolean;
  providerAccepted?: boolean;
  providerOutcome?: ProviderDispatchOutcome;
  persistenceState?: PersistenceState;
  messageId?: string;
  provider?: string;
  rawResponse?: any;
  error?: string;
  status?: string;
  httpStatus?: number;
  retryable?: boolean;
  reconciliationRequired?: boolean;
  persisted?: boolean;
  persistenceFailed?: boolean;
  persistenceErrorCode?: string;
  identityPending?: boolean;
  customerResolved?: boolean;
  reconciled?: boolean;
  eventId?: string;
  customerId?: string;
  duplicate?: boolean;
}

export interface MessagePersistenceContractResult {
  persisted: boolean;
  persistenceState: PersistenceState;
  customerResolved: boolean;
  identityPending: boolean;
  reconciled: boolean;
  duplicate: boolean;
  eventId: string;
  customerId: string;
  deliveryStatus: string;
  record: MessageEventRow;
  resolutionReason?: string;
}

export interface WorkerProcessingContractResult {
  success: boolean;
  persisted: boolean;
  persistenceState: PersistenceState;
  eventId?: string;
  correlationId?: string;
  provider?: string;
  eventType?: string;
  customerId?: string;
  leadId?: string;
  messageEventId?: string;
  deliveryStatus?: string;
  outboundDispatched?: boolean;
  outboundEventId?: string;
  outboundMessageId?: string;
  bypassed?: boolean;
  duplicate?: boolean;
  identityPending?: boolean;
  error?: string;
  message?: string;
}

export type ReconciliationRecordStatus = 'PENDING' | 'RETRYING' | 'RECONCILED' | 'EXHAUSTED';

export interface IdentityReconciliationEntry {
  configKey: string;
  eventIdHash: string;
  provider: CanonicalProviderKey;
  phoneHash: string;
  eventType: 'STATUS_UPDATE' | 'INBOUND_MESSAGE' | 'OUTBOUND_SEND';
  webhookEventId?: string;
  correlationId?: string;
  firstSeenSec: number;
  attempts: number;
  nextRetrySec: number;
  status: ReconciliationRecordStatus;
  lastErrorCode: string;
}

export interface IdentityReconciliationRunResult {
  scanned: number;
  reconciled: number;
  retrying: number;
  exhausted: number;
  skippedNotDue: number;
  skippedInFlight: number;
  malformedSkipped?: number;
  errors: number;
  outboundResent: number;
}

export interface ReconciliationDiagnosticsSummary {
  totalTracked: number;
  pending: number;
  retrying: number;
  reconciled: number;
  exhausted: number;
  malformed?: number;
  activeLeases?: number;
  unresolvedMessageEvents: number;
  generatedAt: string;
}
