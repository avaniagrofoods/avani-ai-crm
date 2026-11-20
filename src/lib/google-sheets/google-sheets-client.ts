/**
 * TASK 5H.4 — GOOGLE SHEETS CLIENT & IN-MEMORY MOCK GATEWAY
 *
 * Supports:
 * 1. APPS_SCRIPT_GATEWAY (Recommended zero-cost architecture with LockService concurrency control)
 * 2. MOCK_IN_MEMORY (Deterministic offline test store with fault, quota, and schema-error injection)
 *
 * Strictly prohibits any MongoDB fallback or local-disk customer data fallback.
 */

import {
  MASTER_SPREADSHEET_NAME,
  PRIMARY_KEY_COLUMN,
  SHEET_COLUMNS,
  SHEET_TABS,
  SHEETS_SCHEMA_VERSION,
  APPLICATION_DATA_VERSION,
  SheetTabName,
  validateSheetHeaderRow,
  objectToRowValues,
  rowValuesToObject
} from './sheet-schema';
import {
  SheetsCrmError,
  createQuotaError,
  createSchemaError,
  createUnavailableError,
  executeWithControlledBackoff
} from './sheet-error-handler';
import { validateAndSanitizeSheetRecord } from './sheet-validation';
import { sheetsWriteMutex } from './sheet-idempotency';
import { signAppsScriptGatewayRequest } from './google-auth';

export type SheetsTransportMode = 'APPS_SCRIPT_GATEWAY' | 'MOCK_IN_MEMORY';

export interface SheetsTestFaultConfig {
  forceUnavailable?: boolean;
  forceQuotaExceeded?: boolean;
  corruptHeaderOnTab?: SheetTabName | null;
  artificialLatencyMs?: number;
}

interface InMemorySpreadsheetState {
  headers: Map<SheetTabName, string[]>;
  rows: Map<SheetTabName, string[][]>;
  faults: SheetsTestFaultConfig;
  writeCount: number;
  readCount: number;
}

function createInitialMockState(): InMemorySpreadsheetState {
  const headers = new Map<SheetTabName, string[]>();
  const rows = new Map<SheetTabName, string[][]>();

  for (const tab of Object.keys(SHEET_TABS) as SheetTabName[]) {
    headers.set(tab, [...SHEET_COLUMNS[tab]]);
    rows.set(tab, []);
  }

  // Seed default advisors & non-secret system config in mock state
  const nowIso = new Date().toISOString();
  rows.get('ADVISORS')!.push(
    ['ADV-SACHIN-01', 'Sachin Shinde', 'ACTIVE', 'CHIEF_LOAN_ADVISOR', nowIso, nowIso],
    ['ADV-OPS-02', 'Avani Operations Desk', 'ACTIVE', 'OPERATIONS_EXECUTIVE', nowIso, nowIso]
  );

  rows.get('SYSTEM_CONFIG')!.push(
    ['spreadsheet_name', MASTER_SPREADSHEET_NAME, nowIso],
    ['spreadsheet_schema_version', SHEETS_SCHEMA_VERSION, nowIso],
    ['application_data_version', APPLICATION_DATA_VERSION, nowIso],
    ['last_sync_timestamp', nowIso, nowIso],
    ['sheet_names', Object.keys(SHEET_TABS).join(','), nowIso],
    ['schema_validation_status', 'VALID', nowIso],
    ['system_health_status', 'HEALTHY', nowIso]
  );

  return {
    headers,
    rows,
    faults: {},
    writeCount: 0,
    readCount: 0
  };
}

const globalForSheets = globalThis as unknown as {
  __avaniSheetsMockState?: InMemorySpreadsheetState;
};

function getMockState(): InMemorySpreadsheetState {
  if (!globalForSheets.__avaniSheetsMockState) {
    globalForSheets.__avaniSheetsMockState = createInitialMockState();
  }
  return globalForSheets.__avaniSheetsMockState;
}

export function resetMockSheetsStore(): void {
  globalForSheets.__avaniSheetsMockState = createInitialMockState();
}

export function configureMockSheetsFaults(faults: SheetsTestFaultConfig): void {
  const state = getMockState();
  state.faults = { ...faults };
  if (faults.corruptHeaderOnTab) {
    state.headers.set(faults.corruptHeaderOnTab, ['corrupted_column_1', 'unexpected_col_2']);
  } else {
    for (const tab of Object.keys(SHEET_TABS) as SheetTabName[]) {
      state.headers.set(tab, [...SHEET_COLUMNS[tab]]);
    }
  }
}

export function getMockSheetsTelemetry(): { writeCount: number; readCount: number } {
  const state = getMockState();
  return { writeCount: state.writeCount, readCount: state.readCount };
}

