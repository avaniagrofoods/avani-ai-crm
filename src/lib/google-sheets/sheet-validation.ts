/**
 * TASK 5H.4 + WORKSTREAM C — GOOGLE SHEETS DATA VALIDATION, FORMULA-INJECTION GUARD & PRIVACY SANITIZER
 */

import { SHEET_COLUMNS, SheetTabName } from './sheet-schema';
import { createFormulaInjectionError, createValidationError } from './sheet-error-handler';

export const MAX_FIELD_LENGTH = 500;
export const MAX_SHORT_NOTE_LENGTH = 240;

const FORMULA_PREFIX_REGEX = /^[\s]*[=+\-@]|^[\t\r\n]/;
const DANGEROUS_FORMULA_TOKEN_REGEX =
  /^\s*[=+\-@]\s*[A-Za-z0-9_]+\s*\(|IMPORTXML|IMPORTHTML|IMPORTDATA|IMPORTRANGE|IMAGE\s*\(|HYPERLINK\s*\(/i;
const BLOCKED_BINARY_OR_DATA_URI_REGEX =
  /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,|-----BEGIN\s+[A-Z0-9 ]+-----/i;
const LONG_BASE64_BLOB_REGEX = /(?:^|[\s:=])[A-Za-z0-9+/]{120,}={0,2}(?:$|[\s])/;

export const ALLOWED_LOAN_CATEGORIES = [
  'Personal Loan',
  'Home Loan',
  'Business Loan',
  'Doctor Loan',
  'Mortgage Loan / LAP',
  'Education Loan — India',
  'Education Loan — Global Studies',
  'School Funding',
  'College Funding',
  'CA Professional Loan',
  'Vehicle / Commercial Equipment Loan',
  'Project Finance / Institutional Funding',
  'Loan Transfer / Balance Transfer'
] as const;

export const ALLOWED_CONSENT_STATUSES = ['GRANTED', 'DENIED', 'WITHDRAWN', 'PENDING'] as const;
export const ALLOWED_OPTOUT_STATUSES = ['OPTED_IN', 'OPTED_OUT'] as const;

/**
 * Workstream C Data Minimisation: Sensitive KYC, financial document, and binary attachment keys
 * strictly prohibited at public API boundaries and Google Sheets write paths.
 */
export const PROHIBITED_SENSITIVE_FIELD_KEYS = [
  'aadhaar',
  'aadhar',
  'aadhaarnumber',
  'aadharnumber',
  'aadhaarcopy',
  'pan',
  'pannumber',
  'pancard',
  'pancopy',
  'bankaccount',
  'bankaccountnumber',
  'accountnumber',
  'ifsc',
  'ifsccode',
  'bankstatement',
  'bankstatements',
  'salaryslip',
  'salaryslips',
  'payslip',
  'payslips',
  'creditreport',
  'cibilreport',
  'passport',
  'passportnumber',
  'passportcopy',
  'propertydocument',
  'propertydocuments',
  'identityscan',
  'kycdoc',
  'kycdocument',
  'incomeproof',
  'document',
  'documents',
  'attachment',
  'attachments',
  'file',
  'files',
  'filedata',
  'base64',
  'pdf',
  'photo',
  'photograph',
  'selfie',
  'audiorecording',
  'videorecording',
  'callrecording',
  'recordingurl'
] as const;

const PROHIBITED_KEY_SET = new Set<string>(PROHIBITED_SENSITIVE_FIELD_KEYS);

/**
 * Inspects a request payload recursively (bounded depth) and returns any prohibited
 * KYC, sensitive financial document, or binary attachment keys present with non-empty values.
 */
export function findProhibitedSensitivePayloadKeys(
  payload: unknown,
  depth = 0
): string[] {
  if (!payload || typeof payload !== 'object' || depth > 4) return [];
  const hits: string[] = [];

  if (Array.isArray(payload)) {
    for (const item of payload) {
      hits.push(...findProhibitedSensitivePayloadKeys(item, depth + 1));
    }
    return [...new Set(hits)];
  }

  for (const [rawKey, val] of Object.entries(payload as Record<string, unknown>)) {
    const normKey = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hasValue =
      val !== undefined &&
      val !== null &&
      !(typeof val === 'string' && val.trim() === '') &&
      !(Array.isArray(val) && val.length === 0);

    if (hasValue && PROHIBITED_KEY_SET.has(normKey)) {
      hits.push(rawKey);
    } else if (
      typeof val === 'string' &&
      (BLOCKED_BINARY_OR_DATA_URI_REGEX.test(val) || LONG_BASE64_BLOB_REGEX.test(val))
    ) {
      hits.push(rawKey);
    } else if (val && typeof val === 'object') {
      hits.push(...findProhibitedSensitivePayloadKeys(val, depth + 1));
    }
  }
  return [...new Set(hits)];
}

/**
 * Normalizes an Indian mobile number to E.164 (+91XXXXXXXXXX) and 10-digit raw format.
 * Note: For phone numbers starting with '+91', '+' is a valid E.164 prefix only when followed by 10-12 digits.
 */
export function normalizeMobileNumber(input: string): { e164: string; raw10: string } {
  const raw = String(input || '').trim();
  const digits = raw.replace(/\D/g, '');
  const raw10 = digits.length > 10 ? digits.slice(-10) : digits;
  if (raw10.length !== 10 || !/^[6-9]\d{9}$/.test(raw10)) {
    throw createValidationError(`Invalid Indian mobile number: "${raw}". Must be a 10-digit number starting with 6-9.`);
  }
  return {
    e164: `+91${raw10}`,
    raw10
  };
}

/**
 * Inspects and sanitizes a value before writing to Google Sheets to prevent Spreadsheet Formula Injection,
 * binary/base64 attachment persistence, and accidental sensitive KYC leakage.
 */
export function sanitizeCellForSheets(
  fieldName: string,
  value: unknown,
  options: { allowE164Phone?: boolean; strictRejectFormula?: boolean; maxLength?: number } = {}
): string {
  if (value === undefined || value === null) return '';
  const str = String(value).trim();
  if (!str) return '';

  // Workstream C Data Minimisation: Reject embedded base64/data-URI/PEM blobs fail-closed
  if (BLOCKED_BINARY_OR_DATA_URI_REGEX.test(str) || LONG_BASE64_BLOB_REGEX.test(str)) {
    throw createValidationError(
      `Field "${fieldName}" contains prohibited binary, data-URI, or base64 attachment content.`
    );
  }

  const maxLen = options.maxLength ?? MAX_FIELD_LENGTH;
  if (str.length > maxLen) {
    throw createValidationError(`Field "${fieldName}" exceeds maximum length of ${maxLen} characters (got ${str.length}).`);
  }

  // Allow valid E.164 phone numbers (+919876543210) when explicitly marked as a phone column
  if (options.allowE164Phone && /^\+91[6-9]\d{9}$/.test(str)) {
    return str;
  }

  // Block dangerous spreadsheet formula expressions unconditionally
  if (DANGEROUS_FORMULA_TOKEN_REGEX.test(str)) {
    throw createFormulaInjectionError(fieldName);
  }

  if (FORMULA_PREFIX_REGEX.test(str)) {
    if (options.strictRejectFormula !== false) {
      throw createFormulaInjectionError(fieldName);
    }
    return `'${str}`;
  }

  // Redact sensitive KYC / bank patterns (Aadhaar / PAN / IFSC / 14-19 digit account/card numbers)
  return redactSensitiveKycPatterns(str);
}

export function redactSensitiveKycPatterns(text: string): string {
  return String(text || '')
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, '[REDACTED_PAN]')
    .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, '[REDACTED_IFSC]')
    .replace(/\b\d{14,19}\b/g, '[REDACTED_FINANCIAL_NUM]')
    .replace(/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g, (match) => {
      const digits = match.replace(/\s+/g, '');
      return digits.startsWith('91') ? match : '[REDACTED_AADHAAR]';
    });
}

export function validateCustomerName(name: string): string {
  const clean = sanitizeCellForSheets('customer_name', name, { strictRejectFormula: true, maxLength: 120 });
  if (!clean || clean.length < 2) {
    throw createValidationError('Customer name is required and must be at least 2 characters.');
  }
  return clean;
}

export function validateLoanCategory(input: string): string {
  const clean = sanitizeCellForSheets('loan_category', input || 'Personal Loan', {
    strictRejectFormula: true,
    maxLength: 80
  });
  const upper = clean.toUpperCase().replace(/[^A-Z]/g, '');
  if (upper.includes('DOCTOR') || upper.includes('MEDIC')) return 'Doctor Loan';
  if (upper.includes('VEHICLE') || upper.includes('EQUIPMENT')) return 'Vehicle / Commercial Equipment Loan';
  if (upper.includes('PROJECTFIN') || upper.includes('INSTITUTIONAL')) return 'Project Finance / Institutional Funding';
  if (upper.includes('BALANCETRANSFER') || upper.includes('LOANTRANSFER')) return 'Loan Transfer / Balance Transfer';
  if (upper.includes('BUSIN') || upper.includes('COMMERC') || upper.includes('MSME') || upper.includes('WORKINGCAP')) {
    return 'Business Loan';
  }
  if (upper.includes('MORTG') || upper.includes('LAP') || upper.includes('AGAINSTPROP')) return 'Mortgage Loan / LAP';
  if (upper.includes('HOME') || upper.includes('HOUS')) return 'Home Loan';
  if (upper.includes('GLOBAL') || upper.includes('ABROAD') || upper.includes('OVERSEA')) return 'Education Loan — Global Studies';
  if (upper.includes('EDU') || upper.includes('STUD')) return 'Education Loan — India';
  if (upper.includes('SCHOOL')) return 'School Funding';
  if (upper.includes('COLLEGE')) return 'College Funding';
  if (upper.includes('CA') || upper.includes('CHARTERED') || upper.includes('PROFESSIONAL')) return 'CA Professional Loan';
  if ((ALLOWED_LOAN_CATEGORIES as readonly string[]).includes(clean)) return clean;
  return 'Personal Loan';
}

export function validateRequestedAmount(input: unknown): string {
  if (input === undefined || input === null || input === '') return '0';
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0 || input > 10_000_000_000) {
      throw createValidationError(`Invalid requested loan amount: ${input}`);
    }
    return String(Math.round(input));
  }
  const str = sanitizeCellForSheets('requested_amount', input, { strictRejectFormula: true, maxLength: 40 });
  const numeric = Number(str.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 10_000_000_000) {
    throw createValidationError(`Invalid requested loan amount: "${str}"`);
  }
  return numeric > 0 ? String(Math.round(numeric)) : str;
}

