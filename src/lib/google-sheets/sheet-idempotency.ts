/**
 * TASK 5H.4 — DETERMINISTIC EVENT ID, PAYLOAD HASH & CONCURRENCY LOCK ENGINE
 * Coordinates serialized writes and duplicate-event suppression for Google Sheets.
 */

import crypto from 'node:crypto';

/**
 * Computes a deterministic 64-character SHA-256 hex digest of a webhook or request payload.
 * Never persists the raw payload itself in Google Sheets.
 */
export function computePayloadSha256(payload: unknown): string {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

/**
 * Generates a deterministic webhook event ID when not explicitly provided.
 */
export function buildDeterministicEventId(params: {
  provider: string;
  eventType: string;
  messageId?: string | null;
  status?: string | null;
  payloadHash?: string;
}): string {
  const prov = String(params.provider || 'WEBHOOK').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const type = String(params.eventType || 'EVENT').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
  const msgId = String(params.messageId || '').trim();
  const status = String(params.status || '').trim().toUpperCase();

  if (prov === 'CHATMITRA' || prov === 'CM') {
    if (type === 'STATUS_UPDATE' && msgId) {
      return `CM_STATUS_${msgId}_${status || 'UPDATED'}`;
    }
    if (msgId) {
      return `CM_INBOUND_${msgId}`;
    }
  }
  if (prov === 'META' || prov === 'WHATSAPP') {
    if (type === 'STATUS_UPDATE' && msgId) {
      return `META_STATUS_${msgId}_${status || 'UPDATED'}`;
    }
    if (msgId) {
      return `META_INBOUND_${msgId}`;
    }
  }
  const suffix = msgId || (params.payloadHash ? params.payloadHash.slice(0, 24) : crypto.randomUUID());
  return `${prov}_${type}_${suffix}`;
}

/**
 * Process-level async mutex lock queue (mirrors Google Apps Script LockService.getScriptLock()).
 * Ensures that concurrent in-process webhook/CRM writes execute strictly sequentially,
 * preventing read-then-append race conditions.
 */
class SerializedWriteLock {
  private queue: Promise<void> = Promise.resolve();

  public async withLock<T>(fn: () => Promise<T>, timeoutMs = 15000): Promise<T> {
    let release!: () => void;
    const nextReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = this.queue;
    this.queue = prev.then(() => nextReady).catch(() => nextReady);

    let timer: NodeJS.Timeout | null = null;
    try {
      await Promise.race([
        prev,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Lock acquisition timed out')), timeoutMs);
        })
      ]);
      if (timer) clearTimeout(timer);
      return await fn();
    } finally {
      if (timer) clearTimeout(timer);
      release();
    }
  }
}

export const sheetsWriteMutex = new SerializedWriteLock();

/**
 * Anti-replay nonce tracker for Apps Script Gateway requests.
 */
const seenRequestNonces = new Map<string, number>();
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function verifyAndRecordRequestNonce(requestId: string, timestampMs: number, nowMs = Date.now()): {
  valid: boolean;
  error?: string;
} {
  if (!requestId || typeof requestId !== 'string' || requestId.length < 8) {
    return { valid: false, error: 'Missing or invalid X-Avani-Request-Id nonce' };
  }
  if (!Number.isFinite(timestampMs) || Math.abs(nowMs - timestampMs) > 5 * 60 * 1000) {
    return { valid: false, error: 'Expired or clock-skewed request timestamp (exceeds 300s window)' };
  }
  // Prune expired nonces
  for (const [k, exp] of seenRequestNonces.entries()) {
    if (exp <= nowMs) seenRequestNonces.delete(k);
  }
  if (seenRequestNonces.has(requestId)) {
    return { valid: false, error: 'Replayed request ID rejected' };
  }
  seenRequestNonces.set(requestId, nowMs + NONCE_TTL_MS);
  return { valid: true };
}

export function resetNoncesForTesting(): void {
  seenRequestNonces.clear();
}
