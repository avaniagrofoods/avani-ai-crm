/**
 * TASK 5H.4 — SHEET 5: CONSENTS REPOSITORY
 * Columns: consent_id, customer_id, channel, consent_status, consent_source, consent_timestamp, optout_status, updated_at
 */

import { BaseSheetsRepository } from './sheets-repository';
import { ConsentRow } from './sheet-schema';
import { sanitizeCellForSheets, validateIsoTimestamp } from './sheet-validation';

export class ConsentRepository extends BaseSheetsRepository<ConsentRow> {
  constructor() {
    super('CONSENTS');
  }

  public static buildConsentId(customerId: string): string {
    return `CNS-${customerId}`;
  }

  public async findByCustomerId(customerId: string): Promise<ConsentRow | null> {
    const byId = await this.findById(ConsentRepository.buildConsentId(customerId));
    if (byId) return byId;
    const all = await this.findAll();
    return all.find((c) => c.customer_id === customerId) || null;
  }

  public async upsertConsent(params: {
    consent_id?: string;
    customer_id: string;
    channel?: string;
    consent_status: 'GRANTED' | 'DENIED' | 'WITHDRAWN' | 'PENDING';
    consent_source?: string;
    consent_timestamp?: string | Date;
    optout_status: 'OPTED_IN' | 'OPTED_OUT';
    updated_at?: string | Date;
  }): Promise<{ record: ConsentRow; created: boolean }> {
    const consentId = params.consent_id || ConsentRepository.buildConsentId(params.customer_id);
    const nowIso = validateIsoTimestamp(params.updated_at);
    const tsIso = validateIsoTimestamp(params.consent_timestamp || nowIso);

    const row: ConsentRow = {
      consent_id: sanitizeCellForSheets('consent_id', consentId),
      customer_id: sanitizeCellForSheets('customer_id', params.customer_id),
      channel: sanitizeCellForSheets('channel', params.channel || 'WHATSAPP'),
      consent_status: params.consent_status,
      consent_source: sanitizeCellForSheets(
        'consent_source',
        params.consent_source || 'WHATSAPP_INBOUND'
      ),
      consent_timestamp: tsIso,
      optout_status: params.optout_status,
      updated_at: nowIso
    };

    return this.upsert(row);
  }
}

export const consentRepository = new ConsentRepository();
