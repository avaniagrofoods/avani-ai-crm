/**
 * BLOCKER 7 — READ-ONLY HISTORICAL `MSG_<id>` MIGRATION & ROLLBACK PLANNER
 *
 * Strictly dry-run, deterministic, pure snapshot analyzer for legacy unscoped
 * `MESSAGE_EVENTS` rows (`MSG_<providerMessageId>`) prior to Task 5H.31/5H.33
 * provider-scoped IDs (`MSG_META_<id>`, `MSG_CHATMITRA_<id>`).
 *
 * Safety Invariants:
 * - ZERO live Google Sheets reads or writes.
 * - ZERO mutation of input row arrays or objects.
 * - Produces a PII-free, reversible migration & rollback manifest containing ONLY
 *   event IDs, provider classifications, conflict reasons, and target IDs.
 */

import crypto from 'node:crypto';
import { MessageEventRow, WebhookEventRow } from './sheet-schema';
import { buildCanonicalMessageEventId, isUnresolvedCustomerId } from './message-event-repository';
import { normalizeSupportedProvider } from '../messaging-contract';

export const LEGACY_UNSCOPED_MESSAGE_ID_REGEX = /^MSG_(?!META_|CHATMITRA_)(.+)$/i;
export const CANONICAL_SCOPED_MESSAGE_ID_REGEX = /^MSG_(META|CHATMITRA)_[A-Za-z0-9._-]+$/;

export type LegacyMessageRowClassification =
  | 'ALREADY_CANONICAL'
  | 'MIGRATABLE_LEGACY'
  | 'DUPLICATE_OF_CANONICAL'
  | 'CROSS_PROVIDER_COLLISION'
  | 'MANUAL_REVIEW_REQUIRED';

export interface LegacyMessagePlanItem {
  currentEventId: string;
  proposedEventId: string | null;
  provider: string;
  normalizedProvider: 'Meta' | 'ChatMitra' | null;
  providerMessageId: string;
  classification: LegacyMessageRowClassification;
  reason: string;
  hasUnresolvedCustomer: boolean;
  webhookEvidenceCount: number;
}

export interface LegacyMessageRollbackEntry {
  targetCanonicalEventId: string;
  restoreLegacyEventId: string;
  provider: 'Meta' | 'ChatMitra';
  providerMessageId: string;
}

export interface LegacyMessageMigrationPlan {
  dryRunOnly: true;
  generatedAt: string;
  snapshotSha256: string;
  totalRowsScanned: number;
  counts: Record<LegacyMessageRowClassification, number>;
  safeToApplyAutomatically: boolean;
  plannedRemaps: LegacyMessagePlanItem[];
  duplicateMergeCandidates: LegacyMessagePlanItem[];
  crossProviderCollisions: LegacyMessagePlanItem[];
  manualReviewQueue: LegacyMessagePlanItem[];
  rollbackManifest: LegacyMessageRollbackEntry[];
}

function tryNormalizeProvider(raw?: string | null): 'Meta' | 'ChatMitra' | null {
  if (!raw || !String(raw).trim()) return null;
  try {
    const canon = normalizeSupportedProvider(raw).canonicalName;
    return canon === 'Meta' || canon === 'ChatMitra' ? canon : null;
  } catch {
    return null;
  }
}

function computeSnapshotSha256(rows: readonly MessageEventRow[]): string {
  const canonicalPayload = rows
    .map((r) => `${r.event_id}|${r.provider}|${r.provider_message_id}|${r.delivery_status}|${r.direction}`)
    .sort()
    .join('\n');
  return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}

/**
 * Analyzes an in-memory snapshot of `MESSAGE_EVENTS` (and optional `WEBHOOK_EVENTS`)
 * and builds a deterministic, PII-free, reversible migration plan.
 */
