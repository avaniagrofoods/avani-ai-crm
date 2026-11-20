/**
 * TASK 5H.4 — SHEET 1: CUSTOMERS REPOSITORY
 * Columns: customer_id, customer_name, mobile_number, city, enquiry_source, created_at, updated_at, record_status
 */

import { BaseSheetsRepository } from './sheets-repository';
import { CustomerRow } from './sheet-schema';
import {
  normalizeMobileNumber,
  sanitizeCellForSheets,
  validateCustomerName,
  validateIsoTimestamp
} from './sheet-validation';

export class CustomerRepository extends BaseSheetsRepository<CustomerRow> {
  constructor() {
    super('CUSTOMERS');
  }

  public static buildDeterministicCustomerId(raw10Digits: string): string {
    return `CUST-${raw10Digits}`;
  }

  public async findByMobile(phoneInput: string): Promise<CustomerRow | null> {
    let normalized: { e164: string; raw10: string };
    try {
      normalized = normalizeMobileNumber(phoneInput);
    } catch {
      return null;
    }
    const all = await this.findAll();
    return (
      all.find(
        (c) =>
          c.mobile_number === normalized.e164 ||
          c.mobile_number.replace(/\D/g, '').slice(-10) === normalized.raw10 ||
          c.customer_id === CustomerRepository.buildDeterministicCustomerId(normalized.raw10)
      ) || null
    );
  }

  public async upsertCustomer(params: {
    customer_id?: string;
    customer_name: string;
    mobile_number: string;
    city?: string;
    enquiry_source?: string;
    record_status?: 'ACTIVE' | 'OPTED_OUT' | 'INACTIVE';
    created_at?: string | Date;
    updated_at?: string | Date;
  }): Promise<{ record: CustomerRow; created: boolean }> {
    const mobile = normalizeMobileNumber(params.mobile_number);
    const name = validateCustomerName(params.customer_name || 'Valued Customer');
    const existing = await this.findByMobile(mobile.e164);

    const customerId =
      existing?.customer_id ||
      params.customer_id ||
      CustomerRepository.buildDeterministicCustomerId(mobile.raw10);

    const nowIso = validateIsoTimestamp(params.updated_at);
    const createdIso = existing?.created_at || validateIsoTimestamp(params.created_at || nowIso);

    const row: CustomerRow = {
      customer_id: sanitizeCellForSheets('customer_id', customerId),
      customer_name: name,
      mobile_number: mobile.e164,
      city: sanitizeCellForSheets('city', params.city ?? existing?.city ?? 'Latur'),
      enquiry_source: sanitizeCellForSheets(
        'enquiry_source',
        params.enquiry_source ?? existing?.enquiry_source ?? 'WHATSAPP_INBOUND'
      ),
      created_at: createdIso,
      updated_at: nowIso,
      record_status:
        params.record_status ??
        (existing?.record_status === 'OPTED_OUT' ? 'OPTED_OUT' : 'ACTIVE')
    };

    return this.upsert(row);
  }
}

export const customerRepository = new CustomerRepository();