export function resolveTransportMode(): SheetsTransportMode {
  const explicitMode = String(process.env.GOOGLE_SHEETS_TRANSPORT_MODE || '').trim().toUpperCase();
  if (explicitMode === 'MOCK' || explicitMode === 'MOCK_IN_MEMORY') {
    return 'MOCK_IN_MEMORY';
  }
  if (explicitMode === 'APPS_SCRIPT_GATEWAY' || explicitMode === 'LIVE') {
    return 'APPS_SCRIPT_GATEWAY';
  }
  // In test or offline development when no live gateway URL is configured, allow mock mode only if explicitly enabled or NODE_ENV=test
  if (process.env.NODE_ENV === 'test' || process.env.GOOGLE_SHEETS_ENABLE_MOCK === 'true') {
    return 'MOCK_IN_MEMORY';
  }
  return 'APPS_SCRIPT_GATEWAY';
}

function assertNotFaulted(tab?: SheetTabName): void {
  const state = getMockState();
  if (state.faults.forceUnavailable || process.env.GOOGLE_SHEETS_FORCE_OFFLINE === 'true') {
    throw createUnavailableError('Service offline or unreachable');
  }
  if (state.faults.forceQuotaExceeded) {
    throw createQuotaError('Per-minute read/write request quota exceeded (60 req/min/user)');
  }
  if (tab) {
    const actualHeaders = state.headers.get(tab) || [];
    const check = validateSheetHeaderRow(tab, actualHeaders);
    if (!check.valid) {
      throw createSchemaError(check.error || `Invalid schema on tab ${tab}`);
    }
  }
}

export class GoogleSheetsClient {
  public async checkConnectivity(): Promise<{
    online: boolean;
    mode: SheetsTransportMode;
    spreadsheetName: string;
    schemaVersion: string;
    error?: string;
    errorCode?: SheetsCrmError['code'];
    httpStatus?: number;
  }> {
    const mode = resolveTransportMode();
    try {
      if (mode === 'MOCK_IN_MEMORY') {
        assertNotFaulted('SYSTEM_CONFIG');
        return {
          online: true,
          mode,
          spreadsheetName: MASTER_SPREADSHEET_NAME,
          schemaVersion: SHEETS_SCHEMA_VERSION
        };
      }

      const gatewayUrl = String(process.env.GOOGLE_SHEETS_GATEWAY_URL || '').trim();
      if (!gatewayUrl) {
        throw createUnavailableError('GOOGLE_SHEETS_GATEWAY_URL is not configured.');
      }
      const res = await this.dispatchGatewayRequest({ action: 'HEALTH_CHECK' }, true);
      return {
        online: Boolean(res?.ok),
        mode,
        spreadsheetName: MASTER_SPREADSHEET_NAME,
        schemaVersion: SHEETS_SCHEMA_VERSION
      };
    } catch (err: any) {
      return {
        online: false,
        mode,
        spreadsheetName: MASTER_SPREADSHEET_NAME,
        schemaVersion: SHEETS_SCHEMA_VERSION,
        error: err?.message || 'Google Sheets unavailable',
        errorCode: err instanceof SheetsCrmError ? err.code : 'GOOGLE_SHEETS_UNAVAILABLE',
        httpStatus: err instanceof SheetsCrmError ? err.httpStatus : 503
      };
    }
  }

  public async getAllRows<T = Record<string, string>>(tab: SheetTabName): Promise<T[]> {
    const mode = resolveTransportMode();
    if (mode === 'MOCK_IN_MEMORY') {
      assertNotFaulted(tab);
      const state = getMockState();
      state.readCount++;
      const rawRows = state.rows.get(tab) || [];
      return rawRows.map((r) => rowValuesToObject<T>(tab, r));
    }

    const res = await this.dispatchGatewayRequest({ action: 'GET_ALL', tab }, true);
    const data = res?.data ?? res;
    if (Array.isArray(data?.headers)) {
      const check = validateSheetHeaderRow(tab, data.headers);
      if (!check.valid) throw createSchemaError(check.error!);
    }
    const rawRows: any[][] = Array.isArray(data?.rows) ? data.rows : [];
    return rawRows.map((r) => rowValuesToObject<T>(tab, r));
  }