export function buildLegacyMessageMigrationPlan(
  messageRows: readonly MessageEventRow[],
  webhookRows: readonly WebhookEventRow[] = []
): LegacyMessageMigrationPlan {
  const rows = Array.isArray(messageRows) ? messageRows : [];
  const webhooks = Array.isArray(webhookRows) ? webhookRows : [];

  const counts: Record<LegacyMessageRowClassification, number> = {
    ALREADY_CANONICAL: 0,
    MIGRATABLE_LEGACY: 0,
    DUPLICATE_OF_CANONICAL: 0,
    CROSS_PROVIDER_COLLISION: 0,
    MANUAL_REVIEW_REQUIRED: 0
  };

  // Index existing canonical event_ids & provider_message_ids across providers
  const existingEventIds = new Set<string>();
  const providersByMessageId = new Map<string, Set<string>>();
  const countByLegacyEventId = new Map<string, number>();

  for (const row of rows) {
    const evId = String(row.event_id || '').trim();
    const pMsgId = String(row.provider_message_id || '').trim();
    const normProv = tryNormalizeProvider(row.provider);
    if (evId) {
      existingEventIds.add(evId);
      countByLegacyEventId.set(evId, (countByLegacyEventId.get(evId) || 0) + 1);
    }
    if (pMsgId && normProv) {
      const set = providersByMessageId.get(pMsgId) || new Set<string>();
      set.add(normProv);
      providersByMessageId.set(pMsgId, set);
    }
  }

  // Count matching webhook rows mentioning provider_message_id (read-only cross-reference)
  const countWebhookMatches = (providerMessageId: string): number => {
    if (!providerMessageId) return 0;
    let hits = 0;
    for (const wh of webhooks) {
      if (String(wh.event_id || '').includes(providerMessageId)) {
        hits += 1;
      }
    }
    return hits;
  };

  const plannedRemaps: LegacyMessagePlanItem[] = [];
  const duplicateMergeCandidates: LegacyMessagePlanItem[] = [];
  const crossProviderCollisions: LegacyMessagePlanItem[] = [];
  const manualReviewQueue: LegacyMessagePlanItem[] = [];
  const rollbackManifest: LegacyMessageRollbackEntry[] = [];
  const claimedTargetIds = new Set<string>();

  for (const row of rows) {
    const currentEventId = String(row.event_id || '').trim();
    const rawProvider = String(row.provider || '').trim();
    const normalizedProvider = tryNormalizeProvider(rawProvider);
    const providerMessageId = String(row.provider_message_id || '').trim();
    const hasUnresolvedCustomer = isUnresolvedCustomerId(row.customer_id);
    const webhookEvidenceCount = countWebhookMatches(providerMessageId);

    // 1. Check already-canonical provider-scoped ID
    const canonicalMatch = CANONICAL_SCOPED_MESSAGE_ID_REGEX.exec(currentEventId);
    if (canonicalMatch) {
      const prefixKey = canonicalMatch[1]; // META or CHATMITRA
      const expectedCanonicalProvider = prefixKey === 'META' ? 'Meta' : 'ChatMitra';
      if (normalizedProvider && normalizedProvider === expectedCanonicalProvider) {
        counts.ALREADY_CANONICAL += 1;
      } else {
        counts.MANUAL_REVIEW_REQUIRED += 1;
        manualReviewQueue.push({
          currentEventId,
          proposedEventId: null,
          provider: rawProvider || 'UNSPECIFIED',
          normalizedProvider,
          providerMessageId,
          classification: 'MANUAL_REVIEW_REQUIRED',
          reason: `Canonical event_id prefix (${prefixKey}) conflicts with provider column (${rawProvider || 'BLANK'}).`,
          hasUnresolvedCustomer,
          webhookEvidenceCount
        });
      }
      continue;
    }

    // 2. Non-canonical row must match legacy MSG_<id> shape, else manual review
    if (!LEGACY_UNSCOPED_MESSAGE_ID_REGEX.test(currentEventId)) {
      counts.MANUAL_REVIEW_REQUIRED += 1;
      manualReviewQueue.push({
        currentEventId,
        proposedEventId: null,
        provider: rawProvider || 'UNSPECIFIED',
        normalizedProvider,
        providerMessageId,
        classification: 'MANUAL_REVIEW_REQUIRED',
        reason: 'Event ID does not match canonical MSG_<PROVIDER>_<id> or legacy MSG_<id> format.',
        hasUnresolvedCustomer,
        webhookEvidenceCount
      });
      continue;
    }

    // 3. Validate provider & provider_message_id
    if (!normalizedProvider) {
      counts.MANUAL_REVIEW_REQUIRED += 1;
      manualReviewQueue.push({
        currentEventId,
        proposedEventId: null,
        provider: rawProvider || 'UNSPECIFIED',
        normalizedProvider: null,
        providerMessageId,
        classification: 'MANUAL_REVIEW_REQUIRED',
        reason: 'Blank or unrecognized provider prevents deterministic provider-scoped remapping.',
        hasUnresolvedCustomer,
        webhookEvidenceCount
      });
      continue;
    }

    if (!providerMessageId) {
      counts.MANUAL_REVIEW_REQUIRED += 1;
      manualReviewQueue.push({
        currentEventId,
        proposedEventId: null,
        provider: rawProvider,
        normalizedProvider,
        providerMessageId: '',
        classification: 'MANUAL_REVIEW_REQUIRED',
        reason: 'Missing provider_message_id on legacy row.',
        hasUnresolvedCustomer,
        webhookEvidenceCount
      });
      continue;
    }

    // 4. Check for cross-provider collision or duplicated legacy event_id
    const distinctProviders = providersByMessageId.get(providerMessageId);
    const duplicateLegacyCount = countByLegacyEventId.get(currentEventId) || 0;
    const proposedEventId = buildCanonicalMessageEventId(normalizedProvider, providerMessageId);

    if ((distinctProviders && distinctProviders.size > 1) || duplicateLegacyCount > 1) {
      counts.CROSS_PROVIDER_COLLISION += 1;
      crossProviderCollisions.push({
        currentEventId,
        proposedEventId,
        provider: rawProvider,
        normalizedProvider,
        providerMessageId,
        classification: 'CROSS_PROVIDER_COLLISION',
        reason:
          distinctProviders && distinctProviders.size > 1
            ? `provider_message_id "${providerMessageId}" appears under multiple providers (${Array.from(distinctProviders).sort().join(', ')}).`
            : `Legacy event_id "${currentEventId}" appears ${duplicateLegacyCount} times in snapshot.`,
        hasUnresolvedCustomer,
        webhookEvidenceCount
      });
      continue;
    }

    // 5. Check if canonical target already exists in snapshot (or was already claimed by another row)
    if (existingEventIds.has(proposedEventId) || claimedTargetIds.has(proposedEventId)) {
      counts.DUPLICATE_OF_CANONICAL += 1;
      duplicateMergeCandidates.push({
        currentEventId,
        proposedEventId,
        provider: rawProvider,
        normalizedProvider,
        providerMessageId,
        classification: 'DUPLICATE_OF_CANONICAL',
        reason: `Canonical row "${proposedEventId}" already exists; manual deduplication required instead of blind rename.`,
        hasUnresolvedCustomer,
        webhookEvidenceCount
      });
      continue;
    }

    // 6. Unresolved customer markers should be reconciled or reviewed before migration
    if (hasUnresolvedCustomer) {
      counts.MANUAL_REVIEW_REQUIRED += 1;
      manualReviewQueue.push({
        currentEventId,
        proposedEventId,
        provider: rawProvider,
        normalizedProvider,
        providerMessageId,
        classification: 'MANUAL_REVIEW_REQUIRED',
        reason: 'Row carries an UNRESOLVED_CUSTOMER marker; reconcile customer identity before migrating event_id.',
        hasUnresolvedCustomer: true,
        webhookEvidenceCount
      });
      continue;
    }

    // 7. Clean, deterministic, conflict-free legacy remap
    claimedTargetIds.add(proposedEventId);
    counts.MIGRATABLE_LEGACY += 1;
    plannedRemaps.push({
      currentEventId,
      proposedEventId,
      provider: rawProvider,
      normalizedProvider,
      providerMessageId,
      classification: 'MIGRATABLE_LEGACY',
      reason: 'Unambiguous legacy MSG_<id> row eligible for owner-approved backfill.',
      hasUnresolvedCustomer: false,
      webhookEvidenceCount
    });
    rollbackManifest.push({
      targetCanonicalEventId: proposedEventId,
      restoreLegacyEventId: currentEventId,
      provider: normalizedProvider,
      providerMessageId
    });
  }

  const safeToApplyAutomatically =
    crossProviderCollisions.length === 0 &&
    duplicateMergeCandidates.length === 0 &&
    manualReviewQueue.length === 0;

  return {
    dryRunOnly: true,
    generatedAt: new Date().toISOString(),
    snapshotSha256: computeSnapshotSha256(rows),
    totalRowsScanned: rows.length,
    counts,
    safeToApplyAutomatically,
    plannedRemaps,
    duplicateMergeCandidates,
    crossProviderCollisions,
    manualReviewQueue,
    rollbackManifest
  };
}
