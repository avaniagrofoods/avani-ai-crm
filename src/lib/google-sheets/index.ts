/**
 * TASK 5H.4 — UNIFIED GOOGLE SHEETS CRM ENGINE & REPOSITORY BARREL
 *
 * Implements:
 * - Sheet 8 ADVISORS Repository (zero passwords or secrets)
 * - Sheet 9 SYSTEM_CONFIG Repository (non-secret configuration metadata only)
 * - Composite CrmSheetsService hydrating CRM domain views from the 9 Master Sheets tabs
 * - Strict zero-MongoDB-fallback enforcement
 */

import { BaseSheetsRepository } from './sheets-repository';
import {
  AdvisorRow,
  SystemConfigRow,
  CustomerRow,
  LeadRow,
  ApplicationRow,
  FollowupRow,
  ConsentRow
} from './sheet-schema';
import {
  normalizeMobileNumber,
  sanitizeCellForSheets,
  validateAdvisorId,
  validateIsoTimestamp
} from './sheet-validation';
import { createValidationError, SheetsCrmError } from './sheet-error-handler';
import { defaultSheetsClient } from './google-sheets-client';
import { customerRepository, CustomerRepository } from './customer-repository';
import { leadRepository, LeadRepository } from './lead-repository';
import { applicationRepository, ApplicationRepository } from './application-repository';
import { followupRepository, FollowupRepository } from './followup-repository';
import { consentRepository, ConsentRepository } from './consent-repository';
import { messageEventRepository, MessageEventRepository } from './message-event-repository';
import { webhookEventRepository, WebhookEventRepository } from './webhook-event-repository';

export * from './sheet-schema';
export * from './sheet-error-handler';
export * from './sheet-validation';
export * from './sheet-idempotency';
export * from './google-auth';
export * from './google-sheets-client';
export * from './sheets-repository';
export * from './customer-repository';
export * from './lead-repository';
export * from './application-repository';
export * from './followup-repository';
export * from './consent-repository';
export * from './message-event-repository';
export * from './webhook-event-repository';
export * from './identity-reconciliation';
export * from './legacy-message-migration-plan';

export class AdvisorRepository extends BaseSheetsRepository<AdvisorRow> {
  constructor() {
    super('ADVISORS');
  }

  public async listActiveAdvisors(): Promise<AdvisorRow[]> {
    const all = await this.findAll();
    return all.filter((a) => a.active_status === 'ACTIVE');
  }

  public async upsertAdvisor(params: {
    advisor_id?: string;
    advisor_name: string;
    active_status?: 'ACTIVE' | 'INACTIVE';
    role?: AdvisorRow['role'];
    created_at?: string | Date;
    updated_at?: string | Date;
  }): Promise<{ record: AdvisorRow; created: boolean }> {
    const cleanName = sanitizeCellForSheets('advisor_name', params.advisor_name);
    if (!cleanName) throw createValidationError('advisor_name is required');
    const id = validateAdvisorId(
      params.advisor_id ||
        `ADV-${cleanName.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`
    );
    const existing = await this.findById(id);
    const nowIso = validateIsoTimestamp(params.updated_at);
    const createdIso = existing?.created_at || validateIsoTimestamp(params.created_at || nowIso);

    const row: AdvisorRow = {
      advisor_id: id,
      advisor_name: cleanName,
      active_status: params.active_status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      role: params.role || existing?.role || 'LOAN_ADVISOR',
      created_at: createdIso,
      updated_at: nowIso
    };
    return this.upsert(row);
  }
}

const FORBIDDEN_SECRET_CONFIG_KEY_REGEX = /secret|password|token|private_key|api_key|credential|uri/i;

export class SystemConfigRepository extends BaseSheetsRepository<SystemConfigRow> {
  constructor() {
    super('SYSTEM_CONFIG');
  }

  public async setConfigValue(key: string, value: string): Promise<SystemConfigRow> {
    const cleanKey = sanitizeCellForSheets('config_key', key, { maxLength: 80 });
    if (!cleanKey || FORBIDDEN_SECRET_CONFIG_KEY_REGEX.test(cleanKey)) {
      throw createValidationError(
        `Config key "${cleanKey}" is forbidden in SYSTEM_CONFIG. Never store secrets, passwords, or tokens in Google Sheets.`
      );
    }
    const cleanVal = sanitizeCellForSheets('config_value', value, { maxLength: 240 });
    const res = await this.upsert({
      config_key: cleanKey,
      config_value: cleanVal,
      updated_at: new Date().toISOString()
    });
    return res.record;
  }
}

export const advisorRepository = new AdvisorRepository();
export const systemConfigRepository = new SystemConfigRepository();

