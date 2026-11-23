/**
 * TASK 5H.29 — F-01 FOCUSED TEST SUITE: GOOGLE SHEETS MUTATION RESPONSE HANDLING
 *
 * Tests src/lib/google-sheets/google-sheets-client.ts in APPS_SCRIPT_GATEWAY mode
 * against both mocked HTTP responses AND the actual src/lib/google-sheets/gateway.gs
 * executed inside an isolated Node.js vm sandbox.
 *
 * Execution Mode: 100% Offline (zero live Google Sheets / Apps Script requests).
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const candidate = path.join(SRC_DIR, request.slice(2));
    for (const c of [candidate, `${candidate}.ts`, path.join(candidate, 'index.ts')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
  }
  return origResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = function (mod, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename
  });
  mod._compile(compiled.outputText, filename);
};

const sheets = require('../src/lib/google-sheets/index.ts');
const {
  GoogleSheetsClient,
  SheetsCrmError,
  SHEET_COLUMNS,
  webhookEventRepository,
  customerRepository,
  leadRepository,
  consentRepository,
  followupRepository,
  messageEventRepository,
  CrmSheetsService
} = sheets;

const GAS_CODE = fs.readFileSync(path.join(SRC_DIR, 'lib', 'google-sheets', 'gateway.gs'), 'utf8');
const TEST_SECRET = 'test_5h29_f01_hmac_secret_0123456789abcdef';
const TEST_SPREADSHEET_ID = 'TEST_5H29_SHEET_ID_ISOLATED';

function createGatewayVmFetch() {
  const props = new Map([
    ['GATEWAY_HMAC_SECRET', TEST_SECRET],
    ['ALLOWED_SPREADSHEET_ID', TEST_SPREADSHEET_ID]
  ]);
  const cacheMap = new Map();
  const sheetsMap = new Map();
  for (const [tab, cols] of Object.entries(SHEET_COLUMNS)) {
    sheetsMap.set(tab, [[...cols]]);
  }
  let hasLock = false;

  const sandbox = {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => (props.has(k) ? props.get(k) : null) })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cacheMap.has(k) ? cacheMap.get(k) : null),
        put: (k, v) => cacheMap.set(k, v)
      })
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => { hasLock = true; },
        hasLock: () => hasLock,
        releaseLock: () => { hasLock = false; }
      })
    },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      computeHmacSha256Signature: (data, secret) => {
        const buf = crypto.createHmac('sha256', secret).update(data, 'utf8').digest();
        return Array.from(buf, (b) => (b > 127 ? b - 256 : b));
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (txt) => ({ setMimeType: () => ({ getContent: () => txt }) })
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getId: () => TEST_SPREADSHEET_ID,
        getName: () => 'AVANI_LOAN_SERVICES_CRM_MASTER',
        getSheetByName: (name) => {
          if (!sheetsMap.has(name)) return null;
          return {
            getName: () => name,
            getLastRow: () => sheetsMap.get(name).length,
            getLastColumn: () => sheetsMap.get(name)[0].length,
            getRange: (r, c, nr, nc) => ({
              getValues: () => {
                const table = sheetsMap.get(name);
                const out = [];
                for (let row = r - 1; row < r - 1 + nr; row++) {
                  const line = [];
                  for (let col = c - 1; col < c - 1 + nc; col++) {
                    line.push(table[row]?.[col] ?? '');
                  }
                  out.push(line);
                }
                return out;
              },
              setValues: (vals) => {
                const table = sheetsMap.get(name);
                for (let i = 0; i < vals.length; i++) {
                  table[r - 1 + i] = [...vals[i]];
                }
              }
            }),
            appendRow: (vals) => { sheetsMap.get(name).push([...vals]); },
            deleteRow: (rowIndex1Based) => { sheetsMap.get(name).splice(rowIndex1Based - 1, 1); }
          };
        }
      })
    },
    Date,
    Math,
    JSON,
    Number,
    String,
    Array,
    Object,
    isFinite
  };

  vm.createContext(sandbox);
  vm.runInContext(GAS_CODE, sandbox);

  const mockFetch = async (_url, init) => {
    const rawResp = sandbox.doPost({ postData: { contents: init.body } }).getContent();
    return {
      ok: true,
      status: 200,
      async json() {
        return JSON.parse(rawResp);
      }
    };
  };

  return { mockFetch, sheetsMap };
}

describe('Task 5H.29 F-01 — Google Sheets Mutation Response Handling', () => {
  const origEnv = {
    GOOGLE_SHEETS_TRANSPORT_MODE: process.env.GOOGLE_SHEETS_TRANSPORT_MODE,
    GOOGLE_SHEETS_GATEWAY_URL: process.env.GOOGLE_SHEETS_GATEWAY_URL,
    GOOGLE_SHEETS_GATEWAY_SECRET: process.env.GOOGLE_SHEETS_GATEWAY_SECRET,
    GOOGLE_SHEETS_GATEWAY_TIMEOUT_MS: process.env.GOOGLE_SHEETS_GATEWAY_TIMEOUT_MS
  };
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/offline-vm-mock/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = TEST_SECRET;
    delete process.env.GOOGLE_SHEETS_GATEWAY_TIMEOUT_MS;
    sheets.resetNoncesForTesting();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('T01: Successful nested insertIfAbsent response unwraps data.inserted === true', async () => {
    const { mockFetch } = createGatewayVmFetch();
    globalThis.fetch = mockFetch;
    const client = new GoogleSheetsClient();

    const res = await client.insertIfAbsent('WEBHOOK_EVENTS', {
      event_id: 'META_INBOUND_wamid_f01_001',
      provider: 'Meta',
      event_type: 'INBOUND_MESSAGE',
      processing_status: 'RECEIVED',
      payload_hash: 'a'.repeat(64),
      received_at: new Date().toISOString(),
      processed_at: '',
      error_code: ''
    });

    assert.equal(res.inserted, true);
    assert.equal(res.record.event_id, 'META_INBOUND_wamid_f01_001');
  });

  it('T02: Duplicate nested insertIfAbsent response unwraps data.inserted === false and preserves existingRow', async () => {
    const { mockFetch } = createGatewayVmFetch();
    globalThis.fetch = mockFetch;
    const client = new GoogleSheetsClient();

    const first = await client.insertIfAbsent('WEBHOOK_EVENTS', {
      event_id: 'META_INBOUND_wamid_f01_dup',
      provider: 'Meta',
      event_type: 'INBOUND_MESSAGE',
      processing_status: 'RECEIVED',
      payload_hash: 'b'.repeat(64),
      received_at: '2026-11-20T10:00:00.000Z',
      processed_at: '',
      error_code: ''
    });
    assert.equal(first.inserted, true);

    const second = await client.insertIfAbsent('WEBHOOK_EVENTS', {
      event_id: 'META_INBOUND_wamid_f01_dup',
      provider: 'Meta',
      event_type: 'INBOUND_MESSAGE',
      processing_status: 'RECEIVED',
      payload_hash: 'c'.repeat(64),
      received_at: '2026-11-20T10:05:00.000Z',
      processed_at: '',
      error_code: ''
    });
    assert.equal(second.inserted, false);
    assert.equal(second.record.payload_hash, 'b'.repeat(64));
  });

  it('T03: Successful nested upsertRow create response unwraps data.created === true', async () => {
    const { mockFetch } = createGatewayVmFetch();
    globalThis.fetch = mockFetch;
    const client = new GoogleSheetsClient();

    const res = await client.upsertRow('CUSTOMERS', {
      customer_id: 'CUST-9876543210',
      customer_name: 'Dr Ramesh Kulkarni',
      mobile_number: '+919876543210',
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND',
      created_at: '2026-11-20T10:00:00.000Z',
      updated_at: '2026-11-20T10:00:00.000Z',
      record_status: 'ACTIVE'
    });

    assert.equal(res.created, true);
    assert.equal(res.record.customer_id, 'CUST-9876543210');
  });

  it('T04: Successful nested upsertRow update response unwraps data.created === false', async () => {
    const { mockFetch } = createGatewayVmFetch();
    globalThis.fetch = mockFetch;
    const client = new GoogleSheetsClient();

    const createRes = await client.upsertRow('CUSTOMERS', {
      customer_id: 'CUST-9876543211',
      customer_name: 'Dr Meera Joshi',
      mobile_number: '+919876543211',
      city: 'Pune',
      enquiry_source: 'WHATSAPP_INBOUND',
      created_at: '2026-11-20T10:00:00.000Z',
      updated_at: '2026-11-20T10:00:00.000Z',
      record_status: 'ACTIVE'
    });
    assert.equal(createRes.created, true);

    const updateRes = await client.upsertRow('CUSTOMERS', {
      customer_id: 'CUST-9876543211',
      customer_name: 'Dr Meera Joshi',
      mobile_number: '+919876543211',
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND',
      created_at: '2026-11-20T10:00:00.000Z',
      updated_at: '2026-11-20T10:15:00.000Z',
      record_status: 'ACTIVE'
    });
    assert.equal(updateRes.created, false);
    assert.equal(updateRes.record.city, 'Latur');
  });

  it('T05: Successful nested deleteRowByPrimaryKey unwraps data.deleted === true (and false when absent)', async () => {
    const { mockFetch } = createGatewayVmFetch();
    globalThis.fetch = mockFetch;
    const client = new GoogleSheetsClient();

    await client.upsertRow('SYSTEM_CONFIG', {
      config_key: 'test_temp_key',
      config_value: 'temp_val',
      updated_at: '2026-11-20T10:00:00.000Z'
    });

    const deletedFirst = await client.deleteRowByPrimaryKey('SYSTEM_CONFIG', 'test_temp_key');
    assert.equal(deletedFirst, true);

    const deletedSecond = await client.deleteRowByPrimaryKey('SYSTEM_CONFIG', 'test_temp_key');
    assert.equal(deletedSecond, false);
  });

  it('T06: Gateway returns ok: false -> explicit SheetsCrmError failure (never false success)', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          ok: false,
          status: 400,
          code: 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED',
          error: 'Formula injection blocked'
        };
      }
    });
    const client = new GoogleSheetsClient();

    await assert.rejects(
      () =>
        client.upsertRow('SYSTEM_CONFIG', {
          config_key: 'safe_key',
          config_value: 'safe_value',
          updated_at: '2026-11-20T10:00:00.000Z'
        }),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED' && err.httpStatus === 400
    );
  });

  it('T07: Missing data envelope (flat response without data object) fails safely', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return { ok: true, status: 200, inserted: true };
      }
    });
    const client = new GoogleSheetsClient();

    await assert.rejects(
      () =>
        client.insertIfAbsent('WEBHOOK_EVENTS', {
          event_id: 'EVT_MISSING_DATA',
          provider: 'Meta',
          event_type: 'INBOUND_MESSAGE',
          processing_status: 'RECEIVED',
          payload_hash: 'd'.repeat(64),
          received_at: '2026-11-20T10:00:00.000Z',
          processed_at: '',
          error_code: ''
        }),
      (err) => err instanceof SheetsCrmError && /missing required "data" object envelope/i.test(err.message)
    );
  });

  it('T08: Malformed JSON response fails safely with SheetsCrmError', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        throw new SyntaxError('Unexpected token < in JSON');
      }
    });
    const client = new GoogleSheetsClient();

    await assert.rejects(
      () => client.deleteRowByPrimaryKey('SYSTEM_CONFIG', 'any_key'),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_UNAVAILABLE' && /Malformed JSON/i.test(err.message)
    );
  });

  it('T09: Unexpected mutation response shape (non-boolean or missing flag inside data) fails safely', async () => {
    const badResponses = [
      { ok: true, status: 200, code: 'OK', data: {} },
      { ok: true, status: 200, code: 'OK', data: { inserted: 'true' } },
      { ok: true, status: 200, code: 'OK', data: { created: 1 } },
      { ok: true, status: 200, code: 'OK', data: { deleted: null } }
    ];
    const client = new GoogleSheetsClient();

    // Missing inserted
    globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return badResponses[0]; } });
    await assert.rejects(
      () => client.insertIfAbsent('SYSTEM_CONFIG', { config_key: 'k1', config_value: 'v1', updated_at: '2026-11-20T10:00:00.000Z' }),
      (err) => err instanceof SheetsCrmError && /expected boolean "data\.inserted"/i.test(err.message)
    );

    // String inserted
    globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return badResponses[1]; } });
    await assert.rejects(
      () => client.insertIfAbsent('SYSTEM_CONFIG', { config_key: 'k2', config_value: 'v2', updated_at: '2026-11-20T10:00:00.000Z' }),
      (err) => err instanceof SheetsCrmError && /expected boolean "data\.inserted"/i.test(err.message)
    );

    // Numeric created
    globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return badResponses[2]; } });
    await assert.rejects(
      () => client.upsertRow('SYSTEM_CONFIG', { config_key: 'k3', config_value: 'v3', updated_at: '2026-11-20T10:00:00.000Z' }),
      (err) => err instanceof SheetsCrmError && /expected boolean "data\.created"/i.test(err.message)
    );

    // Null deleted
    globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return badResponses[3]; } });
    await assert.rejects(
      () => client.deleteRowByPrimaryKey('SYSTEM_CONFIG', 'k4'),
      (err) => err instanceof SheetsCrmError && /expected boolean "data\.deleted"/i.test(err.message)
    );
  });

  it('T10: Duplicate webhook event via webhookEventRepository produces no duplicate CRM event', async () => {
    const { mockFetch, sheetsMap } = createGatewayVmFetch();
    globalThis.fetch = mockFetch;

    const first = await webhookEventRepository.registerWebhookEventIdempotent({
      event_id: 'CM_INBOUND_msg_5h29_100',
      provider: 'ChatMitra',
      event_type: 'INBOUND_MESSAGE',
      rawPayloadForHashOnly: { id: 'msg_5h29_100', text: 'Need doctor loan' }
    });
    assert.equal(first.duplicate, false, 'First webhook event MUST NOT be marked duplicate');

    const second = await webhookEventRepository.registerWebhookEventIdempotent({
      event_id: 'CM_INBOUND_msg_5h29_100',
      provider: 'ChatMitra',
      event_type: 'INBOUND_MESSAGE',
      rawPayloadForHashOnly: { id: 'msg_5h29_100', text: 'Need doctor loan' }
    });
    assert.equal(second.duplicate, true, 'Second identical webhook event MUST be marked duplicate');

    const webhookRows = sheetsMap.get('WEBHOOK_EVENTS').slice(1);
    assert.equal(webhookRows.length, 1, 'Exactly one row must exist in WEBHOOK_EVENTS');
  });

  it('T11: Gateway timeout preserves retry behavior and fails safely with SheetsCrmError', async () => {
    process.env.GOOGLE_SHEETS_GATEWAY_TIMEOUT_MS = '60';
    let attempts = 0;
    globalThis.fetch = async (_url, init) => {
      attempts++;
      return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };

    const client = new GoogleSheetsClient();
    await assert.rejects(
      () =>
        client.upsertRow('SYSTEM_CONFIG', {
          config_key: 'timeout_key',
          config_value: 'timeout_val',
          updated_at: '2026-11-20T10:00:00.000Z'
        }),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_UNAVAILABLE' && /timed out/i.test(err.message)
    );
    assert.equal(attempts, 3, 'Idempotent mutation must retry up to maxAttempts=3 on timeout');
  });

  it('T12: Complete persistence call chain via gateway.gs VM creates CUSTOMERS, CONSENTS, LEADS, FOLLOWUPS, and MESSAGE_EVENTS', async () => {
    const { mockFetch, sheetsMap } = createGatewayVmFetch();
    globalThis.fetch = mockFetch;

    const reg = await CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Dr Anita Deshmukh',
      phone: '+919822011223',
      city: 'Latur',
      loanCategory: 'Doctor Loan',
      requestedAmount: '500000',
      leadSource: 'WHATSAPP_INBOUND'
    });

    assert.equal(reg.customer.customer_id, 'CUST-9822011223');
    assert.equal(reg.lead.customer_id, 'CUST-9822011223');
    assert.equal(reg.consent.consent_status, 'GRANTED');

    // Previously broken by F-01 because upsertRow returned created=false, suppressing initial D0 followup!
    const followups = await followupRepository.findByLeadId(reg.lead.lead_id);
    assert.equal(followups.length, 1, 'Initial D0 follow-up MUST be created when lead upsert returns data.created=true');
    assert.equal(followups[0].followup_id, `FUP-${reg.lead.lead_id}-D0`);

    const msgRes = await messageEventRepository.recordMessageEvent({
      customer_id: reg.customer.customer_id,
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: 'wamid.5h29_chain_01'
    });
    assert.equal(msgRes.created, true);

    assert.equal(sheetsMap.get('CUSTOMERS').length - 1, 1);
    assert.equal(sheetsMap.get('CONSENTS').length - 1, 1);
    assert.equal(sheetsMap.get('LEADS').length - 1, 1);
    assert.equal(sheetsMap.get('FOLLOWUPS').length - 1, 1);
    assert.equal(sheetsMap.get('MESSAGE_EVENTS').length - 1, 1);
  });
});
