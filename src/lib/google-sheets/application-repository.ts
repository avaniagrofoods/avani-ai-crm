/**
 * TASK 5H.4 — SHEET 3: APPLICATIONS REPOSITORY
 * Columns: application_id, lead_id, customer_id, loan_category, requested_amount, application_status, lender_status, assigned_advisor_id, created_at, updated_at
 */

import { BaseSheetsRepository } from './sheets-repository';
import { ApplicationRow } from './sheet-schema';
import {
  sanitizeCellForSheets,
  validateAdvisorId,
  validateIsoTimestamp,
  validateLoanCategory,
  validateRequestedAmount
} from './sheet-validation';

export class ApplicationRepository extends BaseSheetsRepository<ApplicationRow> {
  constructor() {
    super('APPLICATIONS');
  }

  public async findByLeadId(leadId: string): Promise<ApplicationRow | null> {
    const all = await this.findAll();
    return all.find((a) => a.lead_id === leadId) || null;
  }

  public async upsertApplication(params: {
    application_id?: string;
    lead_id: string;
    customer_id: string;
    loan_category: string;
    requested_amount?: unknown;
    application_status: string;
    lender_status?: string;
    assigned_advisor_id?: string;
    created_at?: string | Date;
    updated_at?: string | Date;
  }): Promise<{ record: ApplicationRow; created: boolean }> {
    const existingById = params.application_id ? await this.findById(params.application_id) : null;
    const existingByLead = !existingById ? await this.findByLeadId(params.lead_id) : null;
    const existing = existingById || existingByLead;

    const appId = existing?.application_id || params.application_id || `APP-${params.lead_id}`;
    const nowIso = validateIsoTimestamp(params.updated_at);
    const createdIso = existing?.created_at || validateIsoTimestamp(params.created_at || nowIso);

    const row: ApplicationRow = {
      application_id: sanitizeCellForSheets('application_id', appId),
      lead_id: sanitizeCellForSheets('lead_id', params.lead_id),
      customer_id: sanitizeCellForSheets('customer_id', params.customer_id || existing?.customer_id),
      loan_category: validateLoanCategory(params.loan_category || existing?.loan_category || 'Personal Loan'),
      requested_amount: validateRequestedAmount(
        params.requested_amount !== undefined ? params.requested_amount : existing?.requested_amount ?? '0'
      ),
      application_status: sanitizeCellForSheets(
        'application_status',
        params.application_status || existing?.application_status || 'PREPARING'
      ),
      lender_status: sanitizeCellForSheets(
        'lender_status',
        params.lender_status || existing?.lender_status || 'PENDING_SUBMISSION'
      ),
      assigned_advisor_id: validateAdvisorId(
        params.assigned_advisor_id || existing?.assigned_advisor_id || 'ADV-SACHIN-01'
      ),
      created_at: createdIso,
      updated_at: nowIso
    };

    return this.upsert(row);
  }
}

export const applicationRepository = new ApplicationRepository();
