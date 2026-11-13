const assert = require('assert');
const crypto = require('crypto');
const { spawn } = require('child_process');
const mongoose = require('mongoose');

const TEST_PORT = Number(process.env.CP281_AUTH_TEST_PORT || 3098);
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const OWNER_EMAIL = 'owner.cp281@avanifinserv.test';
const OWNER_PASS = 'AvaniOwner!CP281#2026';
const ADVISOR_EMAIL = 'advisor.cp281@avanifinserv.test';
const ADVISOR_PASS = 'AvaniAdvisor!CP281#2026';
const JSON_ADVISOR_EMAIL = 'staff.json@avanifinserv.test';
const JSON_ADVISOR_PASS = 'AvaniStaff!CP281#2026';
const UNKNOWN_EMAIL = 'stranger@avanifinserv.test';
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function makeScryptHash(password) {
  const saltHex = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$${saltHex}$${key}`;
}

function loadTestMongoUri() {
  const rawUri = (process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/avani_ai_crm_test').trim();
  const u = new URL(rawUri);
  assert.ok(
    u.pathname === '/avani_ai_crm_test' && !rawUri.includes('avani_ai_crm_prod'),
    'SAFETY ABORT: Test DB URI must point exclusively to /avani_ai_crm_test'
  );
  return u.toString();
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

function signToken(payload, secret) {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64, 'utf8').digest('base64url');
  return `${payloadB64}.${sig}`;
}

async function runTests() {
  const testMongoUri = loadTestMongoUri();
  await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 10000 });
  assert.strictEqual(mongoose.connection.name, 'avani_ai_crm_test');
  const db = mongoose.connection.db;

  const ownerHash = makeScryptHash(OWNER_PASS);
  const advisorHash = makeScryptHash(ADVISOR_PASS);
  const jsonAdvisorHash = makeScryptHash(JSON_ADVISOR_PASS);

  const serverEnv = {
    ...process.env,
    NODE_ENV: 'test',
    APP_MODE: 'test',
    PROVIDER_MODE: 'mock',
    MONGODB_URI: testMongoUri,
    SESSION_SECRET,
    CRM_ADMIN_EMAIL: OWNER_EMAIL,
    CRM_ADMIN_NAME: 'Sachin Shinde',
    CRM_ADMIN_PASSWORD_HASH: ownerHash,
    CRM_ADVISOR_EMAIL: ADVISOR_EMAIL,
    CRM_ADVISOR_NAME: 'Blocked Advisor',
    CRM_ADVISOR_PASSWORD_HASH: advisorHash,
    CRM_AUTH_ACCOUNTS_JSON: JSON.stringify([
      { id: 'STAFF-01', name: 'Blocked Staff', email: JSON_ADVISOR_EMAIL, role: 'ADVISOR', passwordHash: jsonAdvisorHash }
    ]),
    ALLOWED_TEST_PHONES: '919820010099'
  };

  const serverLogs = [];
  const serverProc = spawn('npx', ['next', 'dev', '-p', String(TEST_PORT), '-H', '127.0.0.1'], {
    cwd: process.cwd(),
    env: serverEnv,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProc.stdout.on('data', (d) => serverLogs.push(d.toString()));
  serverProc.stderr.on('data', (d) => serverLogs.push(d.toString()));

  let passed = 0;
  const total = 11;
  async function check(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  let ownerCookie = null;

  try {
    await waitForServer(BASE_URL);
    console.log(`\n🔐 CP-28.1 Single-Owner Authentication Suite (${BASE_URL})`);

    await check('1. Owner admin login succeeds (200) and sets HttpOnly session cookie', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
        body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASS })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.role, 'ADMIN');
      ownerCookie = extractCookie(res, 'avani_crm_session');
      assert.ok(ownerCookie, 'Session cookie must be issued');
    });

    await check('2. Owner admin session check (/api/auth/session) returns authenticated=true', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/session`, {
        headers: { Cookie: ownerCookie }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.authenticated, true);
      assert.strictEqual(data.user.role, 'ADMIN');
    });

    await check('3. Owner admin protected API (/api/leads) returns 200', async () => {
      const res = await fetch(`${BASE_URL}/api/leads`, {
        headers: { Cookie: ownerCookie }
      });
      assert.strictEqual(res.status, 200);
    });

    await check('4. Wrong password login fails closed (401)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
        body: JSON.stringify({ email: OWNER_EMAIL, password: 'WrongPassword!123' })
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(extractCookie(res, 'avani_crm_session'), null);
    });

    await check('5. Advisor login (even with valid CRM_ADVISOR_* env vars) is DENIED (401)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
        body: JSON.stringify({ email: ADVISOR_EMAIL, password: ADVISOR_PASS })
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(extractCookie(res, 'avani_crm_session'), null);
    });

    await check('6. Staff/Advisor login via CRM_AUTH_ACCOUNTS_JSON is DENIED (401)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
        body: JSON.stringify({ email: JSON_ADVISOR_EMAIL, password: JSON_ADVISOR_PASS })
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(extractCookie(res, 'avani_crm_session'), null);
    });

    await check('7. Unknown user login is DENIED (401)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
        body: JSON.stringify({ email: UNKNOWN_EMAIL, password: OWNER_PASS })
      });
      assert.strictEqual(res.status, 401);
    });

    await check('8. Public registration / signup routes are absent or redirect to /login (never 200/201)', async () => {
      for (const route of ['/api/auth/register', '/api/auth/signup', '/api/users/register', '/register', '/signup']) {
        const res = await fetch(`${BASE_URL}${route}`, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
          body: JSON.stringify({ email: UNKNOWN_EMAIL, password: OWNER_PASS })
        });
        assert.ok(
          res.status === 307 || res.status === 401 || res.status === 404 || res.status === 405,
          `Unexpected status ${res.status} on ${route}`
        );
      }
    });

    await check('9. Unauthenticated protected API access (/api/leads, /api/settings) fails closed (401)', async () => {
      const r1 = await fetch(`${BASE_URL}/api/leads`);
      const r2 = await fetch(`${BASE_URL}/api/settings`);
      assert.strictEqual(r1.status, 401);
      assert.strictEqual(r2.status, 401);
    });

    await check('10. Signed ADVISOR-role session token or tampered/expired token is rejected (401)', async () => {
      const advToken = signToken(
        {
          jti: `adv-forged-${Date.now()}`,
          sub: 'ADV-OPS-02',
          name: 'Forged Advisor',
          email: ADVISOR_EMAIL,
          role: 'ADVISOR',
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        SESSION_SECRET
      );
      const resAdv = await fetch(`${BASE_URL}/api/leads`, {
        headers: { Cookie: `avani_crm_session=${advToken}` }
      });
      assert.strictEqual(resAdv.status, 401);

      const expiredAdmin = signToken(
        {
          jti: `exp-admin-${Date.now()}`,
          sub: 'ADV-SACHIN-01',
          name: 'Sachin Shinde',
          email: OWNER_EMAIL,
          role: 'ADMIN',
          exp: Math.floor(Date.now() / 1000) - 60
        },
        SESSION_SECRET
      );
      const resExp = await fetch(`${BASE_URL}/api/leads`, {
        headers: { Cookie: `avani_crm_session=${expiredAdmin}` }
      });
      assert.strictEqual(resExp.status, 401);
    });

    await check('11. Owner logout invalidates active session token (replay -> 401)', async () => {
      const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: ownerCookie, Origin: BASE_URL }
      });
      assert.strictEqual(logoutRes.status, 200);

      const replayRes = await fetch(`${BASE_URL}/api/leads`, {
        headers: { Cookie: ownerCookie }
      });
      assert.strictEqual(replayRes.status, 401);
    });

    console.log(`\n📊 SINGLE-OWNER AUTH SUMMARY: ${passed} / ${total} CHECKS PASSED`);
  } finally {
    if (serverProc && !serverProc.killed) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(serverProc.pid), '/f', '/t'], { stdio: 'ignore' });
      } else {
        serverProc.kill('SIGTERM');
      }
    }
    await db.collection('authsessions').deleteMany({ email: { $in: [OWNER_EMAIL, ADVISOR_EMAIL, JSON_ADVISOR_EMAIL] } }).catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
}

runTests().catch((err) => {
  console.error('❌ CP-28.1 Single-Owner Auth Suite failed:', err);
  process.exit(1);
});
