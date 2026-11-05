/**
 * AVANI AI CRM — Canonical Message Status Module
 * 
 * Provides centralized message status definitions, lifecycle state machine,
 * and robust normalization at the provider integration boundary.
 * 
 * Complies with CP-23 requirements:
 * 1. Establishes one canonical message-status enum.
 * 2. Normalizes all provider status values (ChatMitra, Meta WABA, AiSensy).
 * 3. Maps inbound messages to exact schema-supported 'RECEIVED' value.
 * 4. Maps delivery receipts consistently to 'SENT', 'DELIVERED', 'READ', and 'FAILED'.
 * 5. Rejects or safely maps unknown values to 'UNKNOWN' without corrupting existing records.
 */

export const CANONICAL_MESSAGE_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'DISPATCHED',
  'PROVIDER_REQUESTED',
  'PROVIDER_ACCEPTED',
  'API_ACCEPTED',
  'WAITING_FOR_PROVIDER_STATUS',
  'PROVIDER_MESSAGE_ID_CREATED',
  'RECEIVED',
  'SENT',
  'DELIVERED',
  'READ',
  'CUSTOMER_REPLIED',
  'FAILED',
  'API_FAILED',
  'PROVIDER_FAILED',
  'BALANCE_BLOCKED',
  'INVALID_DESTINATION',
  'TEMPLATE_REJECTED',
  'WEBHOOK_TIMEOUT',
  'UNKNOWN'
] as const;

export type CanonicalMessageStatus = typeof CANONICAL_MESSAGE_STATUSES[number];

/**
 * Normalizes any raw provider status into a canonical uppercase status enum value.
 * 
 * @param rawStatus - Raw status string or object from provider callback/webhook
 * @param direction - Direction of the message ('inbound' or 'outbound')
 * @returns CanonicalMessageStatus - Normalized, schema-valid uppercase status
 */
export function normalizeMessageStatus(
  rawStatus: any,
  direction: 'inbound' | 'outbound' = 'outbound'
): CanonicalMessageStatus {
  // If direction is inbound, canonical status is always RECEIVED
  if (direction === 'inbound') {
    return 'RECEIVED';
  }

  if (!rawStatus || typeof rawStatus !== 'string') {
    return 'UNKNOWN';
  }

  const s = rawStatus.trim().toLowerCase();

  // Inbound synonyms
  if (s === 'received' || s === 'inbound' || s === 'incoming') {
    return 'RECEIVED';
  }

  // Delivery receipt mappings
  switch (s) {
    case 'sent':
      return 'SENT';
    case 'delivered':
      return 'DELIVERED';
    case 'read':
    case 'seen':
      return 'READ';
    case 'failed':
    case 'undelivered':
    case 'rejected':
    case 'error':
      return 'FAILED';
    case 'queued':
    case 'enqueued':
    case 'pending':
      return 'QUEUED';
    case 'processing':
      return 'PROCESSING';
    case 'dispatched':
      return 'DISPATCHED';
    case 'provider_accepted':
      return 'PROVIDER_ACCEPTED';
    case 'api_accepted':
      return 'API_ACCEPTED';
    case 'customer_replied':
      return 'CUSTOMER_REPLIED';
    case 'balance_blocked':
      return 'BALANCE_BLOCKED';
    case 'invalid_destination':
      return 'INVALID_DESTINATION';
    case 'template_rejected':
      return 'TEMPLATE_REJECTED';
    case 'webhook_timeout':
      return 'WEBHOOK_TIMEOUT';
    default: {
      const upper = rawStatus.trim().toUpperCase() as CanonicalMessageStatus;
      if (CANONICAL_MESSAGE_STATUSES.includes(upper)) {
        return upper;
      }
      return 'UNKNOWN';
    }
  }
}

export const STATUS_DELIVERY_RANK: Record<string, number> = {
  'QUEUED': 1,
  'PROCESSING': 2,
  'DISPATCHED': 3,
  'PROVIDER_REQUESTED': 4,
  'PROVIDER_ACCEPTED': 5,
  'API_ACCEPTED': 6,
  'SENT': 10,
  'DELIVERED': 20,
  'READ': 30,
  'CUSTOMER_REPLIED': 40,
  'FAILED': 50
};

/**
 * Determines whether a message can transition from currentStatus to newStatus,
 * preventing out-of-order delivery receipts from downgrading a higher state (e.g. READ -> DELIVERED).
 */
export function canTransitionStatus(currentStatus?: string, newStatus?: string): boolean {
  if (!currentStatus) return true;
  if (!newStatus) return false;

  const currentUpper = currentStatus.trim().toUpperCase();
  const newUpper = newStatus.trim().toUpperCase();

  if (currentUpper === newUpper) return true;

  const currentRank = STATUS_DELIVERY_RANK[currentUpper] || 0;
  const newRank = STATUS_DELIVERY_RANK[newUpper] || 0;

  // Prevent downgrades in the delivery receipt progression:
  // If already READ (30), do not downgrade to DELIVERED (20) or SENT (10)
  // If already DELIVERED (20), do not downgrade to SENT (10)
  // If already CUSTOMER_REPLIED (40), do not downgrade to delivery callbacks
  if (currentRank > 0 && newRank > 0 && newRank < currentRank) {
    return false;
  }

  return true;
}

