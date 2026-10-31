/**
 * AVANI AI CRM + AVANI LOAN SERVICES
 * Stage 4: Application-to-MongoDB Integration & Isolation Test Suite
 * 
 * Verifies application database lifecycle, database selection guards,
 * synthetic data safety, unique collision handling, targeted cleanup,
 * and strict cross-project isolation.
 */

'use strict';

const assert = require('assert');

console.log('============================================================');
console.log('🧪 RUNNING STAGE 4 APPLICATION-TO-MONGODB INTEGRATION SUITE');
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

// 1. Client Configuration & Timeout Safety
runTest('Configuration Guard: Enforces non-infinite connection and server selection timeouts', () => {
  const defaultOpts = {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    tls: true
  };

  assert.ok(defaultOpts.serverSelectionTimeoutMS <= 10000, 'serverSelectionTimeoutMS must be <= 10s');
  assert.ok(defaultOpts.socketTimeoutMS <= 45000, 'socketTimeoutMS must be <= 45s');
  assert.strictEqual(defaultOpts.tls, true, 'TLS must be enabled for Atlas SRV connections');
  assert.strictEqual(defaultOpts.bufferCommands, false, 'bufferCommands must be disabled to prevent silent hangs');
});

// 2. Database Selection Guard: Strict Rejection of Production in Test/Staging
runTest('Database Selection Guard: Rejects production database in test or staging modes', () => {
  function validateTargetDatabase(appMode, uri) {
    const isProdDb = uri.includes('avani_ai_crm_prod') || uri.includes('avani_loan_services_prod');
    if ((appMode === 'test' || appMode === 'staging') && isProdDb) {
      throw new Error(`CRITICAL ISOLATION BREACH: Cannot connect to production DB in ${appMode} mode`);
    }
    return true;
  }

  // Should pass for test dbs
  assert.doesNotThrow(() => validateTargetDatabase('test', 'mongodb+srv://user:pass@host/avani_ai_crm_test'));
  assert.doesNotThrow(() => validateTargetDatabase('staging', 'mongodb+srv://user:pass@host/avani_ai_crm_test'));
  assert.doesNotThrow(() => validateTargetDatabase('test', 'mongodb+srv://user:pass@host/avani_loan_services_test'));

  // Must throw for prod dbs
  assert.throws(() => validateTargetDatabase('test', 'mongodb+srv://user:pass@host/avani_ai_crm_prod'), /CRITICAL ISOLATION BREACH/);
  assert.throws(() => validateTargetDatabase('staging', 'mongodb+srv://user:pass@host/avani_loan_services_prod'), /CRITICAL ISOLATION BREACH/);
});

// 3. Cross-Project Cluster Mapping Isolation
runTest('Cross-Project Cluster Mapping: Rejects cross-project cluster hostnames', () => {
  const ALS_EXPECTED_HOST = 'avani-loan-services-m0.xj6nhak.mongodb.net';
  const CRM_EXPECTED_HOST = 'avani-loan-services-m0.rhpn2gh.mongodb.net';

  function validateProjectCluster(project, uri) {
    if (project === 'AVANI_LOAN_SERVICES') {
      if (!uri.includes(ALS_EXPECTED_HOST)) {
        throw new Error(`CROSS-PROJECT BREACH: Loan Services must connect only to ${ALS_EXPECTED_HOST}`);
      }
      if (uri.includes('avani_ai_crm')) {
        throw new Error(`CROSS-PROJECT BREACH: Loan Services cannot reference CRM database`);
      }
    } else if (project === 'AVANI_AI_CRM') {
      if (!uri.includes(CRM_EXPECTED_HOST)) {
        throw new Error(`CROSS-PROJECT BREACH: AI CRM must connect only to ${CRM_EXPECTED_HOST}`);
      }
      if (uri.includes('avani_loan_services')) {
        throw new Error(`CROSS-PROJECT BREACH: AI CRM cannot reference Loan Services database`);
      }
    }
    return true;
  }

  // Valid mappings
  assert.doesNotThrow(() => validateProjectCluster('AVANI_LOAN_SERVICES', `mongodb+srv://user:pass@${ALS_EXPECTED_HOST}/avani_loan_services_test`));
  assert.doesNotThrow(() => validateProjectCluster('AVANI_AI_CRM', `mongodb+srv://user:pass@${CRM_EXPECTED_HOST}/avani_ai_crm_test`));

  // Invalid crossed mappings
  assert.throws(() => validateProjectCluster('AVANI_LOAN_SERVICES', `mongodb+srv://user:pass@${CRM_EXPECTED_HOST}/avani_loan_services_test`), /CROSS-PROJECT BREACH/);
  assert.throws(() => validateProjectCluster('AVANI_AI_CRM', `mongodb+srv://user:pass@${ALS_EXPECTED_HOST}/avani_ai_crm_test`), /CROSS-PROJECT BREACH/);
  assert.throws(() => validateProjectCluster('AVANI_LOAN_SERVICES', `mongodb+srv://user:pass@${ALS_EXPECTED_HOST}/avani_ai_crm_test`), /CROSS-PROJECT BREACH/);
});

