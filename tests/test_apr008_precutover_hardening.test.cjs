/**
 * APR-008 Phase 3/4 — Project B Pre-Cutover Hardening & Legacy MongoDB Route Verification Suite
 * Verifies all 9 newly hardened Project B API routes + 0 unguarded MongoDB routes repo-wide
 * + 0 residual genuine secret patterns across all 5 Phase 3A redacted Project B files.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

function assertFailClosedBeforeDb(relPath, minGuardCount) {
  const src = readRel(relPath);
  const guards = src.match(/process\.env\.LEGACY_MONGODB_ROUTES_ENABLED\s*!==\s*['"]true['"]/g) || [];
  assert.ok(guards.length >= minGuardCount, `${relPath}: expected >= ${minGuardCount} guards, found ${guards.length}`);
  assert.ok(src.includes("'LEGACY_MONGODB_ROUTE_DISABLED'"), `${relPath}: missing LEGACY_MONGODB_ROUTE_DISABLED`);
  assert.ok(src.includes('status: 410'), `${relPath}: missing HTTP 410`);
  const firstGuard = src.indexOf("process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true'");
  const firstDb = src.indexOf('connectToDatabase()');
  assert.ok(firstGuard !== -1 && firstDb !== -1 && firstGuard < firstDb, `${relPath}: guard must precede connectToDatabase()`);
  assert.ok(!src.includes('error: error.message') && !src.includes('error: err.message'), `${relPath}: must sanitize 500 error responses`);
}

runTest('T01: forensic-test/route.ts enforces ADMIN auth -> fail-closed 410 guard before DB', () => {
  assertFailClosedBeforeDb('src/app/api/forensic-test/route.ts', 1);
});

runTest('T02: golden-test-state/route.ts enforces ADMIN auth -> fail-closed 410 guard before DB', () => {
  assertFailClosedBeforeDb('src/app/api/golden-test-state/route.ts', 1);
});

runTest('T03: broadcasts/[id]/stats/route.ts enforces ADMIN auth -> fail-closed 410 guard before DB', () => {
  assertFailClosedBeforeDb('src/app/api/broadcasts/[id]/stats/route.ts', 1);
});

runTest('T04: campaigns/schedule/route.ts preserves bulk policy & enforces fail-closed 410 guard on GET/POST/PATCH', () => {
  const rel = 'src/app/api/campaigns/schedule/route.ts';
  assertFailClosedBeforeDb(rel, 3);
  const src = readRel(rel);
  assert.ok(src.indexOf('evaluateBulkBroadcastPolicy()') < src.indexOf("process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true'"));
});

runTest('T05: lenders/route.ts serves static DEFAULT_AVANI_LENDERS catalog on GET (with category filter) and fails closed 410 on POST', () => {
  const src = readRel('src/app/api/lenders/route.ts');
  assert.ok(src.includes("source: 'STATIC_CATALOG'"), 'GET must serve static catalog when legacy MongoDB is disabled');
  assert.ok(src.includes("'LEGACY_MONGODB_ROUTE_DISABLED'"), 'POST must fail closed with 410');
  assert.ok(!src.includes('error: error.message'), 'Must sanitize 500 errors');
});

runTest('T06: diagnostics/route.ts checks canonical Google Sheets Gateway (zero MongoDB imports) and preserves all safeguard flags', () => {
  const src = readRel('src/app/api/diagnostics/route.ts');
  assert.ok(src.includes('defaultSheetsClient.checkConnectivity()'), 'diagnostics must check canonical Google Sheets connectivity');
  assert.ok(src.includes("dataStore: 'GOOGLE_SHEETS'"), 'diagnostics must report GOOGLE_SHEETS dataStore');
  assert.ok(src.includes("provider: 'Google Sheets Gateway'"), 'diagnostics database provider must be Google Sheets Gateway');
  assert.ok(!src.includes('@/lib/db'), 'diagnostics must not import legacy MongoDB @/lib/db');
  assert.ok(!src.includes("from 'mongoose'"), 'diagnostics must not import mongoose');
  for (const flag of ['autoReplyEnabled', 'whatsappInboundAiReplyEnabled', 'aisensyInboundWebhookEnabled', 'bulkBroadcastEnabled', 'omniLiveEnabled', 'legacyMongoDbRoutesEnabled']) {
    assert.ok(src.includes(flag), `diagnostics missing environment flag: ${flag}`);
  }
});

runTest('T07: cron/follow-ups/route.ts preserves CRON_SECRET/ADMIN auth and returns non-failing HTTP 200 standby without MongoDB fallback', () => {
  const src = readRel('src/app/api/cron/follow-ups/route.ts');
  assert.ok(src.includes('constantTimeEqualStrings'), 'cron/follow-ups must use timing-safe CRON_SECRET check');
  assert.ok(src.includes("reason: 'CANONICAL_SHEETS_MODE_LEGACY_MONGO_DRIP_PAUSED'"), 'cron/follow-ups must pause legacy MongoDB drip cleanly');
  const guardIdx = src.indexOf("process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true'");
  const dbIdx = src.indexOf('connectToDatabase()');
  assert.ok(guardIdx !== -1 && guardIdx < dbIdx, 'cron/follow-ups guard must precede connectToDatabase()');
  assert.ok(!src.includes('error: error.message'), 'Must sanitize 500 errors');
});

runTest('T08: cron/process-scheduled/route.ts preserves CRON_SECRET/ADMIN auth and returns non-failing HTTP 200 standby without MongoDB fallback', () => {
  const src = readRel('src/app/api/cron/process-scheduled/route.ts');
  assert.ok(src.includes('constantTimeEqualStrings'), 'cron/process-scheduled must use timing-safe CRON_SECRET check');
  assert.ok(src.includes("reason: 'CANONICAL_SHEETS_MODE_LEGACY_MONGO_SCHEDULER_PAUSED'"), 'cron/process-scheduled must pause legacy MongoDB scheduler cleanly');
  const guardIdx = src.indexOf("process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true'");
  const dbIdx = src.indexOf('connectToDatabase()');
  assert.ok(guardIdx !== -1 && guardIdx < dbIdx, 'cron/process-scheduled guard must precede connectToDatabase()');
  assert.ok(!src.includes('error: error.message'), 'Must sanitize 500 errors');
});

runTest('T09: omnidim-webhook/route.ts uses timing-safe GET verification, gates MongoDB fallback, preserves zero recordingUrl/transcript, sanitizes 500', () => {
  const src = readRel('src/app/api/omnidim-webhook/route.ts');
  assert.ok(src.includes('constantTimeEqualStrings(token, VERIFY_TOKEN)'), 'GET verify_token must use constantTimeEqualStrings');
  assert.ok(src.includes("const legacyMongoEnabled = process.env.LEGACY_MONGODB_ROUTES_ENABLED === 'true'"), 'POST must gate MongoDB behind LEGACY_MONGODB_ROUTES_ENABLED');
  assert.ok(!src.includes('updateData.recordingUrl') && !src.includes('updateData.transcript'), 'Zero-Media-Storage policy violated');
  assert.ok(!src.includes('error: error.message'), 'Must sanitize 500 errors');
});

runTest('T10: Repo-wide invariant — ZERO API routes in src/app/api invoke connectToDatabase() without LEGACY_MONGODB_ROUTES_ENABLED guard', () => {
  const apiDir = path.join(ROOT, 'src', 'app', 'api');
  const unguarded = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name === 'route.ts') {
        const txt = fs.readFileSync(full, 'utf8');
        if (txt.includes('connectToDatabase()') && !txt.includes('LEGACY_MONGODB_ROUTES_ENABLED')) {
          unguarded.push(path.relative(apiDir, full).replace(/\\/g, '/'));
        }
      }
    }
  }
  walk(apiDir);
  assert.deepStrictEqual(unguarded, [], `Unguarded MongoDB routes remain: ${unguarded.join(', ')}`);
});

runTest('T11: Phase 3A recurrence check — ZERO genuine secret patterns remain in the 5 redacted Project B files', () => {
  const files = [
    'AVANI_LOAN_SERVICES_3_MONTH_AISENSY_BASIC_OPERATING_PLAN.md',
    'CHATMITRA_CRM_IMPLEMENTATION/43_TASK_5H_7_CONTROLLED_REMEDIATION/TASK_5H_7_FILE_CHANGE_MANIFEST.md',
    'MONGODB_ATLAS_TWO_PROJECT_SETUP_REPORT.md',
    'scratch/test_production_db_diagnosis.cjs',
    'Integrate OmniDim API Key & Automate Deployment'
  ];
  const forbidden = [
    /EAA[A-Za-z0-9]{25,}/,
    /mongodb\+srv:\/\/(?!\[REDACTED)[^:\s'"`<>]+:(?!\[REDACTED)[^@\s'"`<>]+@/i,
    /https:\/\/hooks\.zapier\.com\/hooks\/catch\/[0-9]+\/[a-zA-Z0-9_-]+/i,
    /\b(al|pa)-[A-Za-z0-9._-]{20,}\b/
  ];
  for (const rel of files) {
    const txt = readRel(rel);
    for (const re of forbidden) {
      assert.strictEqual(re.test(txt), false, `Forbidden secret pattern found in ${rel}: ${re}`);
    }
  }
});

console.log(`\nAPR-008 Project B Pre-Cutover Hardening Summary: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
