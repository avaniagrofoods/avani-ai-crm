/**
 * TASK 5H.4 / TASK 5H.31 — SHEET 6: MESSAGE_EVENTS REPOSITORY
 * Columns: event_id, customer_id, provider, message_type, direction, delivery_status, provider_message_id, event_timestamp
 * Stores ONLY essential message operational metadata. Prohibits full chat transcripts, media, or attachment contents.
 *
 * Task 5H.31 Hardening:
 * - R-07: Deterministic provider-scoped canonical identity `MSG_<PROVIDER>_<PROVIDER_MESSAGE_ID>`
 *   with strict same-provider legacy compatibility (`MSG_<id>` only when provider matches).
 * - R-05: Prohibits shared `'UNKNOWN'` customer placeholder; supports per-message scoped
 *   `UNRESOLVED_<PROVIDER>_<hash>` markers for safe retry reconciliation.
 */

import crypto from 'node:crypto';
import { BaseSheetsRepository } from './sheets-repository';
import { MessageEventRow } from './sheet-schema';
import { sanitizeCellForSheets, validateIsoTimestamp } from './sheet-validation';
import { createValidationError } from './sheet-error-handler';
import {
  normalizeSupportedProvider,
  tryNormalizeSupportedProvider
} from '../messaging-contract';

export const UNRESOLVED_CUSTOMER_PREFIX = 'UNRESOLVED_';

/**
 * Normalizes ONLY explicitly supported messaging provider aliases into an unambiguous
 * uppercase alphanumeric token (zero underscores) so `MSG_<PROVIDER>_<PROVIDER_MESSAGE_ID>`
 * cannot collide or concatenate ambiguously. Fails closed on empty or unknown providers (R-07 / H-01).
 */
export function normalizeMessageProviderKey(provider?: string | null): string {
  return normalizeSupportedProvider(provider).key;
}

function tryNormalizeProviderKey(provider?: string | null): string | null {
  return tryNormalizeSupportedProvider(provider)?.key ?? null;
}

/**
 * Builds a deterministic, provider-scoped, formula-safe canonical event_id:
 *   `MSG_<PROVIDER>_<SAFE_PROVIDER_MESSAGE_ID>`
 * Preserves readable safe IDs (e.g., `MSG_META_wamid.HBgM...`) and deterministically
 * hashes unsafe/oversized IDs to prevent unsafe characters or ambiguous concatenation.
 */