  /**
   * Batched multi-tab read (GET_SNAPSHOT) to conserve Google Sheets / Apps Script quotas.
   * Reduces N separate GET_ALL calls to 1 HTTP round-trip.
   */
  public async getSnapshot<T extends Record<string, any> = Record<string, string>>(
    tabs: SheetTabName[]
  ): Promise<Partial<Record<SheetTabName, T[]>>> {
    const uniqueTabs = Array.from(new Set(tabs));
    const mode = resolveTransportMode();
    if (mode === 'MOCK_IN_MEMORY') {
      const state = getMockState();
      state.readCount++;
      const out: Partial<Record<SheetTabName, T[]>> = {};
      for (const tab of uniqueTabs) {
        assertNotFaulted(tab);
        const rawRows = state.rows.get(tab) || [];
        out[tab] = rawRows.map((r) => rowValuesToObject<T>(tab, r));
      }
      return out;
    }

    const res = await this.dispatchGatewayRequest({ action: 'GET_SNAPSHOT', tabs: uniqueTabs }, true);
    const data = res?.data ?? res;
    const tabPayload = data?.tabs ?? {};
    const out: Partial<Record<SheetTabName, T[]>> = {};
    for (const tab of uniqueTabs) {
      const entry = tabPayload[tab];
      if (!entry) {
        throw createSchemaError(`Missing tab "${tab}" in GET_SNAPSHOT response`);
      }
      if (Array.isArray(entry.headers)) {
        const check = validateSheetHeaderRow(tab, entry.headers);
        if (!check.valid) throw createSchemaError(check.error!);
      }
      const rawRows: any[][] = Array.isArray(entry.rows) ? entry.rows : [];
      out[tab] = rawRows.map((r) => rowValuesToObject<T>(tab, r));
    }
    return out;
  }

  public async findRowByPrimaryKey<T = Record<string, string>>(
    tab: SheetTabName,
    keyValue: string
  ): Promise<T | null> {
    if (!keyValue) return null;
    const pkCol = PRIMARY_KEY_COLUMN[tab];
    const rows = await this.getAllRows<Record<string, string>>(tab);
    const match = rows.find((r) => r[pkCol] === String(keyValue));
    return (match as unknown as T) || null;
  }

  /**
   * Serialized, lock-protected atomic upsert on a worksheet tab.
   */
  public async upsertRow<T extends Record<string, any>>(
    tab: SheetTabName,
    record: T
  ): Promise<{ record: T; created: boolean }> {
    const sanitized = validateAndSanitizeSheetRecord(tab, record);
    const pkCol = PRIMARY_KEY_COLUMN[tab];
    const pkVal = sanitized[pkCol];
    if (!pkVal) {
      throw new SheetsCrmError({
        code: 'GOOGLE_SHEETS_VALIDATION_FAILED',
        message: `Missing primary key "${pkCol}" for sheet tab "${tab}".`,
        httpStatus: 400
      });
    }

    return sheetsWriteMutex.withLock(async () => {
      const mode = resolveTransportMode();
      if (mode === 'MOCK_IN_MEMORY') {
        assertNotFaulted(tab);
        const state = getMockState();
        if (state.faults.artificialLatencyMs) {
          await new Promise((r) => setTimeout(r, state.faults.artificialLatencyMs));
        }
        const tabRows = state.rows.get(tab)!;
        const pkIndex = SHEET_COLUMNS[tab].indexOf(pkCol);
        const existingIdx = tabRows.findIndex((r) => r[pkIndex] === pkVal);
        const rowValues = objectToRowValues(tab, sanitized);
        state.writeCount++;

        if (existingIdx >= 0) {
          // Preserve original created_at if present
          const createdColIdx = SHEET_COLUMNS[tab].indexOf('created_at');
          if (createdColIdx >= 0 && tabRows[existingIdx][createdColIdx] && !record.created_at) {
            rowValues[createdColIdx] = tabRows[existingIdx][createdColIdx];
          }
          tabRows[existingIdx] = rowValues;
          return { record: rowValuesToObject<T>(tab, rowValues), created: false };
        } else {
          tabRows.push(rowValues);
          return { record: rowValuesToObject<T>(tab, rowValues), created: true };
        }
      }

      const res = await this.dispatchGatewayRequest(
        {
          action: 'UPSERT_ROW',
          tab,
          primaryKeyColumn: pkCol,
          primaryKeyValue: pkVal,
          rowValues: objectToRowValues(tab, sanitized)
        },
        true
      );
      return {
        record: (sanitized as unknown) as T,
        created: Boolean(res?.created)
      };
    });
  }

