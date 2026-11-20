/**
 * TASK 5H.4 — SHEET 6: MESSAGE_EVENTS REPOSITORY
 * Columns: event_id, customer_id, provider, message_type, direction, delivery_status, provider_message_id, event_timestamp
 * Stores ONLY essential message operational metadata. Prohibits full chat transcripts, media, or attachment contents.
 */

import { BaseSheetsRepository } from './sheets-repository';
import { MessageEventRow } from './sheet-schema';
import { sanitizeCellForSheets, validateIsoTimestamp } from './sheet-validation';

export class MessageEventRepository extends BaseSheetsRepository<MessageEventRow> {
  constructor() {
    super('MESSAGE_EVENTS');
  }

  public async findByProviderMessageId(providerMsgId: string): Promise<MessageEventRow | null> {
    if (!providerMsgId) return null;
    const all = await this.findAll();
    return (
      all.find(
        (m) => m.provider_message_id === providerMsgId || m.event_id === `MSG_${providerMsgId}`
      ) || null
    );
  }

  public async findByCustomerId(customerId: string): Promise<MessageEventRow[]> {
    const all = await this.findAll();
    return all.filter((m) => m.customer_id === customerId);
  }

  public async recordMessageEvent(params: {
    event_id?: string;
    customer_id: string;
    provider?: string;
    message_type?: string;
    direction: 'inbound' | 'outbound';
    delivery_status: string;
    provider_message_id: string;
    event_timestamp?: string | Date;
  }): Promise<{ record: MessageEventRow; created: boolean }> {
    const provMsgId = sanitizeCellForSheets('provider_message_id', params.provider_message_id);
    const eventId = sanitizeCellForSheets('event_id', params.event_id || `MSG_${provMsgId}`);
    const tsIso = validateIsoTimestamp(params.event_timestamp);

    const row: MessageEventRow = {
      event_id: eventId,
      customer_id: sanitizeCellForSheets('customer_id', params.customer_id || 'UNKNOWN'),
      provider: sanitizeCellForSheets('provider', params.provider || 'ChatMitra'),
      message_type: sanitizeCellForSheets('message_type', params.message_type || 'TEXT'),
      direction: params.direction === 'inbound' ? 'inbound' : 'outbound',
      delivery_status: sanitizeCellForSheets('delivery_status', params.delivery_status || 'RECEIVED'),
      provider_message_id: provMsgId,
      event_timestamp: tsIso
    };

    return this.upsert(row);
  }
}

export const messageEventRepository = new MessageEventRepository();