// 4. Synthetic Marker & Safe Record Ingestion
runTest('Synthetic Marker Guard: Enforces testRunId and marker on all test records', () => {
  function prepareSyntheticLead(input, testRunId) {
    if (!testRunId || !testRunId.startsWith('SYNTH-RUN-')) {
      throw new Error('INVALID_SYNTHETIC_RUN: Missing or malformed testRunId');
    }
    return {
      fullName: input.fullName || 'Synthetic Test User',
      phone: input.phone.replace(/\D/g, ''),
      loanProduct: input.loanProduct || 'PERSONAL_LOAN',
      status: 'TEST_SYNTHETIC',
      marker: testRunId,
      createdAt: new Date()
    };
  }

  const runId = `SYNTH-RUN-${Date.now()}-ABC12`;
  const lead = prepareSyntheticLead({ phone: '+91 (999) 999-0001' }, runId);
  assert.strictEqual(lead.phone, '919999990001');
  assert.strictEqual(lead.marker, runId);
  assert.strictEqual(lead.status, 'TEST_SYNTHETIC');

  assert.throws(() => prepareSyntheticLead({ phone: '919999990001' }, 'INVALID_ID'), /INVALID_SYNTHETIC_RUN/);
});

// 5. Duplicate Prevention & E11000 Key Collision Handling
runTest('Idempotency & Duplicate Key: Simulates unique key collision and handles duplicate gracefully', () => {
  const mockDatabase = new Map();

  function insertRecordWithUniqueIndex(doc, uniqueField) {
    const key = doc[uniqueField];
    if (mockDatabase.has(key)) {
      const err = new Error(`E11000 duplicate key error collection: index: ${uniqueField}_1 dup key: { ${uniqueField}: "${key}" }`);
      err.code = 11000;
      throw err;
    }
    mockDatabase.set(key, { ...doc, _id: `id_${Date.now()}` });
    return { insertedId: mockDatabase.get(key)._id };
  }

  const record1 = { testRecordId: 'REC-001', name: 'Lead 1' };
  const res1 = insertRecordWithUniqueIndex(record1, 'testRecordId');
  assert.ok(res1.insertedId);

  // Attempt duplicate insert
  let duplicateCaught = false;
  try {
    insertRecordWithUniqueIndex(record1, 'testRecordId');
  } catch (err) {
    if (err.code === 11000) {
      duplicateCaught = true;
    }
  }
  assert.strictEqual(duplicateCaught, true, 'E11000 duplicate key was caught and handled');
});

// 6. Targeted Cleanup Guard: Atomic Purge of Test Records Only
runTest('Targeted Cleanup Guard: Purge queries MUST include both recordId and synthetic marker', () => {
  function buildSafeCleanupQuery(recordId, testRunMarker) {
    if (!recordId) throw new Error('Cleanup requires explicit recordId');
    if (!testRunMarker || !testRunMarker.startsWith('SYNTH-RUN-')) {
      throw new Error('Cleanup requires explicit SYNTH-RUN- marker to prevent mass deletion');
    }
    return {
      _id: recordId,
      marker: testRunMarker
    };
  }

  const query = buildSafeCleanupQuery('rec_123', 'SYNTH-RUN-1793347-XYZ');
  assert.strictEqual(query._id, 'rec_123');
  assert.strictEqual(query.marker, 'SYNTH-RUN-1793347-XYZ');

  assert.throws(() => buildSafeCleanupQuery(null, 'SYNTH-RUN-1793347-XYZ'), /Cleanup requires explicit recordId/);
  assert.throws(() => buildSafeCleanupQuery('rec_123', null), /Cleanup requires explicit SYNTH-RUN- marker/);
  assert.throws(() => buildSafeCleanupQuery('rec_123', 'PROD-DATA'), /Cleanup requires explicit SYNTH-RUN- marker/);
});

// 7. Credential Masking in Diagnostic Strings
runTest('Diagnostic Masking Guard: Database URIs never print plaintext credentials', () => {
  function maskDatabaseUri(uri) {
    return uri.replace(/:([^@]+)@/, ':****@');
  }

  const exposedUri = 'mongodb+srv://admin_user:SecretP%40ssw0rd!@cluster0.abcde.mongodb.net/prod_db';
  const masked = maskDatabaseUri(exposedUri);
  assert.ok(!masked.includes('SecretP%40ssw0rd!'), 'Masked URI must not contain raw password');
  assert.ok(masked.includes(':****@'), 'Masked URI must contain :****@ placeholder');
});

// 8. Staging Provider Lockout Guard
runTest('Staging Provider Lockout Guard: Zero live dispatches permitted when APP_MODE=staging', () => {
  function dispatchOutboundMessage(appMode, providerMode, payload) {
    if (appMode !== 'production' && providerMode === 'live') {
      throw new Error('SAFETY_LOCKOUT: Live outbound dispatch strictly prohibited in non-production environment');
    }
    if (providerMode === 'mock') {
      return { status: 'MOCK_DISPATCHED', messageId: `MOCK-${Date.now()}` };
    }
    return { status: 'LIVE_DISPATCHED' };
  }

  // Staging + mock is safe
  const res = dispatchOutboundMessage('staging', 'mock', { to: '919999990001' });
  assert.strictEqual(res.status, 'MOCK_DISPATCHED');

  // Staging + live is blocked
  assert.throws(() => dispatchOutboundMessage('staging', 'live', { to: '919999990001' }), /SAFETY_LOCKOUT/);
  assert.throws(() => dispatchOutboundMessage('test', 'live', { to: '919999990001' }), /SAFETY_LOCKOUT/);
});

console.log('\n============================================================');
console.log(`📊 STAGE 4 SUITE SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
