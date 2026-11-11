const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const TEST_PORT = Number(process.env.CP26_3_TEST_PORT || 3099);
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const SYNTHETIC_ADMIN_EMAIL = 'admin.e2e@avanifinserv.test';
const SYNTHETIC_ADMIN_PASS = 'AvaniAdmin!Test#2026';
const SYNTHETIC_ADVISOR_EMAIL = 'advisor.e2e@avanifinserv.test';
const SYNTHETIC_ADVISOR_PASS = 'AvaniAdvisor!Test#2026';
const SYNTHETIC_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const SYNTHETIC_META_SECRET = 'meta_test_secret_cp26_3_abcdef123456';
const SYNTHETIC_META_VERIFY = 'meta_verify_test_cp26_3';
const SYNTHETIC_CRON_SECRET = 'cron_test_secret_cp26_3_xyz';
const SYNTHETIC_WORKER_SECRET = 'worker_test_secret_cp26_3_xyz';
const SYNTHETIC_CM_SECRET = 'chatmitra_test_secret_cp26_3_xyz';

function loadTestMongoUri() {
  let rawUri = process.env.TEST_MONGODB_URI || '';
  if (!rawUri) {
    const tmpEnv = path.join(process.cwd(), 'scratch', `.tmp_gate7_${process.pid}.env`);
    try {
      execFileSync('cmd.exe', ['/c', 'npx', 'vercel', 'env', 'pull', tmpEnv, '--environment=production', '--yes'], {
        stdio: ['ignore', 'ignore', 'pipe']
      });
      if (fs.existsSync(tmpEnv)) {
        const content = fs.readFileSync(tmpEnv, 'utf8');
        const m = content.match(/^(?:avani_ai_crm_prod_MONGODB_URI|MONGODB_URI)=["']?(mongodb[^"'\r\n]+)["']?/m);
        if (m) rawUri = m[1].trim();
      }
    } finally {
      if (fs.existsSync(tmpEnv)) fs.unlinkSync(tmpEnv);
    }
  }
  assert.ok(rawUri, 'Missing TEST_MONGODB_URI or active cluster URI for avani_ai_crm_test');
  const u = new URL(rawUri);
  u.pathname = '/avani_ai_crm_test';
  const testUri = u.toString();
  assert.ok(
    testUri.includes('/avani_ai_crm_test') && !testUri.includes('avani_ai_crm_prod'),
    'SAFETY ABORT: Test DB URI must point exclusively to avani_ai_crm_test'
  );
  return testUri;
}

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for isolated server at ${url}`);
}

function extractCookie(res, name) {
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  for (const header of setCookie) {
    const parts = header.split(';')[0];
    const idx = parts.indexOf('=');
    if (idx > 0 && parts.slice(0, idx).trim() === name) {
      return `${name}=${parts.slice(idx + 1).trim()}`;
    }
  }
  return null;
}

function signMetaPayload(rawBody, secret) {
  const hex = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return `sha256=${hex}`;
}

async function runTests() {
  const testMongoUri = loadTestMongoUri();
  const runTag = `CP263_${Date.now()}`;
  const phoneA = '919820010001';
  const phoneB = '919820010002';
  const phoneC = '919820010003';
  const phoneMeta = '919820010004';
  const phonePhones = [phoneA, phoneB, phoneC, phoneMeta, `+${phoneA}`, `+${phoneB}`, `+${phoneC}`, `+${phoneMeta}`];
  const raw10s = [phoneA.slice(-10), phoneB.slice(-10), phoneC.slice(-10), phoneMeta.slice(-10)];

  let serverProc = null;
  const serverLogs = [];

  // Connect Mongoose directly to avani_ai_crm_test for setup/assertions/cleanup
  await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 10000 });
  assert.strictEqual(mongoose.connection.name, 'avani_ai_crm_test', 'Connected DB MUST be avani_ai_crm_test');
  const db = mongoose.connection.db;

  const createdEventIds = [];
  const createdMsgIds = [];

  try {
    const childEnv = {
      ...process.env,
      NODE_ENV: 'production',
      APP_MODE: 'test',
      PORT: String(TEST_PORT),
      MONGODB_URI: testMongoUri,
      avani_ai_crm_prod_MONGODB_URI: testMongoUri,
      PROVIDER_MODE: 'mock',
      CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'false',
      BULK_BROADCAST_ENABLED: 'false',
      OMNIDM_LIVE_ENABLED: 'false',
      AUTHORIZED_TEST_PHONE_CANONICAL: '919175635165',
      SESSION_SECRET: SYNTHETIC_SESSION_SECRET,
      CRM_ADMIN_EMAIL: SYNTHETIC_ADMIN_EMAIL,
      CRM_ADMIN_NAME: 'Sachin Test Admin',
      CRM_ADMIN_PASSWORD: SYNTHETIC_ADMIN_PASS,
      CRM_ADVISOR_EMAIL: SYNTHETIC_ADVISOR_EMAIL,
      CRM_ADVISOR_NAME: 'Advisor Test Ops',
      CRM_ADVISOR_PASSWORD: SYNTHETIC_ADVISOR_PASS,
      META_APP_SECRET: SYNTHETIC_META_SECRET,
      META_WEBHOOK_VERIFY_TOKEN: SYNTHETIC_META_VERIFY,
      STRICT_META_WEBHOOK_VERIFICATION: 'true',
      CRON_SECRET: SYNTHETIC_CRON_SECRET,
      INTERNAL_WORKER_SECRET: SYNTHETIC_WORKER_SECRET,
      CHATMITRA_WEBHOOK_SECRET: SYNTHETIC_CM_SECRET
    };

    const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
    const dnsPreload = path.join(process.cwd(), 'tests', 'dns_preload.cjs');
    serverProc = spawn(process.execPath, ['--require', dnsPreload, nextBin, 'start', '-p', String(TEST_PORT), '-H', '127.0.0.1'], {
      cwd: process.cwd(),
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    serverProc.stdout.on('data', (d) => serverLogs.push(d.toString()));
    serverProc.stderr.on('data', (d) => serverLogs.push(d.toString()));

    await waitForServer(BASE_URL);
    console.log(`\n[Gate 7] Isolated test server ready at ${BASE_URL} (DB: ${mongoose.connection.name})`);

    let passed = 0;
    const assertTest = (name, fn) => async () => {
      await fn();
      passed += 1;
      console.log(`  PASS: ${name}`);
    };

    const tests = [
      assertTest('1. Unauthenticated API calls fail closed with 401', async () => {
        const r1 = await fetch(`${BASE_URL}/api/leads`);
        assert.strictEqual(r1.status, 401);
        const r2 = await fetch(`${BASE_URL}/api/dashboard/metrics`);
        assert.strictEqual(r2.status, 401);
        const r3 = await fetch(`${BASE_URL}/api/settings`);
        assert.strictEqual(r3.status, 401);
        const r4 = await fetch(`${BASE_URL}/api/cron/process-scheduled`, { method: 'GET' });
        assert.strictEqual(r4.status, 401);
        const r5 = await fetch(`${BASE_URL}/api/cron/follow-ups`, { method: 'GET' });
        assert.strictEqual(r5.status, 401);
      }),

      assertTest('2. Unauthenticated protected UI routes redirect to /login', async () => {
        for (const route of ['/crm', '/leads', '/inbox', '/']) {
          const res = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' });
          assert.ok([302, 307, 308].includes(res.status), `Expected redirect on ${route}, got ${res.status}`);
          const loc = res.headers.get('location') || '';
          assert.ok(loc.includes('/login'), `Expected redirect to /login for ${route}, got ${loc}`);
        }
      }),

      assertTest('3. Public enquiry /api/public/enquiry accepts valid applicant & strips privileged mass-assignment', async () => {
        const res = await fetch(`${BASE_URL}/api/public/enquiry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Public Applicant ${runTag}`,
            phone: phoneA,
            loanType: 'Doctor Loan',
            requestedAmount: '2500000',
            consentStatus: 'GRANTED',
            role: 'ADMIN',
            stage: 'DISBURSED',
            revenueTracking: { actualRevenueReceived: 999999 },
            assignedAdvisor: { email: 'evil@attacker.test', role: 'ADMIN' }
          })
        });
        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.leadId);
        assert.strictEqual(body.lead, undefined, 'Public endpoint must not leak full lead record');

        const dbLead = await db.collection('leads').findOne({ normalizedMobile: phoneA.slice(-10) });
        assert.ok(dbLead, 'Lead must exist in avani_ai_crm_test');
        assert.strictEqual(dbLead.stage, 'NEW_ENQUIRY', 'Injected DISBURSED stage must be ignored');
        assert.notStrictEqual(dbLead.assignedAdvisor?.email, 'evil@attacker.test', 'Injected advisor must be stripped');
        assert.ok(!dbLead.revenueTracking?.actualRevenueReceived, 'Injected revenue must be stripped');
      }),

      assertTest('4. Invalid login fails 401 without session cookie', async () => {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: SYNTHETIC_ADMIN_EMAIL, password: 'WrongPassword!123' })
        });
        assert.strictEqual(res.status, 401);
        assert.strictEqual(extractCookie(res, 'avani_crm_session'), null);
      }),

      assertTest('5. Tampered session cookie is rejected 401', async () => {
        const res = await fetch(`${BASE_URL}/api/leads`, {
          headers: { Cookie: 'avani_crm_session=tampered.signaturevalue' }
        });
        assert.strictEqual(res.status, 401);
      })
    ];

    for (const t of tests) await t();

    // Sign in as ADMIN & ADVISOR
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SYNTHETIC_ADMIN_EMAIL, password: SYNTHETIC_ADMIN_PASS })
    });
    assert.strictEqual(adminLoginRes.status, 200);
    const adminCookie = extractCookie(adminLoginRes, 'avani_crm_session');
    assert.ok(adminCookie, 'ADMIN login must set session cookie');

    const advisorLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SYNTHETIC_ADVISOR_EMAIL, password: SYNTHETIC_ADVISOR_PASS })
    });
    assert.strictEqual(advisorLoginRes.status, 200);
    const advisorCookie = extractCookie(advisorLoginRes, 'avani_crm_session');
    assert.ok(advisorCookie, 'ADVISOR login must set session cookie');

    // Create Lead B assigned to other advisor & Lead C assigned to advisor
    const leadBDoc = await db.collection('leads').insertOne({
      leadId: `AVL-OTHER-${runTag}`,
      name: `Other Advisor Lead ${runTag}`,
      phone: `+${phoneB}`,
      normalizedMobile: phoneB.slice(-10),
      loanType: 'Home Loan',
      stage: 'NEW_ENQUIRY',
      status: 'New',
      assignedAdvisor: { email: 'other.advisor@avanifinserv.test', name: 'Other Advisor', role: 'LOAN_ADVISOR' },
      documentChecklist: [{ code: 'KYC_PAN', name: 'PAN Card', category: 'KYC', mandatory: true, status: 'PENDING' }],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const leadBId = String(leadBDoc.insertedId);

    const leadCDoc = await db.collection('leads').insertOne({
      leadId: `AVL-OWNED-${runTag}`,
      name: `Owned Advisor Lead ${runTag}`,
      phone: `+${phoneC}`,
      normalizedMobile: phoneC.slice(-10),
      loanType: 'Personal Loan',
      stage: 'DOCUMENTS_PENDING',
      status: 'DOCUMENTS_PENDING',
      assignedAdvisor: { email: SYNTHETIC_ADVISOR_EMAIL, name: 'Advisor Test Ops', role: 'LOAN_ADVISOR' },
      documentChecklist: [{ code: 'KYC_PAN', name: 'PAN Card', category: 'KYC', mandatory: true, status: 'PENDING' }],
      revenue: { expectedRevenue: 25000, actualRevenueReceived: 20000, paymentStatus: 'PARTIAL' },
      revenueTracking: { expectedCommissionAmount: 25000, actualRevenueReceived: 20000 },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const leadCId = String(leadCDoc.insertedId);

    const rbacTests = [
      assertTest('6. ADVISOR visibility scoping hides other advisor leads & denies IDOR 403', async () => {
        const listRes = await fetch(`${BASE_URL}/api/leads`, { headers: { Cookie: advisorCookie } });
        assert.strictEqual(listRes.status, 200);
        const listData = await listRes.json();
        const ids = (listData.leads || []).map((l) => String(l._id));
        assert.ok(ids.includes(leadCId), 'ADVISOR must see assigned Lead C');
        assert.ok(!ids.includes(leadBId), 'ADVISOR must NOT see other advisor Lead B');

        const idorGet = await fetch(`${BASE_URL}/api/leads/${leadBId}`, { headers: { Cookie: advisorCookie } });
        assert.strictEqual(idorGet.status, 403);
        const idorPatch = await fetch(`${BASE_URL}/api/leads/${leadBId}`, {
          method: 'PATCH',
          headers: { Cookie: advisorCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'CONTACTED' })
        });
        assert.strictEqual(idorPatch.status, 403);

        const ownGet = await fetch(`${BASE_URL}/api/leads/${leadCId}`, { headers: { Cookie: advisorCookie } });
        assert.strictEqual(ownGet.status, 200);
        const ownBody = await ownGet.json();
        assert.strictEqual(ownBody.lead.revenueTracking, undefined, 'ADVISOR lead detail must strip revenueTracking');
        assert.strictEqual(ownBody.lead.revenue?.actualRevenueReceived, undefined, 'ADVISOR lead detail must mask revenue figures');
        assert.strictEqual(ownBody.lead.revenue?.restricted, true);
      }),

      assertTest('7. ADVISOR blocked 403 from assign, financial milestones, and admin routes', async () => {
        const assignRes = await fetch(`${BASE_URL}/api/leads/${leadCId}/assign`, {
          method: 'POST',
          headers: { Cookie: advisorCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ advisorEmail: SYNTHETIC_ADVISOR_EMAIL, advisorName: 'Self' })
        });
        assert.strictEqual(assignRes.status, 403);

        for (const action of ['RECORD_SANCTION', 'RECORD_DISBURSEMENT', 'RECORD_REVENUE']) {
          const finRes = await fetch(`${BASE_URL}/api/leads/${leadCId}/application`, {
            method: 'POST',
            headers: { Cookie: advisorCookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, sanctionedAmount: 500000, disbursedAmount: 500000, actualRevenueReceived: 5000 })
          });
          assert.strictEqual(finRes.status, 403, `ADVISOR must be denied ${action}`);
        }

        const massRes = await fetch(`${BASE_URL}/api/leads`, {
          method: 'POST',
          headers: { Cookie: advisorCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Mass Assign Attempt',
            phone: phoneB,
            loanType: 'Personal Loan',
            actualRevenueReceived: 50000
          })
        });
        assert.ok([400, 403].includes(massRes.status), `Mass-assigned financial field / cross-advisor phone must fail, got ${massRes.status}`);

        const badIdRes = await fetch(`${BASE_URL}/api/leads/invalid_object_id_format`, {
          headers: { Cookie: advisorCookie }
        });
        assert.strictEqual(badIdRes.status, 400);
      }),

      assertTest('8. ADMIN can assign lead, update checklist item, enforce stage/financial workflow', async () => {
        const assignRes = await fetch(`${BASE_URL}/api/leads/${leadBId}/assign`, {
          method: 'POST',
          headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            advisorEmail: SYNTHETIC_ADVISOR_EMAIL,
            advisorName: 'Advisor Test Ops',
            advisorRole: 'LOAN_ADVISOR'
          })
        });
        assert.strictEqual(assignRes.status, 200);

        // Checklist update
        const chkRes = await fetch(`${BASE_URL}/api/leads/${leadBId}`, {
          method: 'PATCH',
          headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ updateChecklistItem: { code: 'KYC_PAN', status: 'VERIFIED' } })
        });
        assert.strictEqual(chkRes.status, 200);
        const chkData = await chkRes.json();
        const panItem = (chkData.lead.documentChecklist || []).find((i) => i.code === 'KYC_PAN');
        assert.strictEqual(panItem.status, 'VERIFIED');

        // Financial prerequisite: cannot sanction before submission
        const badSanc = await fetch(`${BASE_URL}/api/leads/${leadBId}/application`, {
          method: 'POST',
          headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'RECORD_SANCTION', sanctionedAmount: 100000 })
        });
        assert.ok([400, 409].includes(badSanc.status), `Expected 400 or 409 for premature sanction, got ${badSanc.status}`);

        // Happy path: submit -> sanction -> disburse -> revenue
        const sub = await fetch(`${BASE_URL}/api/leads/${leadBId}/application`, {
          method: 'POST',
          headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'SUBMIT_APPLICATION', lenderName: 'HDFC Bank', appliedAmount: 1000000 })
        });
        assert.strictEqual(sub.status, 200);

        const sanc = await fetch(`${BASE_URL}/api/leads/${leadBId}/application`, {
          method: 'POST',
          headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'RECORD_SANCTION', sanctionedAmount: 900000, sanctionLetterRef: 'SL-E2E-1' })
        });
        assert.strictEqual(sanc.status, 200);

        const disb = await fetch(`${BASE_URL}/api/leads/${leadBId}/application`, {
          method: 'POST',
          headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'RECORD_DISBURSEMENT', disbursedAmount: 900000, utrNumber: 'UTR-E2E-1' })
        });
        assert.strictEqual(disb.status, 200);

        const rev = await fetch(`${BASE_URL}/api/leads/${leadBId}/application`, {
          method: 'POST',
          headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'RECORD_REVENUE', actualRevenueReceived: 18000, invoiceNumber: 'INV-E2E-1' })
        });
        assert.strictEqual(rev.status, 200);
      }),

      assertTest('9. Meta webhook GET verification & POST X-Hub-Signature-256 enforcement + idempotency', async () => {
        const badVerify = await fetch(`${BASE_URL}/api/meta-webhook?hub.mode=subscribe&hub.verify_token=avani_secure_token&hub.challenge=123`);
        assert.strictEqual(badVerify.status, 403, 'Hardcoded avani_secure_token fallback must be dead');

        const okVerify = await fetch(`${BASE_URL}/api/meta-webhook?hub.mode=subscribe&hub.verify_token=${SYNTHETIC_META_VERIFY}&hub.challenge=CHALLENGE_OK`);
        assert.strictEqual(okVerify.status, 200);
        assert.strictEqual(await okVerify.text(), 'CHALLENGE_OK');

        const payload = JSON.stringify({
          object: 'page',
          entry: [{
            id: 'PAGE-TEST',
            changes: [{
              field: 'leadgen',
              value: { leadgen_id: `LG-${runTag}`, form_id: 'FORM-1', phone_number: `+${phoneMeta}`, loan_type: 'Business Loan' }
            }]
          }]
        });
        createdEventIds.push(`META_LEADGEN_LG-${runTag}`);

        const missingSig = await fetch(`${BASE_URL}/api/meta-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });
        assert.strictEqual(missingSig.status, 401);

        const wrongSig = await fetch(`${BASE_URL}/api/meta-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + '0'.repeat(64) },
          body: payload
        });
        assert.strictEqual(wrongSig.status, 401);

        const validSigHeader = signMetaPayload(payload, SYNTHETIC_META_SECRET);
        const validPost = await fetch(`${BASE_URL}/api/meta-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': validSigHeader },
          body: payload
        });
        assert.strictEqual(validPost.status, 200);
        const validJson = await validPost.json();
        assert.strictEqual(validJson.success, true);

        const dupPost = await fetch(`${BASE_URL}/api/meta-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': validSigHeader },
          body: payload
        });
        assert.strictEqual(dupPost.status, 200);
        const dupJson = await dupPost.json();
        assert.strictEqual(dupJson.duplicate, true);
      }),

      assertTest('10. Telemetry separation counts Mock attempts separately from Real Delivered/Failed & masks ADVISOR revenue', async () => {
        const beforeRes = await fetch(`${BASE_URL}/api/dashboard/metrics`, { headers: { Cookie: adminCookie } });
        assert.strictEqual(beforeRes.status, 200);
        const beforeT = (await beforeRes.json()).whatsappTelemetry;

        const mockMsgId = `CM-MOCK-${runTag}-1`;
        const realAccId = `WAMID-REAL-ACC-${runTag}`;
        const realDelId = `WAMID-REAL-DEL-${runTag}`;
        const realFailId = `WAMID-REAL-FAIL-${runTag}`;
        const inboundId = `WAMID-INBOUND-${runTag}`;
        createdMsgIds.push(mockMsgId, realAccId, realDelId, realFailId, inboundId);

        await db.collection('messages').insertMany([
          { contactId: leadCId, messageId: mockMsgId, idempotencyKey: mockMsgId, direction: 'OUTBOUND', status: 'API_ACCEPTED', provider: 'ChatMitra', providerResponse: { mock: true }, body: 'Mock msg', createdAt: new Date() },
          { contactId: leadCId, messageId: realAccId, idempotencyKey: realAccId, direction: 'OUTBOUND', status: 'PROVIDER_ACCEPTED', provider: 'ChatMitra', providerResponse: { mock: false }, body: 'Real sent', createdAt: new Date() },
          { contactId: leadCId, messageId: realDelId, idempotencyKey: realDelId, direction: 'OUTBOUND', status: 'DELIVERED', provider: 'Meta', providerResponse: { mock: false }, body: 'Real del', createdAt: new Date() },
          { contactId: leadCId, messageId: realFailId, idempotencyKey: realFailId, direction: 'OUTBOUND', status: 'FAILED', provider: 'Meta', providerResponse: { mock: false }, body: 'Real fail', createdAt: new Date() },
          { contactId: leadCId, messageId: inboundId, idempotencyKey: inboundId, direction: 'INBOUND', status: 'RECEIVED', provider: 'WhatsApp', providerResponse: { mock: false }, body: 'Inbound hi', createdAt: new Date() }
        ]);

        const adminMetricsRes = await fetch(`${BASE_URL}/api/dashboard/metrics`, { headers: { Cookie: adminCookie } });
        assert.strictEqual(adminMetricsRes.status, 200);
        const adminM = await adminMetricsRes.json();
        assert.strictEqual(adminM.whatsappTelemetry.mockAttempts - beforeT.mockAttempts, 1, 'Mock count must increase by 1 only');
        assert.strictEqual(adminM.whatsappTelemetry.providerAccepted - beforeT.providerAccepted, 2, 'Real accepted increases by 2 (PROVIDER_ACCEPTED + DELIVERED)');
        assert.strictEqual(adminM.whatsappTelemetry.delivered - beforeT.delivered, 1, 'Delivered count increases by 1 excluding mock');
        assert.strictEqual(adminM.whatsappTelemetry.failed - beforeT.failed, 1, 'Failed count increases by 1 excluding mock');
        assert.strictEqual(adminM.whatsappTelemetry.inboundReceived - beforeT.inboundReceived, 1);
        assert.ok(adminM.revenue.totalActualRevenueReceived >= 18000, 'ADMIN sees real revenue');
        assert.strictEqual(adminM.revenue.restricted, false);

        const advMetricsRes = await fetch(`${BASE_URL}/api/dashboard/metrics`, { headers: { Cookie: advisorCookie } });
        assert.strictEqual(advMetricsRes.status, 200);
        const advM = await advMetricsRes.json();
        assert.strictEqual(advM.revenue.restricted, true);
        assert.strictEqual(advM.revenue.totalActualRevenueReceived, null);
        assert.strictEqual(advM.revenue.totalDisbursedAmount, null);
      }),

      assertTest('11. Webhook dead-letter worker handles string leadId STATUS_UPDATE & E11000 inbound duplicates without failing', async () => {
        const statusEvtId = `META_STATUS_DL_${runTag}`;
        const strLeadMsgId = `META-STR-MSG-${runTag}`;
        const dupInboundWamid = `WAMID-INBOUND-${runTag}`; // already in messages above!
        const inboundEvtId = `META_INB_DUP_${runTag}`;
        createdEventIds.push(statusEvtId, inboundEvtId);
        createdMsgIds.push(strLeadMsgId);

        await db.collection('messages').insertOne({
          leadId: `AVL-NON-OID-${runTag}`,
          contactId: leadCId,
          messageId: strLeadMsgId,
          providerMessageId: strLeadMsgId,
          idempotencyKey: strLeadMsgId,
          direction: 'OUTBOUND',
          status: 'SENT',
          provider: 'Meta',
          body: 'Outbound string leadId test',
          createdAt: new Date()
        });

        await db.collection('webhookinboxes').insertMany([
          {
            eventId: statusEvtId,
            provider: 'Meta',
            eventType: 'STATUS_UPDATE',
            status: 'RECEIVED',
            attemptCount: 0,
            payload: { id: strLeadMsgId, status: 'delivered' },
            receivedAt: new Date()
          },
          {
            eventId: inboundEvtId,
            provider: 'Meta',
            eventType: 'INBOUND_MESSAGE',
            status: 'RECEIVED',
            attemptCount: 0,
            payload: { id: dupInboundWamid, from: phoneC, type: 'text', text: { body: 'Duplicate retry test' } },
            receivedAt: new Date()
          }
        ]);

        const workerStatusRes = await fetch(`${BASE_URL}/api/whatsapp-webhook-worker`, {
          method: 'POST',
          headers: { 'x-worker-auth': SYNTHETIC_WORKER_SECRET, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: statusEvtId,
            correlationId: `CORR-ST-${runTag}`,
            eventType: 'STATUS_UPDATE',
            data: { msgId: strLeadMsgId, statusStr: 'delivered', statusObj: {} }
          })
        });
        assert.strictEqual(workerStatusRes.status, 200);

        const workerInbRes = await fetch(`${BASE_URL}/api/whatsapp-webhook-worker`, {
          method: 'POST',
          headers: { 'x-worker-auth': SYNTHETIC_WORKER_SECRET, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: inboundEvtId,
            correlationId: `CORR-INB-${runTag}`,
            eventType: 'INBOUND_MESSAGE',
            data: {
              msgId: dupInboundWamid,
              fromPhone: phoneC,
              profileName: 'Test Duplicate User',
              message: { type: 'text', text: { body: 'Duplicate retry test' } }
            }
          })
        });
        assert.strictEqual(workerInbRes.status, 200);

        const sDoc = await db.collection('webhookinboxes').findOne({ eventId: statusEvtId });
        const iDoc = await db.collection('webhookinboxes').findOne({ eventId: inboundEvtId });
        assert.strictEqual(sDoc.status, 'COMPLETED', `Expected COMPLETED for string status update, got ${sDoc.status}: ${sDoc.lastError}`);
        assert.strictEqual(iDoc.status, 'COMPLETED', `Expected COMPLETED for idempotent duplicate inbound, got ${iDoc.status}: ${iDoc.lastError}`);
      }),

      assertTest('12. Cron Bearer secret works & logout clears session cookie', async () => {
        const cronOk = await fetch(`${BASE_URL}/api/cron/process-scheduled`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${SYNTHETIC_CRON_SECRET}` }
        });
        assert.strictEqual(cronOk.status, 200);

        const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Cookie: advisorCookie }
        });
        assert.strictEqual(logoutRes.status, 200);
        const setCookie = logoutRes.headers.get('set-cookie') || '';
        assert.ok(setCookie.includes('Max-Age=0') || setCookie.includes('avani_crm_session=;'), 'Logout must expire session cookie');
      })
    ];

    for (const t of rbacTests) await t();
    console.log(`\n[Gate 7 Summary] ${passed}/${tests.length + rbacTests.length} integration checks PASSED.`);
  } finally {
    // Cleanup ONLY our synthetic test records in avani_ai_crm_test
    try {
      await db.collection('leads').deleteMany({
        $or: [
          { normalizedMobile: { $in: raw10s } },
          { phone: { $in: phonePhones } },
          { leadId: new RegExp(runTag) }
        ]
      });
      await db.collection('contacts').deleteMany({ phone: { $in: phonePhones } });
      await db.collection('messages').deleteMany({ messageId: { $in: createdMsgIds } });
      await db.collection('conversations').deleteMany({ customerPhone: { $in: phonePhones } });
      await db.collection('webhookinboxes').deleteMany({ eventId: { $in: createdEventIds } });
      const residual = await db.collection('leads').countDocuments({ normalizedMobile: { $in: raw10s } });
      assert.strictEqual(residual, 0, 'Test residue must be zero after cleanup');
      console.log('[Gate 7 Cleanup] Verified 0 synthetic test records remain in avani_ai_crm_test.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
      process.exitCode = 1;
    }

    if (serverProc && !serverProc.killed) {
      serverProc.kill();
    }
    await mongoose.disconnect().catch(() => {});
  }
}

runTests().catch((err) => {
  console.error('\n[Gate 7 FAILED]', err);
  process.exit(1);
});
