/**
 * TASK 5H.7 — REMEDIATION VERIFICATION TEST SUITE (A-01 THROUGH A-06)
 *
 * Execution Mode: 100% Offline (MOCK_IN_MEMORY + mocked fetch, zero live Google/MongoDB connections)
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

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
    static json(data, init = {}) {
      return new MockNextResponse(data, init);
    }
  }
};

const nextServerId = require.resolve('next/server');
require.cache[nextServerId] = { id: nextServerId, filename: nextServerId, loaded: true, exports: nextServerMock };

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'next/server') return nextServerMock;
  if (request === '@vercel/functions') {
    return { waitUntil: (p) => Promise.resolve(p).catch(() => {}) };
  }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'MOCK_IN_MEMORY';
process.env.GOOGLE_SHEETS_ENABLE_MOCK = 'true';
process.env.SESSION_SECRET = 'test_5h7_session_secret_0123456789abcdef';
process.env.GOOGLE_SHEETS_GATEWAY_SECRET = 'test_5h7_gateway_secret_0123456789abcdef';

const sheets = require('../src/lib/google-sheets/index.ts');
const auth = require('../src/lib/auth.ts');
const authStore = require('../src/lib/auth-store.ts');
const contactsUploadRoute = require('../src/app/api/contacts/upload/route.ts');
const leadsUploadRoute = require('../src/app/api/leads/upload/route.ts');
const chatmantraRoute = require('../src/app/api/chatmantra-webhook/route.ts');

async function createAdminRequest(url, method = 'POST', body = {}) {
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
    body: JSON.stringify(body)
  });
}

describe('Task 5H.7 — Controlled Remediation Verification (A-01 to A-06)', () => {
  beforeEach(() => {
    sheets.resetMockSheetsStore();
    sheets.configureMockSheetsFaults({ forceUnavailable: false, forceQuotaExceeded: false, corruptHeaderOnTab: null });
    sheets.resetNoncesForTesting();
  });

  it('A-01: Canonical JSON-body gateway envelope & HMAC verification (zero custom HTTP header reliance)', async () => {
    const payload = { action: 'GET_SNAPSHOT', tabs: ['CUSTOMERS', 'LEADS'] };
    const env = sheets.signAppsScriptGatewayRequest(payload, process.env.GOOGLE_SHEETS_GATEWAY_SECRET);
    const parsedBody = JSON.parse(env.bodyString);

    assert.ok(parsedBody.requestId.startsWith('REQ-'));
    assert.equal(typeof parsedBody.timestampMs, 'number');
    assert.equal(parsedBody.payloadJson, JSON.stringify(payload));
    assert.equal(parsedBody.signature.length, 64);

    const verified = sheets.verifyAppsScriptGatewaySignature({
      payloadJson: parsedBody.payloadJson,
      requestId: parsedBody.requestId,
      timestampMs: parsedBody.timestampMs,
      signature: parsedBody.signature,
      secret: process.env.GOOGLE_SHEETS_GATEWAY_SECRET
    });
    assert.equal(verified.valid, true);

    // Replay of same requestId must be rejected
    const replay = sheets.verifyAppsScriptGatewaySignature({
      payloadJson: parsedBody.payloadJson,
      requestId: parsedBody.requestId,
      timestampMs: parsedBody.timestampMs,
      signature: parsedBody.signature,
      secret: process.env.GOOGLE_SHEETS_GATEWAY_SECRET
    });
    assert.equal(replay.valid, false);
  });

  it('A-01/A-05: Mocked APPS_SCRIPT_GATEWAY HTTP transport sends JSON body only (no X-Avani-* headers)', async () => {
    const origFetch = globalThis.fetch;
    const origMode = process.env.GOOGLE_SHEETS_TRANSPORT_MODE;
    const origUrl = process.env.GOOGLE_SHEETS_GATEWAY_URL;
    let capturedHeaders = null;
    let capturedBody = null;

    try {
      process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
      process.env.GOOGLE_SHEETS_GATEWAY_URL = 'https://script.google.com/macros/s/mock/exec';
      globalThis.fetch = async (_url, init) => {
        capturedHeaders = init.headers;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true, status: 200, code: 'OK', requestId: capturedBody.requestId, data: { spreadsheetName: 'AVANI_LOAN_SERVICES_CRM_MASTER', tabs: [] } };
          }
        };
      };

      const client = new sheets.GoogleSheetsClient();
      const health = await client.checkConnectivity();
      assert.equal(health.online, true);
      assert.equal('X-Avani-Signature' in capturedHeaders, false);
      assert.equal('X-Avani-Request-Id' in capturedHeaders, false);
      assert.ok(capturedBody.requestId && capturedBody.timestampMs && capturedBody.payloadJson && capturedBody.signature);
    } finally {
      globalThis.fetch = origFetch;
      process.env.GOOGLE_SHEETS_TRANSPORT_MODE = origMode;
      if (origUrl === undefined) delete process.env.GOOGLE_SHEETS_GATEWAY_URL;
      else process.env.GOOGLE_SHEETS_GATEWAY_URL = origUrl;
    }
  });

  it('A-02: 9-Tab Canonical Schema Parity between sheet-schema.ts and TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md', () => {
    const gasDoc = fs.readFileSync(
      path.join(ROOT_DIR, 'CHATMITRA_CRM_IMPLEMENTATION/40_TASK_5H_4_GOOGLE_SHEETS_IMPLEMENTATION/TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md'),
      'utf8'
    );
    const match = gasDoc.match(/const EXPECTED_TABS = (\{[\s\S]*?\n\});/);
    assert.ok(match, 'EXPECTED_TABS block must exist in Apps Script source doc');
    const expectedTabsObj = Function(`return (${match[1]});`)();

    const tsTabs = Object.keys(sheets.SHEET_COLUMNS).sort();
    const gasTabs = Object.keys(expectedTabsObj).sort();
    assert.deepEqual(gasTabs, tsTabs);

    for (const tab of tsTabs) {
      assert.deepEqual(expectedTabsObj[tab], [...sheets.SHEET_COLUMNS[tab]], `Column mismatch on tab ${tab}`);
    }
  });

  it('A-03: Disabled legacy MongoDB/upload/recording routes & FileUpload.tsx', async () => {
    const cRes = await contactsUploadRoute.POST(await createAdminRequest('http://localhost/api/contacts/upload'));
    assert.equal(cRes.status, 410);
    assert.equal((await cRes.json()).error, 'CSV_UPLOAD_DISABLED');

    const lRes = await leadsUploadRoute.POST(await createAdminRequest('http://localhost/api/leads/upload'));
    assert.equal(lRes.status, 410);
    assert.equal((await lRes.json()).error, 'BULK_LEAD_UPLOAD_DISABLED');

    const cmRes = await chatmantraRoute.POST();
    assert.equal(cmRes.status, 410);
    assert.equal((await cmRes.json()).error, 'LEGACY_ALIAS_DISABLED');

    const fileUploadSrc = fs.readFileSync(path.join(SRC_DIR, 'components/FileUpload.tsx'), 'utf8');
    assert.equal(fileUploadSrc.includes('type="file"'), false);

    const omnidimSrc = fs.readFileSync(path.join(SRC_DIR, 'app/api/omnidim-webhook/route.ts'), 'utf8');
    assert.equal(omnidimSrc.includes('updateData.recordingUrl'), false);
    assert.equal(omnidimSrc.includes('updateData.transcript'), false);
  });

  it('A-04: Interim 1800s (30-min) session expiry & in-memory revocation check', async () => {
    assert.equal(auth.SESSION_MAX_AGE_SECONDS, 1800);
    const { token, session } = await auth.signSessionTokenWithDetails({
      sub: 'ADV-SACHIN-01',
      name: 'Sachin Shinde',
      email: 'sachin@avaniloan.in',
      role: 'ADMIN'
    });
    assert.equal(session.exp - session.iat, 1800);
    await authStore.registerSessionInDb(session);
    assert.equal(await authStore.isSessionActiveInDb(session.jti), true);
    await authStore.revokeSessionInDb(session.jti);
    assert.equal(await authStore.isSessionActiveInDb(session.jti), false);
    const verified = await auth.verifyActiveSession(token);
    assert.equal(verified, null);
  });

  it('A-06: Batched GET_SNAPSHOT reduces listHydratedLeads() to 1 read & partial write retry converges cleanly', async () => {
    await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Smita Deshpande',
      phone: '9822334455',
      loanCategory: 'Home Loan',
      requestedAmount: '3200000'
    });

    const beforeReads = sheets.getMockSheetsTelemetry().readCount;
    const hydrated = await sheets.CrmSheetsService.listHydratedLeads();
    const afterReads = sheets.getMockSheetsTelemetry().readCount;

    assert.equal(hydrated.length, 1);
    assert.equal(afterReads - beforeReads, 1, 'listHydratedLeads must use 1 batched GET_SNAPSHOT read');

    // Retry same customer+lead registration -> must converge without creating duplicate rows
    await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Smita Deshpande',
      phone: '+919822334455',
      loanCategory: 'Home Loan',
      requestedAmount: '3200000'
    });
    assert.equal((await sheets.customerRepository.findAll()).length, 1);
    assert.equal((await sheets.leadRepository.findAll()).length, 1);
  });
});
