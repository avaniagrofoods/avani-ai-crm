'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT_SAFE = Number(process.env.CP26_8_PORT_SAFE || 3108);
const PORT_LIVE_NEG = Number(process.env.CP26_8_PORT_LIVE_NEG || 3109);
const BASE_SAFE = `http://127.0.0.1:${PORT_SAFE}`;
const BASE_LIVE_NEG = `http://127.0.0.1:${PORT_LIVE_NEG}`;

const SYNTHETIC_ADMIN_EMAIL = 'admin.cp268@avanifinserv.test';
const SYNTHETIC_ADMIN_PASS = 'AvaniAdmin!CP268#2026';
const SYNTHETIC_ADVISOR_EMAIL = 'advisor.cp268@avanifinserv.test';
const SYNTHETIC_ADVISOR_PASS = 'AvaniAdvisor!CP268#2026';
const SYNTHETIC_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const SYNTHETIC_CRON_SECRET = 'cron_test_secret_cp26_8_xyz';
const SYNTHETIC_WORKER_SECRET = 'worker_test_secret_cp26_8_xyz';
const SYNTHETIC_CALLKARO_SECRET = 'callkaro_test_secret_cp26_8_xyz';

let passed = 0;
let failed = 0;

function recordPass(name) {
  passed++;
  console.log(`[PASS] ${name}`);
}

function recordFail(name, err) {
  failed++;
  console.error(`[FAIL] ${name}: ${err && err.stack ? err.stack : err}`);
}

async function runCase(name, fn) {
  try {
    await fn();
    recordPass(name);
  } catch (err) {
    recordFail(name, err);
  }
}

/**
 * Loads a TypeScript module directly from src/ using the TypeScript compiler API
 * with @/ alias resolution and optional mock overrides for DB/models/HTTP spies.
 */
function loadTsModules(stubs = {}) {
  const originalLoad = Module._load;
  const cache = new Map();

  function resolveTsFile(targetPath) {
    const candidates = [
      targetPath,
      `${targetPath}.ts`,
      `${targetPath}.tsx`,
      `${targetPath}.js`,
      path.join(targetPath, 'index.ts')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    return null;
  }

  function compileAndLoad(filePath) {
    if (cache.has(filePath)) return cache.get(filePath).exports;
    const mod = { exports: {} };
    cache.set(filePath, mod);

    const source = fs.readFileSync(filePath, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    });

    const dirname = path.dirname(filePath);
    const localRequire = (specifier) => {
      if (stubs[specifier]) return stubs[specifier];
      if (specifier.startsWith('@/')) {
        const mapped = resolveTsFile(path.join(ROOT_DIR, 'src', specifier.slice(2)));
        if (mapped) return compileAndLoad(mapped);
      }
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        const mapped = resolveTsFile(path.resolve(dirname, specifier));
        if (mapped) return compileAndLoad(mapped);
      }
      return originalLoad(specifier, module, false);
    };

    const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', output.outputText);
    fn(mod.exports, localRequire, mod, filePath, dirname);
    return mod.exports;
  }

  return { compileAndLoad };
}

function withEnv(tempEnv, fn) {
  const backup = {};
  for (const k of Object.keys(tempEnv)) {
    backup[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
    if (tempEnv[k] === undefined) delete process.env[k];
    else process.env[k] = tempEnv[k];
  }
  const restore = () => {
    for (const k of Object.keys(tempEnv)) {
      if (backup[k] === undefined) delete process.env[k];
      else process.env[k] = backup[k];
    }
  };
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res.finally(restore);
    }
    restore();
    return res;
  } catch (err) {
    restore();
    throw err;
  }
}

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
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

function extractCookie(res, name) {
  const setCookie = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  for (const header of setCookie) {
    const parts = header.split(';')[0];
    const idx = parts.indexOf('=');
    if (idx > 0 && parts.slice(0, idx).trim() === name) {
      return `${name}=${parts.slice(idx + 1).trim()}`;
    }
  }
  return null;
}