export interface HydratedCrmLeadView {
  _id: string;
  leadId: string;
  customerId: string;
  name: string;
  phone: string;
  normalizedMobile: string;
  city: string;
  loanType: string;
  requestedAmount: string;
  requiredLoanAmount: number;
  stage: string;
  status: string;
  leadSource: string;
  source: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedAdvisor: {
    id: string;
    name: string;
    role: string;
  };
  consentStatus: 'GRANTED' | 'DENIED' | 'WITHDRAWN' | 'PENDING';
  consentTimestamp: string;
  isOptedOut: boolean;
  application?: {
    applicationId: string;
    applicationNumber: string;
    appliedAmount: number;
    status: string;
    lenderStatus: string;
    lenderName: string;
  };
  followUpTasks: Array<{
    taskId: string;
    title: string;
    dueDate: string;
    status: string;
    assignedTo: string;
    notes: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Process-local serialization chains keyed by normalized customer phone.
 *
 * IMPORTANT (Task 5H.35 F34-02 honesty invariant):
 * - This map is a process-local ordering optimization ONLY (reduces redundant reads/writes
 *   under burst concurrency within one Node.js worker). It is NOT relied upon for
 *   cross-instance uniqueness.
 * - Cross-instance duplicate prevention is provided durably by deterministic business
 *   primary keys (`CUST-<raw10>`, `CNS-<customer_id>-WHATSAPP`,
 *   `LeadRepository.buildDeterministicLeadId(customerId, loanCategory, enquiryKey)`,
 *   and `FUP-<lead_id>-D0`) combined with `gateway.gs` `INSERT_IF_ABSENT`/`UPSERT_ROW`
 *   serialized under `LockService.getScriptLock()`.
 * - Kept strictly separate from `sheetsWriteMutex` to prevent non-reentrant deadlock.
 */
const customerLeadSerializeChains = new Map<string, Promise<void>>();

async function withCustomerLocalOrderLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = customerLeadSerializeChains.get(key) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = prev.then(() => gate).catch(() => gate);
  customerLeadSerializeChains.set(key, chained);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (customerLeadSerializeChains.get(key) === chained) {
      customerLeadSerializeChains.delete(key);
    }
  }
}

/**
 * Composite service coordinating multi-sheet CRM operations across the 9 master sheets.
 */
export class CrmSheetsService {
  public static async assertHealthy(): Promise<void> {
    const health = await defaultSheetsClient.checkConnectivity();
    if (!health.online) {
      throw new SheetsCrmError({
        code: health.errorCode || 'GOOGLE_SHEETS_UNAVAILABLE',
        message: health.error || 'Google Sheets store is unreachable.',
        httpStatus: health.httpStatus || 503,
        retryable: (health.httpStatus || 503) === 503 || health.httpStatus === 429
      });
    }
  }

