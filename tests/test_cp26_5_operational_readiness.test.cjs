const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const TEST_PORT = Number(process.env.CP26_5_TEST_PORT || 3095);
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const SYNTHETIC_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const SYNTHETIC_META_SECRET = 'meta_test_secret_cp26_5_abcdef123456';
const SYNTHETIC_META_VERIFY = 'meta_verify_test_cp26_5';
const SYNTHETIC_CRON_SECRET = 'cron_test_secret_cp26_5_xyz';
const SYNTHETIC_WORKER_SECRET = 'worker_test_secret_cp26_5_xyz';
const SYNTHETIC_CM_SECRET = 'chatmitra_test_secret_cp26_5_xyz';
const SYNTHETIC_CALLKARO_SECRET = 'callkaro_test_secret_cp26_5_xyz';
const SYNTHETIC_OMNIDIM_SECRET = 'omnidim_test_secret_cp26_5_xyz';
const SYNTHETIC_VAPI_SECRET = 'vapi_test_secret_cp26_5_xyz';

function loadTestMongoUri() {
  const rawUri = (process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/avani_ai_crm_test').trim();
  const u = new URL(rawUri);
  const host = (u.hostname || '').toLowerCase();
  assert.ok(
    !host.includes('rhpn2gh.mongodb.net') && !host.includes('cluster0.mlcxcp.mongodb.net') && !host.includes('xj6nhak.mongodb.net'),
    'SAFETY ABORT: Local/isolated tests must NOT target shared production Atlas clusters'
  );
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
      // retry until timeout
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for isolated server at ${url}`);
}

async function runTests() {
  const testMongoUri = loadTestMongoUri();
  const runTag = `cp265_${Date.now().toString().slice(-6)}`;
  const suffix = String(Date.now()).slice(-4);
  const phoneCk = `91982004${suffix}`;
  const phoneOd = `91982005${suffix}`;
  const phoneVp = `91982006${suffix}`;
  const phoneWk = `91982007${suffix}`;
  const allPhones = [phoneCk, phoneOd, phoneVp, phoneWk];
  const raw10s = allPhones.map((p) => p.slice(-10));
  const createdEventIds = [`WA_INBOUND_${runTag}_WK_NULL`, `WA_INBOUND_${runTag}_WA_UNAUTH`];

  const serverLogs = [];
  let serverProc = null;

  await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 10000 });
  assert.strictEqual(mongoose.connection.name, 'avani_ai_crm_test');
  const db = mongoose.connection.db;

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
      META_APP_SECRET: SYNTHETIC_META_SECRET,
      META_WEBHOOK_VERIFY_TOKEN: SYNTHETIC_META_VERIFY,
      STRICT_META_WEBHOOK_VERIFICATION: 'true',
      CRON_SECRET: SYNTHETIC_CRON_SECRET,
      DIAGNOSTICS_SECRET: SYNTHETIC_CRON_SECRET,
      INTERNAL_WORKER_SECRET: SYNTHETIC_WORKER_SECRET,
      CHATMITRA_WEBHOOK_SECRET: SYNTHETIC_CM_SECRET,
      CHATMITRA_VERIFY_TOKEN: SYNTHETIC_META_VERIFY,
      CALLKARO_WEBHOOK_SECRET: SYNTHETIC_CALLKARO_SECRET,
      OMNIDIM_WEBHOOK_SECRET: SYNTHETIC_OMNIDIM_SECRET,
      VAPI_WEBHOOK_SECRET: SYNTHETIC_VAPI_SECRET,
      HUBSPOT_PORTAL_ID: '',
      HUBSPOT_FORM_ID: ''
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
    console.log(`\n[CP-26.5] Isolated test server ready at ${BASE_URL} (DB: ${mongoose.connection.name})`);

    let passed = 0;
    const assertTest = async (name, fn) => {
      await fn();
      passed += 1;
      console.log(`  PASS: ${name}`);
    };

    await assertTest('S1 CallKaro webhook rejects unauthenticated/wrong secret (401 no-store) and accepts valid secret', async () => {
      const payload = JSON.stringify({ callId: `CK_${runTag}`, phone: phoneCk, status: 'completed', duration: 30 });
      const rUnauth = await fetch(`${BASE_URL}/api/callkaro-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      assert.strictEqual(rUnauth.status, 401);
      assert.ok((rUnauth.headers.get('cache-control') || '').includes('no-store'));

      const rWrong = await fetch(`${BASE_URL}/api/callkaro-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-secret' },
        body: payload
      });
      assert.strictEqual(rWrong.status, 401);

      const leadCountAfterDenied = await db.collection('leads').countDocuments({ normalizedMobile: phoneCk.slice(-10) });
      assert.strictEqual(leadCountAfterDenied, 0, 'Unauthenticated CallKaro webhook must not create a lead');

      const rOk = await fetch(`${BASE_URL}/api/callkaro-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-callkaro-secret': SYNTHETIC_CALLKARO_SECRET },
        body: payload
      });
      assert.notStrictEqual(rOk.status, 401);
      assert.strictEqual(rOk.status, 200);
    });

    await assertTest('S2 OmniDim webhook rejects unauthenticated/wrong secret (401 no-store) and accepts valid secret', async () => {
      const payload = JSON.stringify({ phone_number: phoneOd, status: 'completed' });
      const rUnauth = await fetch(`${BASE_URL}/api/omnidim-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      assert.strictEqual(rUnauth.status, 401);
      assert.ok((rUnauth.headers.get('cache-control') || '').includes('no-store'));

      const rWrong = await fetch(`${BASE_URL}/api/omnidim-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-omnidim-secret': 'bad-secret' },
        body: payload
      });
      assert.strictEqual(rWrong.status, 401);

      const leadCountAfterDenied = await db.collection('leads').countDocuments({ normalizedMobile: phoneOd.slice(-10) });
      assert.strictEqual(leadCountAfterDenied, 0, 'Unauthenticated OmniDim webhook must not create a lead');

      const rOk = await fetch(`${BASE_URL}/api/omnidim-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-omnidim-secret': SYNTHETIC_OMNIDIM_SECRET },
        body: payload
      });
      assert.notStrictEqual(rOk.status, 401);
      assert.strictEqual(rOk.status, 200);
    });

    await assertTest('S3 Vapi webhook rejects unauthenticated/wrong secret (401 no-store) and accepts valid secret', async () => {
      const payload = JSON.stringify({
        message: {
          type: 'end-of-call-report',
          call: { id: `VP_${runTag}`, endedReason: 'assistant-ended-call', customer: { number: `+${phoneVp}` } }
        }
      });
      const rUnauth = await fetch(`${BASE_URL}/api/vapi-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      assert.strictEqual(rUnauth.status, 401);
      assert.ok((rUnauth.headers.get('cache-control') || '').includes('no-store'));

      const rWrong = await fetch(`${BASE_URL}/api/vapi-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-vapi-secret': 'bad-secret' },
        body: payload
      });
      assert.strictEqual(rWrong.status, 401);

      const rOk = await fetch(`${BASE_URL}/api/vapi-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-vapi-secret': SYNTHETIC_VAPI_SECRET },
        body: payload
      });
      assert.notStrictEqual(rOk.status, 401);
      assert.strictEqual(rOk.status, 200);
    });

    await assertTest('S4 Worker rejects dev_secret_only & bad x-worker-auth (401 no-store), and guarantees non-null idempotencyKey', async () => {
      const workerMsgId = `WAMID_WK_${runTag}`;
      const wkPayload = JSON.stringify({
        eventId: `WA_INBOUND_${runTag}_WK_NULL`,
        correlationId: `CORR_${runTag}`,
        eventType: 'INBOUND_MESSAGE',
        provider: 'Meta',
        data: {
          msgId: workerMsgId,
          fromPhone: phoneWk,
          profileName: 'CP265 Test',
          message: { id: workerMsgId, from: phoneWk, type: 'text', text: { body: `Need business loan info ${runTag}` } }
        }
      });

      const rDevSecret = await fetch(`${BASE_URL}/api/whatsapp-webhook-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-worker-auth': 'dev_secret_only' },
        body: wkPayload
      });
      assert.strictEqual(rDevSecret.status, 401);
      assert.ok((rDevSecret.headers.get('cache-control') || '').includes('no-store'));

      const rEmpty = await fetch(`${BASE_URL}/api/whatsapp-webhook-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: wkPayload
      });
      assert.strictEqual(rEmpty.status, 401);

      await db.collection('webhookinboxes').insertOne({
        eventId: `WA_INBOUND_${runTag}_WK_NULL`,
        provider: 'Meta',
        eventType: 'INBOUND_MESSAGE',
        status: 'RECEIVED',
        attemptCount: 0,
        payload: { from: phoneWk, type: 'text', text: { body: `Need business loan info ${runTag}` } },
        receivedAt: new Date()
      });

      const rValid = await fetch(`${BASE_URL}/api/whatsapp-webhook-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-worker-auth': SYNTHETIC_WORKER_SECRET },
        body: wkPayload
      });
      const rValidText = await rValid.text();
      assert.strictEqual(rValid.status, 200, `Worker failed (${rValid.status}): ${rValidText} | logs: ${serverLogs.slice(-10).join(' | ')}`);

      const persistedMsg = await db.collection('messages').findOne({
        $or: [
          { idempotencyKey: workerMsgId },
          { idempotencyKey: `WA_INBOUND_${runTag}_WK_NULL` },
          { body: `Need business loan info ${runTag}` }
        ]
      });
      assert.ok(persistedMsg, 'Authorized worker invocation must persist inbound message');
      assert.ok(
        typeof persistedMsg.idempotencyKey === 'string' && persistedMsg.idempotencyKey.length > 0,
        `idempotencyKey must be non-null non-empty string, got ${persistedMsg.idempotencyKey}`
      );
    });

    await assertTest('S5 Unsigned POST /api/whatsapp-webhook rejected with 401 fail-closed', async () => {
      const payload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ value: { messages: [{ id: `WA_UNAUTH_${runTag}`, from: phoneWk, type: 'text', text: { body: 'hi' } }] } }] }]
      });
      const res = await fetch(`${BASE_URL}/api/whatsapp-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      assert.strictEqual(res.status, 401);
      assert.ok((res.headers.get('cache-control') || '').includes('no-store'));
    });

    console.log(`\n[CP-26.5 Summary] ${passed}/5 security hardening suites PASSED.`);
  } finally {
    try {
      await db.collection('leads').deleteMany({
        $or: [
          { normalizedMobile: { $in: raw10s } },
          { phone: { $in: allPhones } },
          { phone: { $in: allPhones.map((p) => `+${p}`) } },
          { phone: { $in: raw10s } }
        ]
      });
      await db.collection('contacts').deleteMany({ phone: { $in: [...allPhones, ...raw10s] } });
      await db.collection('conversations').deleteMany({ customerPhone: { $in: [...allPhones, ...raw10s] } });
      await db.collection('messages').deleteMany({
        $or: [
          { idempotencyKey: `WAMID_WK_${runTag}` },
          { idempotencyKey: `WA_INBOUND_${runTag}_WK_NULL` },
          { correlationId: `CORR_${runTag}` },
          { eventId: { $in: createdEventIds } },
          { body: `Need business loan info ${runTag}` },
          { phone: { $in: [...allPhones, ...raw10s] } },
          { from: { $in: allPhones } }
        ]
      });
      await db.collection('webhookinboxes').deleteMany({ eventId: { $in: createdEventIds } });
      await db.collection('calls').deleteMany({ callId: { $in: [`CK_${runTag}`, `OD_${runTag}`, `VP_${runTag}`] } });
      await db.collection('providerledgers').deleteMany({ destination: { $in: [...allPhones, ...raw10s] } });
      const residual = await db.collection('leads').countDocuments({ normalizedMobile: { $in: raw10s } });
      assert.strictEqual(residual, 0, 'Zero lead residue expected after CP-26.5 cleanup');
      console.log('[CP-26.5 Cleanup] Verified 0 synthetic test records remain in avani_ai_crm_test.');
    } catch (cleanupErr) {
      console.error('CP-26.5 Cleanup error:', cleanupErr);
      process.exitCode = 1;
    }

    if (serverProc && !serverProc.killed) serverProc.kill();
    await mongoose.disconnect().catch(() => {});
  }
}

runTests().catch((err) => {
  console.error('\n[CP-26.5 FAILED]', err);
  process.exit(1);
});
