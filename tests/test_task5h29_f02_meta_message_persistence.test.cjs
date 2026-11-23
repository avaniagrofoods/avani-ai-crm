/**
 * TASK 5H.29 — F-02 FOCUSED TEST SUITE: META WHATSAPP MESSAGE PERSISTENCE
 *
 * Tests src/lib/aisensy.ts, src/app/api/whatsapp-webhook-worker/route.ts, and
 * Google Sheets messageEventRepository integration with zero live Meta, ChatMitra,
 * MongoDB, PostgreSQL, or Google Sheets calls.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// Verify statically that src/lib/aisensy.ts has ZERO MongoDB / Mongoose / PostgreSQL imports or references
const aisensySource = fs.readFileSync(path.join(SRC_DIR, 'lib', 'aisensy.ts'), 'utf8');

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

// Mock next/server and poison MongoDB & PostgreSQL modules to PROVE zero runtime dependency
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
    static json(data, init = {}) {
      return new MockNextResponse(data, init);
    }
  }
};

let mongoAttemptCount = 0;
let postgresAttemptCount = 0;

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'next/server') return nextServerMock;
  if (request === '@vercel/functions') {
    return { waitUntil: (p) => Promise.resolve(p).catch(() => {}) };
  }
  if (request === '@/lib/db' || request === './db' || request === 'mongoose' || request === '@/models/Message' || request === '@/models/ProviderLedger') {
    mongoAttemptCount++;
    throw new Error(`MongoDB unavailable (prohibited dependency accessed: ${request})`);
  }
  if (request === './postgres' || request === '@/lib/postgres') {
    postgresAttemptCount++;
    throw new Error(`PostgreSQL unavailable (prohibited dependency accessed: ${request})`);
  }
  return origLoad.call(this, request, parent, isMain);
};

const axios = require('axios');
const sheets = require('../src/lib/google-sheets/index.ts');
const aisensy = require('../src/lib/aisensy.ts');
const workerRoute = require('../src/app/api/whatsapp-webhook-worker/route.ts');

const {
  resetMockSheetsStore,
  configureMockSheetsFaults,
  customerRepository,
  leadRepository,
  messageEventRepository,
  webhookEventRepository,
  SHEET_COLUMNS
} = sheets;

describe('Task 5H.29 F-02 — Meta WhatsApp Message Persistence via Google Sheets', () => {
  const origAxiosPost = axios.post;
  const origEnv = {
    PROVIDER_MODE: process.env.PROVIDER_MODE,
    AUTHORIZED_TEST_PHONE_CANONICAL: process.env.AUTHORIZED_TEST_PHONE_CANONICAL,
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    OMNIDIM_API_KEY: process.env.OMNIDIM_API_KEY,
    AISENSY_API_KEY: process.env.AISENSY_API_KEY,
    AISENSY_WABA_API_KEY: process.env.AISENSY_WABA_API_KEY,
    AISENCY_WABA_API_KEY: process.env.AISENCY_WABA_API_KEY,
    GOOGLE_SHEETS_TRANSPORT_MODE: process.env.GOOGLE_SHEETS_TRANSPORT_MODE,
    GOOGLE_SHEETS_ENABLE_MOCK: process.env.GOOGLE_SHEETS_ENABLE_MOCK,
    INTERNAL_WORKER_SECRET: process.env.INTERNAL_WORKER_SECRET,
    WHATSAPP_INBOUND_AI_REPLY_ENABLED: process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED,
    AISENSY_INBOUND_WEBHOOK_ENABLED: process.env.AISENSY_INBOUND_WEBHOOK_ENABLED
  };

  beforeEach(() => {
    mongoAttemptCount = 0;
    postgresAttemptCount = 0;
    resetMockSheetsStore();
    configureMockSheetsFaults({ forceUnavailable: false, forceQuotaExceeded: false, corruptHeaderOnTab: null });
    process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'MOCK_IN_MEMORY';
    process.env.GOOGLE_SHEETS_ENABLE_MOCK = 'true';
    process.env.PROVIDER_MODE = 'live';
    process.env.AUTHORIZED_TEST_PHONE_CANONICAL = '919175635165';
    process.env.WHATSAPP_TOKEN = 'EAAG_SYNTHETIC_TEST_TOKEN_DO_NOT_USE_1234567890';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1147494668457940';
    delete process.env.OMNIDIM_API_KEY;
    delete process.env.AISENSY_API_KEY;
    delete process.env.AISENSY_WABA_API_KEY;
    delete process.env.AISENCY_WABA_API_KEY;
    process.env.INTERNAL_WORKER_SECRET = 'synthetic_worker_secret_5h29_abcdef123456';
  });

  afterEach(() => {
    axios.post = origAxiosPost;
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('T01/T02: Outbound Meta message event is recorded via Google Sheets messageEventRepository with canonical metadata only', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Sachin Test',
      mobile_number: '+919175635165',
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    axios.post = async (url) => {
      assert.ok(url.includes('graph.facebook.com/v25.0/1147494668457940/messages'));
      return { data: { messages: [{ id: 'wamid.5h29_meta_001' }] } };
    };

    const res = await aisensy.sendAiSensyWhatsApp(
      {
        destination: '+919175635165',
        userName: 'Sachin Test',
        text: 'Doctor Loan overview — secret body must not be stored in MESSAGE_EVENTS',
        customerId: 'CUST-9175635165'
      },
      'corr_001'
    );

    assert.equal(res.success, true);
    assert.equal(res.persisted, true);
    assert.equal(res.provider, 'Meta');
    assert.equal(res.messageId, 'wamid.5h29_meta_001');
    assert.equal(res.eventId, 'MSG_META_wamid.5h29_meta_001');
    assert.equal(res.customerId, 'CUST-9175635165');
    assert.equal(res.status, 'SENT');

    const stored = await messageEventRepository.findByProviderMessageId('wamid.5h29_meta_001', 'Meta');
    assert.ok(stored, 'Row must exist in MESSAGE_EVENTS');
    assert.deepEqual(Object.keys(stored).sort(), [...SHEET_COLUMNS.MESSAGE_EVENTS].sort());
    assert.equal(stored.direction, 'outbound');
    assert.equal(stored.provider, 'Meta');
    assert.equal(stored.delivery_status, 'SENT');
    assert.equal(JSON.stringify(stored).includes('secret body'), false, 'Message text must never be persisted');
  });

  it('T03/T11: Duplicate provider message ID and retries produce idempotent result with zero duplicate rows', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Sachin',
      mobile_number: '+919175635165',
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    axios.post = async () => ({ data: { messages: [{ id: 'wamid.5h29_dup_001' }] } });

    const first = await aisensy.sendAiSensyWhatsApp(
      { destination: '+919175635165', userName: 'Sachin', text: 'First send', customerId: 'CUST-9175635165' },
      'corr_dup_1'
    );
    assert.equal(first.success, true);
    assert.equal(first.duplicate, false);

    const retry = await aisensy.sendAiSensyWhatsApp(
      { destination: '+919175635165', userName: 'Sachin', text: 'Retry send', customerId: 'CUST-9175635165' },
      'corr_dup_2'
    );
    assert.equal(retry.success, true);
    assert.equal(retry.persisted, true);
    assert.equal(retry.duplicate, true);

    const allMsgs = await messageEventRepository.findAll();
    assert.equal(allMsgs.length, 1, 'Duplicate retry must not create a second MESSAGE_EVENTS row');
  });

  it('T04/T05: Failed Sheets write / Sheets gateway unavailable fails safely with no false success and no MongoDB fallback', async () => {
    axios.post = async () => ({ data: { messages: [{ id: 'wamid.5h29_sheets_down' }] } });
    configureMockSheetsFaults({ forceUnavailable: true });

    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: '+919175635165', userName: 'Sachin', text: 'Hello', customerId: 'CUST-9175635165' },
      'corr_down'
    );

    assert.equal(res.success, false, 'Must NOT report success when Sheets persistence fails');
    assert.equal(res.persisted, false);
    assert.equal(res.persistenceFailed, true);
    assert.equal(res.status, 'PERSISTENCE_FAILED');
    assert.equal(res.persistenceErrorCode, 'GOOGLE_SHEETS_UNAVAILABLE');
    assert.equal(res.messageId, 'wamid.5h29_sheets_down');
    assert.equal(mongoAttemptCount, 0, 'Must NEVER fall back to MongoDB');
    assert.equal(postgresAttemptCount, 0, 'Must NEVER fall back to PostgreSQL');
  });

  it('T06/T07: Static and runtime proof that MongoDB and PostgreSQL unavailability do not affect Meta persistence path', async () => {
    assert.equal(/connectToDatabase|mongoose|@\/models\/Message|ProviderLedger/.test(aisensySource), false);
    assert.equal(/\.\/postgres|@\/lib\/postgres/.test(aisensySource), false);

    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Sachin',
      mobile_number: '+919175635165',
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });

    axios.post = async () => ({ data: { messages: [{ id: 'wamid.5h29_no_db_001' }] } });
    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: '+919175635165', userName: 'Sachin', text: 'No Mongo/Postgres' },
      'corr_nodb'
    );

    assert.equal(res.success, true);
    assert.equal(res.persisted, true);
    assert.equal(mongoAttemptCount, 0);
    assert.equal(postgresAttemptCount, 0);
  });

  it('T08: Explicit customerId is associated accurately in MESSAGE_EVENTS', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-EXPLICIT-77',
      customer_name: 'Sachin Explicit',
      mobile_number: '+919175635165',
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    axios.post = async () => ({ data: { messages: [{ id: 'wamid.5h29_cust_001' }] } });

    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: '+919175635165', userName: 'Sachin', text: 'Check customer', customerId: 'CUST-EXPLICIT-77' },
      'corr_cust'
    );

    assert.equal(res.success, true);
    assert.equal(res.customerId, 'CUST-EXPLICIT-77');
    const row = await messageEventRepository.findByProviderMessageId('wamid.5h29_cust_001', 'Meta');
    assert.equal(row.customer_id, 'CUST-EXPLICIT-77');
  });

  it('T09: Lead ID resolves canonical customer_id from LEADS tab when customerId is omitted', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Sachin Lead Owner',
      mobile_number: '+919175635165',
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    const { record: lead } = await leadRepository.upsertLead({
      lead_id: 'AVL-20261120-555555',
      customer_id: 'CUST-9175635165',
      loan_category: 'Doctor Loan',
      requested_amount: '500000'
    });

    axios.post = async () => ({ data: { messages: [{ id: 'wamid.5h29_lead_001' }] } });
    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: '+919175635165', userName: 'Sachin', text: 'Lead reply', leadId: lead.lead_id },
      'corr_lead'
    );

    assert.equal(res.success, true);
    assert.equal(res.customerId, 'CUST-9175635165');
    const row = await messageEventRepository.findByProviderMessageId('wamid.5h29_lead_001', 'Meta');
    assert.equal(row.customer_id, 'CUST-9175635165');
  });

  it('T10: Message status callback transitions SENT -> DELIVERED -> READ monotonically without duplicates', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Sachin Status',
      mobile_number: '+919175635165',
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    axios.post = async () => ({ data: { messages: [{ id: 'wamid.5h29_status_001' }] } });
    await aisensy.sendAiSensyWhatsApp(
      { destination: '+919175635165', userName: 'Sachin', text: 'Offer', customerId: 'CUST-9175635165' },
      'corr_st'
    );

    // Simulate Meta STATUS_UPDATE callback via whatsapp-webhook-worker (DELIVERED -> READ -> out-of-order SENT)
    for (const [idx, st] of ['delivered', 'read', 'sent'].entries()) {
      const req = new Request('https://www.avanifinserv.com/api/whatsapp-webhook-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-auth': process.env.INTERNAL_WORKER_SECRET
        },
        body: JSON.stringify({
          eventId: `META_STATUS_wamid.5h29_status_001_${st.toUpperCase()}_${idx}`,
          eventType: 'STATUS_UPDATE',
          provider: 'Meta',
          data: { msgId: 'wamid.5h29_status_001', statusStr: st }
        })
      });
      const resp = await workerRoute.POST(req);
      assert.equal(resp.status, 200);
    }

    const allMsgs = await messageEventRepository.findAll();
    assert.equal(allMsgs.length, 1, 'Status callbacks must update the existing MESSAGE_EVENTS row in place');
    assert.equal(allMsgs[0].delivery_status, 'READ', 'Out-of-order SENT must not downgrade READ');
    assert.equal(allMsgs[0].provider, 'Meta');
  });

  it('T12: Missing optional metadata is handled safely via registered mobile lookup without inventing unverified customers', async () => {
    await customerRepository.upsertCustomer({
      customer_id: 'CUST-9175635165',
      customer_name: 'Minimal User',
      mobile_number: '+919175635165',
      city: 'Latur',
      enquiry_source: 'WHATSAPP_INBOUND'
    });
    axios.post = async () => ({ data: { messages: [{ id: 'wamid.5h29_min_001' }] } });

    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: '9175635165', userName: 'Minimal User' },
      ''
    );

    assert.equal(res.success, true);
    assert.equal(res.persisted, true);
    assert.equal(res.customerId, 'CUST-9175635165');
    const row = await messageEventRepository.findByProviderMessageId('wamid.5h29_min_001', 'Meta');
    assert.equal(row.message_type, 'TEXT');
    assert.equal(row.customer_id, 'CUST-9175635165');
  });

  it('T13: Sensitive data in Meta API error is redacted before logging and returning', async () => {
    axios.post = async () => {
      const err = new Error('Auth failed');
      err.response = {
        data: {
          error: {
            message:
              'Invalid Bearer EAAGSECRETTOKEN999888777666 for customer PAN ABCDE1234F Aadhaar 2345 6789 0123 phone +919175635165'
          }
        }
      };
      throw err;
    };

    const res = await aisensy.sendAiSensyWhatsApp(
      { destination: '+919175635165', userName: 'Sachin', text: 'Test error redaction' },
      'corr_redact_01'
    );

    assert.equal(res.success, false);
    assert.equal(res.status, 'FAILED');
    assert.equal(res.error.includes('EAAGSECRETTOKEN999888777666'), false, 'Meta token must be redacted');
    assert.equal(res.error.includes('ABCDE1234F'), false, 'PAN must be redacted');
    assert.equal(res.error.includes('2345 6789 0123'), false, 'Aadhaar must be redacted');
    assert.equal(res.error.includes('9175635165'), false, 'Raw mobile number must be masked');
    assert.ok(res.error.includes('[REDACTED_PAN]'));
    assert.ok(res.error.includes('[REDACTED_AADHAAR]'));
    assert.ok(res.error.includes('****5165'));
  });

  it('T14: Worker rejects unauthorized x-worker-auth (401) and fails closed on Sheets error during outbound persistence', async () => {
    // 1. Unauthorized worker request fails closed 401
    const unauthReq = new Request('https://www.avanifinserv.com/api/whatsapp-webhook-worker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-auth': 'wrong_secret' },
      body: JSON.stringify({ eventId: 'META_INBOUND_unauth', eventType: 'INBOUND_MESSAGE' })
    });
    const unauthResp = await workerRoute.POST(unauthReq);
    assert.equal(unauthResp.status, 401);

    // 2. Authorized opt-out ack fails safely if Sheets persistence fails after Meta send
    process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED = 'true';
    process.env.AISENSY_INBOUND_WEBHOOK_ENABLED = 'true';
    let callNum = 0;
    axios.post = async () => {
      callNum++;
      // Simulate Sheets going down right after Meta Graph API accepts the outbound opt-out ack
      configureMockSheetsFaults({ forceUnavailable: true });
      return { data: { messages: [{ id: 'wamid.5h29_worker_fail_01' }] } };
    };

    const optOutReq = new Request('https://www.avanifinserv.com/api/whatsapp-webhook-worker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-auth': process.env.INTERNAL_WORKER_SECRET
      },
      body: JSON.stringify({
        eventId: 'META_INBOUND_optout_sheets_fail',
        eventType: 'INBOUND_MESSAGE',
        provider: 'Meta',
        correlationId: 'META-CORR-OPTOUT-1',
        data: {
          message: { type: 'text', text: { body: 'STOP' }, id: 'wamid_in_stop_1' },
          fromPhone: '+919175635165',
          msgId: 'wamid_in_stop_1',
          profileName: 'Sachin'
        }
      })
    });
    const optOutResp = await workerRoute.POST(optOutReq);
    assert.equal(callNum, 1);
    assert.equal(optOutResp.status, 503, 'Worker must NOT report 200 success when outbound Sheets persistence fails');
  });
});