  /**
   * Serialized, lock-protected atomic insert-if-absent (for idempotent webhook / message events).
   * Returns { inserted: false } if the primary key already exists.
   */
  public async insertIfAbsent<T extends Record<string, any>>(
    tab: SheetTabName,
    record: T
  ): Promise<{ record: T; inserted: boolean }> {
    const sanitized = validateAndSanitizeSheetRecord(tab, record);
    const pkCol = PRIMARY_KEY_COLUMN[tab];
    const pkVal = sanitized[pkCol];
    if (!pkVal) {
      throw new SheetsCrmError({
        code: 'GOOGLE_SHEETS_VALIDATION_FAILED',
        message: `Missing primary key "${pkCol}" for sheet tab "${tab}".`,
        httpStatus: 400
      });
    }

    return sheetsWriteMutex.withLock(async () => {
      const mode = resolveTransportMode();
      if (mode === 'MOCK_IN_MEMORY') {
        assertNotFaulted(tab);
        const state = getMockState();
        if (state.faults.artificialLatencyMs) {
          await new Promise((r) => setTimeout(r, state.faults.artificialLatencyMs));
        }
        const tabRows = state.rows.get(tab)!;
        const pkIndex = SHEET_COLUMNS[tab].indexOf(pkCol);
        const existingIdx = tabRows.findIndex((r) => r[pkIndex] === pkVal);
        if (existingIdx >= 0) {
          return {
            record: rowValuesToObject<T>(tab, tabRows[existingIdx]),
            inserted: false
          };
        }
        const rowValues = objectToRowValues(tab, sanitized);
        tabRows.push(rowValues);
        state.writeCount++;
        return {
          record: rowValuesToObject<T>(tab, rowValues),
          inserted: true
        };
      }

      const res = await this.dispatchGatewayRequest(
        {
          action: 'INSERT_IF_ABSENT',
          tab,
          primaryKeyColumn: pkCol,
          primaryKeyValue: pkVal,
          rowValues: objectToRowValues(tab, sanitized)
        },
        true
      );
      return {
        record: (sanitized as unknown) as T,
        inserted: Boolean(res?.inserted)
      };
    });
  }

  public async deleteRowByPrimaryKey(tab: SheetTabName, keyValue: string): Promise<boolean> {
    if (!keyValue) return false;
    const pkCol = PRIMARY_KEY_COLUMN[tab];

    return sheetsWriteMutex.withLock(async () => {
      const mode = resolveTransportMode();
      if (mode === 'MOCK_IN_MEMORY') {
        assertNotFaulted(tab);
        const state = getMockState();
        const tabRows = state.rows.get(tab)!;
        const pkIndex = SHEET_COLUMNS[tab].indexOf(pkCol);
        const idx = tabRows.findIndex((r) => r[pkIndex] === keyValue);
        if (idx === -1) return false;
        tabRows.splice(idx, 1);
        state.writeCount++;
        return true;
      }

      const res = await this.dispatchGatewayRequest(
        {
          action: 'DELETE_ROW',
          tab,
          primaryKeyColumn: pkCol,
          primaryKeyValue: keyValue
        },
        true
      );
      return Boolean(res?.deleted);
    });
  }

  private async dispatchGatewayRequest(
    payload: Record<string, any>,
    isIdempotent: boolean
  ): Promise<any> {
    const gatewayUrl = String(process.env.GOOGLE_SHEETS_GATEWAY_URL || '').trim();
    if (!gatewayUrl) {
      throw createUnavailableError('GOOGLE_SHEETS_GATEWAY_URL is not configured in server environment.');
    }

    return executeWithControlledBackoff(
      async () => {
        const envelope = signAppsScriptGatewayRequest(payload);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(gatewayUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: envelope.bodyString,
            signal: controller.signal
          });

          if (response.status === 429) {
            throw createQuotaError('Google Apps Script / Sheets API returned HTTP 429');
          }
          if (response.status >= 500) {
            throw createUnavailableError(`Gateway returned HTTP ${response.status}`);
          }

          const json = await response.json().catch(() => null);
          if (!response.ok || !json || json.ok === false) {
            const errCode = json?.code || json?.errorCode;
            if (errCode === 'GOOGLE_SHEETS_QUOTA_EXCEEDED' || errCode === 'QUOTA_EXCEEDED' || json?.status === 429) {
              throw createQuotaError(json?.error || 'Quota exceeded');
            }
            if (errCode === 'GOOGLE_SHEETS_SCHEMA_INVALID' || errCode === 'SCHEMA_INVALID') {
              throw createSchemaError(json?.error || 'Invalid sheet schema');
            }
            if (errCode === 'GOOGLE_SHEETS_AUTH_FAILED' || json?.status === 401 || json?.status === 403) {
              throw new SheetsCrmError({
                code: 'GOOGLE_SHEETS_AUTH_FAILED',
                message: json?.error || 'Gateway authentication failed',
                httpStatus: 401,
                retryable: false
              });
            }
            if (errCode === 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED') {
              throw new SheetsCrmError({
                code: 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED',
                message: json?.error || 'Formula injection blocked by gateway',
                httpStatus: 400,
                retryable: false
              });
            }
            throw createUnavailableError(json?.error || `Gateway error (HTTP ${response.status})`);
          }
          return json;
        } catch (err: any) {
          if (err instanceof SheetsCrmError) throw err;
          throw createUnavailableError(err?.message || 'Network request to Google Sheets Gateway failed');
        } finally {
          clearTimeout(timeout);
        }
      },
      { isIdempotent }
    );
  }
}

export const defaultSheetsClient = new GoogleSheetsClient();
