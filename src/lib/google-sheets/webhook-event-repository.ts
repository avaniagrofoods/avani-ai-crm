/**
 * TASK 5H.4 — SHEET 7: WEBHOOK_EVENTS REPOSITORY
 * Columns: event_id, provider, event_type, processing_status, payload_hash, received_at, processed_at, error_code
 *
 * Strictly prohibits storing raw webhook payloads, media IDs, document URLs, or binary payloads.
 * Uses deterministic event IDs and atomic lock-protected insertIfAbsent for idempotency.
 */

import { BaseSheetsRepository } from './sheets-repository';
import { WebhookEventRow } from './sheet-schema';
import { sanitizeCellForSheets, validateIsoTimestamp } from './sheet-validation';
import { computePayloadSha256 } from './sheet-idempotency';

export class WebhookEventRepository extends BaseSheetsRepository<WebhookEventRow> {
  constructor() {
    super('WEBHOOK_EVENTS');
  }

  /**
   * Registers an incoming webhook event idempotently.
   * Returns { duplicate: true } if the event_id already exists in WEBHOOK_EVENTS.
   */
  public async registerWebhookEventIdempotent(params: {
    event_id: string;
    provider: string;
    event_type: string;
    rawPayloadForHashOnly: unknown;
    received_at?: string | Date;
  }): Promise<{ record: WebhookEventRow; duplicate: boolean }> {
    const eventId = sanitizeCellForSheets('event_id', params.event_id);
    const payloadHash = computePayloadSha256(params.rawPayloadForHashOnly);
    const nowIso = validateIsoTimestamp(params.received_at);

    const row: WebhookEventRow = {
      event_id: eventId,
      provider: sanitizeCellForSheets('provider', params.provider || 'ChatMitra'),
      event_type: sanitizeCellForSheets('event_type', params.event_type || 'INBOUND_MESSAGE'),
      processing_status: 'RECEIVED',
      payload_hash: payloadHash,
      received_at: nowIso,
      processed_at: '',
      error_code: ''
    };

    const res = await this.insertIfAbsent(row);
    return {
      record: res.record,
      duplicate: !res.inserted
    };
  }

  public async markWebhookStatus(params: {
    event_id: string;
    processing_status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DUPLICATE' | 'ARCHIVED_HISTORICAL';
    error_code?: string;
    processed_at?: string | Date;
  }): Promise<WebhookEventRow | null> {
    const existing = await this.findById(params.event_id);
    if (!existing) return null;

    const updated: WebhookEventRow = {
      ...existing,
      processing_status: params.processing_status,
      processed_at:
        params.processing_status === 'COMPLETED' ||
        params.processing_status === 'FAILED' ||
        params.processing_status === 'ARCHIVED_HISTORICAL'
          ? validateIsoTimestamp(params.processed_at)
          : existing.processed_at,
      error_code: params.error_code ? sanitizeCellForSheets('error_code', params.error_code) : existing.error_code
    };

    const res = await this.upsert(updated);
    return res.record;
  }
}

export const webhookEventRepository = new WebhookEventRepository();