async function runUnitAndAdapterTests() {
  console.log('\n--- PART 1: Centralized Safeguard Policy & Adapter Negative Tests ---');

  const { compileAndLoad } = loadTsModules({
    '@/lib/db': async () => ({ connection: { readyState: 1 } }),
    './db': async () => ({ connection: { readyState: 1 } }),
    '@/models/Message': {
      Message: {
        findOne: async () => null,
        create: async (doc) => ({ _id: 'msg_stub_1', ...doc }),
        findByIdAndUpdate: async () => ({})
      }
    },
    '@/models/ProviderLedger': {
      ProviderLedger: {
        create: async (doc) => ({ _id: 'ledger_stub_1', ...doc })
      }
    },
    './postgres': {
      query: async () => ({ rows: [] })
    }
  });

  const safeguards = compileAndLoad(path.join(ROOT_DIR, 'src', 'lib', 'safeguards.ts'));
  const chatmitra = compileAndLoad(path.join(ROOT_DIR, 'src', 'lib', 'chatmitra.ts'));
  const aisensy = compileAndLoad(path.join(ROOT_DIR, 'src', 'lib', 'aisensy.ts'));
  const voiceProvider = compileAndLoad(path.join(ROOT_DIR, 'src', 'lib', 'voice-provider.ts'));
  const { ProviderRouter } = compileAndLoad(path.join(ROOT_DIR, 'src', 'lib', 'provider-router.ts'));
  const integrations = compileAndLoad(path.join(ROOT_DIR, 'src', 'lib', 'integrations.ts'));

  // Section C unit checks
  await runCase('C1: evaluateBulkBroadcastPolicy rejects unset, false, malformed, and live states', async () => {
    const rUnset = safeguards.evaluateBulkBroadcastPolicy({ PROVIDER_MODE: 'mock' });
    assert.strictEqual(rUnset.allowed, false);
    assert.strictEqual(rUnset.status, 403);
    assert.strictEqual(rUnset.error, 'BROADCAST_DISABLED');

    for (const val of ['false', 'FALSE', '1', 'yes', 'TRUE', '']) {
      const rBad = safeguards.evaluateBulkBroadcastPolicy({
        PROVIDER_MODE: 'mock',
        BULK_BROADCAST_ENABLED: val
      });
      assert.strictEqual(rBad.allowed, false, `Expected denial for BULK_BROADCAST_ENABLED=${val}`);
      assert.strictEqual(rBad.status, 403);
    }

    const rLive = safeguards.evaluateBulkBroadcastPolicy({
      PROVIDER_MODE: 'live',
      BULK_BROADCAST_ENABLED: 'true'
    });
    assert.strictEqual(rLive.allowed, false);
    assert.strictEqual(rLive.status, 403);
    assert.strictEqual(rLive.error, 'BROADCAST_DISABLED');

    const rOk = safeguards.evaluateBulkBroadcastPolicy({
      PROVIDER_MODE: 'mock',
      BULK_BROADCAST_ENABLED: 'true'
    });
    assert.strictEqual(rOk.allowed, true);
    assert.strictEqual(rOk.status, 200);
  });

  // Section D unit checks
  await runCase('D1: evaluateAuthorizedTestRecipient accepts canonical test phone variants and masks PII', async () => {
    const env = { AUTHORIZED_TEST_PHONE_CANONICAL: '919175635165' };
    for (const variant of ['+919175635165', '919175635165', '9175635165', '09175635165', '+91 91756 35165']) {
      const res = safeguards.evaluateAuthorizedTestRecipient(variant, env);
      assert.strictEqual(res.allowed, true, `Expected ${variant} to match`);
      assert.strictEqual(res.targetCanonicalDigits, '919175635165');
      assert.strictEqual(res.targetE164, '+919175635165');
      assert.strictEqual(res.targetMasked, '****5165');
    }
  });

  await runCase('D2: evaluateAuthorizedTestRecipient fails closed on missing, malformed, and unauthorized numbers', async () => {
    assert.strictEqual(
      safeguards.evaluateAuthorizedTestRecipient('+919175635165', {}).allowed,
      false,
      'Missing env must fail closed'
    );
    assert.strictEqual(
      safeguards.evaluateAuthorizedTestRecipient('+919175635165', { AUTHORIZED_TEST_PHONE_CANONICAL: 'badphone' }).allowed,
      false,
      'Malformed env must fail closed'
    );
    for (const badTarget of [
      '919876543210',
      '9876543210',
      '+919876543210',
      '+14155550100',
      '',
      'abc',
      '0000000000',
      '91917563516599'
    ]) {
      const res = safeguards.evaluateAuthorizedTestRecipient(badTarget, {
        AUTHORIZED_TEST_PHONE_CANONICAL: '919175635165'
      });
      assert.strictEqual(res.allowed, false, `Expected ${badTarget} to be rejected`);
      assert.ok([400, 403].includes(res.status));
      assert.ok(!res.message.includes('9175635165'), 'Error message must not leak raw test phone');
    }
  });

  // Spy on axios.post & global.fetch to guarantee ZERO external calls during unauthorized live tests
  await runCase('D3: Shared provider adapters (ChatMitra, AiSensy, OmniDM WA, ProviderRouter, Voice, Integrations) block unauthorized recipients with ZERO HTTP calls', async () => {
    const axios = require('axios');
    const origAxiosPost = axios.post;
    const origFetch = global.fetch;
    let outboundCalls = 0;

    axios.post = async () => {
      outboundCalls++;
      throw new Error('UNEXPECTED_EXTERNAL_AXIOS_POST');
    };
    global.fetch = async () => {
      outboundCalls++;
      throw new Error('UNEXPECTED_EXTERNAL_FETCH');
    };

    try {
      await withEnv(
        {
          PROVIDER_MODE: 'live',
          OMNIDM_LIVE_ENABLED: 'true',
          AUTHORIZED_TEST_PHONE_CANONICAL: '919175635165',
          CHATMITRA_API_KEY: 'test_cm_key',
          AISENCY_WABA_API_KEY: 'test_ai_key',
          OMNIDIM_API_KEY: 'test_omni_key',
          OMNIDIM_VOICE_AGENT_ID: 'agent_test',
          WHATSAPP_TOKEN: 'meta_tok',
          WHATSAPP_PHONE_NUMBER_ID: '123456',
          TWILIO_ACCOUNT_SID: 'AC_test',
          TWILIO_AUTH_TOKEN: 'auth_test'
        },
        async () => {
          const rCM = await chatmitra.sendChatMitraMessage({
            toPhone: '+919876543210',
            messageText: 'Test'
          });
          assert.strictEqual(rCM.success, false);
          assert.strictEqual(rCM.status, 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT');

          const rAi = await aisensy.sendAiSensyWhatsApp(
            { destination: '+919876543210', userName: 'Test', templateName: 'avani_loan_intro_v2' },
            'msg_1'
          );
          assert.strictEqual(rAi.success, false);
          assert.strictEqual(rAi.status, 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT');

          const rOmniWa = await aisensy.sendOmniDMWhatsApp('+919876543210', 'Test');
          assert.strictEqual(rOmniWa.success, false);

          for (const prov of ['CHATMITRA', 'AISENSY', 'META_CLOUD']) {
            const rPr = await ProviderRouter.dispatchMessage({
              phone: '+919876543210',
              name: 'Test',
              messageText: 'Hello',
              provider: prov
            });
            assert.strictEqual(rPr.success, false, `ProviderRouter(${prov}) must block unauthorized recipient`);
            assert.strictEqual(rPr.status, 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT');
          }

          const rVoice = await voiceProvider.defaultVoiceService.dispatchCall({
            phoneNumber: '9876543210',
            customerName: 'Test',
            consentGranted: true,
            isOptedOut: false
          });
          assert.strictEqual(rVoice.success, false);
          assert.strictEqual(rVoice.rawResponse?.status, 'BLOCKED_UNAUTHORIZED_RECIPIENT');

          const rTpl = await integrations.sendAiSensyWhatsAppTemplate('9876543210', 'Test');
          assert.strictEqual(rTpl.success, false);

          await integrations.sendWhatsAppChecklist('9876543210', 'Test', 'Personal Loan');
          await integrations.sendMissedCallWhatsApp('9876543210', 'Test');

          // Also verify missing AUTHORIZED_TEST_PHONE_CANONICAL blocks even the test number
          await withEnv({ AUTHORIZED_TEST_PHONE_CANONICAL: undefined }, async () => {
            const rMissing = await ProviderRouter.dispatchMessage({
              phone: '+919175635165',
              name: 'Test',
              messageText: 'Missing config',
              provider: 'CHATMITRA'
            });
            assert.strictEqual(rMissing.success, false);
            assert.strictEqual(rMissing.status, 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT');
          });
        }
      );

      // Verify AISENSY fails safe to mock when PROVIDER_MODE is unset
      await withEnv(
        {
          PROVIDER_MODE: undefined,
          AISENCY_WABA_API_KEY: 'test_ai_key',
          AUTHORIZED_TEST_PHONE_CANONICAL: '919175635165'
        },
        async () => {
          const rUnset = await aisensy.sendAiSensyWhatsApp(
            { destination: '+919876543210', userName: 'Unset', text: 'Hi' },
            ''
          );
          assert.strictEqual(rUnset.success, true);
          assert.ok(String(rUnset.messageId).startsWith('mock_wamid_'));
        }
      );

      assert.strictEqual(outboundCalls, 0, `Expected 0 external HTTP calls, observed ${outboundCalls}`);
    } finally {
      axios.post = origAxiosPost;
      global.fetch = origFetch;
    }
  });

  // Section E unit checks
  await runCase('E1: evaluateWebhookReplyPolicy removes prefix bypasses and enforces suppression/archival flags', async () => {
    for (const prefix of ['SYNTHETIC_123', 'TEST_456', 'INTEGRATION_789']) {
      const res = safeguards.evaluateWebhookReplyPolicy({
        eventId: prefix,
        payload: {},
        inboxRecord: { status: 'PROCESSING' },
        env: {
          CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'false',
          WHATSAPP_INBOUND_AI_REPLY_ENABLED: 'true',
          AISENSY_INBOUND_WEBHOOK_ENABLED: 'true'
        }
      });
      assert.strictEqual(res.canTriggerAutoReply, false, `Prefix ${prefix} must NEVER bypass CHATMITRA_INBOUND_AUTO_REPLY_ENABLED=false`);
    }

    const rArchPayload = safeguards.evaluateWebhookReplyPolicy({
      eventId: 'REAL_EVT_1',
      payload: { archiveOnly: true },
      inboxRecord: { status: 'PROCESSING' },
      env: { CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'true' }
    });
    assert.strictEqual(rArchPayload.archiveOnly, true);
    assert.strictEqual(rArchPayload.canSendAnyProviderMessage, false);
    assert.strictEqual(rArchPayload.canTriggerAutoReply, false);

    const rArchRecord = safeguards.evaluateWebhookReplyPolicy({
      eventId: 'REAL_EVT_2',
      payload: {},
      inboxRecord: { status: 'PROCESSING', archiveOnly: true },
      env: { CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'true' }
    });
    assert.strictEqual(rArchRecord.archiveOnly, true);
    assert.strictEqual(rArchRecord.canSendAnyProviderMessage, false);
    assert.strictEqual(rArchRecord.canTriggerAutoReply, false);

    const rSuppPayload = safeguards.evaluateWebhookReplyPolicy({
      eventId: 'REAL_EVT_3',
      payload: { suppressAutoReply: true },
      inboxRecord: { status: 'PROCESSING' },
      env: { CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'true' }
    });
    assert.strictEqual(rSuppPayload.suppressAutoReply, true);
    assert.strictEqual(rSuppPayload.canSendAnyProviderMessage, false);
    assert.strictEqual(rSuppPayload.canTriggerAutoReply, false);

    const rAllowed = safeguards.evaluateWebhookReplyPolicy({
      eventId: 'REAL_EVT_4',
      payload: {},
      inboxRecord: { status: 'PROCESSING' },
      env: {
        CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'true',
        WHATSAPP_INBOUND_AI_REPLY_ENABLED: 'true',
        AISENSY_INBOUND_WEBHOOK_ENABLED: 'true'
      }
    });
    assert.strictEqual(rAllowed.canSendAnyProviderMessage, true);
    assert.strictEqual(rAllowed.canTriggerAutoReply, true);
    assert.strictEqual(rAllowed.suppressionReason, 'ALLOWED');

    // CP-27.2 Phase 2 Item 6 & 7: Verify absent or false WHATSAPP_INBOUND_AI_REPLY_ENABLED blocks inbound AI auto-reply
    for (const badVal of [undefined, '', 'false', 'FALSE', '0']) {
      const rWaDisabled = safeguards.evaluateWebhookReplyPolicy({
        eventId: 'REAL_EVT_WA_OFF',
        payload: {},
        inboxRecord: { status: 'PROCESSING' },
        env: {
          CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'true',
          WHATSAPP_INBOUND_AI_REPLY_ENABLED: badVal,
          AISENSY_INBOUND_WEBHOOK_ENABLED: 'true'
        }
      });
      assert.strictEqual(rWaDisabled.canTriggerAutoReply, false, `WHATSAPP_INBOUND_AI_REPLY_ENABLED=${badVal} must block auto-reply`);
      assert.strictEqual(rWaDisabled.suppressionReason, 'WHATSAPP_AI_REPLY_DISABLED');
    }

    // CP-27.2 Phase 2 Item 6 & 7: Verify absent or false AISENSY_INBOUND_WEBHOOK_ENABLED blocks inbound automation
    for (const badVal of [undefined, '', 'false', 'FALSE', '0']) {
      const rAiDisabled = safeguards.evaluateWebhookReplyPolicy({
        eventId: 'REAL_EVT_AISENSY_OFF',
        payload: {},
        inboxRecord: { status: 'PROCESSING' },
        env: {
          CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'true',
          WHATSAPP_INBOUND_AI_REPLY_ENABLED: 'true',
          AISENSY_INBOUND_WEBHOOK_ENABLED: badVal
        }
      });
      assert.strictEqual(rAiDisabled.canTriggerAutoReply, false, `AISENSY_INBOUND_WEBHOOK_ENABLED=${badVal} must block auto-reply`);
      assert.strictEqual(rAiDisabled.suppressionReason, 'AISENSY_INBOUND_DISABLED');
    }
  });

  // CP-27.2 Phase 1 Item 12: Explicit negative test proving local execution under proposed .env.local / .env.test / .env.production cannot send live WhatsApp or voice messages
  await runCase('LOCAL-NEG-1 (CP-27.2): Local execution profiles (development, test, production with PROVIDER_MODE=mock and all live flags false) cannot send live WhatsApp or voice messages', async () => {
    const axios = require('axios');
    const origAxiosPost = axios.post;
    const origFetch = global.fetch;
    let externalHttpCount = 0;

    axios.post = async () => {
      externalHttpCount++;
      throw new Error('FORBIDDEN_LIVE_AXIOS_POST_IN_LOCAL_EXECUTION');
    };
    global.fetch = async () => {
      externalHttpCount++;
      throw new Error('FORBIDDEN_LIVE_FETCH_IN_LOCAL_EXECUTION');
    };

    const callkaro = compileAndLoad(path.join(ROOT_DIR, 'src', 'lib', 'callkaro.ts'));
    const vapi = compileAndLoad(path.join(ROOT_DIR, 'src', 'lib', 'vapi.ts'));

    const localProfiles = [
      { name: '.env.local', APP_MODE: 'development', PROVIDER_MODE: 'mock' },
      { name: '.env.test', APP_MODE: 'test', PROVIDER_MODE: 'mock' },
      { name: '.env.production', APP_MODE: 'production', PROVIDER_MODE: 'mock' }
    ];

    try {
      for (const profile of localProfiles) {
        await withEnv(
          {
            APP_MODE: profile.APP_MODE,
            PROVIDER_MODE: profile.PROVIDER_MODE,
            LIVE_TEST_AUTHORIZATION: 'false',
            ALLOW_PRODUCTION_TESTS: 'false',
            BULK_BROADCAST_ENABLED: 'false',
            CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'false',
            WHATSAPP_INBOUND_AI_REPLY_ENABLED: 'false',
            AISENSY_INBOUND_WEBHOOK_ENABLED: 'false',
            OMNIDM_LIVE_ENABLED: 'false',
            AUTHORIZED_TEST_PHONE_CANONICAL: undefined,
            CHATMITRA_API_KEY: 'local_dummy_key',
            AISENCY_WABA_API_KEY: 'local_dummy_key',
            OMNIDIM_API_KEY: 'local_dummy_key',
            CALLKARO_API_KEY: 'local_dummy_key',
            VAPI_API_KEY: 'local_dummy_key'
          },
          async () => {
            const cmRes = await chatmitra.sendChatMitraMessage({
              toPhone: '+919175635165',
              messageText: `Local ${profile.name} test`
            });
            assert.strictEqual(cmRes.provider, 'ChatMitra_Mock', `${profile.name}: ChatMitra must remain mock`);
            assert.ok(String(cmRes.messageId).startsWith('CM-MOCK-'), `${profile.name}: ChatMitra messageId must be CM-MOCK-*`);

            const aiRes = await aisensy.sendAiSensyWhatsApp(
              { destination: '+919175635165', userName: 'Local', text: 'Test' },
              `idemp_${profile.name}`
            );
            assert.ok(String(aiRes.messageId).startsWith('mock_wamid_'), `${profile.name}: AiSensy must remain mock`);

            const prRes = await ProviderRouter.dispatchMessage({
              phone: '+919175635165',
              name: 'Local',
              messageText: 'Router test',
              provider: 'CHATMITRA'
            });
            assert.ok(String(prRes.providerMessageId).startsWith('CM-MOCK-'), `${profile.name}: ProviderRouter must remain mock`);

            const voiceRes = await voiceProvider.defaultVoiceService.dispatchCall({
              phoneNumber: '+919175635165',
              customerName: 'Local',
              consentGranted: true,
              isOptedOut: false
            });
            assert.strictEqual(voiceRes.success, false, `${profile.name}: VoiceService must block live call when OMNIDM_LIVE_ENABLED=false`);
            assert.strictEqual(voiceRes.rawResponse?.status, 'DISABLED_PENDING_RECHARGE');

            const ckRes = await callkaro.triggerCallKaroCall('+919175635165', 'Local', 'Personal Loan');
            assert.ok(String(ckRes.call_id).startsWith('mock_callkaro_'), `${profile.name}: CallKaro must remain mock when PROVIDER_MODE=mock`);

            const vapiRes = await vapi.triggerOutboundCall('+919175635165', 'Local', 'Personal Loan');
            assert.strictEqual(vapiRes.blocked, true, `${profile.name}: Vapi must block live call when PROVIDER_MODE=mock`);

            const bulkPolicy = safeguards.evaluateBulkBroadcastPolicy(process.env);
            assert.strictEqual(bulkPolicy.allowed, false, `${profile.name}: Bulk broadcast must be blocked`);

            const inbPolicy = safeguards.evaluateWebhookReplyPolicy({
              eventId: `EVT_${profile.name}`,
              payload: {},
              inboxRecord: { status: 'PROCESSING' },
              env: process.env
            });
            assert.strictEqual(inbPolicy.canTriggerAutoReply, false, `${profile.name}: Inbound auto-reply must be blocked`);
          }
        );
      }
      assert.strictEqual(externalHttpCount, 0, `Expected 0 external HTTP calls across all local profiles, got ${externalHttpCount}`);
    } finally {
      axios.post = origAxiosPost;
      global.fetch = origFetch;
    }
  });

  await runCase('E2-PROVIDER-FLAGS (CP-27.4): ChatMitra and Meta/AiSensy inbound permissions are independently evaluated', async () => {
    // Enabling ChatMitra does NOT enable Meta/AiSensy
    const rChatMitraOn = safeguards.evaluateWebhookReplyPolicy({
      eventId: 'EVT_CM_1',
      provider: 'ChatMitra',
      payload: {},
      inboxRecord: { status: 'PROCESSING', provider: 'ChatMitra' },
      env: {
        CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'true',
        WHATSAPP_INBOUND_AI_REPLY_ENABLED: 'true',
        AISENSY_INBOUND_WEBHOOK_ENABLED: 'false'
      }
    });
    assert.strictEqual(rChatMitraOn.canTriggerAutoReply, true, 'ChatMitra should be allowed when its own flag + global flag are true');
    assert.strictEqual(rChatMitraOn.suppressionReason, 'ALLOWED');

    const rMetaWhileChatMitraOn = safeguards.evaluateWebhookReplyPolicy({
      eventId: 'META_EVT_1',
      provider: 'Meta_LeadAds',
      payload: {},
      inboxRecord: { status: 'PROCESSING', provider: 'Meta_LeadAds' },
      env: {
        CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'true',
        WHATSAPP_INBOUND_AI_REPLY_ENABLED: 'true',
        AISENSY_INBOUND_WEBHOOK_ENABLED: 'false'
      }
    });
    assert.strictEqual(rMetaWhileChatMitraOn.canTriggerAutoReply, false, 'Meta/AiSensy must remain blocked when AISENSY_INBOUND_WEBHOOK_ENABLED=false');
    assert.strictEqual(rMetaWhileChatMitraOn.suppressionReason, 'AISENSY_INBOUND_DISABLED');

    // Enabling AiSensy/Meta does NOT enable ChatMitra
    const rAiSensyOn = safeguards.evaluateWebhookReplyPolicy({
      eventId: 'EVT_AI_1',
      provider: 'AiSensy',
      payload: {},
      inboxRecord: { status: 'PROCESSING', provider: 'AiSensy' },
      env: {
        CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'false',
        WHATSAPP_INBOUND_AI_REPLY_ENABLED: 'true',
        AISENSY_INBOUND_WEBHOOK_ENABLED: 'true'
      }
    });
    assert.strictEqual(rAiSensyOn.canTriggerAutoReply, true, 'AiSensy should be allowed when its own flag + global flag are true');

    const rChatMitraWhileAiSensyOn = safeguards.evaluateWebhookReplyPolicy({
      eventId: 'EVT_CM_2',
      provider: 'ChatMitra',
      payload: {},
      inboxRecord: { status: 'PROCESSING', provider: 'ChatMitra' },
      env: {
        CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'false',
        WHATSAPP_INBOUND_AI_REPLY_ENABLED: 'true',
        AISENSY_INBOUND_WEBHOOK_ENABLED: 'true'
      }
    });
    assert.strictEqual(rChatMitraWhileAiSensyOn.canTriggerAutoReply, false, 'ChatMitra must remain blocked when CHATMITRA_INBOUND_AUTO_REPLY_ENABLED=false');
    assert.strictEqual(rChatMitraWhileAiSensyOn.suppressionReason, 'AUTO_REPLY_DISABLED');
  });

  await runCase('E3-CHATMITRA-AUTH (CP-27.4): ChatMitra webhook rejects missing secret, missing signature, and invalid HMAC signature', async () => {
    const mockNextResponse = {
      json: (body, init = {}) => ({ status: init.status || 200, body })
    };
    const chatmitraLoader = loadTsModules({});
    const chatmitraMod = chatmitraLoader.compileAndLoad(path.join(ROOT_DIR, 'src/lib/chatmitra.ts'));
    const routeLoader = loadTsModules({
      'next/server': { NextResponse: mockNextResponse },
      '@vercel/functions': { waitUntil: () => {} },
      '@/lib/chatmitra': chatmitraMod,
      '@/lib/db': async () => ({ connection: { readyState: 1 } }),
      '@/models/WebhookInbox': {
        WebhookInbox: {
          create: async () => ({ _id: 'wb_1' })
        }
      },
      mongoose: { connection: { readyState: 1 } }
    });
    const routeMod = routeLoader.compileAndLoad(path.join(ROOT_DIR, 'src/app/api/chatmitra-webhook/route.ts'));

    const sampleBody = JSON.stringify({
      event: 'message.received',
      messageId: 'CM-AUTH-TEST-1',
      from: '919322875165',
      text: 'Hello'
    });
    const makeReq = (headersMap = {}) => ({
      text: async () => sampleBody,
      headers: {
        get: (k) => headersMap[k.toLowerCase()] || null
      },
      url: 'http://127.0.0.1:3000/api/chatmitra-webhook'
    });

    await withEnv(
      { CHATMITRA_WEBHOOK_SECRET: '', CHATMANTRA_WEBHOOK_SECRET: '', CHATMITRA_SECRET: '', CHATMANTRA_SECRET: '' },
      async () => {
        const resNoSecret = await routeMod.POST(makeReq({}));
        assert.strictEqual(resNoSecret.status, 401, 'Missing webhook secret must fail closed with 401');
      }
    );

    await withEnv(
      { CHATMITRA_WEBHOOK_SECRET: 'test_cm_secret_123' },
      async () => {
        const resNoSig = await routeMod.POST(makeReq({}));
        assert.strictEqual(resNoSig.status, 401, 'Missing signature header must fail closed with 401');

        const resBadSig = await routeMod.POST(makeReq({ 'x-webhook-signature': 'deadbeef0000' }));
        assert.strictEqual(resBadSig.status, 401, 'Invalid HMAC signature must fail closed with 401');
      }
    );
  });

  await runCase('E4-META-OPTOUT-MOCK (CP-27.4): Meta webhook blocks outbound actions for opted-out contacts and makes ZERO Graph API calls in mock mode', async () => {
    const mockNextResponse = {
      json: (body, init = {}) => ({ status: init.status || 200, body })
    };
    let graphApiCalls = 0;
    let waDispatchCalls = 0;
    let voiceDispatchCalls = 0;

    const metaLoader = loadTsModules({
      'next/server': { NextResponse: mockNextResponse },
      '@/lib/db': async () => ({ connection: { readyState: 1 } }),
      '@/models/Lead': {
        Lead: {
          findOneAndUpdate: async () => ({ _id: 'lead_1', isOptedOut: true, status: 'OPTED_OUT', consentStatus: 'WITHDRAWN' }),
          findByIdAndUpdate: async () => {}
        }
      },
      '@/models/Contact': {
        Contact: {
          findOne: () => ({ lean: async () => ({ _id: 'contact_1', optedIn: false }) })
        }
      },
      '@/models/WebhookInbox': {
        WebhookInbox: {
          create: async () => ({ _id: 'inbox_1' }),
          updateOne: async () => {}
        }
      },
      '@/lib/aisensy': {
        sendAiSensyWhatsApp: async () => { waDispatchCalls++; return { success: true }; }
      },
      '@/lib/voice-provider': {
        defaultVoiceService: {
          dispatchCall: async () => { voiceDispatchCalls++; return { success: true }; }
        }
      },
      '@/lib/safeguards': safeguards,
      axios: {
        get: async () => { graphApiCalls++; return { data: {} }; }
      }
    });
    const metaRouteMod = metaLoader.compileAndLoad(path.join(ROOT_DIR, 'src/app/api/meta-webhook/route.ts'));

    const metaPayload = JSON.stringify({
      entry: [{
        changes: [{
          field: 'leadgen',
          value: { leadgen_id: 'LG_1001', phone_number: '9322875165', loan_type: 'Business Loan' }
        }]
      }]
    });
    const metaSecret = 'meta_test_secret_123';
    const metaSig = 'sha256=' + crypto.createHmac('sha256', metaSecret).update(metaPayload).digest('hex');

    await withEnv(
      {
        PROVIDER_MODE: 'mock',
        WHATSAPP_TOKEN: 'dummy_graph_token',
        META_APP_SECRET: metaSecret,
        WHATSAPP_APP_SECRET: metaSecret,
        AISENSY_INBOUND_WEBHOOK_ENABLED: 'true',
        WHATSAPP_INBOUND_AI_REPLY_ENABLED: 'true',
        OMNIDM_LIVE_ENABLED: 'true'
      },
      async () => {
        const res = await metaRouteMod.POST({
          text: async () => metaPayload,
          headers: { get: (k) => (k.toLowerCase() === 'x-hub-signature-256' ? metaSig : null) }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(graphApiCalls, 0, 'Mock mode must make ZERO Facebook Graph API calls');
        assert.strictEqual(waDispatchCalls, 0, 'Opted-out contact must NOT receive welcome WhatsApp');
        assert.strictEqual(voiceDispatchCalls, 0, 'Opted-out contact must NOT receive voice call');
      }
    );

    // Even in live mode, opted-out contact must still receive 0 welcome messages or calls
    await withEnv(
      {
        PROVIDER_MODE: 'live',
        WHATSAPP_TOKEN: '',
        META_APP_SECRET: metaSecret,
        WHATSAPP_APP_SECRET: metaSecret,
        AISENSY_INBOUND_WEBHOOK_ENABLED: 'true',
        WHATSAPP_INBOUND_AI_REPLY_ENABLED: 'true',
        OMNIDM_LIVE_ENABLED: 'true'
      },
      async () => {
        const resLiveOptedOut = await metaRouteMod.POST({
          text: async () => metaPayload,
          headers: { get: (k) => (k.toLowerCase() === 'x-hub-signature-256' ? metaSig : null) }
        });
        assert.strictEqual(resLiveOptedOut.status, 200);
        assert.strictEqual(waDispatchCalls, 0, 'Opted-out contact must NOT receive welcome WhatsApp even in live mode');
        assert.strictEqual(voiceDispatchCalls, 0, 'Opted-out contact must NOT receive voice call even in live mode');
      }
    );
  });
}

async function seedSyntheticUsers(testMongoUri, runTag) {
  await mongoose.connect(testMongoUri);
  const { User } = (() => {
    const s = new mongoose.Schema(
      {
        email: { type: String, required: true, unique: true },
        name: String,
        role: String,
        passwordHash: String,
        isActive: Boolean
      },
      { strict: false }
    );
    return { User: mongoose.models.User || mongoose.model('User', s) };
  })();

  const makeHash = (pw) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(pw, salt, 64).toString('hex');
    return `${salt}:${derived}`;
  };

  await User.deleteMany({ email: { $in: [SYNTHETIC_ADMIN_EMAIL, SYNTHETIC_ADVISOR_EMAIL] } });
  await User.create([
    {
      email: SYNTHETIC_ADMIN_EMAIL,
      name: `CP268 Admin ${runTag}`,
      role: 'ADMIN',
      passwordHash: makeHash(SYNTHETIC_ADMIN_PASS),
      isActive: true
    },
    {
      email: SYNTHETIC_ADVISOR_EMAIL,
      name: `CP268 Advisor ${runTag}`,
      role: 'ADVISOR',
      passwordHash: makeHash(SYNTHETIC_ADVISOR_PASS),
      isActive: true
    }
  ]);
}

async function loginAs(baseUrl, email, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const cookie = extractCookie(res, 'avani_crm_session');
  assert.strictEqual(res.status, 200, `Login failed for ${email}`);
  assert.ok(cookie, `Missing session cookie for ${email}`);
  return cookie;
}

async function runHttpRouteTests() {
  console.log('\n--- PART 2: Real Isolated Server Negative & Regression Route Tests (avani_ai_crm_test) ---');
  const testMongoUri = loadTestMongoUri();
  const runTag = `CP268_${Date.now()}`;
  await seedSyntheticUsers(testMongoUri, runTag);

  const db = mongoose.connection.db;
  const serverSafeEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT_SAFE),
    MONGODB_URI: testMongoUri,
    avani_ai_crm_prod_MONGODB_URI: testMongoUri,
    APP_MODE: 'test',
    PROVIDER_MODE: 'mock',
    BULK_BROADCAST_ENABLED: 'false',
    CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'false',
    WHATSAPP_INBOUND_AI_REPLY_ENABLED: 'true',
    AISENSY_INBOUND_WEBHOOK_ENABLED: 'true',
    AUTHORIZED_TEST_PHONE_CANONICAL: '919175635165',
    OMNIDM_LIVE_ENABLED: 'false',
    SESSION_SECRET: SYNTHETIC_SESSION_SECRET,
    CRM_ADMIN_EMAIL: SYNTHETIC_ADMIN_EMAIL,
    CRM_ADMIN_NAME: `CP268 Admin ${runTag}`,
    CRM_ADMIN_PASSWORD: SYNTHETIC_ADMIN_PASS,
    CRM_ADVISOR_EMAIL: SYNTHETIC_ADVISOR_EMAIL,
    CRM_ADVISOR_NAME: `CP268 Advisor ${runTag}`,
    CRM_ADVISOR_PASSWORD: SYNTHETIC_ADVISOR_PASS,
    CRON_SECRET: SYNTHETIC_CRON_SECRET,
    INTERNAL_WORKER_SECRET: SYNTHETIC_WORKER_SECRET,
    CALLKARO_WEBHOOK_SECRET: SYNTHETIC_CALLKARO_SECRET
  };

  const serverLiveNegEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT_LIVE_NEG),
    MONGODB_URI: testMongoUri,
    avani_ai_crm_prod_MONGODB_URI: testMongoUri,
    APP_MODE: 'test',
    PROVIDER_MODE: 'live',
    BULK_BROADCAST_ENABLED: 'true',
    CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'true',
    AUTHORIZED_TEST_PHONE_CANONICAL: '919175635165',
    OMNIDM_LIVE_ENABLED: 'true',
    CHATMITRA_API_KEY: 'synthetic_cm_key_cp268',
    AISENCY_WABA_API_KEY: 'synthetic_aisensy_key_cp268',
    OMNIDIM_API_KEY: 'synthetic_omnidim_key_cp268',
    WHATSAPP_TOKEN: 'synthetic_meta_tok_cp268',
    WHATSAPP_PHONE_NUMBER_ID: '999999999999',
    SESSION_SECRET: SYNTHETIC_SESSION_SECRET,
    CRM_ADMIN_EMAIL: SYNTHETIC_ADMIN_EMAIL,
    CRM_ADMIN_NAME: `CP268 Admin ${runTag}`,
    CRM_ADMIN_PASSWORD: SYNTHETIC_ADMIN_PASS,
    CRM_ADVISOR_EMAIL: SYNTHETIC_ADVISOR_EMAIL,
    CRM_ADVISOR_NAME: `CP268 Advisor ${runTag}`,
    CRM_ADVISOR_PASSWORD: SYNTHETIC_ADVISOR_PASS,
    CRON_SECRET: SYNTHETIC_CRON_SECRET,
    INTERNAL_WORKER_SECRET: SYNTHETIC_WORKER_SECRET,
    CALLKARO_WEBHOOK_SECRET: SYNTHETIC_CALLKARO_SECRET
  };

  const nextBin = path.join(ROOT_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');
  const dnsPreload = path.join(ROOT_DIR, 'tests', 'dns_preload.cjs');
  const serverLogsSafe = [];
  const serverLogsLive = [];
  let procSafe = null;
  let procLive = null;

  try {
    procSafe = spawn(
      process.execPath,
      ['--require', dnsPreload, nextBin, 'start', '-p', String(PORT_SAFE), '-H', '127.0.0.1'],
      { cwd: ROOT_DIR, env: serverSafeEnv, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    procSafe.stdout.on('data', (d) => serverLogsSafe.push(d.toString()));
    procSafe.stderr.on('data', (d) => serverLogsSafe.push(d.toString()));

    procLive = spawn(
      process.execPath,
      ['--require', dnsPreload, nextBin, 'start', '-p', String(PORT_LIVE_NEG), '-H', '127.0.0.1'],
      { cwd: ROOT_DIR, env: serverLiveNegEnv, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    procLive.stdout.on('data', (d) => serverLogsLive.push(d.toString()));
    procLive.stderr.on('data', (d) => serverLogsLive.push(d.toString()));

    await Promise.all([waitForServer(BASE_SAFE), waitForServer(BASE_LIVE_NEG)]);

    const adminSafeCookie = await loginAs(BASE_SAFE, SYNTHETIC_ADMIN_EMAIL, SYNTHETIC_ADMIN_PASS);
    const advBlockedRes = await fetch(`${BASE_SAFE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SYNTHETIC_ADVISOR_EMAIL, password: SYNTHETIC_ADVISOR_PASS })
    });
    assert.strictEqual(advBlockedRes.status, 401, 'CP-28.1 single-owner policy: ADVISOR login must return 401');
    const adminLiveCookie = await loginAs(BASE_LIVE_NEG, SYNTHETIC_ADMIN_EMAIL, SYNTHETIC_ADMIN_PASS);

    // Seed synthetic contact so bulk-message would have targets if not blocked early
    await db.collection('contacts').insertOne({
      name: `${runTag} Contact`,
      phone: '+919876543210',
      tag: runTag,
      createdAt: new Date()
    });

    // SECTION C: Bulk broadcast routes fail closed in mock when BULK_BROADCAST_ENABLED=false
    await runCase('HTTP-C1: BULK_BROADCAST_ENABLED=false blocks bulk-message, broadcasts/*, schedule/* with HTTP 403 and zero queue writes', async () => {
      const bBefore = await db.collection('broadcasts').countDocuments();
      const sBefore = await db.collection('schedules').countDocuments();
      const mBefore = await db.collection('messages').countDocuments();
      const lBefore = await db.collection('providerledgers').countDocuments();

      const cases = [
        {
          path: '/api/contacts/bulk-message',
          body: { message: 'Promo test', templateName: 'avani_loan_intro_v2' }
        },
        {
          path: '/api/broadcasts/create',
          body: { name: `${runTag} Blocked`, templateName: 'avani_loan_intro_v2', totalContacts: 10 }
        },
        {
          path: '/api/broadcasts/send',
          body: { phone: '+919876543210', name: 'Blocked', templateName: 'avani_loan_intro_v2', testMode: true }
        },
        {
          path: '/api/campaigns/schedule',
          body: { campaignName: `${runTag} Sched`, scheduledAt: new Date(Date.now() + 60000).toISOString(), templateName: 'avani_loan_intro_v2' }
        },
        {
          path: '/api/schedule',
          body: { title: `${runTag} BroadSched`, date: '2026-12-01', time: '10:00', type: 'Broadcast' }
        }
      ];

      for (const c of cases) {
        const res = await fetch(`${BASE_SAFE}${c.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: adminSafeCookie },
          body: JSON.stringify(c.body)
        });
        assert.strictEqual(res.status, 403, `${c.path} must return 403 when BULK_BROADCAST_ENABLED=false, got ${res.status}`);
        const json = await res.json();
        assert.strictEqual(json.error, 'BROADCAST_DISABLED', `${c.path} must return error BROADCAST_DISABLED`);
      }

      // Check advisor role denied (403 RBAC) and unauthenticated denied (401)
      const unauthRes = await fetch(`${BASE_SAFE}/api/contacts/bulk-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'No auth' })
      });
      assert.strictEqual(unauthRes.status, 401);

      const advRes = await fetch(`${BASE_SAFE}/api/broadcasts/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'avani_crm_session=forged.advisor.token' },
        body: JSON.stringify({ name: 'Adv attempt' })
      });
      assert.strictEqual(advRes.status, 401);

      assert.strictEqual(await db.collection('broadcasts').countDocuments(), bBefore, 'Broadcast collection must not grow');
      assert.strictEqual(await db.collection('schedules').countDocuments(), sBefore, 'Schedule collection must not grow');
      assert.strictEqual(await db.collection('messages').countDocuments(), mBefore, 'Message collection must not grow');
      assert.strictEqual(await db.collection('providerledgers').countDocuments(), lBefore, 'ProviderLedger collection must not grow');
    });

    await runCase('HTTP-C2: Cron /api/cron/process-scheduled cancels due Broadcast when BULK_BROADCAST_ENABLED=false with zero dispatches', async () => {
      const schedId = `SCHED-${runTag}-DUE`;
      await db.collection('schedules').insertOne({
        scheduleId: schedId,
        title: `${runTag} Due Broadcast`,
        type: 'Broadcast',
        scheduledAt: new Date(Date.now() - 60000),
        status: 'SCHEDULED',
        targetAudience: 'ALL_LEADS',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const mBefore = await db.collection('messages').countDocuments();
      const lBefore = await db.collection('providerledgers').countDocuments();

      const res = await fetch(`${BASE_SAFE}/api/cron/process-scheduled`, {
        headers: { Authorization: `Bearer ${SYNTHETIC_CRON_SECRET}` }
      });
      assert.strictEqual(res.status, 200);
      const updated = await db.collection('schedules').findOne({ scheduleId: schedId });
      assert.strictEqual(updated.status, 'CANCELLED');
      assert.strictEqual(updated.executionResult?.blockedByPolicy, true);
      assert.strictEqual(await db.collection('messages').countDocuments(), mBefore);
      assert.strictEqual(await db.collection('providerledgers').countDocuments(), lBefore);
    });

    await runCase('HTTP-C3: PROVIDER_MODE=live blocks all bulk routes even if BULK_BROADCAST_ENABLED=true', async () => {
      for (const item of [
        { path: '/api/contacts/bulk-message', body: { message: 'Live bulk attempt' } },
        { path: '/api/broadcasts/create', body: { name: `${runTag} LiveBulk`, templateName: 'avani_loan_intro_v2' } },
        { path: '/api/broadcasts/send', body: { phone: '+919876543210', name: 'X', templateName: 'avani_loan_intro_v2' } },
        { path: '/api/campaigns/schedule', body: { campaignName: `${runTag} LiveSched`, scheduledAt: new Date(Date.now() + 60000).toISOString() } },
        { path: '/api/schedule', body: { title: `${runTag} LiveSched2`, date: '2026-12-01', type: 'Broadcast' } }
      ]) {
        const res = await fetch(`${BASE_LIVE_NEG}${item.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: adminLiveCookie },
          body: JSON.stringify(item.body)
        });
        assert.strictEqual(res.status, 403, `${item.path} in live mode must return 403, got ${res.status}`);
      }
    });

    // SECTION D: Live unauthorized recipient HTTP rejections
    await runCase('HTTP-D1: Live mode rejects unauthorized recipients across direct-message, test-omnidim, and callkaro-webhook with HTTP 403 and zero dispatches', async () => {
      const mBefore = await db.collection('messages').countDocuments();
      const lBefore = await db.collection('providerledgers').countDocuments();

      for (const badPhone of ['919876543210', '9876543210', '+919876543210', '+14155550100']) {
        const dmRes = await fetch(`${BASE_LIVE_NEG}/api/contacts/direct-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: adminLiveCookie },
          body: JSON.stringify({ phone: badPhone, message: 'Unauthorized test' })
        });
        assert.strictEqual(dmRes.status, 403, `direct-message must return 403 for ${badPhone}, got ${dmRes.status}`);
        const dmJson = await dmRes.json();
        assert.strictEqual(dmJson.error, 'LIVE_DISPATCH_RESTRICTED');
      }

      const omniRes = await fetch(`${BASE_LIVE_NEG}/api/test-omnidim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminLiveCookie },
        body: JSON.stringify({ phoneNumber: '919876543210', mode: 'live' })
      });
      assert.strictEqual(omniRes.status, 403);

      const ckRes = await fetch(`${BASE_LIVE_NEG}/api/callkaro-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-callkaro-secret': SYNTHETIC_CALLKARO_SECRET
        },
        body: JSON.stringify({
          call_id: `ck_${runTag}`,
          phone_number: '+919876543210',
          status: 'completed'
        })
      });
      assert.strictEqual(ckRes.status, 403);

      assert.strictEqual(await db.collection('messages').countDocuments(), mBefore);
      assert.strictEqual(await db.collection('providerledgers').countDocuments(), lBefore);
    });

    // SECTION E: Webhook worker bypass removal + suppression flags
    await runCase('HTTP-E1: SYNTHETIC_/TEST_/INTEGRATION_ prefixes never trigger AI replies when CHATMITRA_INBOUND_AUTO_REPLY_ENABLED=false', async () => {
      for (const pfx of ['SYNTHETIC_', 'TEST_', 'INTEGRATION_']) {
        const eventId = `${pfx}${runTag}`;
        const phone = '+919876500111';
        await db.collection('webhookinboxes').insertOne({
          eventId,
          provider: 'ChatMitra',
          eventType: 'INBOUND_MESSAGE',
          status: 'RECEIVED',
          receivedAt: new Date(),
          payload: {}
        });

        const msgCountBefore = await db.collection('messages').countDocuments({ direction: 'OUTBOUND' });
        const ledgerBefore = await db.collection('providerledgers').countDocuments();

        const res = await fetch(`${BASE_SAFE}/api/whatsapp-webhook-worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-auth': SYNTHETIC_WORKER_SECRET
          },
          body: JSON.stringify({
            eventId,
            provider: 'ChatMitra',
            eventType: 'INBOUND_MESSAGE',
            correlationId: runTag,
            data: {
              fromPhone: phone,
              profileName: `${runTag} User`,
              msgId: `wamid_${eventId}`,
              message: { type: 'text', text: { body: 'Hello loan info' } }
            }
          })
        });
        assert.strictEqual(res.status, 200);
        const conv = await db.collection('conversations').findOne({ phone });
        const modelTurns = (conv?.history || []).filter((h) => h.role === 'model');
        assert.strictEqual(modelTurns.length, 0, `${pfx} must NOT generate AI model reply when CHATMITRA_INBOUND_AUTO_REPLY_ENABLED=false`);
        assert.strictEqual(await db.collection('messages').countDocuments({ direction: 'OUTBOUND' }), msgCountBefore);
        assert.strictEqual(await db.collection('providerledgers').countDocuments(), ledgerBefore);
      }
    });

    await runCase('HTTP-E2: archiveOnly and suppressAutoReply suppress AI replies, opt-out ACKs, and worker retries even if auto-reply env is true', async () => {
      // 1) archiveOnly=true persisted on FAILED record -> retry must transition to ARCHIVED_HISTORICAL with zero outbound
      const archEventId = `ARCH_RETRY_${runTag}`;
      const archPhone = '+919876500222';
      await db.collection('webhookinboxes').insertOne({
        eventId: archEventId,
        provider: 'ChatMitra',
        eventType: 'INBOUND_MESSAGE',
        status: 'FAILED',
        archiveOnly: true,
        suppressAutoReply: true,
        receivedAt: new Date(),
        payload: { archiveOnly: true, suppressAutoReply: true }
      });

      const outBefore = await db.collection('messages').countDocuments({ direction: 'OUTBOUND' });
      const ledBefore = await db.collection('providerledgers').countDocuments();

      const resArch = await fetch(`${BASE_LIVE_NEG}/api/whatsapp-webhook-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-auth': SYNTHETIC_WORKER_SECRET
        },
        body: JSON.stringify({
          eventId: archEventId,
          provider: 'ChatMitra',
          eventType: 'INBOUND_MESSAGE',
          correlationId: runTag,
          data: {
            fromPhone: archPhone,
            profileName: `${runTag} Archive`,
            msgId: `wamid_${archEventId}`,
            message: { type: 'text', text: { body: 'Need business loan' } }
          }
        })
      });
      assert.strictEqual(resArch.status, 200);
      const archJson = await resArch.json();
      assert.strictEqual(archJson.archivedOnly, true);
      assert.strictEqual(archJson.outboundDispatched, false);

      const archDoc = await db.collection('webhookinboxes').findOne({ eventId: archEventId });
      assert.strictEqual(archDoc.status, 'ARCHIVED_HISTORICAL');

      // 2) suppressAutoReply=true + STOP opt-out message -> optOut saved, ZERO optOutAck sent
      const suppEventId = `SUPP_STOP_${runTag}`;
      const suppPhone = '+919876500333';
      await db.collection('webhookinboxes').insertOne({
        eventId: suppEventId,
        provider: 'ChatMitra',
        eventType: 'INBOUND_MESSAGE',
        status: 'RECEIVED',
        suppressAutoReply: true,
        receivedAt: new Date(),
        payload: { suppressAutoReply: true }
      });

      const resSupp = await fetch(`${BASE_LIVE_NEG}/api/whatsapp-webhook-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-auth': SYNTHETIC_WORKER_SECRET
        },
        body: JSON.stringify({
          eventId: suppEventId,
          provider: 'ChatMitra',
          eventType: 'INBOUND_MESSAGE',
          suppressAutoReply: true,
          correlationId: runTag,
          data: {
            fromPhone: suppPhone,
            profileName: `${runTag} OptOut`,
            msgId: `wamid_${suppEventId}`,
            message: { type: 'text', text: { body: 'STOP' } }
          }
        })
      });
      assert.strictEqual(resSupp.status, 200);
      const suppJson = await resSupp.json();
      assert.strictEqual(suppJson.optedOut, true);
      assert.strictEqual(await db.collection('messages').countDocuments({ direction: 'OUTBOUND' }), outBefore, 'Zero outbound optOutAck allowed when suppressAutoReply=true');
      assert.strictEqual(await db.collection('providerledgers').countDocuments(), ledBefore, 'Zero ledger writes allowed under suppression');

      // 3) Mock-mode STOP + suppressAutoReply=true must also suppress OptOutEngine.processOptOut outbound ACK
      const suppMockEventId = `SUPP_MOCK_STOP_${runTag}`;
      const suppMockPhone = '+919876500444';
      await db.collection('webhookinboxes').insertOne({
        eventId: suppMockEventId,
        provider: 'ChatMitra',
        eventType: 'INBOUND_MESSAGE',
        status: 'RECEIVED',
        suppressAutoReply: true,
        receivedAt: new Date(),
        payload: { suppressAutoReply: true }
      });

      const resSuppMock = await fetch(`${BASE_SAFE}/api/whatsapp-webhook-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-auth': SYNTHETIC_WORKER_SECRET
        },
        body: JSON.stringify({
          eventId: suppMockEventId,
          provider: 'ChatMitra',
          eventType: 'INBOUND_MESSAGE',
          suppressAutoReply: true,
          correlationId: runTag,
          data: {
            fromPhone: suppMockPhone,
            profileName: `${runTag} OptOut Mock`,
            msgId: `wamid_${suppMockEventId}`,
            message: { type: 'text', text: { body: 'STOP' } }
          }
        })
      });
      assert.strictEqual(resSuppMock.status, 200);
      assert.strictEqual(await db.collection('messages').countDocuments({ direction: 'OUTBOUND' }), outBefore, 'Zero outbound optOutAck allowed in mock mode when suppressAutoReply=true');
      assert.strictEqual(await db.collection('providerledgers').countDocuments(), ledBefore, 'Zero ledger writes allowed in mock mode under suppression');
    });

    // -------------------------------------------------------------------------
    // TEST 11 (CP-27.0): Multi-actor STOP suppression across phone variants (+91, 91, 10-digit),
    // pending workflow trigger cancellation, subsequent inbound AI suppression,
    // broadcasts/send opt-out guard, and PATCH /api/schedule bulk policy guard
    // -------------------------------------------------------------------------
    await runCase('HTTP-F1 (CP-27.0): Multi-actor STOP suppression across phone variants, broadcasts/send opt-out guard, and PATCH /api/schedule bulk guard', async () => {
      const leadIdPlus = `AVL-CP27-PLUS-${runTag}`;
      const leadIdRaw10 = `AVL-CP27-RAW10-${runTag}`;
      await db.collection('leads').insertMany([
        {
          leadId: leadIdPlus,
          name: `${runTag} Variant Plus`,
          phone: '+919876500555',
          normalizedMobile: '9876500555',
          loanType: 'Business Loan',
          status: 'New',
          isOptedOut: false,
          consentStatus: 'GRANTED',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          leadId: leadIdRaw10,
          name: `${runTag} Variant Raw10`,
          phone: '9876500555',
          normalizedMobile: '9876500555',
          loanType: 'Personal Loan',
          status: 'New',
          isOptedOut: false,
          consentStatus: 'GRANTED',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
      await db.collection('contacts').insertOne({
        name: `${runTag} Variant Contact`,
        phone: '919876500555',
        optedIn: true,
        tag: runTag,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await db.collection('workflowtriggers').insertMany([
        {
          triggerId: `TRIG_PLUS_${runTag}`,
          eventId: `EVT_TRIG_PLUS_${runTag}`,
          idempotencyKey: `IDEMP_TRIG_PLUS_${runTag}`,
          leadId: leadIdPlus,
          phone: '+919876500555',
          workflowType: 'DRIP_DAY_1',
          status: 'PENDING',
          scheduledAt: new Date(Date.now() + 60000)
        },
        {
          triggerId: `TRIG_RAW10_${runTag}`,
          eventId: `EVT_TRIG_RAW10_${runTag}`,
          idempotencyKey: `IDEMP_TRIG_RAW10_${runTag}`,
          leadId: leadIdRaw10,
          phone: '9876500555',
          workflowType: 'DRIP_DAY_3',
          status: 'PENDING',
          scheduledAt: new Date(Date.now() + 120000)
        }
      ]);

      // Customer sends STOP from 919876500555 (12-digit format without +)
      const stopVarEventId = `STOP_VAR_${runTag}`;
      await db.collection('webhookinboxes').insertOne({
        eventId: stopVarEventId,
        provider: 'ChatMitra',
        eventType: 'INBOUND_MESSAGE',
        status: 'RECEIVED',
        suppressAutoReply: true,
        receivedAt: new Date(),
        payload: { suppressAutoReply: true }
      });

      const resStopVar = await fetch(`${BASE_SAFE}/api/whatsapp-webhook-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-auth': SYNTHETIC_WORKER_SECRET
        },
        body: JSON.stringify({
          eventId: stopVarEventId,
          provider: 'ChatMitra',
          eventType: 'INBOUND_MESSAGE',
          suppressAutoReply: true,
          correlationId: runTag,
          data: {
            fromPhone: '919876500555',
            profileName: `${runTag} Variant Stopper`,
            msgId: `wamid_${stopVarEventId}`,
            message: { type: 'text', text: { body: 'STOP' } }
          }
        })
      });
      assert.strictEqual(resStopVar.status, 200);
      const stopVarBody = await resStopVar.json();
      assert.strictEqual(stopVarBody.optedOut, true);

      // Verify both sibling leads (+91 and 10-digit) and 12-digit contact are opted out
      const updatedPlus = await db.collection('leads').findOne({ leadId: leadIdPlus });
      const updatedRaw10 = await db.collection('leads').findOne({ leadId: leadIdRaw10 });
      const updatedContact = await db.collection('contacts').findOne({ phone: '919876500555' });
      assert.strictEqual(updatedPlus.isOptedOut, true, '+91 lead must be marked isOptedOut=true');
      assert.strictEqual(updatedRaw10.isOptedOut, true, '10-digit sibling lead must be marked isOptedOut=true');
      assert.strictEqual(updatedContact.optedIn, false, '12-digit contact must be marked optedIn=false');

      // Verify both pending workflowtriggers were cancelled
      const trigPlus = await db.collection('workflowtriggers').findOne({ triggerId: `TRIG_PLUS_${runTag}` });
      const trigRaw10 = await db.collection('workflowtriggers').findOne({ triggerId: `TRIG_RAW10_${runTag}` });
      assert.strictEqual(trigPlus.status, 'SUPPRESSED_CUSTOMER_OPTED_OUT', 'Pending trigger for +91 lead must be cancelled');
      assert.strictEqual(trigRaw10.status, 'SUPPRESSED_CUSTOMER_OPTED_OUT', 'Pending trigger for 10-digit lead must be cancelled');

      // Customer subsequently sends a non-STOP message from 9876500555 (10-digit format) while AI auto-reply is enabled
      const followInbEventId = `FOLLOW_INB_VAR_${runTag}`;
      await db.collection('webhookinboxes').insertOne({
        eventId: followInbEventId,
        provider: 'ChatMitra',
        eventType: 'INBOUND_MESSAGE',
        status: 'RECEIVED',
        receivedAt: new Date(),
        payload: {}
      });
      const resFollowInb = await fetch(`${BASE_LIVE_NEG}/api/whatsapp-webhook-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-auth': SYNTHETIC_WORKER_SECRET
        },
        body: JSON.stringify({
          eventId: followInbEventId,
          provider: 'ChatMitra',
          eventType: 'INBOUND_MESSAGE',
          correlationId: runTag,
          data: {
            fromPhone: '9876500555',
            profileName: `${runTag} Variant Stopper`,
            msgId: `wamid_${followInbEventId}`,
            message: { type: 'text', text: { body: 'I want a Business Loan of 25 Lakhs' } }
          }
        })
      });
      assert.strictEqual(resFollowInb.status, 200);
      const followInbBody = await resFollowInb.json();
      assert.strictEqual(followInbBody.optedOutSuppressed, true, 'Subsequent message from 10-digit variant must be suppressed by DPDP guard');

      // Verify POST /api/contacts/direct-message blocks opted-out recipient across variants (+91 after 91 STOP) with 403 CONTACT_OPTED_OUT
      const resDirectOptedOut = await fetch(`${BASE_SAFE}/api/contacts/direct-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminSafeCookie
        },
        body: JSON.stringify({
          phone: '+919876500555',
          name: `${runTag} Variant Plus`,
          message: 'Follow up after STOP'
        })
      });
      assert.strictEqual(resDirectOptedOut.status, 403, 'direct-message must block opted-out recipient across phone variants with 403');
      const directOptedOutBody = await resDirectOptedOut.json();
      assert.strictEqual(directOptedOutBody.error, 'CONTACT_OPTED_OUT');

      // Verify POST /api/broadcasts/send remains blocked with 403 BROADCAST_DISABLED in live mode
      const resBcastOptedOut = await fetch(`${BASE_LIVE_NEG}/api/broadcasts/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminLiveCookie
        },
        body: JSON.stringify({
          phone: '+919876500555',
          name: `${runTag} Variant Plus`,
          templateName: 'Avani_Loan_Welcome',
          broadcastType: 'whatsapp'
        })
      });
      assert.strictEqual(resBcastOptedOut.status, 403, 'broadcasts/send must return 403');
      const bcastOptedOutBody = await resBcastOptedOut.json();
      assert.strictEqual(bcastOptedOutBody.error, 'BROADCAST_DISABLED');

      // Verify PATCH /api/schedule blocks action=RESUME when BULK_BROADCAST_ENABLED=false
      const patchSchedId = `SCHED_PATCH_${runTag}`;
      await db.collection('schedules').insertOne({
        scheduleId: patchSchedId,
        title: `${runTag} Paused Broadcast`,
        type: 'Broadcast',
        scheduledAt: new Date(Date.now() + 3600000),
        date: '2026-11-15',
        time: '10:00 AM',
        targetAudience: 'ALL_LEADS',
        status: 'CANCELLED'
      });
      const resPatchResume = await fetch(`${BASE_SAFE}/api/schedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminSafeCookie
        },
        body: JSON.stringify({
          scheduleId: patchSchedId,
          action: 'RESUME'
        })
      });
      assert.strictEqual(resPatchResume.status, 403, 'PATCH /api/schedule action=RESUME must return 403 when BULK_BROADCAST_ENABLED=false');
      const patchResumeBody = await resPatchResume.json();
      assert.strictEqual(patchResumeBody.error, 'BROADCAST_DISABLED');
    });

    // -------------------------------------------------------------------------
    // TEST 14 (CP-27.2): Verify /api/whatsapp-webhook-worker suppresses inbound AI reply when
    // WHATSAPP_INBOUND_AI_REPLY_ENABLED / AISENSY_INBOUND_WEBHOOK_ENABLED are absent on BASE_LIVE_NEG,
    // and verify /api/diagnostics exposes all 5 boolean safeguard flags without leaking secrets
    // -------------------------------------------------------------------------
    await runCase('HTTP-G1 (CP-27.2): Absent WHATSAPP_INBOUND_AI_REPLY_ENABLED / AISENSY_INBOUND_WEBHOOK_ENABLED blocks worker AI reply on live server, and /api/diagnostics reports all 5 safeguard flags', async () => {
      const evtAbsentInb = `CP272_ABSENT_INB_${runTag}`;
      const testPhone = '+919876500111';
      await db.collection('webhookinboxes').insertOne({
        eventId: evtAbsentInb,
        provider: 'ChatMitra',
        eventType: 'INBOUND_MESSAGE',
        status: 'RECEIVED',
        receivedAt: new Date(),
        payload: {}
      });

      const outBefore = await db.collection('messages').countDocuments({ direction: 'OUTBOUND' });
      const ledBefore = await db.collection('providerledgers').countDocuments();

      // Note: serverLiveNegEnv has CHATMITRA_INBOUND_AUTO_REPLY_ENABLED='true' but WHATSAPP_INBOUND_AI_REPLY_ENABLED and AISENSY_INBOUND_WEBHOOK_ENABLED are absent
      const resWorker = await fetch(`${BASE_LIVE_NEG}/api/whatsapp-webhook-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-auth': SYNTHETIC_WORKER_SECRET
        },
        body: JSON.stringify({
          eventId: evtAbsentInb,
          provider: 'ChatMitra',
          eventType: 'INBOUND_MESSAGE',
          correlationId: runTag,
          data: {
            fromPhone: testPhone,
            profileName: `${runTag} Inbound Guard`,
            msgId: `wamid_${evtAbsentInb}`,
            message: { type: 'text', text: { body: 'I want a Home Loan of 50 Lakhs' } }
          }
        })
      });
      assert.strictEqual(resWorker.status, 200);
      assert.strictEqual(await db.collection('messages').countDocuments({ direction: 'OUTBOUND' }), outBefore, 'Absent WHATSAPP_INBOUND_AI_REPLY_ENABLED must suppress outbound AI reply');
      assert.strictEqual(await db.collection('providerledgers').countDocuments(), ledBefore, 'Zero ledger entries allowed when WHATSAPP_INBOUND_AI_REPLY_ENABLED is absent');

      const leadAfter = await db.collection('leads').findOne({ phone: testPhone });
      assert.strictEqual(leadAfter.status, 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP', 'Lead must transition to CUSTOMER_REPLIED_HUMAN_FOLLOWUP when inbound AI flags are absent/false');

      // Check /api/diagnostics on BASE_SAFE
      const resDiag = await fetch(`${BASE_SAFE}/api/diagnostics`, {
        headers: { Authorization: `Bearer ${SYNTHETIC_CRON_SECRET}` }
      });
      assert.strictEqual(resDiag.status, 200);
      const diagBody = await resDiag.json();
      assert.strictEqual(diagBody.environment.appMode, 'test');
      assert.strictEqual(diagBody.environment.providerMode, 'mock');
      assert.strictEqual(diagBody.environment.autoReplyEnabled, false);
      assert.strictEqual(diagBody.environment.whatsappInboundAiReplyEnabled, true);
      assert.strictEqual(diagBody.environment.aisensyInboundWebhookEnabled, true);
      assert.strictEqual(diagBody.environment.bulkBroadcastEnabled, false);
      assert.strictEqual(diagBody.environment.omniLiveEnabled, false);
    });
  } finally {
    if (procSafe) procSafe.kill();
    if (procLive) procLive.kill();

    if (mongoose.connection.readyState === 1) {
      await db.collection('users').deleteMany({ email: { $in: [SYNTHETIC_ADMIN_EMAIL, SYNTHETIC_ADVISOR_EMAIL] } });
      await db.collection('contacts').deleteMany({ $or: [{ tag: runTag }, { phone: { $in: ['+919876500111', '+919876500222', '+919876500333', '+919876500444', '+919876500555', '919876500555', '9876500555', '+919876543210'] } }] });
      await db.collection('optouts').deleteMany({ phone: { $in: ['+919876500111', '+919876500222', '+919876500333', '+919876500444', '+919876500555', '919876500555', '9876500555'] } });
      await db.collection('schedules').deleteMany({ scheduleId: new RegExp(runTag) });
      await db.collection('workflowtriggers').deleteMany({ triggerId: new RegExp(runTag) });
      await db.collection('webhookinboxes').deleteMany({ eventId: new RegExp(runTag) });
      await db.collection('messages').deleteMany({ providerMessageId: new RegExp(runTag) });
      await db.collection('messages').deleteMany({ phone: { $in: ['+919876500111', '+919876500222', '+919876500333', '+919876500444', '+919876500555', '919876500555', '9876500555', '+919876543210'] } });
      await db.collection('leads').deleteMany({ phone: { $in: ['+919876500111', '+919876500222', '+919876500333', '+919876500444', '+919876500555', '919876500555', '9876500555', '+919876543210'] } });
      await db.collection('conversations').deleteMany({ $or: [{ phone: { $in: ['+919876500111', '+919876500222', '+919876500333', '+919876500444', '+919876500555', '919876500555', '9876500555'] } }, { customerPhone: { $in: ['+919876500111', '+919876500222', '+919876500333', '+919876500444', '+919876500555', '919876500555', '9876500555'] } }] });
      await mongoose.disconnect();
    }
  }
}

(async () => {
  await runUnitAndAdapterTests();
  await runHttpRouteTests();
  console.log(`\n${passed} / ${passed + failed} TESTS PASSED`);
  if (failed > 0) process.exit(1);
})().catch((err) => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
