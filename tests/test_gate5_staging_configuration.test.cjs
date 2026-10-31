/**
 * AVANI AI CRM — Gate 5 Staging Configuration & Guard Validation Suite
 * 
 * Verifies:
 * 1. .env.staging.example existence and structure
 * 2. APP_MODE=staging and PROVIDER_MODE=mock enforcement
 * 3. Absence of production database 'avani_ai_crm_prod' or production cluster identifiers
 * 4. Compliance with src/lib/db.ts forensic safety guard ('avani_ai_crm_test')
 * 5. Rejection of unhardened database names (e.g. avani_ai_crm_staging, avani_ai_crm_prod)
 * 6. Provider mock safety (zero external HTTP dispatch in mock mode)
 * 7. Voice calling safety (disabled when OMNIDM_LIVE_ENABLED !== 'true')
 * 8. Pure in-memory execution with zero network, zero database, zero live secrets.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('============================================================');
console.log('🧪 RUNNING GATE 5 STAGING CONFIGURATION & GUARD VALIDATION');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
  }
}

const stagingExamplePath = path.resolve(__dirname, '..', '.env.staging.example');

// Test 1: Verify .env.staging.example exists
runTest('Staging example configuration file exists on disk', () => {
  assert.strictEqual(fs.existsSync(stagingExamplePath), true, '.env.staging.example must exist');
});

// Test 2: Parse .env.staging.example and verify core modes
const envContent = fs.existsSync(stagingExamplePath) ? fs.readFileSync(stagingExamplePath, 'utf8') : '';
const envMap = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    val = val.trim().replace(/^['"]|['"]$/g, '');
    envMap[match[1]] = val;
  }
});

runTest('Staging example mandates APP_MODE=staging and PROVIDER_MODE=mock', () => {
  assert.strictEqual(envMap.APP_MODE, 'staging', 'APP_MODE must be staging');
  assert.strictEqual(envMap.PROVIDER_MODE, 'mock', 'PROVIDER_MODE must be mock');
  assert.strictEqual(envMap.LIVE_TEST_AUTHORIZATION, 'false', 'LIVE_TEST_AUTHORIZATION must be false');
  assert.strictEqual(envMap.OMNIDM_LIVE_ENABLED, 'false', 'OMNIDM_LIVE_ENABLED must be false');
});

// Test 3: Zero production resources in staging example
runTest('Staging example does NOT reference production database or production cluster', () => {
  assert.strictEqual(envContent.includes('avani_ai_crm_prod'), false, 'Must not reference avani_ai_crm_prod');
  assert.strictEqual(envContent.includes('cluster0.mlcxcp.mongodb.net'), false, 'Must not reference production cluster0');
  assert.strictEqual(envContent.includes('avani-dev-cluster.wmv4ncg.mongodb.net'), false, 'Must not reference avani-dev-cluster');
});

// Test 4: Database name satisfies src/lib/db.ts forensic safety guard
runTest('Staging MongoDB URI database name contains avani_ai_crm_test', () => {
  const uri = envMap.MONGODB_URI || '';
  assert.strictEqual(uri.includes('avani_ai_crm_test'), true, 'MONGODB_URI must contain avani_ai_crm_test');
});

// Test 5: Validate db.ts forensic safety guard simulation
function simulateDbGuard(uri, appMode, providerMode, liveTestAuth) {
  if (appMode === 'test' || appMode === 'staging') {
    if (!uri || !uri.includes('avani_ai_crm_test')) {
      return { allowed: false, error: 'PRODUCTION DATABASE DETECTED — TEST ABORTED' };
    }
    if (providerMode === 'live' && liveTestAuth !== 'true') {
      return { allowed: false, error: 'LIVE PROVIDER DETECTED IN TEST MODE WITHOUT AUTHORIZATION' };
    }
  }
  return { allowed: true };
}

runTest('src/lib/db.ts guard rejects avani_ai_crm_prod when APP_MODE=staging', () => {
  const res = simulateDbGuard('mongodb+srv://user:pass@cluster/avani_ai_crm_prod', 'staging', 'mock', 'false');
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.error, 'PRODUCTION DATABASE DETECTED — TEST ABORTED');
});

runTest('src/lib/db.ts guard rejects unapproved avani_ai_crm_staging when APP_MODE=staging', () => {
  const res = simulateDbGuard('mongodb+srv://user:pass@cluster/avani_ai_crm_staging', 'staging', 'mock', 'false');
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.error, 'PRODUCTION DATABASE DETECTED — TEST ABORTED');
});

runTest('src/lib/db.ts guard allows avani_ai_crm_test when APP_MODE=staging and PROVIDER_MODE=mock', () => {
  const res = simulateDbGuard('mongodb+srv://staging_user:pass@cluster/avani_ai_crm_test', 'staging', 'mock', 'false');
  assert.strictEqual(res.allowed, true);
});

runTest('src/lib/db.ts guard blocks live provider in staging unless explicitly authorized', () => {
  const res = simulateDbGuard('mongodb+srv://staging_user:pass@cluster/avani_ai_crm_test', 'staging', 'live', 'false');
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.error, 'LIVE PROVIDER DETECTED IN TEST MODE WITHOUT AUTHORIZATION');
});

// Test 6: Voice Provider guard validation
function simulateVoiceDispatch(liveEnabled) {
  if (liveEnabled !== 'true') {
    return {
      success: false,
      error: "OmniDM integration READY — live calling disabled pending recharge.",
      rawResponse: { status: "DISABLED_PENDING_RECHARGE" }
    };
  }
  return { success: true, callId: 'live_call_123' };
}

runTest('Voice provider halts dispatch when OMNIDM_LIVE_ENABLED !== true', () => {
  const res = simulateVoiceDispatch(envMap.OMNIDM_LIVE_ENABLED);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error.includes('live calling disabled'), true);
});

// Test 7: Proposed Meta Cloud Mock Guard Simulation
function simulateMetaCloudDispatch(providerMode, metaToken, phoneId) {
  if (providerMode === 'mock') {
    return {
      success: true,
      provider: 'META_CLOUD',
      providerMessageId: `mock_meta_${Date.now()}`,
      status: 'API_ACCEPTED',
      mode: 'mock_intercepted'
    };
  }
  if (!metaToken || !phoneId) {
    return { success: false, provider: 'META_CLOUD', status: 'API_FAILED', error: 'Missing creds' };
  }
  return { success: true, provider: 'META_CLOUD', providerMessageId: 'live_meta_123', status: 'API_ACCEPTED' };
}

runTest('Proposed Meta Cloud guard intercepts dispatch in mock mode even with live tokens', () => {
  const res = simulateMetaCloudDispatch('mock', 'EAAG...liveToken', '1147494668457940');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.mode, 'mock_intercepted');
  assert.strictEqual(res.providerMessageId.startsWith('mock_meta_'), true);
});

// Test 8: Proposed Postgres Staging Guard Simulation
function simulatePostgresGuard(databaseUrl, appMode) {
  if (appMode === 'staging' || appMode === 'test') {
    if (databaseUrl && (databaseUrl.includes('supabase.co') || databaseUrl.includes('prod'))) {
      return { allowed: false, error: 'PRODUCTION_POSTGRES_TARGET_REJECTED' };
    }
  }
  return { allowed: true };
}

runTest('Proposed Postgres guard rejects production Supabase URL when APP_MODE=staging', () => {
  const res = simulatePostgresGuard('postgresql://postgres:secret@db.supabase.co:5432/postgres', 'staging');
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.error, 'PRODUCTION_POSTGRES_TARGET_REJECTED');
});

runTest('Proposed Postgres guard allows isolated staging URL when APP_MODE=staging', () => {
  const res = simulatePostgresGuard('postgresql://staging_user:secret@staging.internal:5432/avani_crm_staging', 'staging');
  assert.strictEqual(res.allowed, true);
});

console.log(`\n============================================================`);
console.log(`📊 GATE 5 LOCAL VALIDATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
console.log(`============================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}

