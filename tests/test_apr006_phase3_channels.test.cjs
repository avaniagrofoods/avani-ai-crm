/**
 * APR-006 Phase 3 — ChatMitra, Meta & WhatsApp Integration Verification Suite
 * Synthetic test fixtures ONLY. Zero live outbound WhatsApp/Meta messages.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

function readRel(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function loadTsModule(relPath) {
  const source = readRel(relPath);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(compiled, { exports: mod.exports, module: mod, require });
  return mod.exports;
}

runTest('T01: whatsapp/templates/route.ts enforces fail-closed 410 guard before DB and sanitizes 500 errors', () => {
  const src = readRel('src/app/api/whatsapp/templates/route.ts');
  const guardIdx = src.indexOf("process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true'");
  const dbIdx = src.indexOf('await connectToDatabase()');
  assert.ok(guardIdx !== -1 && dbIdx !== -1 && guardIdx < dbIdx, '410 guard must precede connectToDatabase()');
  assert.ok(src.includes("'LEGACY_MONGODB_ROUTE_DISABLED'"));
  assert.ok(src.includes('status: 410'));
  assert.ok(!src.includes('error: error.message'), 'Must not expose raw error.message on 500');
});

runTest('T02: whatsapp/templates/sync/route.ts enforces 410 guard, classifies Meta token expiry, and sanitizes errors', () => {
  const src = readRel('src/app/api/whatsapp/templates/sync/route.ts');
  assert.ok(src.includes("process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true'"), 'Missing 410 guard');
  assert.ok(src.includes('classifyMetaTokenError'), 'Missing classifyMetaTokenError call');
  assert.ok(src.includes('sanitizeErrorForLog'), 'Missing sanitizeErrorForLog call');
  assert.ok(!src.includes('error: error.message'), 'Must not expose raw error.message on 500');
});

runTest('T03: classifyMetaTokenError accurately detects Meta HTTP 401 and OAuth code 190 expiry without leaking secrets', () => {
  const { classifyMetaTokenError } = loadTsModule('src/lib/meta-token-monitor.ts');

  const r401 = classifyMetaTokenError({
    response: { status: 401, data: { error: { message: 'Unauthorized EAAFAKE123456' } } }
  });
  assert.strictEqual(r401.status, 502);
  assert.strictEqual(r401.error, 'META_TOKEN_EXPIRED_OR_INVALID');
  assert.strictEqual(r401.requiresOwnerTokenRefresh, true);
  assert.strictEqual(r401.retryable, false);
  assert.ok(!r401.message.includes('EAAFAKE123456'), 'Must not leak token in response message');

  const r190 = classifyMetaTokenError({
    response: { status: 400, data: { error: { code: 190, type: 'OAuthException', message: 'Error validating access token: Session has expired' } } }
  });
  assert.strictEqual(r190.status, 502);
  assert.strictEqual(r190.error, 'META_TOKEN_EXPIRED_OR_INVALID');
  assert.strictEqual(r190.requiresOwnerTokenRefresh, true);

  const rGeneric = classifyMetaTokenError(new Error('mongodb://internal-secret:pw@10.0.0.1 failed'));
  assert.strictEqual(rGeneric.status, 500);
  assert.strictEqual(rGeneric.error, 'TEMPLATE_SYNC_FAILED');
  assert.strictEqual(rGeneric.retryable, true);
  assert.strictEqual(rGeneric.requiresOwnerTokenRefresh, false);
  assert.ok(!rGeneric.message.includes('internal-secret'), 'Must not leak internal error details');
});

runTest('T04: ChatMitra webhook uses timing-safe HMAC verification and Sheets persistence with zero MongoDB fallback', () => {
  const routeSrc = readRel('src/app/api/chatmitra-webhook/route.ts');
  const libSrc = readRel('src/lib/chatmitra.ts');
  assert.ok(routeSrc.includes('verifyChatMitraSignature'), 'chatmitra-webhook must call verifyChatMitraSignature');
  assert.ok(libSrc.includes('timingSafeEqual'), 'chatmitra.ts must use crypto.timingSafeEqual');
  assert.ok(routeSrc.includes('webhookEventRepository'), 'chatmitra-webhook must log events to Sheets repository');
  assert.ok(!routeSrc.includes("@/lib/db"), 'chatmitra-webhook must not import MongoDB @/lib/db');
});

runTest('T05: Meta webhook enforces timing-safe X-Hub-Signature-256 and GET verify_token comparison', () => {
  const metaSrc = readRel('src/app/api/meta-webhook/route.ts');
  assert.ok(metaSrc.includes('verifyMetaWebhookSignature'), 'Missing verifyMetaWebhookSignature');
  assert.ok(metaSrc.includes('crypto.timingSafeEqual'), 'Missing timingSafeEqual verification');
  assert.ok(metaSrc.includes('evaluateWebhookReplyPolicy'), 'Missing webhook reply safeguard policy');
});

runTest('T06: Outbound messaging safeguards enforce fail-closed controls', () => {
  const safeSrc = readRel('src/lib/safeguards.ts');
  assert.ok(safeSrc.includes('evaluateBulkBroadcastPolicy'), 'Missing evaluateBulkBroadcastPolicy');
  assert.ok(safeSrc.includes('evaluateWebhookReplyPolicy'), 'Missing evaluateWebhookReplyPolicy');
});

console.log(`\nAPR-006 Phase 3 Channels Summary: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