  /**
   * Registers or updates a customer enquiry across CUSTOMERS, LEADS, CONSENTS, and initial FOLLOWUPS.
   */
  public static async registerOrUpdateCustomerLead(params: {
    leadId?: string;
    enquiryKey?: string;
    name: string;
    phone: string;
    city?: string;
    loanCategory: string;
    requestedAmount?: unknown;
    leadStatus?: string;
    leadSource?: string;
    assignedAdvisorId?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    consentStatus?: 'GRANTED' | 'DENIED' | 'WITHDRAWN' | 'PENDING';
    consentSource?: string;
    isOptedOut?: boolean;
  }): Promise<{
    customer: CustomerRow;
    lead: LeadRow;
    consent: ConsentRow;
    hydrated: HydratedCrmLeadView;
  }> {
    const mobile = normalizeMobileNumber(params.phone);

    return withCustomerLocalOrderLock(mobile.raw10, async () => {
      const existingCustomer = await customerRepository.findByMobile(mobile.e164);
      const existingConsent = existingCustomer
        ? await consentRepository.findByCustomerId(existingCustomer.customer_id)
        : null;

      const alreadyOptedOut =
        params.isOptedOut === true ||
        existingCustomer?.record_status === 'OPTED_OUT' ||
        existingConsent?.optout_status === 'OPTED_OUT' ||
        existingConsent?.consent_status === 'DENIED' ||
        existingConsent?.consent_status === 'WITHDRAWN';

      const incomingNameClean = String(params.name || '').trim();
      const isGenericInboundName =
        !incomingNameClean ||
        incomingNameClean.toLowerCase() === 'customer' ||
        incomingNameClean.toLowerCase() === 'valued customer';
      const resolvedCustomerName =
        existingCustomer?.customer_name && isGenericInboundName
          ? existingCustomer.customer_name
          : incomingNameClean || existingCustomer?.customer_name || 'Valued Customer';

      const { record: customer } = await customerRepository.upsertCustomer({
        customer_id: existingCustomer?.customer_id,
        customer_name: resolvedCustomerName,
        mobile_number: mobile.e164,
        city: params.city || existingCustomer?.city || 'Latur',
        enquiry_source: params.leadSource || existingCustomer?.enquiry_source || 'WEBSITE',
        record_status: alreadyOptedOut ? 'OPTED_OUT' : 'ACTIVE'
      });

      const { record: consent } = await consentRepository.upsertConsent({
        customer_id: customer.customer_id,
        channel: 'WHATSAPP',
        consent_status: alreadyOptedOut
          ? (existingConsent?.consent_status || 'WITHDRAWN')
          : (params.consentStatus || existingConsent?.consent_status || 'GRANTED'),
        consent_source: params.consentSource || existingConsent?.consent_source || params.leadSource || 'WEBSITE',
        optout_status: alreadyOptedOut ? 'OPTED_OUT' : 'OPTED_IN'
      });

      // Task 5H.33 D-01 + Task 5H.35 F34-02:
      // - Verify optional leadId belongs strictly to this customer.
      // - When leadId is omitted, match ONLY an active lead for the SAME (customer_id, loan_category)
      //   (or explicit deterministic enquiryKey) so genuinely distinct loan requirements are never
      //   merged merely because the mobile number matches.
      const safeLeadId = params.leadId ? String(params.leadId).trim() : undefined;
      let existingLeadForAdvisor: LeadRow | null = null;
      if (safeLeadId) {
        const foundLead = await leadRepository.findById(safeLeadId);
        if (foundLead && foundLead.customer_id && foundLead.customer_id !== customer.customer_id) {
          throw createValidationError(
            `Lead ownership mismatch: lead "${safeLeadId}" does not belong to customer "${customer.customer_id}".`
          );
        }
        existingLeadForAdvisor = foundLead;
      } else if (params.enquiryKey) {
        const detId = LeadRepository.buildDeterministicLeadId({
          customerId: customer.customer_id,
          loanCategory: params.loanCategory,
          enquiryKey: params.enquiryKey
        });
        existingLeadForAdvisor = await leadRepository.findById(detId);
      } else {
        existingLeadForAdvisor = await leadRepository.findActiveByCustomerAndCategory(
          customer.customer_id,
          params.loanCategory
        );
      }

      const { record: lead, created: leadCreated } = await leadRepository.upsertLead({
        lead_id: safeLeadId,
        customer_id: customer.customer_id,
        loan_category: params.loanCategory,
        enquiry_key: params.enquiryKey,
        requested_amount: params.requestedAmount,
        lead_status: alreadyOptedOut ? 'OPTED_OUT' : (params.leadStatus || existingLeadForAdvisor?.lead_status || 'NEW_ENQUIRY'),
        lead_source: params.leadSource || existingLeadForAdvisor?.lead_source || customer.enquiry_source,
        assigned_advisor_id: params.assignedAdvisorId || existingLeadForAdvisor?.assigned_advisor_id || 'ADV-SACHIN-01',
        priority: params.priority || existingLeadForAdvisor?.priority || 'MEDIUM'
      });

      if (!alreadyOptedOut) {
        const initialFollowupId = `FUP-${lead.lead_id}-D0`;
        const needsInitialFollowup =
          leadCreated ||
          (lead.lead_status === 'NEW_ENQUIRY' && !(await followupRepository.findById(initialFollowupId)));
        if (needsInitialFollowup) {
          await followupRepository.createOrUpdateFollowup({
            followup_id: initialFollowupId,
            lead_id: lead.lead_id,
            customer_id: customer.customer_id,
            advisor_id: lead.assigned_advisor_id,
            followup_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            followup_type: 'INITIAL_QUALIFICATION_CALL',
            followup_status: 'PENDING',
            short_notes: `Initial consultation for ${lead.loan_category}`
          });
        }
      }

      const hydrated = await this.hydrateLeadView(lead, customer, consent);
      return { customer, lead, consent, hydrated };
    });
  }

