/**
 * TASK 5H.4 — GOOGLE SHEETS MASTER DATABASE SCHEMA DEFINITION
 * Master Spreadsheet: AVANI_LOAN_SERVICES_CRM_MASTER
 * Sole CRM Business-Data Store (Zero MongoDB Fallback, Zero File/Attachment Storage)
 */

export const MASTER_SPREADSHEET_NAME = 'AVANI_LOAN_SERVICES_CRM_MASTER';
export const SHEETS_SCHEMA_VERSION = '2026.11.5H4';
export const APPLICATION_DATA_VERSION = 'CRM-SHEETS-1.0.0';

export type SheetTabName =
  | 'CUSTOMERS'
  | 'LEADS'
  | 'APPLICATIONS'
  | 'FOLLOWUPS'
  | 'CONSENTS'
  | 'MESSAGE_EVENTS'
  | 'WEBHOOK_EVENTS'
  | 'ADVISORS'
  | 'SYSTEM_CONFIG';

export const SHEET_TABS: Record<SheetTabName, SheetTabName> = {
  CUSTOMERS: 'CUSTOMERS',
  LEADS: 'LEADS',
  APPLICATIONS: 'APPLICATIONS',
  FOLLOWUPS: 'FOLLOWUPS',
  CONSENTS: 'CONSENTS',
  MESSAGE_EVENTS: 'MESSAGE_EVENTS',
  WEBHOOK_EVENTS: 'WEBHOOK_EVENTS',
  ADVISORS: 'ADVISORS',
  SYSTEM_CONFIG: 'SYSTEM_CONFIG'
};

export const SHEET_COLUMNS: Record<SheetTabName, readonly string[]> = {
  CUSTOMERS: [
    'customer_id',
    'customer_name',
    'mobile_number',
    'city',
    'enquiry_source',
    'created_at',
    'updated_at',
    'record_status'
  ],
  LEADS: [
    'lead_id',
    'customer_id',
    'loan_category',
    'requested_amount',
    'lead_status',
    'lead_source',
    'assigned_advisor_id',
    'priority',
    'created_at',
    'updated_at'
  ],
  APPLICATIONS: [
    'application_id',
    'lead_id',
    'customer_id',
    'loan_category',
    'requested_amount',
    'application_status',
    'lender_status',
    'assigned_advisor_id',
    'created_at',
    'updated_at'
  ],
  FOLLOWUPS: [
    'followup_id',
    'lead_id',
    'customer_id',
    'advisor_id',
    'followup_date',
    'followup_type',
    'followup_status',
    'short_notes',
    'created_at',
    'updated_at'
  ],
  CONSENTS: [
    'consent_id',
    'customer_id',
    'channel',
    'consent_status',
    'consent_source',
    'consent_timestamp',
    'optout_status',
    'updated_at'
  ],
  MESSAGE_EVENTS: [
    'event_id',
    'customer_id',
    'provider',
    'message_type',
    'direction',
    'delivery_status',
    'provider_message_id',
    'event_timestamp'
  ],
  WEBHOOK_EVENTS: [
    'event_id',
    'provider',
    'event_type',
    'processing_status',
    'payload_hash',
    'received_at',
    'processed_at',
    'error_code'
  ],
  ADVISORS: [
    'advisor_id',
    'advisor_name',
    'active_status',
    'role',
    'created_at',
    'updated_at'
  ],
  SYSTEM_CONFIG: [
    'config_key',
    'config_value',
    'updated_at'
  ]
} as const;

export const PRIMARY_KEY_COLUMN: Record<SheetTabName, string> = {
  CUSTOMERS: 'customer_id',
  LEADS: 'lead_id',
  APPLICATIONS: 'application_id',
  FOLLOWUPS: 'followup_id',
  CONSENTS: 'consent_id',
  MESSAGE_EVENTS: 'event_id',
  WEBHOOK_EVENTS: 'event_id',
  ADVISORS: 'advisor_id',
  SYSTEM_CONFIG: 'config_key'
};

export interface CustomerRow {
  customer_id: string;
  customer_name: string;
  mobile_number: string;
  city: string;
  enquiry_source: string;
  created_at: string;
  updated_at: string;
  record_status: 'ACTIVE' | 'OPTED_OUT' | 'INACTIVE';
}

