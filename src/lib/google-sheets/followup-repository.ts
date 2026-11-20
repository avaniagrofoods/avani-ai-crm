/**
 * TASK 5H.4 — SHEET 4: FOLLOWUPS REPOSITORY
 * Columns: followup_id, lead_id, customer_id, advisor_id, followup_date, followup_type, followup_status, short_notes, created_at, updated_at
 */

import { BaseSheetsRepository } from './sheets-repository';
import { FollowupRow } from './sheet-schema';
import {
  MAX_SHORT_NOTE_LENGTH,
  sanitizeCellForSheets,
  validateAdvisorId,
  validateIsoTimestamp
} from './sheet-validation';

export class FollowupRepository extends BaseSheetsRepository<FollowupRow> {
  constructor() {
    super('FOLLOWUPS');
  }

  public async findByLeadId(leadId: string): Promise<FollowupRow[]> {
    const all = await this.findAll();
    return all.filter((f) => f.lead_id === leadId);
  }

  public async createOrUpdateFollowup(params: {
    followup_id?: string;
    lead_id: string;
    customer_id: string;
    advisor_id?: string;
    followup_date: string | Date;
    followup_type?: string;
    followup_status?: 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
    short_notes?: string;
    created_at?: string | Date;
    updated_at?: string | Date;
  }): Promise<{ record: FollowupRow; created: boolean }> {
    const existing = params.followup_id ? await this.findById(params.followup_id) : null;
    const followupId =
      existing?.followup_id ||
      params.followup_id ||
      `FUP-${params.lead_id}-${Date.now().toString().slice(-5)}`;
    const nowIso = validateIsoTimestamp(params.updated_at);
    const createdIso = existing?.created_at || validateIsoTimestamp(params.created_at || nowIso);

    const statusUpper = String(params.followup_status || existing?.followup_status || 'PENDING').toUpperCase();
    const validStatus: 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED' =
      statusUpper === 'COMPLETED' || statusUpper === 'OVERDUE' || statusUpper === 'CANCELLED'
        ? statusUpper
        : 'PENDING';

    const notesRaw = String(params.short_notes ?? existing?.short_notes ?? '').slice(0, MAX_SHORT_NOTE_LENGTH);

    const row: FollowupRow = {
      followup_id: sanitizeCellForSheets('followup_id', followupId),
      lead_id: sanitizeCellForSheets('lead_id', params.lead_id),
      customer_id: sanitizeCellForSheets('customer_id', params.customer_id || existing?.customer_id),
      advisor_id: validateAdvisorId(params.advisor_id || existing?.advisor_id || 'ADV-SACHIN-01'),
      followup_date: validateIsoTimestamp(params.followup_date),
      followup_type: sanitizeCellForSheets(
        'followup_type',
        params.followup_type || existing?.followup_type || 'ADVISOR_CALL'
      ),
      followup_status: validStatus,
      short_notes: sanitizeCellForSheets('short_notes', notesRaw, { maxLength: MAX_SHORT_NOTE_LENGTH }),
      created_at: createdIso,
      updated_at: nowIso
    };

    return this.upsert(row);
  }

  public async cancelPendingFollowupsForCustomerOrLead(params: {
    lead_id?: string;
    customer_id?: string;
  }): Promise<number> {
    const all = await this.findAll();
    let cancelled = 0;
    const nowIso = new Date().toISOString();
    for (const f of all) {
      const matches =
        (params.lead_id && f.lead_id === params.lead_id) ||
        (params.customer_id && f.customer_id === params.customer_id);
      if (matches && f.followup_status === 'PENDING') {
        await this.upsert({
          ...f,
          followup_status: 'CANCELLED',
          short_notes: 'Cancelled due to customer opt-out',
          updated_at: nowIso
        });
        cancelled++;
      }
    }
    return cancelled;
  }
}

export const followupRepository = new FollowupRepository();
