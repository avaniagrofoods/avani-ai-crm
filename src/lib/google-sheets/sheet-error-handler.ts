/**
 * TASK 5H.4 — GOOGLE SHEETS STRUCTURED ERROR HANDLER, CORRELATION ID & BACKOFF ENGINE
 * Enforces fail-closed behavior with zero automatic MongoDB or local-file fallback.
 */

import crypto from 'node:crypto';

export type SheetsErrorCode =
  | 'GOOGLE_SHEETS_UNAVAILABLE'
  | 'GOOGLE_SHEETS_QUOTA_EXCEEDED'
  | 'GOOGLE_SHEETS_SCHEMA_INVALID'
  | 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED'
  | 'GOOGLE_SHEETS_VALIDATION_FAILED'
  | 'GOOGLE_SHEETS_DUPLICATE_EVENT'
  | 'GOOGLE_SHEETS_AUTH_FAILED'
  | 'GOOGLE_SHEETS_LOCK_TIMEOUT'
  | 'DOCUMENT_UPLOAD_DISABLED';

export class SheetsCrmError extends Error {
  public readonly code: SheetsErrorCode;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly correlationId: string;

  constructor(params: {
    code: SheetsErrorCode;
    message: string;
    httpStatus: number;
    retryable?: boolean;
    correlationId?: string;
  }) {
    super(params.message);
    this.name = 'SheetsCrmError';
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.retryable = Boolean(params.retryable);
    this.correlationId = params.correlationId || generateCorrelationId('SHEETS');
  }
}

export function generateCorrelationId(prefix = 'CRM'): string {
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${Date.now()}-${rand}`;
}

export function createUnavailableError(reason: string, correlationId?: string): SheetsCrmError {
  return new SheetsCrmError({
    code: 'GOOGLE_SHEETS_UNAVAILABLE',
    message: `Google Sheets CRM store unavailable: ${reason}`,
    httpStatus: 503,
    retryable: true,
    correlationId
  });
}

export function createQuotaError(reason: string, correlationId?: string): SheetsCrmError {
  return new SheetsCrmError({
    code: 'GOOGLE_SHEETS_QUOTA_EXCEEDED',
    message: `Google Sheets API quota limit reached: ${reason}`,
    httpStatus: 429,
    retryable: true,
    correlationId
  });
}

export function createSchemaError(reason: string, correlationId?: string): SheetsCrmError {
  return new SheetsCrmError({
    code: 'GOOGLE_SHEETS_SCHEMA_INVALID',
    message: `Google Sheets schema validation failed: ${reason}`,
    httpStatus: 500,
    retryable: false,
    correlationId
  });
}

export function createValidationError(reason: string, correlationId?: string): SheetsCrmError {
  return new SheetsCrmError({
    code: 'GOOGLE_SHEETS_VALIDATION_FAILED',
    message: reason,
    httpStatus: 400,
    retryable: false,
    correlationId
  });
}

export function createFormulaInjectionError(field: string, correlationId?: string): SheetsCrmError {
  return new SheetsCrmError({
    code: 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED',
    message: `Untrusted formula expression blocked in field "${field}".`,
    httpStatus: 400,
    retryable: false,
    correlationId
  });
}

export function createDuplicateEventError(eventId: string, correlationId?: string): SheetsCrmError {
  return new SheetsCrmError({
    code: 'GOOGLE_SHEETS_DUPLICATE_EVENT',
    message: `Duplicate event rejected: ${eventId}`,
    httpStatus: 409,
    retryable: false,
    correlationId
  });
}

/**
 * Controlled exponential backoff for eligible idempotent or read operations only.
 * Never retries non-idempotent mutations without an explicit idempotency key.
 */
export async function executeWithControlledBackoff<T>(
  operation: () => Promise<T>,
  options: {
    isIdempotent: boolean;
    maxAttempts?: number;
    baseDelayMs?: number;
    correlationId?: string;
  }
): Promise<T> {
  const maxAttempts = options.isIdempotent ? Math.min(options.maxAttempts ?? 3, 4) : 1;
  const baseDelayMs = options.baseDelayMs ?? 150;
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        options.isIdempotent &&
        attempt < maxAttempts &&
        (err instanceof SheetsCrmError ? err.retryable : Boolean(err?.retryable));
      if (!isRetryable) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 40);
      const waitMs = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}
