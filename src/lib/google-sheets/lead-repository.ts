/**
 * TASK 5H.4 — SHEET 2: LEADS REPOSITORY
 * Columns: lead_id, customer_id, loan_category, requested_amount, lead_status, lead_source, assigned_advisor_id, priority, created_at, updated_at
 */

import crypto from 'node:crypto';
import { BaseSheetsRepository } from './sheets-repository';
import { LeadRow } from './sheet-schema';
import { createValidationError } from './sheet-error-handler';
import {
  sanitizeCellForSheets,
  validateAdvisorId,
  validateIsoTimestamp,
  validateLoanCategory,
  validateRequestedAmount
} from './sheet-validation';

const TERMINAL_LEAD_STATUSES = new Set(['CLOSED', 'DISBURSED', 'REJECTED', 'ARCHIVED']);

export class LeadRepository extends BaseSheetsRepository<LeadRow> {
  constructor() {
    super('LEADS');
  }

  /**
   * Normalizes a loan category label into a stable uppercase business key
   * so equivalent casing/spacing maps to the same logical loan category while
   * distinct loan products (e.g. Home Loan vs Business Loan) stay strictly separate.
   */
  public static normalizeLoanCategoryKey(loanCategory: string): string {
    const validated = validateLoanCategory(loanCategory || 'Personal Loan');
    return validated
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'PERSONAL_LOAN';
  }

  /**
   * Task 5H.35 F34-02: Deterministic business lead identifier derived from verified
   * `customerId`, normalized `loanCategory`, and optional `enquiryKey`.
   *
   * Guarantees:
   * - Simultaneous requests, duplicate webhooks, process restarts, and independent
   *   worker instances targeting the same `(customerId, loanCategory, enquiryKey)`
   *   compute the exact same `lead_id` and converge atomically under `gateway.gs`
   *   `INSERT_IF_ABSENT` + `LockService.getScriptLock()`.
   * - Distinct loan categories or explicit distinct enquiries for the same customer
   *   produce distinct deterministic `lead_id`s (zero false merging).
   * - Contains zero raw customer phone PII and zero randomness.
   */
  public static buildDeterministicLeadId(params: {
    customerId: string;
    loanCategory: string;
    enquiryKey?: string;
  }): string {
    const cleanCustomer = String(params.customerId || '').trim().toUpperCase();
    if (!cleanCustomer) {
      throw createValidationError('customer_id is required to build deterministic lead_id.');
    }
    const categoryKey = LeadRepository.normalizeLoanCategoryKey(params.loanCategory || 'Personal Loan');
    const cleanEnquiry = String(params.enquiryKey || '').trim().toUpperCase();
    const catPrefix = categoryKey.replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'LOA';
    const digest = crypto
      .createHash('sha256')
      .update(`AVANI_LEAD_V1|${cleanCustomer}|${categoryKey}|${cleanEnquiry}`, 'utf8')
      .digest('hex')
      .slice(0, 10)
      .toUpperCase();
    return `AVL-${catPrefix}-${digest}`;
  }

  /**
   * @deprecated Task 5H.35 F34-02: Random lead IDs are no longer used for lead creation
   * deduplication; use `LeadRepository.buildDeterministicLeadId(...)`.
   */
  public static generateLeadId(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `AVL-${dateStr}-${rand}`;
  }

  public async findByCustomerId(customerId: string): Promise<LeadRow[]> {
    const all = await this.findAll();
    return all.filter((l) => l.customer_id === customerId);
  }

  public async findActiveByCustomerAndCategory(
    customerId: string,
    loanCategory: string
  ): Promise<LeadRow | null> {
    if (!customerId) return null;
    const targetCategoryKey = LeadRepository.normalizeLoanCategoryKey(loanCategory || 'Personal Loan');
    const owned = await this.findByCustomerId(customerId);
    return (
      owned.find(
        (l) =>
          LeadRepository.normalizeLoanCategoryKey(l.loan_category) === targetCategoryKey &&
          !TERMINAL_LEAD_STATUSES.has(String(l.lead_status || '').toUpperCase())
      ) || null
    );
  }

