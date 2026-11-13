/**
 * AVANI AI CRM — Gate 5 Staging Configuration & Guard Validation Suite
 *
 * Verifies:
 * 1. .env.staging.example existence and structure
 * 2. APP_MODE=staging and PROVIDER_MODE=mock enforcement
 * 3. Absence of production database 'avani_ai_crm_prod' or production cluster identifiers
 * 4. Compliance with src/lib/db.ts and src/lib/postgres.ts isolation guards (exercising REAL source modules)
 * 5. Full CP-27.4 Mandatory Database Isolation Matrix (Development, Test, Local Prod, Preview, Staging,
 *    Malformed URI, Query-Param Spoofing, Case/Whitespace Normalization, and Cached Connection Invalidation)
 * 6. Pure in-memory execution with zero network, zero database, zero live secrets.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

console.log('============================================================');
console.log('🧪 RUNNING GATE 5 STAGING CONFIGURATION & GUARD VALIDATION');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    Promise.resolve(fn()).then(() => {
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    }).catch((err) => {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    });
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
  }
}

async function runTestAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
  }
}

function loadTsModule(relPath, customMocks = {}) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const mod = new Module(fullPath);
  mod.filename = fullPath;
  mod.paths = Module._nodeModulePaths(path.dirname(fullPath));
  const origRequire = mod.require.bind(mod);
  mod.require = (id) => {
    if (Object.prototype.hasOwnProperty.call(customMocks, id)) {
      return customMocks[id];
    }
    return origRequire(id);
  };
  mod._compile(transpiled, fullPath);
  return mod.exports;
}

async function main() {
  const stagingExamplePath = path.resolve(__dirname, '..', '.env.staging.example');

  // Test 1: Verify .env.staging.example exists
  await runTestAsync('Staging example configuration file exists on disk', () => {
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

  await runTestAsync('Staging example mandates APP_MODE=staging and PROVIDER_MODE=mock', () => {
    assert.strictEqual(envMap.APP_MODE, 'staging', 'APP_MODE must be staging');
    assert.strictEqual(envMap.PROVIDER_MODE, 'mock', 'PROVIDER_MODE must be mock');
    assert.strictEqual(envMap.LIVE_TEST_AUTHORIZATION, 'false', 'LIVE_TEST_AUTHORIZATION must be false');
    assert.strictEqual(envMap.OMNIDM_LIVE_ENABLED, 'false', 'OMNIDM_LIVE_ENABLED must be false');
  });

  // Test 3: Zero production resources in staging example
  await runTestAsync('Staging example does NOT reference production database or production cluster', () => {
    assert.strictEqual(envContent.includes('avani_ai_crm_prod'), false, 'Must not reference avani_ai_crm_prod');
    assert.strictEqual(envContent.includes('cluster0.mlcxcp.mongodb.net'), false, 'Must not reference production cluster0');
    assert.strictEqual(envContent.includes('avani-dev-cluster.wmv4ncg.mongodb.net'), false, 'Must not reference avani-dev-cluster');
  });

  // Test 4: Database name satisfies src/lib/db.ts forensic safety guard
  await runTestAsync('Staging MongoDB URI database name is avani_ai_crm_test', () => {
    const uri = envMap.MONGODB_URI || '';
    const parsed = new URL(uri);
    assert.strictEqual(parsed.pathname, '/avani_ai_crm_test', 'MONGODB_URI pathname must be /avani_ai_crm_test');
  });

  // Load REAL src/lib/db.ts with safe in-memory mongoose & alerts mocks
  let connectCalls = [];
  const mockMongoose = {
    connection: { readyState: 1 },
    connect: async (uri, opts) => {
      connectCalls.push({ uri, opts });
      return { connection: { readyState: 1 } };
    }
  };
  global.mongoose = undefined;
  const dbMod = loadTsModule('src/lib/db.ts', {
    mongoose: mockMongoose,
    './alerts': { sendSlackAlert: async () => {} }
  });

  // Test 5: Mandatory CP-27.4 Database Isolation Matrix against REAL src/lib/db.ts
  await runTestAsync('REAL src/lib/db.ts allows Development + dedicated test DB', () => {
    const res = dbMod.evaluateDatabaseIsolation('mongodb://127.0.0.1:27017/avani_ai_crm_test', 'development', 'mock', '');
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.dbName, 'avani_ai_crm_test');
  });

  await runTestAsync('REAL src/lib/db.ts allows Test + dedicated test DB', () => {
    const res = dbMod.evaluateDatabaseIsolation('mongodb://127.0.0.1:27017/avani_ai_crm_test', 'test', 'mock', '');
    assert.strictEqual(res.allowed, true);
  });

  await runTestAsync('REAL src/lib/db.ts REJECTS local production-mode execution + production DB', () => {
    const res = dbMod.evaluateDatabaseIsolation('mongodb+srv://u:p@cluster.mongodb.net/avani_ai_crm_prod', 'production', 'mock', '');
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, 'PRODUCTION_TARGET_FORBIDDEN_IN_NON_PROD');
  });

  await runTestAsync('REAL src/lib/db.ts REJECTS local production-mode execution even if PROVIDER_MODE=live', () => {
    const res = dbMod.evaluateDatabaseIsolation('mongodb+srv://u:p@cluster.mongodb.net/avani_ai_crm_prod', 'production', 'live', '');
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, 'PRODUCTION_TARGET_FORBIDDEN_IN_NON_PROD');
  });

  await runTestAsync('REAL src/lib/db.ts allows local production-mode execution + dedicated test DB', () => {
    const res = dbMod.evaluateDatabaseIsolation('mongodb://127.0.0.1:27017/avani_ai_crm_test', 'production', 'mock', '');
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.dbName, 'avani_ai_crm_test');
  });

  await runTestAsync('REAL src/lib/db.ts REJECTS Preview deployment + production DB', () => {
    const res = dbMod.evaluateDatabaseIsolation('mongodb+srv://u:p@cluster.mongodb.net/avani_ai_crm_prod', 'production', 'mock', 'preview');
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, 'PRODUCTION_TARGET_FORBIDDEN_IN_NON_PROD');
  });

  await runTestAsync('REAL src/lib/db.ts REJECTS Staging + production DB', () => {
    const res = dbMod.evaluateDatabaseIsolation('mongodb+srv://u:p@cluster.mongodb.net/avani_ai_crm_prod', 'staging', 'mock', '');
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, 'PRODUCTION_TARGET_FORBIDDEN_IN_NON_PROD');
  });

  await runTestAsync('REAL src/lib/db.ts ALLOWS safe-mode Vercel Production (production/mock/production) + production DB', () => {
    const res = dbMod.evaluateDatabaseIsolation('mongodb+srv://u:p@cluster.mongodb.net/avani_ai_crm_prod', 'production', 'mock', 'production');
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.dbName, 'avani_ai_crm_prod');
  });

  await runTestAsync('REAL src/lib/db.ts REJECTS test DB in Vercel Production runtime', () => {
    const res = dbMod.evaluateDatabaseIsolation('mongodb+srv://u:p@cluster.mongodb.net/avani_ai_crm_test', 'production', 'mock', 'production');
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, 'TEST_DATABASE_FORBIDDEN_IN_PROD');
  });

  await runTestAsync('REAL src/lib/db.ts REJECTS missing or malformed URI', () => {
    const resMissing = dbMod.evaluateDatabaseIsolation('', 'test', 'mock', '');
    assert.strictEqual(resMissing.allowed, false);
    assert.strictEqual(resMissing.code, 'URI_MISSING');

    const resMalformed = dbMod.evaluateDatabaseIsolation('not_a_valid_uri', 'test', 'mock', '');
    assert.strictEqual(resMalformed.allowed, false);
    assert.strictEqual(resMalformed.code, 'URI_MALFORMED');
  });

  await runTestAsync('REAL src/lib/db.ts REJECTS misleading database-name text in query parameters', () => {
    const resSpoof = dbMod.evaluateDatabaseIsolation(
      'mongodb://127.0.0.1:27017/other_db?appName=avani_ai_crm_test',
      'development',
      'mock',
      ''
    );
    assert.strictEqual(resSpoof.allowed, false);
    assert.strictEqual(resSpoof.code, 'TARGET_DATABASE_NOT_TEST');
  });

  await runTestAsync('REAL src/lib/db.ts normalizes case and whitespace variants of environment values', () => {
    const resCase = dbMod.evaluateDatabaseIsolation(
      'mongodb+srv://u:p@cluster.mongodb.net/avani_ai_crm_prod',
      '  Test  ',
      ' LIVE ',
      ''
    );
    assert.strictEqual(resCase.allowed, false);
    assert.strictEqual(resCase.code, 'PRODUCTION_TARGET_FORBIDDEN_IN_NON_PROD');
  });

  await runTestAsync('REAL src/lib/db.ts validates cached connection and rejects/invalidates changed target URI', async () => {
    connectCalls = [];
    const origEnv = { ...process.env };
    try {
      process.env.APP_MODE = 'test';
      process.env.PROVIDER_MODE = 'mock';
      process.env.VERCEL_ENV = '';
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/avani_ai_crm_test';

      const conn1 = await dbMod.connectToDatabase();
      assert.ok(conn1, 'Initial test connection should succeed');
      assert.strictEqual(connectCalls.length, 1);

      // Mutate target URI to production DB while cached connection exists
      process.env.MONGODB_URI = 'mongodb+srv://u:p@cluster.mongodb.net/avani_ai_crm_prod';
      const conn2 = await dbMod.connectToDatabase();
      assert.strictEqual(conn2, null, 'Must reject changed production URI and NOT return cached connection');
      assert.strictEqual(connectCalls.length, 1, 'Must not initiate mongoose.connect on rejected URI');
    } finally {
      process.env = origEnv;
    }
  });

  // Test 6: Load REAL src/lib/postgres.ts with safe pg Pool mock
  let pgPoolCreates = 0;
  let pgPoolEnded = 0;
  class MockPool {
    constructor(opts) {
      this.opts = opts;
      pgPoolCreates++;
    }
    async query(sql, params) {
      return { rowCount: 1, rows: [] };
    }
    async end() {
      pgPoolEnded++;
    }
  }
  const pgMod = loadTsModule('src/lib/postgres.ts', { pg: { Pool: MockPool } });

  await runTestAsync('REAL src/lib/postgres.ts REJECTS missing or malformed DATABASE_URL', () => {
    const rMissing = pgMod.evaluatePostgresIsolation('', 'staging', '');
    assert.strictEqual(rMissing.allowed, false);
    assert.strictEqual(rMissing.code, 'DATABASE_URL_MISSING');

    const rMalformed = pgMod.evaluatePostgresIsolation('invalid://[url', 'staging', '');
    assert.strictEqual(rMalformed.allowed, false);
    assert.strictEqual(rMalformed.code, 'DATABASE_URL_MALFORMED');
  });

  await runTestAsync('REAL src/lib/postgres.ts REJECTS production Supabase/Postgres URL in staging/local execution', () => {
    const rSupa = pgMod.evaluatePostgresIsolation('postgresql://postgres:secret@db.supabase.co:5432/postgres', 'staging', '');
    assert.strictEqual(rSupa.allowed, false);
    assert.strictEqual(rSupa.code, 'PRODUCTION_POSTGRES_TARGET_REJECTED');

    const rLocalProd = pgMod.evaluatePostgresIsolation('postgresql://user:secret@host:5432/avani_prod_db', 'production', '');
    assert.strictEqual(rLocalProd.allowed, false);
    assert.strictEqual(rLocalProd.code, 'PRODUCTION_POSTGRES_TARGET_REJECTED');
  });

  await runTestAsync('REAL src/lib/postgres.ts allows isolated test Postgres URL and enforces pool-reuse guard', async () => {
    const origEnv = { ...process.env };
    try {
      process.env.APP_MODE = 'staging';
      process.env.VERCEL_ENV = '';
      process.env.DATABASE_URL = 'postgresql://staging_user:secret@127.0.0.1:5432/avani_crm_staging';

      const pool1 = pgMod.getPostgresPool();
      assert.ok(pool1);
      assert.strictEqual(pgPoolCreates, 1);

      // Same URL reuses pool
      const pool2 = pgMod.getPostgresPool();
      assert.strictEqual(pool1, pool2);
      assert.strictEqual(pgPoolCreates, 1);

      // Mutate DATABASE_URL to production Supabase: must throw and invalidate pool
      process.env.DATABASE_URL = 'postgresql://postgres:secret@db.supabase.co:5432/postgres';
      assert.throws(() => pgMod.getPostgresPool(), /PRODUCTION_POSTGRES_TARGET_REJECTED/);
    } finally {
      process.env = origEnv;
    }
  });

  console.log(`\n============================================================`);
  console.log(`📊 GATE 5 LOCAL VALIDATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log(`============================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