export function validateIsoTimestamp(input?: string | Date | null): string {
  if (!input) return new Date().toISOString();
  const d = input instanceof Date ? input : new Date(String(input));
  if (isNaN(d.getTime())) {
    throw createValidationError(`Invalid timestamp: "${String(input)}"`);
  }
  return d.toISOString();
}

export function validateAdvisorId(input?: string | null): string {
  if (!input) return 'ADV-SACHIN-01';
  const clean = sanitizeCellForSheets('assigned_advisor_id', input, { strictRejectFormula: true, maxLength: 64 });
  if (!/^[A-Za-z0-9_.\-@ ]+$/.test(clean)) {
    throw createValidationError(`Invalid advisor ID format: "${clean}"`);
  }
  return clean;
}

/**
 * Validates that a record object contains only columns permitted for the target sheet tab
 * and sanitizes every cell against formula injection, binary blobs, and oversized strings.
 */
export function validateAndSanitizeSheetRecord<T extends Record<string, any>>(
  tab: SheetTabName,
  record: T
): Record<string, string> {
  const allowedCols = new Set(SHEET_COLUMNS[tab]);
  const keys = Object.keys(record || {});
  for (const k of keys) {
    if (!allowedCols.has(k)) {
      throw createValidationError(`Unexpected column "${k}" rejected for sheet tab "${tab}".`);
    }
  }

  const sanitized: Record<string, string> = {};
  for (const col of SHEET_COLUMNS[tab]) {
    const rawVal = record[col];
    const isPhoneCol = col === 'mobile_number';
    const maxLength = col === 'short_notes' ? MAX_SHORT_NOTE_LENGTH : MAX_FIELD_LENGTH;
    sanitized[col] = sanitizeCellForSheets(col, rawVal, {
      allowE164Phone: isPhoneCol,
      strictRejectFormula: true,
      maxLength
    });
  }
  return sanitized;
}