export interface LeadRow {
  lead_id: string;
  customer_id: string;
  loan_category: string;
  requested_amount: string;
  lead_status: string;
  lead_source: string;
  assigned_advisor_id: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  created_at: string;
  updated_at: string;
}

export interface ApplicationRow {
  application_id: string;
  lead_id: string;
  customer_id: string;
  loan_category: string;
  requested_amount: string;
  application_status: string;
  lender_status: string;
  assigned_advisor_id: string;
  created_at: string;
  updated_at: string;
}

export interface FollowupRow {
  followup_id: string;
  lead_id: string;
  customer_id: string;
  advisor_id: string;
  followup_date: string;
  followup_type: string;
  followup_status: 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  short_notes: string;
  created_at: string;
  updated_at: string;
}

export interface ConsentRow {
  consent_id: string;
  customer_id: string;
  channel: string;
  consent_status: 'GRANTED' | 'DENIED' | 'WITHDRAWN' | 'PENDING';
  consent_source: string;
  consent_timestamp: string;
  optout_status: 'OPTED_IN' | 'OPTED_OUT';
  updated_at: string;
}

export interface MessageEventRow {
  event_id: string;
  customer_id: string;
  provider: string;
  message_type: string;
  direction: 'inbound' | 'outbound';
  delivery_status: string;
  provider_message_id: string;
  event_timestamp: string;
}

export interface WebhookEventRow {
  event_id: string;
  provider: string;
  event_type: string;
  processing_status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DUPLICATE' | 'ARCHIVED_HISTORICAL';
  payload_hash: string;
  received_at: string;
  processed_at: string;
  error_code: string;
}

export interface AdvisorRow {
  advisor_id: string;
  advisor_name: string;
  active_status: 'ACTIVE' | 'INACTIVE';
  role: 'CHIEF_LOAN_ADVISOR' | 'LOAN_ADVISOR' | 'OPERATIONS_EXECUTIVE' | 'READ_ONLY' | 'ADMIN';
  created_at: string;
  updated_at: string;
}

export interface SystemConfigRow {
  config_key: string;
  config_value: string;
  updated_at: string;
}

/**
 * Validates that a worksheet's header row exactly matches the canonical schema.
 * Rejects missing, reordered, or unexpected extra columns.
 */
export function validateSheetHeaderRow(
  tab: SheetTabName,
  actualHeaders: string[]
): { valid: boolean; error?: string } {
  const expected = SHEET_COLUMNS[tab];
  if (!expected) {
    return { valid: false, error: `Unknown sheet tab: ${String(tab)}` };
  }
  if (!Array.isArray(actualHeaders) || actualHeaders.length !== expected.length) {
    return {
      valid: false,
      error: `Invalid schema on tab ${tab}: expected ${expected.length} columns (${expected.join(', ')}), got ${
        Array.isArray(actualHeaders) ? actualHeaders.length : 0
      } (${Array.isArray(actualHeaders) ? actualHeaders.join(', ') : 'none'}).`
    };
  }
  for (let i = 0; i < expected.length; i++) {
    const col = String(actualHeaders[i] ?? '').trim();
    if (col !== expected[i]) {
      return {
        valid: false,
        error: `Invalid column on tab ${tab} at position ${i + 1}: expected "${expected[i]}", found "${col}".`
      };
    }
  }
  return { valid: true };
}

export function objectToRowValues<T extends Record<string, any>>(
  tab: SheetTabName,
  record: T
): string[] {
  const cols = SHEET_COLUMNS[tab];
  return cols.map((c) => {
    const v = record[c];
    if (v === undefined || v === null) return '';
    return String(v);
  });
}

export function rowValuesToObject<T = Record<string, string>>(
  tab: SheetTabName,
  values: any[]
): T {
  const cols = SHEET_COLUMNS[tab];
  const out: Record<string, string> = {};
  for (let i = 0; i < cols.length; i++) {
    out[cols[i]] = values[i] !== undefined && values[i] !== null ? String(values[i]) : '';
  }
  return out as unknown as T;
}
