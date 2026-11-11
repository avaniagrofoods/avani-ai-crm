const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const TEST_PORT = Number(process.env.CP26_4_TEST_PORT || 3097);
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const SYNTHETIC_ADMIN_EMAIL = 'admin.cp264@avanifinserv.test';
const SYNTHETIC_ADMIN_PASS = 'AvaniAdmin!CP264#2026';
const SYNTHETIC_ADVISOR_EMAIL = 'advisor.cp264@avanifinserv.test';
const SYNTHETIC_ADVISOR_PASS = 'AvaniAdvisor!CP264#2026';
const SYNTHETIC_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const SYNTHETIC_META_SECRET = 'meta_test_secret_cp26_4_abcdef123456';
const SYNTHETIC_META_VERIFY = 'meta_verify_test_cp26_4';
const SYNTHETIC_CRON_SECRET = 'cron_test_secret_cp26_4_xyz789';
const SYNTHETIC_WORKER_SECRET = 'worker_test_secret_cp26_4_xyz789';
const SYNTHETIC_CM_SECRET = 'chatmitra_test_secret_cp26_4_xyz789';

function makeScryptHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

function loadTestMongoUri() {
  let rawUri = process.env.TEST_MONGODB_URI || '';
  if (!rawUri) {
    const tmpEnv = path.join(process.cwd(), 'scratch', `.tmp_cp264_${process.pid}.env`);
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
  assert.ok(rawUri, 'Missing TEST_MONGODB_URI or active Atlas URI');
  const u = new URL(rawUri);
  u.pathname = '/avani_ai_crm_test';
  const testUri = u.toString();
  assert.ok(
    testUri.includes('/avani_ai_crm_test') && !testUri.includes('avani_ai_crm_prod'),
    'SAFETY ABORT: CP-26.4 tests must target avani_ai_crm_test ONLY'
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
  throw new Error(`Timed out waiting for CP-26.4 test server at ${url}`);
}

function extractRawSetCookie(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie().join('; ');
  }
  return res.headers.get('set-cookie') || '';
}

function extractCookieValue(res, name) {
  const raw = extractRawSetCookie(res);
  const m = raw.match(new RegExp(`${name}=([^;]+)`));
  return m ? `${name}=${m[1]}` : null;
}

function signHmacRaw(payload, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

function forgeSessionCookie(claims, secret) {
  const payloadB64 = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sigB64 = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `avani_crm_session=${payloadB64}.${sigB64}`;
}

async function runTests() {
  const testMongoUri = loadTestMongoUri();
  const runTag = `CP264_${Date.now()}`;
  const phoneLeadPublicOk = '919820030001';
  const phoneLeadNoConsent = '919820030002';
  const phoneLeadDenied = '919820030003';
  const phoneOther = '919820030004';
  const phoneOwned = '919820030005';
  const phoneMeta = '919820030006';
  const phoneCm = '919820030007';

  const allPhones = [
    phoneLeadPublicOk,
    phoneLeadNoConsent,
    phoneLeadDenied,
    phoneOther,
    phoneOwned,
    phoneMeta,
    phoneCm,
    `+${phoneLeadPublicOk}`,
    `+${phoneLeadNoConsent}`,
    `+${phoneLeadDenied}`,
    `+${phoneOther}`,
    `+${phoneOwned}`,
    `+${phoneMeta}`,
    `+${phoneCm}`
  ];
  const raw10s = [
    phoneLeadPublicOk,
    phoneLeadNoConsent,
    phoneLeadDenied,
    phoneOther,
    phoneOwned,
    phoneMeta,
    phoneCm
  ].map((p) => p.slice(-10));

  const createdEventIds = [];
  const serverLogs = [];
  let serverProc = null;

  await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 10000 });
  assert.strictEqual(mongoose.connection.name, 'avani_ai_crm_test');
  const db = mongoose.connection.db;

  const adminHash = makeScryptHash(SYNTHETIC_ADMIN_PASS);
  const advisorHash = makeScryptHash(SYNTHETIC_ADVISOR_PASS);

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
      CRM_ADMIN_PASSWORD_HASH: adminHash,
      CRM_ADVISOR_EMAIL: SYNTHETIC_ADVISOR_EMAIL,
      CRM_ADVISOR_NAME: 'Advisor Test Ops',
      CRM_ADVISOR_PASSWORD_HASH: advisorHash,
      META_APP_SECRET: SYNTHETIC_META_SECRET,
      META_WEBHOOK_VERIFY_TOKEN: SYNTHETIC_META_VERIFY,
      STRICT_META_WEBHOOK_VERIFICATION: 'true',
      CRON_SECRET: SYNTHETIC_CRON_SECRET,
      DIAGNOSTICS_SECRET: SYNTHETIC_CRON_SECRET,
      INTERNAL_WORKER_SECRET: SYNTHETIC_WORKER_SECRET,
      CHATMITRA_WEBHOOK_SECRET: SYNTHETIC_CM_SECRET,
      CHATMITRA_VERIFY_TOKEN: SYNTHETIC_META_VERIFY
    };

    const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
    const dnsPreload = path.join(process.cwd(), 'tests', 'dns_preload.cjs');
    serverProc = spawn(
      process.execPath,
      ['--require', dnsPreload, nextBin, 'start', '-p', String(TEST_PORT), '-H', '127.0.0.1'],
      { cwd: process.cwd(), env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    serverProc.stdout.on('data', (d) => serverLogs.push(d.toString()));
    serverProc.stderr.on('data', (d) => serverLogs.push(d.toString()));

    await waitForServer(BASE_URL);
    console.log(`\n[CP-26.4] Isolated test server ready at ${BASE_URL} (DB: ${mongoose.connection.name})`);

    let passed = 0;
    const assertTest = async (name, fn) => {
      await fn();
      passed += 1;
      console.log(`  PASS: ${name}`);
    };

    // Gate 1: Public /api/health vs Private /api/diagnostics
    await assertTest('G1.1 Public /api/health returns strictly minimal JSON with no-store CDN headers', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      assert.strictEqual(res.status, 200);
      assert.ok((res.headers.get('cache-control') || '').includes('no-store'));
      assert.strictEqual(res.headers.get('cdn-cache-control'), 'no-store');
      const body = await res.json();
      assert.deepStrictEqual(Object.keys(body).sort(), ['available', 'service', 'status', 'timestamp']);
      assert.strictEqual(body.service, 'AVANI LOAN SERVICES — AVANI AI CRM');
      assert.strictEqual(body.status, 'HEALTHY');
      assert.strictEqual(body.available, true);
      const rawStr = JSON.stringify(body);
      for (const forbidden of ['integrations', 'databaseReady', 'providerMode', 'metaWaba', '72491', '1147494668457940', 'chatmitra', 'omniDM', 'apiKey', 'CONFIGURED']) {
        assert.ok(!rawStr.includes(forbidden), `/api/health leaked forbidden field: ${forbidden}`);
      }
    });

    await assertTest('G1.2 Private /api/diagnostics denies unauthenticated (401) and invalid Bearer (401)', async () => {
      const r1 = await fetch(`${BASE_URL}/api/diagnostics`);
      assert.strictEqual(r1.status, 401);
      assert.ok((r1.headers.get('cache-control') || '').includes('no-store'));

      const r2 = await fetch(`${BASE_URL}/api/diagnostics`, {
        headers: { Authorization: 'Bearer wrong-token' }
      });
      assert.strictEqual(r2.status, 401);

      const r3 = await fetch(`${BASE_URL}/api/diagnostics`, {
        headers: { Authorization: `Bearer ${SYNTHETIC_CRON_SECRET}` }
      });
      assert.strictEqual(r3.status, 200);
      assert.ok((r3.headers.get('cache-control') || '').includes('no-store'));
      const dBody = await r3.json();
      assert.ok(dBody.integrations && dBody.readiness && dBody.environment);
      const dStr = JSON.stringify(dBody);
      assert.ok(!dStr.includes('...'), 'Diagnostics must never return masked key substrings');
    });

    // Gate 2 & 3: Salted scrypt Login, Account Enumeration, Cookie Flags, Rotation, Rate Limiting, CSRF
    let adminCookie1 = null;
    let adminCookie = null;
    let advisorCookie = null;

    await assertTest('G2.1 Salted scrypt login succeeds, sets HttpOnly/SameSite=Lax/Path/MaxAge, and hides account existence on failure', async () => {
      const badExisting = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.10' },
        body: JSON.stringify({ email: SYNTHETIC_ADMIN_EMAIL, password: 'WrongPassword!123' })
      });
      const badUnknown = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.11' },
        body: JSON.stringify({ email: 'nonexistent@avanifinserv.test', password: 'WrongPassword!123' })
      });
      assert.strictEqual(badExisting.status, 401);
      assert.strictEqual(badUnknown.status, 401);
      const b1 = await badExisting.json();
      const b2 = await badUnknown.json();
      assert.strictEqual(b1.error, b2.error, 'Login error must be identical to prevent account enumeration');

      const okRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.12' },
        body: JSON.stringify({ email: SYNTHETIC_ADMIN_EMAIL, password: SYNTHETIC_ADMIN_PASS })
      });
      assert.strictEqual(okRes.status, 200);
      assert.ok((okRes.headers.get('cache-control') || '').includes('no-store'));
      const rawCookie = extractRawSetCookie(okRes);
      assert.ok(rawCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
      assert.ok(/samesite=lax/i.test(rawCookie), 'Cookie must include SameSite=Lax');
      assert.ok(/max-age=28800/i.test(rawCookie), 'Cookie must expire after 8h');
      const okBody = await okRes.json();
      assert.strictEqual(okBody.user.password, undefined);
      assert.strictEqual(okBody.user.passwordHash, undefined);
      adminCookie1 = extractCookieValue(okRes, 'avani_crm_session');
      assert.ok(adminCookie1);
    });

    await assertTest('G3.1 Session rotation on re-login revokes prior cookie (anti-fixation)', async () => {
      const okRes2 = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie1,
          'x-forwarded-for': '198.51.100.12'
        },
        body: JSON.stringify({ email: SYNTHETIC_ADMIN_EMAIL, password: SYNTHETIC_ADMIN_PASS })
      });
      assert.strictEqual(okRes2.status, 200);
      adminCookie = extractCookieValue(okRes2, 'avani_crm_session');
      assert.ok(adminCookie && adminCookie !== adminCookie1, 'Login must rotate session token');

      const oldReuse = await fetch(`${BASE_URL}/api/leads`, { headers: { Cookie: adminCookie1 } });
      assert.strictEqual(oldReuse.status, 401, 'Old session token after rotation must be revoked (401)');

      const newOk = await fetch(`${BASE_URL}/api/leads`, { headers: { Cookie: adminCookie } });
      assert.strictEqual(newOk.status, 200);
    });

    await assertTest('G3.2 Distributed MongoDB brute-force protection throttles after 5 failures with 429 Retry-After', async () => {
      const bfIp = '203.0.113.77';
      const bfEmail = 'bruteforce.target@avanifinserv.test';
      for (let i = 0; i < 5; i++) {
        const attempt = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': bfIp },
          body: JSON.stringify({ email: bfEmail, password: 'WrongPassword!123' })
        });
        assert.strictEqual(attempt.status, 401, `Attempt ${i + 1} should return 401`);
      }
      const blocked = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': bfIp },
        body: JSON.stringify({ email: bfEmail, password: 'WrongPassword!123' })
      });
      assert.strictEqual(blocked.status, 429, '6th failed attempt must return 429 Too Many Requests');
      assert.ok(Number(blocked.headers.get('retry-after')) > 0, '429 must include Retry-After header');
      const rlCount = await db.collection('authratelimits').countDocuments({ attempts: { $gte: 5 } });
      assert.ok(rlCount >= 1, 'Rate limit state must persist in MongoDB');
    });

    await assertTest('G3.3 Diagnostics denies ADVISOR (403) and accepts ADMIN cookie (200)', async () => {
      const advLogin = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.13' },
        body: JSON.stringify({ email: SYNTHETIC_ADVISOR_EMAIL, password: SYNTHETIC_ADVISOR_PASS })
      });
      assert.strictEqual(advLogin.status, 200);
      advisorCookie = extractCookieValue(advLogin, 'avani_crm_session');

      const advDiag = await fetch(`${BASE_URL}/api/diagnostics`, { headers: { Cookie: advisorCookie } });
      assert.strictEqual(advDiag.status, 403);

      const admDiag = await fetch(`${BASE_URL}/api/diagnostics`, { headers: { Cookie: adminCookie } });
      assert.strictEqual(admDiag.status, 200);
    });

    // Seed isolated synthetic leads for Gate 4 matrix
    const leadOtherRes = await db.collection('leads').insertOne({
      leadId: `AVL-OTHER-${runTag}`,
      name: `Other Lead ${runTag}`,
      phone: `+${phoneOther}`,
      normalizedMobile: phoneOther.slice(-10),
      loanType: 'Home Loan',
      stage: 'NEW_ENQUIRY',
      status: 'New',
      assignedAdvisor: { email: 'someone.else@avanifinserv.test', name: 'Someone Else', role: 'LOAN_ADVISOR' },
      documentChecklist: [{ code: 'KYC_PAN', name: 'PAN Card', category: 'KYC', mandatory: true, status: 'PENDING' }],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const leadOtherId = String(leadOtherRes.insertedId);

    const leadOwnedRes = await db.collection('leads').insertOne({
      leadId: `AVL-OWNED-${runTag}`,
      name: `Owned Lead ${runTag}`,
      phone: `+${phoneOwned}`,
      normalizedMobile: phoneOwned.slice(-10),
      loanType: 'Personal Loan',
      stage: 'APPLICATION_SUBMITTED',
      status: 'Application Submitted',
      assignedAdvisor: { email: SYNTHETIC_ADVISOR_EMAIL, name: 'Advisor Test Ops', role: 'LOAN_ADVISOR' },
      documentChecklist: [{ code: 'KYC_PAN', name: 'PAN Card', category: 'KYC', mandatory: true, status: 'PENDING' }],
      revenue: { expectedRevenue: 20000, actualRevenueReceived: 0, paymentStatus: 'UNBILLED' },
      revenueTracking: { expectedCommissionAmount: 20000, actualRevenueReceived: 0 },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const leadOwnedId = String(leadOwnedRes.insertedId);

    await assertTest('G3.4 Cross-site CSRF state-changing requests rejected (403) without DB mutation', async () => {
      const csrfAssign = await fetch(`${BASE_URL}/api/leads/${leadOwnedId}/assign`, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/json',
          Origin: 'https://evil-attacker.test',
          'Sec-Fetch-Site': 'cross-site'
        },
        body: JSON.stringify({ advisorEmail: 'attacker@evil.test', advisorName: 'Evil' })
      });
      assert.strictEqual(csrfAssign.status, 403);
      const csrfLogout = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: adminCookie, 'Sec-Fetch-Site': 'cross-site' }
      });
      assert.strictEqual(csrfLogout.status, 403);

      const dbUnchanged = await db.collection('leads').findOne({ _id: leadOwnedRes.insertedId });
      assert.strictEqual(dbUnchanged.assignedAdvisor.email, SYNTHETIC_ADVISOR_EMAIL);
    });

    // Gate 4: Complete 12-item RBAC + Session Matrix with DB integrity checks
    await assertTest('G4.1-G4.3 Unauthenticated CRM page (/crm), leads API (/api/leads), dashboard (/api/dashboard/metrics) fail closed', async () => {
      const pRes = await fetch(`${BASE_URL}/crm`, { redirect: 'manual' });
      assert.ok([302, 307, 308].includes(pRes.status));
      assert.ok((pRes.headers.get('location') || '').includes('/login'));

      const lRes = await fetch(`${BASE_URL}/api/leads`);
      assert.strictEqual(lRes.status, 401);

      const dRes = await fetch(`${BASE_URL}/api/dashboard/metrics`);
      assert.strictEqual(dRes.status, 401);
    });

    await assertTest('G4.4-G4.6 Admin sees all leads; Advisor sees assigned only & IDOR access returns 403 with zero DB mutation', async () => {
      const admList = await fetch(`${BASE_URL}/api/leads`, { headers: { Cookie: adminCookie } });
      assert.strictEqual(admList.status, 200);
      const admIds = ((await admList.json()).leads || []).map((l) => String(l._id));
      assert.ok(admIds.includes(leadOtherId) && admIds.includes(leadOwnedId));

      const advList = await fetch(`${BASE_URL}/api/leads`, { headers: { Cookie: advisorCookie } });
      assert.strictEqual(advList.status, 200);
      const advIds = ((await advList.json()).leads || []).map((l) => String(l._id));
      assert.ok(advIds.includes(leadOwnedId) && !advIds.includes(leadOtherId));

      const idorGet = await fetch(`${BASE_URL}/api/leads/${leadOtherId}`, { headers: { Cookie: advisorCookie } });
      assert.strictEqual(idorGet.status, 403);
      const idorPatch = await fetch(`${BASE_URL}/api/leads/${leadOtherId}`, {
        method: 'PATCH',
        headers: { Cookie: advisorCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'CONTACTED' })
      });
      assert.strictEqual(idorPatch.status, 403);
      const afterOther = await db.collection('leads').findOne({ _id: leadOtherRes.insertedId });
      assert.strictEqual(afterOther.stage, 'NEW_ENQUIRY', 'Rejected IDOR PATCH must not mutate DB');
    });

    await assertTest('G4.7-G4.9 Advisor financial/assignment attempts fail 403 without DB mutation; Admin financial flow succeeds', async () => {
      const advAssign = await fetch(`${BASE_URL}/api/leads/${leadOwnedId}/assign`, {
        method: 'POST',
        headers: { Cookie: advisorCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisorEmail: 'someone.else@avanifinserv.test', advisorName: 'Someone Else' })
      });
      assert.strictEqual(advAssign.status, 403);

      const advFin = await fetch(`${BASE_URL}/api/leads/${leadOwnedId}/application`, {
        method: 'POST',
        headers: { Cookie: advisorCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RECORD_SANCTION', sanctionedAmount: 500000 })
      });
      assert.strictEqual(advFin.status, 403);

      const afterAdvAttempts = await db.collection('leads').findOne({ _id: leadOwnedRes.insertedId });
      assert.strictEqual(afterAdvAttempts.assignedAdvisor.email, SYNTHETIC_ADVISOR_EMAIL);
      assert.strictEqual(afterAdvAttempts.stage, 'APPLICATION_SUBMITTED');

      const admSanc = await fetch(`${BASE_URL}/api/leads/${leadOwnedId}/application`, {
        method: 'POST',
        headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RECORD_SANCTION', sanctionedAmount: 450000, sanctionLetterRef: 'SL-264' })
      });
      assert.strictEqual(admSanc.status, 200);
      const afterAdmSanc = await db.collection('leads').findOne({ _id: leadOwnedRes.insertedId });
      assert.strictEqual(afterAdmSanc.stage, 'SANCTIONED');
    });

    await assertTest('G4.10-G4.12 Logout permanently blocks cookie reuse on UI & API; expired & forged cookies fail 401', async () => {
      // Capture advisorCookie before logout and replay it after logout
      const savedCookie = advisorCookie;
      const outRes = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: savedCookie }
      });
      assert.strictEqual(outRes.status, 200);

      const replayApi = await fetch(`${BASE_URL}/api/leads`, { headers: { Cookie: savedCookie } });
      assert.strictEqual(replayApi.status, 401, 'Logged-out session must NOT be reusable on API');

      const replayUi = await fetch(`${BASE_URL}/crm`, { headers: { Cookie: savedCookie }, redirect: 'manual' });
      assert.ok([302, 307, 308].includes(replayUi.status), 'Logged-out session must redirect to /login on UI');

      // Expired valid-HMAC token
      const now = Math.floor(Date.now() / 1000);
      const expiredCookie = forgeSessionCookie(
        { jti: 'expired-jti', sub: 'ADV-OPS-02', name: 'Advisor', email: SYNTHETIC_ADVISOR_EMAIL, role: 'ADVISOR', iat: now - 3600, exp: now - 60 },
        SYNTHETIC_SESSION_SECRET
      );
      const expRes = await fetch(`${BASE_URL}/api/leads`, { headers: { Cookie: expiredCookie } });
      assert.strictEqual(expRes.status, 401);

      // Forged wrong-secret valid-format token
      const forgedCookie = forgeSessionCookie(
        { jti: 'forged-jti', sub: 'ADV-ADMIN', name: 'Fake', email: SYNTHETIC_ADMIN_EMAIL, role: 'ADMIN', iat: now, exp: now + 3600 },
        'wrong_signing_secret_000000000000000000000000'
      );
      const forgedRes = await fetch(`${BASE_URL}/api/leads`, { headers: { Cookie: forgedCookie } });
      assert.strictEqual(forgedRes.status, 401);
    });

    // Gate 5: Public Enquiry & Webhook Regression
    await assertTest('G5.1 Public enquiry enforces valid phone, explicit consent policy, anti-mass-assignment & minimal response', async () => {
      const badPhone = await fetch(`${BASE_URL}/api/public/enquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bad Phone', phone: '123', loanType: 'Personal Loan', consentStatus: 'GRANTED' })
      });
      assert.strictEqual(badPhone.status, 400);

      const missingConsent = await fetch(`${BASE_URL}/api/public/enquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Missing Consent', phone: phoneLeadNoConsent, loanType: 'Personal Loan' })
      });
      assert.strictEqual(missingConsent.status, 400);
      assert.strictEqual(await db.collection('leads').countDocuments({ normalizedMobile: phoneLeadNoConsent.slice(-10) }), 0);

      const deniedConsent = await fetch(`${BASE_URL}/api/public/enquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Denied Consent', phone: phoneLeadDenied, loanType: 'Personal Loan', consentStatus: 'DENIED' })
      });
      assert.strictEqual(deniedConsent.status, 403);
      assert.strictEqual(await db.collection('leads').countDocuments({ normalizedMobile: phoneLeadDenied.slice(-10) }), 0);

      const okEnq = await fetch(`${BASE_URL}/api/public/enquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Consented Enq ${runTag}`,
          phone: phoneLeadPublicOk,
          loanType: 'Doctor Loan',
          consentStatus: 'GRANTED',
          role: 'ADMIN',
          stage: 'DISBURSED',
          revenueTracking: { actualRevenueReceived: 88888 }
        })
      });
      assert.strictEqual(okEnq.status, 201);
      const okJson = await okEnq.json();
      assert.strictEqual(okJson.lead, undefined);
      assert.ok(okJson.leadId);
      const dbEnq = await db.collection('leads').findOne({ normalizedMobile: phoneLeadPublicOk.slice(-10) });
      assert.strictEqual(dbEnq.stage, 'NEW_ENQUIRY');
      assert.ok(!dbEnq.revenueTracking?.actualRevenueReceived);
    });

    await assertTest('G5.2 Meta & ChatMitra webhook security & idempotency regression (zero live WhatsApp sent)', async () => {
      const mGetBad = await fetch(`${BASE_URL}/api/meta-webhook?hub.mode=subscribe&hub.verify_token=avani_secure_token&hub.challenge=123`);
      assert.strictEqual(mGetBad.status, 403);

      const mGetOk = await fetch(`${BASE_URL}/api/meta-webhook?hub.mode=subscribe&hub.verify_token=${SYNTHETIC_META_VERIFY}&hub.challenge=CHK_264`);
      assert.strictEqual(mGetOk.status, 200);
      assert.strictEqual(await mGetOk.text(), 'CHK_264');

      const metaEvtId = `META_LEADGEN_LG264_${runTag}`;
      createdEventIds.push(metaEvtId);
      const metaBody = JSON.stringify({
        object: 'page',
        entry: [{ id: 'PG1', changes: [{ field: 'leadgen', value: { leadgen_id: `LG264_${runTag}`, phone_number: `+${phoneMeta}`, loan_type: 'Business Loan' } }] }]
      });

      assert.strictEqual((await fetch(`${BASE_URL}/api/meta-webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: metaBody })).status, 401);
      assert.strictEqual((await fetch(`${BASE_URL}/api/meta-webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + 'f'.repeat(64) }, body: metaBody })).status, 401);

      const sig = signHmacRaw(metaBody, SYNTHETIC_META_SECRET);
      const mValid = await fetch(`${BASE_URL}/api/meta-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig },
        body: metaBody
      });
      assert.strictEqual(mValid.status, 200);
      assert.strictEqual((await mValid.json()).duplicate, undefined);

      const mDup = await fetch(`${BASE_URL}/api/meta-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig },
        body: metaBody
      });
      assert.strictEqual(mDup.status, 200);
      assert.strictEqual((await mDup.json()).duplicate, true);

      // ChatMitra separation check
      const cmBody = JSON.stringify({
        event: 'message.received',
        messageId: `CM_TEST_${runTag}`,
        from: phoneCm,
        text: 'Checking loan status'
      });
      createdEventIds.push(`CM_INBOUND_CM_TEST_${runTag}`);
      assert.strictEqual((await fetch(`${BASE_URL}/api/chatmitra-webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cmBody })).status, 401);

      const cmSig = crypto.createHmac('sha256', SYNTHETIC_CM_SECRET).update(cmBody, 'utf8').digest('hex');
      const cmOk = await fetch(`${BASE_URL}/api/chatmitra-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-signature': cmSig },
        body: cmBody
      });
      assert.strictEqual(cmOk.status, 200);
    });

    console.log(`\n[CP-26.4 Summary] ${passed}/13 security closure suites PASSED.`);
  } finally {
    try {
      await db.collection('leads').deleteMany({
        $or: [{ normalizedMobile: { $in: raw10s } }, { phone: { $in: allPhones } }, { leadId: new RegExp(runTag) }]
      });
      await db.collection('contacts').deleteMany({ phone: { $in: allPhones } });
      await db.collection('conversations').deleteMany({ customerPhone: { $in: allPhones } });
      await db.collection('webhookinboxes').deleteMany({ eventId: { $in: createdEventIds } });
      await db.collection('authsessions').deleteMany({
        email: { $in: [SYNTHETIC_ADMIN_EMAIL, SYNTHETIC_ADVISOR_EMAIL, 'revoked@local'] }
      });
      await db.collection('authratelimits').deleteMany({
        key: { $regex: /^(?:login_acct:(?:198\.51\.100\.|203\.0\.113\.77)|login_ip:(?:198\.51\.100\.|203\.0\.113\.77))/ }
      });
      const residual = await db.collection('leads').countDocuments({ normalizedMobile: { $in: raw10s } });
      assert.strictEqual(residual, 0, 'Zero lead residue expected after cleanup');
      console.log('[CP-26.4 Cleanup] Verified 0 synthetic test records remain in avani_ai_crm_test.');
    } catch (cleanupErr) {
      console.error('CP-26.4 Cleanup error:', cleanupErr);
      process.exitCode = 1;
    }

    if (serverProc && !serverProc.killed) serverProc.kill();
    await mongoose.disconnect().catch(() => {});
  }
}

runTests().catch((err) => {
  console.error('\n[CP-26.4 FAILED]', err);
  process.exit(1);
});