  public static async hydrateLeadView(
    lead: LeadRow,
    customerInput?: CustomerRow | null,
    consentInput?: ConsentRow | null,
    appInput?: ApplicationRow | null,
    followupsInput?: FollowupRow[],
    advisorsInput?: AdvisorRow[]
  ): Promise<HydratedCrmLeadView> {
    const customer = customerInput ?? (await customerRepository.findById(lead.customer_id));
    const consent = consentInput ?? (await consentRepository.findByCustomerId(lead.customer_id));
    const app = appInput !== undefined ? appInput : await applicationRepository.findByLeadId(lead.lead_id);
    const followups = followupsInput ?? (await followupRepository.findByLeadId(lead.lead_id));
    const advisors = advisorsInput ?? (await advisorRepository.findAll());

    const advisorMatch = advisors.find((a) => a.advisor_id === lead.assigned_advisor_id);
    const mobileE164 = customer?.mobile_number || '';
    const raw10 = mobileE164.replace(/\D/g, '').slice(-10);
    const numericAmt = Number(String(lead.requested_amount || '0').replace(/[^0-9.]/g, '')) || 0;
    const isOptedOut =
      consent?.optout_status === 'OPTED_OUT' ||
      customer?.record_status === 'OPTED_OUT' ||
      lead.lead_status === 'OPTED_OUT';

    return {
      _id: lead.lead_id,
      leadId: lead.lead_id,
      customerId: lead.customer_id,
      name: customer?.customer_name || 'Valued Customer',
      phone: mobileE164,
      normalizedMobile: raw10,
      city: customer?.city || 'Latur',
      loanType: lead.loan_category,
      requestedAmount: lead.requested_amount,
      requiredLoanAmount: numericAmt,
      stage: lead.lead_status,
      status: lead.lead_status,
      leadSource: lead.lead_source,
      source: lead.lead_source,
      priority: lead.priority,
      assignedAdvisor: {
        id: lead.assigned_advisor_id,
        name: advisorMatch?.advisor_name || 'Sachin Shinde',
        role: advisorMatch?.role || 'CHIEF_LOAN_ADVISOR'
      },
      consentStatus: consent?.consent_status || 'GRANTED',
      consentTimestamp: consent?.consent_timestamp || lead.created_at,
      isOptedOut,
      application: app
        ? {
            applicationId: app.application_id,
            applicationNumber: app.application_id,
            appliedAmount: Number(app.requested_amount) || numericAmt,
            status: app.application_status,
            lenderStatus: app.lender_status,
            lenderName: app.lender_status.split(':')[0] || 'Partner Lender'
          }
        : undefined,
      followUpTasks: followups.map((f) => ({
        taskId: f.followup_id,
        title: f.followup_type,
        dueDate: f.followup_date,
        status: f.followup_status,
        assignedTo: f.advisor_id,
        notes: f.short_notes
      })),
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    };
  }

  public static async listHydratedLeads(): Promise<HydratedCrmLeadView[]> {
    const snap = await defaultSheetsClient.getSnapshot([
      'LEADS',
      'CUSTOMERS',
      'CONSENTS',
      'APPLICATIONS',
      'FOLLOWUPS',
      'ADVISORS'
    ]);
    const leads = (snap.LEADS || []) as unknown as LeadRow[];
    const customers = (snap.CUSTOMERS || []) as unknown as CustomerRow[];
    const consents = (snap.CONSENTS || []) as unknown as ConsentRow[];
    const apps = (snap.APPLICATIONS || []) as unknown as ApplicationRow[];
    const followups = (snap.FOLLOWUPS || []) as unknown as FollowupRow[];
    const advisors = (snap.ADVISORS || []) as unknown as AdvisorRow[];

    const custMap = new Map(customers.map((c) => [c.customer_id, c]));
    const consentMap = new Map(consents.map((c) => [c.customer_id, c]));
    const appMap = new Map(apps.map((a) => [a.lead_id, a]));
    const fupMap = new Map<string, FollowupRow[]>();
    for (const f of followups) {
      const list = fupMap.get(f.lead_id) || [];
      list.push(f);
      fupMap.set(f.lead_id, list);
    }

    const hydrated: HydratedCrmLeadView[] = [];
    for (const l of leads) {
      const view = await this.hydrateLeadView(
        l,
        custMap.get(l.customer_id) || null,
        consentMap.get(l.customer_id) || null,
        appMap.get(l.lead_id) || null,
        fupMap.get(l.lead_id) || [],
        advisors
      );
      hydrated.push(view);
    }
    return hydrated.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  public static async findHydratedLeadByIdOrPhone(idOrPhone: string): Promise<HydratedCrmLeadView | null> {
    if (!idOrPhone) return null;
    const directLead = await leadRepository.findById(idOrPhone);
    if (directLead) {
      return this.hydrateLeadView(directLead);
    }
    const custById = await customerRepository.findById(idOrPhone);
    const cust = custById || (await customerRepository.findByMobile(idOrPhone));
    if (!cust) return null;
    const leads = await leadRepository.findByCustomerId(cust.customer_id);
    if (leads.length === 0) return null;
    return this.hydrateLeadView(leads[0], cust);
  }
}