  public async upsertLead(params: {
    lead_id?: string;
    customer_id: string;
    loan_category: string;
    enquiry_key?: string;
    requested_amount?: unknown;
    lead_status?: string;
    lead_source?: string;
    assigned_advisor_id?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    created_at?: string | Date;
    updated_at?: string | Date;
  }): Promise<{ record: LeadRow; created: boolean }> {
    const validatedCategory = validateLoanCategory(params.loan_category || 'Personal Loan');
    const explicitLeadId = params.lead_id ? String(params.lead_id).trim() : '';
    const explicitEnquiryKey = params.enquiry_key ? String(params.enquiry_key).trim() : '';

    const existingById = explicitLeadId ? await this.findById(explicitLeadId) : null;
    // Task 5H.33 D-01 defense-in-depth: an existing lead can never be silently reassigned to another customer
    if (
      existingById &&
      params.customer_id &&
      existingById.customer_id &&
      existingById.customer_id !== params.customer_id
    ) {
      throw createValidationError(
        `Lead ownership mismatch: lead "${existingById.lead_id}" belongs to another customer and cannot be reassigned.`
      );
    }

    let existing: LeadRow | null = existingById;
    let leadId: string;

    if (explicitLeadId) {
      leadId = explicitLeadId;
    } else {
      const deterministicId = LeadRepository.buildDeterministicLeadId({
        customerId: params.customer_id,
        loanCategory: validatedCategory,
        enquiryKey: explicitEnquiryKey || undefined
      });

      // Preserve pre-existing active lead for the exact same (customer_id, loan_category)
      // when no distinct enquiry_key is specified, while keeping distinct loan categories separate.
      const existingByCategory =
        !explicitEnquiryKey && params.customer_id
          ? await this.findActiveByCustomerAndCategory(params.customer_id, validatedCategory)
          : null;

      if (existingByCategory) {
        existing = existingByCategory;
        leadId = existingByCategory.lead_id;
      } else {
        existing = await this.findById(deterministicId);
        leadId = deterministicId;
      }
    }

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

    // Task 5H.35 F34-02: For newly created logical leads, use gateway.gs atomic INSERT_IF_ABSENT
    // under LockService.getScriptLock() so simultaneous requests / independent worker instances
    // converge atomically onto a single LEADS row with only one winner receiving `created: true`.
    if (!existing) {
      const insertResult = await this.insertIfAbsent(row);
      if (insertResult.inserted) {
        return { record: insertResult.record, created: true };
      }

      // Concurrent writer beat us to creating this deterministic lead_id.
      const racedExisting = insertResult.record;
      if (
        racedExisting &&
        racedExisting.customer_id &&
        row.customer_id &&
        racedExisting.customer_id !== row.customer_id
      ) {
        throw createValidationError(
          `Lead ownership mismatch: lead "${racedExisting.lead_id}" belongs to another customer and cannot be reassigned.`
        );
      }

      const mergedRow: LeadRow = {
        ...row,
        lead_id: racedExisting?.lead_id || row.lead_id,
        customer_id: racedExisting?.customer_id || row.customer_id,
        loan_category: params.loan_category ? row.loan_category : racedExisting?.loan_category || row.loan_category,
        requested_amount:
          params.requested_amount !== undefined
            ? row.requested_amount
            : racedExisting?.requested_amount ?? row.requested_amount,
        lead_status: params.lead_status || racedExisting?.lead_status || row.lead_status,
        lead_source: params.lead_source || racedExisting?.lead_source || row.lead_source,
        assigned_advisor_id: params.assigned_advisor_id || racedExisting?.assigned_advisor_id || row.assigned_advisor_id,
        priority: params.priority ? validPriority : racedExisting?.priority || validPriority,
        created_at: racedExisting?.created_at || row.created_at,
        updated_at: nowIso
      };

      // Avoid unnecessary overwrite if canonical fields are already identical
      if (
        racedExisting &&
        racedExisting.loan_category === mergedRow.loan_category &&
        racedExisting.requested_amount === mergedRow.requested_amount &&
        racedExisting.lead_status === mergedRow.lead_status &&
        racedExisting.lead_source === mergedRow.lead_source &&
        racedExisting.assigned_advisor_id === mergedRow.assigned_advisor_id &&
        racedExisting.priority === mergedRow.priority
      ) {
        return { record: racedExisting, created: false };
      }

      const updated = await this.upsert(mergedRow);
      return { record: updated.record, created: false };
    }

    return this.upsert(row);
  }
}

export const leadRepository = new LeadRepository();