export function buildCanonicalMessageEventId(provider: string, providerMessageId: string): string {
  const provKey = normalizeMessageProviderKey(provider);
  const rawId = String(providerMessageId || '').trim();
  if (!rawId) {
    throw createValidationError('provider_message_id is required to build canonical message event_id.');
  }

  let safeSuffix: string;
  if (/^[A-Za-z0-9._:-]{1,180}$/.test(rawId)) {
    safeSuffix = rawId;
  } else {
    const cleanedPrefix = rawId
      .replace(/[^A-Za-z0-9._:-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    const digest = crypto.createHash('sha256').update(rawId, 'utf8').digest('hex').slice(0, 16);
    safeSuffix = cleanedPrefix ? `${cleanedPrefix}_${digest}` : `H_${digest}`;
  }

  return `MSG_${provKey}_${safeSuffix}`;
}

/**
 * Returns true if a customer_id is missing, literal `'UNKNOWN'`, or a scoped unresolved marker.
 */
export function isUnresolvedCustomerId(customerId?: string | null): boolean {
  const clean = String(customerId || '').trim().toUpperCase();
  return !clean || clean === 'UNKNOWN' || clean.startsWith(UNRESOLVED_CUSTOMER_PREFIX);
}

/**
 * Builds a deterministic, per-message scoped unresolved customer marker:
 *   `UNRESOLVED_<PROVIDER>_<16-char sha256>`
 * Prevents unrelated unresolved messages from sharing a global `'UNKNOWN'` placeholder
 * while remaining idempotent across retries of the same message.
 */
export function buildScopedUnresolvedCustomerId(
  provider: string,
  providerMessageId: string,
  correlationId?: string
): string {
  const provKey = normalizeMessageProviderKey(provider);
  const canonicalEventKey = buildCanonicalMessageEventId(provider, providerMessageId);
  const hashInput = `${canonicalEventKey}|${String(correlationId || '').trim()}`;
  const digest = crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex').slice(0, 16);
  return `${UNRESOLVED_CUSTOMER_PREFIX}${provKey}_${digest}`;
}

export class MessageEventRepository extends BaseSheetsRepository<MessageEventRow> {
  private readonly eventWriteChains = new Map<string, Promise<void>>();

  constructor() {
    super('MESSAGE_EVENTS');
  }

  private async withEventSerializeLock<T>(eventId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.eventWriteChains.get(eventId) || Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = prev.then(() => gate).catch(() => gate);
    this.eventWriteChains.set(eventId, chained);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.eventWriteChains.get(eventId) === chained) {
        this.eventWriteChains.delete(eventId);
      }
    }
  }

  public async findAllByProviderMessageId(providerMsgId: string): Promise<MessageEventRow[]> {
    const trimmed = String(providerMsgId || '').trim();
    if (!trimmed) return [];
    const all = await this.findAll();
    return all.filter((m) => m.provider_message_id === trimmed || m.event_id === `MSG_${trimmed}`);
  }

  /**
   * Provider-scoped message event lookup (Task 5H.31 R-07 + Task 5H.33 H-01).
   *
   * Requires explicit, supported `provider` context on every call (unsafe unscoped lookup removed).
   * Deterministic 3-phase lookup:
   *   1. Canonical exact match (`event_id === MSG_<PROVIDER>_<ID>`) prioritized first; verifies provider matches.
   *   2. Verified same-provider `provider_message_id === id` match; fails closed if ambiguous (>1 row).
   *   3. Verified same-provider legacy `MSG_<id>` compatibility ONLY when row.provider explicitly matches;
   *      rejects blank/unknown/conflicting legacy rows and fails closed on ambiguous legacy duplicates.
   */
  public async findByProviderMessageId(
    providerMsgId: string,
    provider: string
  ): Promise<MessageEventRow | null> {
    const trimmed = String(providerMsgId || '').trim();
    if (!trimmed) return null;

    // H-01 / R-07: Fail closed when provider is missing, empty, or unsupported
    const normalizedProvider = normalizeSupportedProvider(provider);
    const targetProvKey = normalizedProvider.key;
    const canonicalEventId = buildCanonicalMessageEventId(normalizedProvider.canonicalName, trimmed);

    const all = await this.findAll();

    // 1. Canonical provider-scoped exact match takes strict deterministic priority over legacy rows
    const canonicalMatches = all.filter((m) => m.event_id === canonicalEventId);
    if (canonicalMatches.length > 1) {
      throw createValidationError(
        `Ambiguous canonical message event_id "${canonicalEventId}" matched ${canonicalMatches.length} rows.`
      );
    }
    if (canonicalMatches.length === 1) {
      const row = canonicalMatches[0];
      if (tryNormalizeProviderKey(row.provider) !== targetProvKey) {
        throw createValidationError(
          `Canonical event_id "${canonicalEventId}" has mismatched or invalid provider "${row.provider}".`
        );
      }
      return row;
    }

    // 2. Verified same-provider match by provider_message_id
    const sameProviderMatches = all.filter(
      (m) => m.provider_message_id === trimmed && tryNormalizeProviderKey(m.provider) === targetProvKey
    );
    if (sameProviderMatches.length > 1) {
      throw createValidationError(
        `Ambiguous provider_message_id "${trimmed}" matched ${sameProviderMatches.length} rows for provider "${normalizedProvider.canonicalName}".`
      );
    }
    if (sameProviderMatches.length === 1) {
      return sameProviderMatches[0];
    }

    // 3. Deterministic same-provider legacy compatibility (`MSG_<id>` ONLY when row.provider is verified)
    const legacyEventId = `MSG_${trimmed}`;
    const legacyRows = all.filter((m) => m.event_id === legacyEventId);
    const verifiedLegacy = legacyRows.filter(
      (m) =>
        tryNormalizeProviderKey(m.provider) === targetProvKey &&
        (!m.provider_message_id || m.provider_message_id === trimmed)
    );
    if (verifiedLegacy.length > 1) {
      throw createValidationError(
        `Ambiguous legacy message event_id "${legacyEventId}" matched ${verifiedLegacy.length} rows for provider "${normalizedProvider.canonicalName}".`
      );
    }
    if (verifiedLegacy.length === 1) {
      if (legacyRows.length > 1) {
        throw createValidationError(
          `Ambiguous legacy message event_id "${legacyEventId}" has ${legacyRows.length} conflicting rows.`
        );
      }
      return verifiedLegacy[0];
    }

    return null;
  }

  public async findByCustomerId(customerId: string): Promise<MessageEventRow[]> {
    const all = await this.findAll();
    return all.filter((m) => m.customer_id === customerId);
  }

  public async recordMessageEvent(params: {
    event_id?: string;
    customer_id: string;
    provider: string;
    message_type?: string;
    direction: 'inbound' | 'outbound';
    delivery_status: string;
    provider_message_id: string;
    event_timestamp?: string | Date;
  }): Promise<{ record: MessageEventRow; created: boolean }> {
    const provMsgId = sanitizeCellForSheets('provider_message_id', params.provider_message_id);
    if (!provMsgId) {
      throw createValidationError('provider_message_id is required to record a MESSAGE_EVENTS row.');
    }

    // H-01 / R-07: Reject missing, empty, or unknown provider fail-closed (zero silent 'ChatMitra' default)
    const normalizedProvider = normalizeSupportedProvider(params.provider);
    const providerVal = sanitizeCellForSheets('provider', normalizedProvider.canonicalName);

    const customerIdClean = sanitizeCellForSheets('customer_id', params.customer_id);
    if (!customerIdClean || customerIdClean.toUpperCase() === 'UNKNOWN') {
      throw createValidationError(
        'customer_id cannot be empty or shared placeholder "UNKNOWN"; supply a canonical customer_id or scoped UNRESOLVED_<PROVIDER>_<hash> marker.'
      );
    }

    const eventId = sanitizeCellForSheets(
      'event_id',
      params.event_id || buildCanonicalMessageEventId(providerVal, provMsgId)
    );
    const tsIso = validateIsoTimestamp(params.event_timestamp);

    const row: MessageEventRow = {
      event_id: eventId,
      customer_id: customerIdClean,
      provider: providerVal,
      message_type: sanitizeCellForSheets('message_type', params.message_type || 'TEXT'),
      direction: params.direction === 'inbound' ? 'inbound' : 'outbound',
      delivery_status: sanitizeCellForSheets('delivery_status', params.delivery_status || 'RECEIVED'),
      provider_message_id: provMsgId,
      event_timestamp: tsIso
    };

    // Task 5H.35 F34-01: Serialize per-eventId writes and enforce strict ownership immutability.
    // Once a MESSAGE_EVENTS row is bound to a verified canonical customer_id, neither a concurrent
    // write nor a subsequent call may reassign it to a different customer or downgrade it back to UNRESOLVED_*.
    return this.withEventSerializeLock(eventId, async () => {
      const existing = await this.findById(eventId);
      if (existing) {
        if (existing.provider && tryNormalizeProviderKey(existing.provider) !== normalizedProvider.key) {
          throw createValidationError(
            `Message event provider conflict: event "${eventId}" belongs to a different provider.`
          );
        }
        if (existing.customer_id && !isUnresolvedCustomerId(existing.customer_id)) {
          if (isUnresolvedCustomerId(customerIdClean)) {
            throw createValidationError(
              `Message event ownership violation: cannot downgrade resolved event "${eventId}" to an unresolved customer identity.`
            );
          }
          if (existing.customer_id !== customerIdClean) {
            throw createValidationError(
              `Message event ownership conflict: event "${eventId}" is already bound to another customer and cannot be reassigned.`
            );
          }
        }
      }
      return this.upsert(row);
    });
  }
}

export const messageEventRepository = new MessageEventRepository();
