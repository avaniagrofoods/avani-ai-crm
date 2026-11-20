/**
 * TASK 5H.4 — SHEET 2: LEADS REPOSITORY
 * Columns: lead_id, customer_id, loan_category, requested_amount, lead_status, lead_source, assigned_advisor_id, priority, created_at, updated_at
 */

import { BaseSheetsRepository } from './sheets-repository';
import { LeadRow } from './sheet-schema';
import {
  sanitizeCellForSheets,
  validateAdvisorId,
  validateIsoTimestamp,
  validateLoanCategory,
  validateRequestedAmount
} from './sheet-validation';

export class LeadRepository extends BaseSheetsRepository<LeadRow> {
  constructor() {
    super('LEADS');
  }

  public static generateLeadId(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `AVL-${dateStr}-${rand}`;
  }

  public async findByCustomerId(customerId: string): Promise<LeadRow[]> {
    const all = await this.findAll();
    return all.filter((l) => l.customer_id === customerId);
  }

  public async upsertLead(params: {
    lead_id?: string;
    customer_id: string;
    loan_category: string;
    requested_amount?: unknown;
    lead_status?: string;
    lead_source?: string;
    assigned_advisor_id?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    created_at?: string | Date;
    updated_at?: string | Date;
  }): Promise<{ record: LeadRow; created: boolean }> {
    const existingById = params.lead_id ? await this.findById(params.lead_id) : null;
    const existingByCust =
      !existingById && params.customer_id
        ? (await this.findByCustomerId(params.customer_id))[0] || null
        : null;
    const existing = existingById || existingByCust;

    const leadId = existing?.lead_id || params.lead_id || LeadRepository.generateLeadId();
    const nowIso = validateIsoTimestamp(params.updated_at);
    const createdIso = existing?.created_at || validateIsoTimestamp(params.created_at || nowIso);

    const priorityVal = (params.priority || existing?.priority || 'MEDIUM').toUpperCase();
    const validPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' =
      priorityVal === 'LOW' || priorityVal === 'HIGH' || priorityVal === 'URGENT'
        ? priorityVal
        : 'MEDIUM';

    const row: LeadRow = {
      lead_id: sanitizeCellForSheets('lead_id', leadId),
      customer_id: sanitizeCellForSheets('customer_id', params.customer_id || existing?.customer_id),
      loan_category: validateLoanCategory(params.loan_category || existing?.loan_category || 'Personal Loan'),
      requested_amount: validateRequestedAmount(
        params.requested_amount !== undefined ? params.requested_amount : existing?.requested_amount ?? '0'
      ),
      lead_status: sanitizeCellForSheets(
        'lead_status',
        params.lead_status || existing?.lead_status || 'NEW_ENQUIRY'
      ),
      lead_source: sanitizeCellForSheets(
        'lead_source',
        params.lead_source || existing?.lead_source || 'WEBSITE'
      ),
      assigned_advisor_id: validateAdvisorId(
        params.assigned_advisor_id || existing?.assigned_advisor_id || 'ADV-SACHIN-01'
      ),
      priority: validPriority,
      created_at: createdIso,
      updated_at: nowIso
    };

    return this.upsert(row);
  }
}

export const leadRepository = new LeadRepository();
