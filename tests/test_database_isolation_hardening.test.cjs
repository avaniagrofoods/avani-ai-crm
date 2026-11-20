/**
 * TASK 5F.2: MONGODB DATABASE ISOLATION SECURITY REMEDIATION & OFFLINE REGRESSION SUITE
 * 
 * Business: AVANI LOAN SERVICES
 * Workstream: ChatMitra + AVANI AI CRM
 * Date: 18 November 2026
 * Suite: tests/test_database_isolation_hardening.test.cjs
 * 
 * Strict Scope & Execution Constraints:
 * - 100% Offline execution (zero network requests, zero sockets, zero credentials)
 * - Zero live MongoDB / Atlas connections
 * - In-memory transpilation via typescript.transpileModule loading actual src/lib/db.ts
 * - Zero duplicated business/isolation logic (Resolves Finding F-01)
 * - Complete lifecycle connection pipeline testing via dependency injection (Resolves Finding F-02)
 * - Parameterized test cluster domain testing rejecting 41zrtal (Resolves Finding F-03)
 * - Full regression test coverage: Group A (S01 to S44) + Group B (Tests 1 to 15)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// ============================================================================
// 1. IN-MEMORY TYPESCRIPT TRANSPILATION HOOK (ZERO DUPLICATED LOGIC - F-01)
// ============================================================================

require.extensions['.ts'] = function(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      allowJs: true
    },
    fileName: filename
  });
  module._compile(compiled.outputText, filename);
};

// Import actual production implementation directly from src/lib/db.ts
const db = require('../src/lib/db.ts');

const {
  DatabaseIsolationError,
  PROD_CLUSTER_HOST,
  AUTHORIZED_TEST_DOMAINS,
  getApprovedTestClusterDomain,
  isAuthorizedTestHost,
  classifyRuntimeEnvironment,
  parseAndSanitizeConnectionUri,
  evaluateDatabaseIsolation,
  verifySrvDnsTopology,
  verifySameConnectionIdentity,
  connectToDatabase,
  resetConnectionCacheForTesting,
  getConnectionCacheForTesting,
  getDatabaseLastError
} = db;

// Verify that all required functions are imported directly from src/lib/db.ts
assert.strictEqual(typeof evaluateDatabaseIsolation, 'function', 'evaluateDatabaseIsolation must be exported from src/lib/db.ts');
assert.strictEqual(typeof classifyRuntimeEnvironment, 'function', 'classifyRuntimeEnvironment must be exported from src/lib/db.ts');
assert.strictEqual(typeof isAuthorizedTestHost, 'function', 'isAuthorizedTestHost must be exported from src/lib/db.ts');
assert.strictEqual(typeof parseAndSanitizeConnectionUri, 'function', 'parseAndSanitizeConnectionUri must be exported from src/lib/db.ts');
assert.strictEqual(typeof verifySrvDnsTopology, 'function', 'verifySrvDnsTopology must be exported from src/lib/db.ts');
assert.strictEqual(typeof verifySameConnectionIdentity, 'function', 'verifySameConnectionIdentity must be exported from src/lib/db.ts');
assert.strictEqual(typeof connectToDatabase, 'function', 'connectToDatabase must be exported from src/lib/db.ts');

// ============================================================================
// 2. HELPER FACTORY FOR MOCK MONGOOSE (OFFLINE DEPENDENCY INJECTION)
// ============================================================================

function createMockMongoose({
  dbName = 'avani_ai_crm_test',
  host = 'localhost:27017',
  topologyServers = ['localhost:27017'],
  readyState = 1,
  connectThrows = null
} = {}) {
  const listeners = {};
  const connection = {
    readyState,
    name: dbName,
    host,
    close: async () => {
      connection.readyState = 0;
    },
    getClient: () => ({
      topology: {
        description: {
          servers: new Map(topologyServers.map(s => [s, {}]))
        }
      }
    }),
    on: (evt, cb) => {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(cb);
    },
    listeners: (evt) => listeners[evt] || [],
    emit: (evt, ...args) => {
      if (listeners[evt]) {
        for (const cb of listeners[evt]) cb(...args);
      }
    }
  };

  const mock = {
    connection,
    connect: async (uri, opts) => {
      if (connectThrows) throw connectThrows;
      return mock;
    }
  };

  return mock;
}

// ============================================================================
// 3. GROUP A: OFFLINE UNIT REGRESSION MATRIX (SCENARIOS S01 TO S44)
// ============================================================================

const scenarios = [
  // S01: Missing URI -> allowed: false, URI_MISSING
  {
    id: 'S01',
    category: 'Missing URI',
    run: () => evaluateDatabaseIsolation(null, 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'URI_MISSING' },
    desc: 'Fails closed on absent URI'
  },
  // S02: Whitespace URI -> allowed: false, URI_MISSING
  {
    id: 'S02',
    category: 'Whitespace URI',
    run: () => evaluateDatabaseIsolation('   ', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'URI_MISSING' },
    desc: 'Rejects whitespace string'
  },
  // S03: Malformed Scheme -> allowed: false, URI_MALFORMED
  {
    id: 'S03',
    category: 'Malformed Scheme',
    run: () => evaluateDatabaseIsolation('http://localhost/db', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'URI_MALFORMED' },
    desc: 'Rejects non-mongo scheme'
  },
  // S04: Missing DB Path -> allowed: false, MISSING_DATABASE_NAME
  {
    id: 'S04',
    category: 'Missing DB Path',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'MISSING_DATABASE_NAME' },
    desc: 'Rejects URI without DB name'
  },
  // S05: Decommissioned Host -> allowed: false, LEGACY_CLUSTER_REJECTED
  {
    id: 'S05',
    category: 'Decommissioned Host',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@cluster0.mlcxcp.mongodb.net/test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'LEGACY_CLUSTER_REJECTED' },
    desc: 'Rejects legacy cluster'
  },
  // S06: Cross-App Host -> allowed: false, CROSS_APPLICATION_CLUSTER_REJECTED
  {
    id: 'S06',
    category: 'Cross-App Host',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@xj6nhak.mongodb.net/test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'CROSS_APPLICATION_CLUSTER_REJECTED' },
    desc: 'Rejects Loan Services cluster'
  },
  // S07: Total Missing Flags -> allowed: false, INVALID_OR_UNKNOWN_RUNTIME_PROFILE
  {
    id: 'S07',
    category: 'Total Missing Flags',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', '', 'mock', '', 'false', ''),
    expected: { allowed: false, code: 'INVALID_OR_UNKNOWN_RUNTIME_PROFILE' },
    desc: 'Fails closed on missing indicators'
  },
  // S08: Prod + Dev APP_MODE -> allowed: false, INVALID_OR_UNKNOWN_RUNTIME_PROFILE
  {
    id: 'S08',
    category: 'Prod + Dev APP_MODE',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod', 'dev', 'mock', 'prod', 'false', 'prod'),
    expected: { allowed: false, code: 'INVALID_OR_UNKNOWN_RUNTIME_PROFILE' },
    desc: 'Rejects conflicting prod/dev flags'
  },
  // S09: Prod + Test APP_MODE -> allowed: false, INVALID_OR_UNKNOWN_RUNTIME_PROFILE
  {
    id: 'S09',
    category: 'Prod + Test APP_MODE',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod', 'test', 'mock', 'prod', 'false', 'prod'),
    expected: { allowed: false, code: 'INVALID_OR_UNKNOWN_RUNTIME_PROFILE' },
    desc: 'Rejects conflicting prod/test flags'
  },
  // S10: Prod + Dev NODE_ENV -> allowed: false, INVALID_OR_UNKNOWN_RUNTIME_PROFILE
  {
    id: 'S10',
    category: 'Prod + Dev NODE_ENV',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod', 'prod', 'mock', 'prod', 'false', 'dev'),
    expected: { allowed: false, code: 'INVALID_OR_UNKNOWN_RUNTIME_PROFILE' },
    desc: 'Rejects prod with dev NODE_ENV'
  },
  // S11: Prod + Test NODE_ENV -> allowed: false, INVALID_OR_UNKNOWN_RUNTIME_PROFILE
  {
    id: 'S11',
    category: 'Prod + Test NODE_ENV',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod', 'prod', 'mock', 'prod', 'false', 'test'),
    expected: { allowed: false, code: 'INVALID_OR_UNKNOWN_RUNTIME_PROFILE' },
    desc: 'Rejects prod with test NODE_ENV'
  },
  // S12: Preview + Prod Mode -> allowed: false, INVALID_OR_UNKNOWN_RUNTIME_PROFILE
  {
    id: 'S12',
    category: 'Preview + Prod Mode',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', 'prod', 'mock', 'preview', 'false', 'test'),
    expected: { allowed: false, code: 'INVALID_OR_UNKNOWN_RUNTIME_PROFILE' },
    desc: 'Rejects preview claiming prod mode'
  },
  // S13: Preview + Prod NODE -> allowed: false, INVALID_OR_UNKNOWN_RUNTIME_PROFILE
  {
    id: 'S13',
    category: 'Preview + Prod NODE',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', 'test', 'mock', 'preview', 'false', 'prod'),
    expected: { allowed: false, code: 'INVALID_OR_UNKNOWN_RUNTIME_PROFILE' },
    desc: 'Rejects preview with prod NODE_ENV'
  },
  // S14: Preview Valid Test -> allowed: true, VALID_TEST_CONNECTION
  {
    id: 'S14',
    category: 'Preview Valid Test',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', 'test', 'mock', 'preview', 'false', 'test'),
    expected: { allowed: true, code: 'VALID_TEST_CONNECTION' },
    desc: 'Permits authorized preview test'
  },
  // S15: Preview Valid Dev -> allowed: true, VALID_TEST_CONNECTION
  {
    id: 'S15',
    category: 'Preview Valid Dev',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', 'dev', 'mock', 'preview', 'false', 'dev'),
    expected: { allowed: true, code: 'VALID_TEST_CONNECTION' },
    desc: 'Permits authorized preview dev'
  },
  // S16: Local Missing Indicators -> allowed: false, INVALID_OR_UNKNOWN_RUNTIME_PROFILE
  {
    id: 'S16',
    category: 'Local Missing Indicators',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', '', 'mock', '', 'false', ''),
    expected: { allowed: false, code: 'INVALID_OR_UNKNOWN_RUNTIME_PROFILE' },
    desc: 'Rejects empty local execution'
  },
  // S17: Local Valid Dev -> allowed: true, VALID_TEST_CONNECTION
  {
    id: 'S17',
    category: 'Local Valid Dev',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', 'development', 'mock', '', 'false', 'development'),
    expected: { allowed: true, code: 'VALID_TEST_CONNECTION' },
    desc: 'Permits local dev on localhost'
  },
  // S18: Local Valid Test -> allowed: true, VALID_TEST_CONNECTION
  {
    id: 'S18',
    category: 'Local Valid Test',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: true, code: 'VALID_TEST_CONNECTION' },
    desc: 'Permits local test on localhost'
  },
  // S19: Local Dev from NODE_ENV -> allowed: true, VALID_TEST_CONNECTION
  {
    id: 'S19',
    category: 'Local Dev from NODE_ENV',
    run: () => evaluateDatabaseIsolation('mongodb://127.0.0.1:27017/avani_ai_crm_test', '', 'mock', '', 'false', 'development'),
    expected: { allowed: true, code: 'VALID_TEST_CONNECTION' },
    desc: 'Inferred local dev from NODE_ENV'
  },
  // S20: Local Test from NODE_ENV -> allowed: true, VALID_TEST_CONNECTION
  {
    id: 'S20',
    category: 'Local Test from NODE_ENV',
    run: () => evaluateDatabaseIsolation('mongodb://127.0.0.1:27017/avani_ai_crm_test', '', 'mock', '', 'false', 'test'),
    expected: { allowed: true, code: 'VALID_TEST_CONNECTION' },
    desc: 'Inferred local test from NODE_ENV'
  },
  // S21: Local Prod NODE_ENV -> allowed: false, INVALID_OR_UNKNOWN_RUNTIME_PROFILE
  {
    id: 'S21',
    category: 'Local Prod NODE_ENV',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', 'dev', 'mock', '', 'false', 'production'),
    expected: { allowed: false, code: 'INVALID_OR_UNKNOWN_RUNTIME_PROFILE' },
    desc: 'Rejects local claiming prod NODE_ENV'
  },
  // S22: Unrecognized VERCEL_ENV -> allowed: false, INVALID_OR_UNKNOWN_RUNTIME_PROFILE
  {
    id: 'S22',
    category: 'Unrecognized VERCEL_ENV',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', 'test', 'mock', 'staging', 'false', 'test'),
    expected: { allowed: false, code: 'INVALID_OR_UNKNOWN_RUNTIME_PROFILE' },
    desc: 'Rejects staging VERCEL_ENV'
  },
  // S23: Unrecognized APP_MODE -> allowed: false, INVALID_OR_UNKNOWN_RUNTIME_PROFILE
  {
    id: 'S23',
    category: 'Unrecognized APP_MODE',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', 'qa', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'INVALID_OR_UNKNOWN_RUNTIME_PROFILE' },
    desc: 'Rejects qa APP_MODE'
  },
  // S24: Authorized Production -> allowed: true, VALID_PROD_CONNECTION
  {
    id: 'S24',
    category: 'Authorized Production',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod', 'prod', 'mock', 'prod', 'false', 'prod'),
    expected: { allowed: true, code: 'VALID_PROD_CONNECTION' },
    desc: 'Authorized live production runtime'
  },
  // S25: Prod Trailing Dot -> allowed: true, VALID_PROD_CONNECTION
  {
    id: 'S25',
    category: 'Prod Trailing Dot',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net./avani_ai_crm_prod', 'prod', 'mock', 'prod', 'false', 'prod'),
    expected: { allowed: true, code: 'VALID_PROD_CONNECTION' },
    desc: 'Normalized trailing dot prod'
  },
  // S26: Prod Uppercase Host -> allowed: true, VALID_PROD_CONNECTION
  {
    id: 'S26',
    category: 'Prod Uppercase Host',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@RHPN2GH.MONGODB.NET/avani_ai_crm_prod', 'prod', 'mock', 'prod', 'false', 'prod'),
    expected: { allowed: true, code: 'VALID_PROD_CONNECTION' },
    desc: 'Normalized uppercase prod'
  },
  // S27: Prod Target Test DB -> allowed: false, TEST_DATABASE_FORBIDDEN_IN_PROD
  {
    id: 'S27',
    category: 'Prod Target Test DB',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_test', 'prod', 'mock', 'prod', 'false', 'prod'),
    expected: { allowed: false, code: 'TEST_DATABASE_FORBIDDEN_IN_PROD' },
    desc: 'Prod runtime cannot use test DB'
  },
  // S28: Prod Wrong DB Name -> allowed: false, INVALID_PRODUCTION_DATABASE_NAME
  {
    id: 'S28',
    category: 'Prod Wrong DB Name',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net/other_db', 'prod', 'mock', 'prod', 'false', 'prod'),
    expected: { allowed: false, code: 'INVALID_PRODUCTION_DATABASE_NAME' },
    desc: 'Prod must use avani_ai_crm_prod'
  },
  // S29: Prod Unauthorized Host -> allowed: false, UNAUTHORIZED_PRODUCTION_CLUSTER_HOSTNAME
  {
    id: 'S29',
    category: 'Prod Unauthorized Host',
    run: () => evaluateDatabaseIsolation('mongodb://127.0.0.1:27017/avani_ai_crm_prod', 'prod', 'mock', 'prod', 'false', 'prod'),
    expected: { allowed: false, code: 'UNAUTHORIZED_PRODUCTION_CLUSTER_HOSTNAME' },
    desc: 'Prod cannot use localhost'
  },
  // S30: Non-Prod Target Prod DB -> allowed: false, PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD
  {
    id: 'S30',
    category: 'Non-Prod Target Prod DB',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD' },
    desc: 'Non-prod cannot touch prod DB'
  },
  // S31: Non-Prod Target Prod Host + Test DB -> allowed: false, PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD
  {
    id: 'S31',
    category: 'Primary Defect Test',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD' },
    desc: 'PRIMARY DEFECT TEST: Rejects test db on prod host'
  },
  // S32: Non-Prod Trailing Dot Prod -> allowed: false, PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD
  {
    id: 'S32',
    category: 'Non-Prod Trailing Dot Prod',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net./avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD' },
    desc: 'Trailing dot prod host blocked'
  },
  // S33: Non-Prod Valid 127.0.0.1 -> allowed: true, VALID_TEST_CONNECTION
  {
    id: 'S33',
    category: 'Non-Prod Valid 127.0.0.1',
    run: () => evaluateDatabaseIsolation('mongodb://127.0.0.1:27017/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: true, code: 'VALID_TEST_CONNECTION' },
    desc: 'Permits 127.0.0.1 loopback'
  },
  // S34: Non-Prod Valid localhost -> allowed: true, VALID_TEST_CONNECTION
  {
    id: 'S34',
    category: 'Non-Prod Valid localhost',
    run: () => evaluateDatabaseIsolation('mongodb://localhost:27017/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: true, code: 'VALID_TEST_CONNECTION' },
    desc: 'Permits localhost'
  },
  // S35: Non-Prod Valid IPv6 -> allowed: true, VALID_TEST_CONNECTION
  {
    id: 'S35',
    category: 'Non-Prod Valid IPv6',
    run: () => evaluateDatabaseIsolation('mongodb://[::1]:27017/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: true, code: 'VALID_TEST_CONNECTION' },
    desc: 'Permits IPv6 loopback'
  },
  // S36: Multi-Host All Valid -> allowed: true, VALID_TEST_CONNECTION
  {
    id: 'S36',
    category: 'Multi-Host All Valid',
    run: () => evaluateDatabaseIsolation('mongodb://127.0.0.1:27017,localhost:27018/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: true, code: 'VALID_TEST_CONNECTION' },
    desc: 'Multi-seed valid test hosts'
  },
  // S37: Multi-Host Seed Poison (Prod) -> allowed: false, PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD
  {
    id: 'S37',
    category: 'Multi-Host Seed Poison (Prod)',
    run: () => evaluateDatabaseIsolation('mongodb://127.0.0.1:27017,rhpn2gh.mongodb.net:27017/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD' },
    desc: 'Rejects mixed seed list with prod'
  },
  // S38: Multi-Host Seed Poison (Unknown) -> allowed: false, UNAUTHORIZED_TEST_CLUSTER_HOSTNAME
  {
    id: 'S38',
    category: 'Multi-Host Seed Poison (Unknown)',
    run: () => evaluateDatabaseIsolation('mongodb://127.0.0.1:27017,unknown-host:27017/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'UNAUTHORIZED_TEST_CLUSTER_HOSTNAME' },
    desc: 'Rejects mixed seed list with rogue'
  },
  // S39: SRV with Port Specified -> allowed: false, URI_MALFORMED
  {
    id: 'S39',
    category: 'SRV with Port Specified',
    run: () => evaluateDatabaseIsolation('mongodb+srv://localhost:27017/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'URI_MALFORMED' },
    desc: 'Rejects port in SRV'
  },
  // S40: SRV with Multi-Host -> allowed: false, URI_MALFORMED
  {
    id: 'S40',
    category: 'SRV with Multi-Host',
    run: () => evaluateDatabaseIsolation('mongodb+srv://host1,host2/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'URI_MALFORMED' },
    desc: 'Rejects multi-host in SRV'
  },
  // S41: Subdomain Prefix Spoof -> allowed: false, UNAUTHORIZED_TEST_CLUSTER_HOSTNAME
  {
    id: 'S41',
    category: 'Subdomain Prefix Spoof',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@attacker-rhpn2gh.mongodb.net/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'UNAUTHORIZED_TEST_CLUSTER_HOSTNAME' },
    desc: 'Rejects prefix spoof'
  },
  // S42: Domain Suffix Spoof -> allowed: false, UNAUTHORIZED_TEST_CLUSTER_HOSTNAME
  {
    id: 'S42',
    category: 'Domain Suffix Spoof',
    run: () => evaluateDatabaseIsolation('mongodb+srv://u:p@rhpn2gh.mongodb.net.attacker.com/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'UNAUTHORIZED_TEST_CLUSTER_HOSTNAME' },
    desc: 'Rejects suffix spoof'
  },
  // S43: Percent-Encoded Auth -> allowed: true, VALID_TEST_CONNECTION
  {
    id: 'S43',
    category: 'Percent-Encoded Auth',
    run: () => evaluateDatabaseIsolation('mongodb://user%40corp:pass%40123@127.0.0.1:27017/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: true, code: 'VALID_TEST_CONNECTION' },
    desc: 'Handles percent-encoded auth'
  },
  // S44: Double @ Authority Smuggle -> allowed: false, URI_MALFORMED
  {
    id: 'S44',
    category: 'Double @ Authority Smuggle',
    run: () => evaluateDatabaseIsolation('mongodb://user@host1@host2/avani_ai_crm_test', 'test', 'mock', '', 'false', 'test'),
    expected: { allowed: false, code: 'URI_MALFORMED' },
    desc: 'Rejects unencoded multiple @'
  }
];

// ============================================================================
// 4. GROUP B: LIFECYCLE INTEGRATION TESTS (TESTS 1 TO 15)
// ============================================================================

function setNonProdTestEnv() {
  process.env.VERCEL_ENV = '';
  process.env.APP_MODE = 'test';
  process.env.NODE_ENV = 'test';
  process.env.PROVIDER_MODE = 'mock';
  process.env.LIVE_TEST_AUTHORIZATION = 'false';
}

const groupBTests = [
  // Test 1: Full connectToDatabase() lifecycle with valid non-prod params (mocked connection)
  {
    id: 'TEST_01',
    desc: 'Full connectToDatabase() lifecycle with valid non-prod params',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      process.env.MONGODB_TEST_CLUSTER_DOMAIN = 'avani-test-cluster.xyz123.mongodb.net';
      const mockDns = async () => [
        { name: 'node1.avani-test-cluster.xyz123.mongodb.net', port: 27017 }
      ];
      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: 'avani-test-cluster.xyz123.mongodb.net:27017',
        topologyServers: ['node1.avani-test-cluster.xyz123.mongodb.net:27017']
      });

      const conn = await connectToDatabase({
        uri: 'mongodb+srv://test_user:test_pass@avani-test-cluster.xyz123.mongodb.net/avani_ai_crm_test',
        dnsResolver: mockDns,
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert(conn !== null, 'Connection should succeed with valid non-prod parameters');
      assert.strictEqual(conn.connection.name, 'avani_ai_crm_test');
    }
  },

  // Test 2: Full connectToDatabase() lifecycle with valid prod params (mocked connection)
  {
    id: 'TEST_02',
    desc: 'Full connectToDatabase() lifecycle with valid prod params',
    run: async () => {
      resetConnectionCacheForTesting();
      try {
        process.env.VERCEL_ENV = 'production';
        process.env.APP_MODE = 'production';
        process.env.NODE_ENV = 'production';

        const mockDns = async () => [
          { name: 'atlas-node1.rhpn2gh.mongodb.net', port: 27017 }
        ];
        const mockMongoose = createMockMongoose({
          dbName: 'avani_ai_crm_prod',
          host: 'rhpn2gh.mongodb.net:27017',
          topologyServers: ['atlas-node1.rhpn2gh.mongodb.net:27017']
        });

        const conn = await connectToDatabase({
          uri: 'mongodb+srv://prod_user:prod_pass@rhpn2gh.mongodb.net/avani_ai_crm_prod',
          dnsResolver: mockDns,
          mongooseInstance: mockMongoose,
          skipTls: true
        });

        assert(conn !== null, 'Connection should succeed with valid prod parameters');
        assert.strictEqual(conn.connection.name, 'avani_ai_crm_prod');
      } finally {
        setNonProdTestEnv();
      }
    }
  },

  // Test 3: connectToDatabase() aborts on SRV pointing to production host (mocked DNS)
  {
    id: 'TEST_03',
    desc: 'connectToDatabase() aborts on SRV pointing to production host',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      process.env.MONGODB_TEST_CLUSTER_DOMAIN = 'avani-test-cluster.xyz123.mongodb.net';
      const mockRogueDns = async () => [
        { name: 'node1.rhpn2gh.mongodb.net', port: 27017 }
      ];
      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: 'avani-test-cluster.xyz123.mongodb.net:27017'
      });

      const conn = await connectToDatabase({
        uri: 'mongodb+srv://test_user:test_pass@avani-test-cluster.xyz123.mongodb.net/avani_ai_crm_test',
        dnsResolver: mockRogueDns,
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert.strictEqual(conn, null, 'connectToDatabase must abort when SRV resolves to production node');
      const lastErr = getDatabaseLastError();
      assert(lastErr && lastErr.includes('production cluster node'), `Expected error message about prod cluster node, got ${lastErr}`);
    }
  },

  // Test 4: connectToDatabase() aborts on SRV pointing to unknown external host (mocked DNS)
  {
    id: 'TEST_04',
    desc: 'connectToDatabase() aborts on SRV pointing to unknown external host',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      process.env.MONGODB_TEST_CLUSTER_DOMAIN = 'avani-test-cluster.xyz123.mongodb.net';
      const mockExternalDns = async () => [
        { name: 'evil-node.attacker.com', port: 27017 }
      ];
      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: 'avani-test-cluster.xyz123.mongodb.net:27017'
      });

      const conn = await connectToDatabase({
        uri: 'mongodb+srv://test_user:test_pass@avani-test-cluster.xyz123.mongodb.net/avani_ai_crm_test',
        dnsResolver: mockExternalDns,
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert.strictEqual(conn, null, 'connectToDatabase must abort when SRV resolves to external rogue node');
      const lastErr = getDatabaseLastError();
      assert(lastErr && lastErr.includes('unauthorized external host'), `Expected error message about unauthorized external host, got ${lastErr}`);
    }
  },

  // Test 5: connectToDatabase() aborts on post-connect topology containing production node
  {
    id: 'TEST_05',
    desc: 'connectToDatabase() aborts on post-connect topology containing production node',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      let closed = false;
      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: '127.0.0.1:27017',
        topologyServers: ['127.0.0.1:27017', 'shard-00.rhpn2gh.mongodb.net:27017']
      });
      mockMongoose.connection.close = async () => {
        closed = true;
        mockMongoose.connection.readyState = 0;
      };

      const conn = await connectToDatabase({
        uri: 'mongodb://127.0.0.1:27017/avani_ai_crm_test',
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert.strictEqual(conn, null, 'connectToDatabase must abort when live topology contains prod node');
      assert.strictEqual(closed, true, 'connection must be closed immediately upon topology violation');
      const lastErr = getDatabaseLastError();
      assert(lastErr && lastErr.includes('production cluster node'), `Expected error message about prod cluster node, got ${lastErr}`);
    }
  },

  // Test 6: connectToDatabase() aborts on same-connection database mismatch
  {
    id: 'TEST_06',
    desc: 'connectToDatabase() aborts on same-connection database mismatch',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      let closed = false;
      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_prod', // Mismatch! Target is test
        host: '127.0.0.1:27017',
        topologyServers: ['127.0.0.1:27017']
      });
      mockMongoose.connection.close = async () => {
        closed = true;
        mockMongoose.connection.readyState = 0;
      };

      const conn = await connectToDatabase({
        uri: 'mongodb://127.0.0.1:27017/avani_ai_crm_test',
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert.strictEqual(conn, null, 'connectToDatabase must abort on live database name mismatch');
      assert.strictEqual(closed, true, 'connection must be closed immediately upon database mismatch');
      const lastErr = getDatabaseLastError();
      assert(lastErr && lastErr.includes('does not match expected'), `Expected error message about database mismatch, got ${lastErr}`);
    }
  },

  // Test 7: connectToDatabase() aborts on same-connection host mismatch
  {
    id: 'TEST_07',
    desc: 'connectToDatabase() aborts on same-connection host mismatch',
    run: async () => {
      resetConnectionCacheForTesting();
      try {
        process.env.VERCEL_ENV = 'production';
        process.env.APP_MODE = 'production';
        process.env.NODE_ENV = 'production';

        let closed = false;
        const mockMongoose = createMockMongoose({
          dbName: 'avani_ai_crm_prod',
          host: 'rogue-cluster.mongodb.net:27017', // Mismatch! Expected rhpn2gh
          topologyServers: ['rogue-cluster.mongodb.net:27017']
        });
        mockMongoose.connection.close = async () => {
          closed = true;
          mockMongoose.connection.readyState = 0;
        };

        const conn = await connectToDatabase({
          uri: 'mongodb+srv://prod_user:prod_pass@rhpn2gh.mongodb.net/avani_ai_crm_prod',
          dnsResolver: async () => [{ name: 'atlas-node1.rhpn2gh.mongodb.net', port: 27017 }],
          mongooseInstance: mockMongoose,
          skipTls: true
        });

        assert.strictEqual(conn, null, 'connectToDatabase must abort on live host mismatch');
        assert.strictEqual(closed, true, 'connection must be closed immediately upon host mismatch');
        const lastErr = getDatabaseLastError();
        assert(lastErr && lastErr.includes('does not match expected domain'), `Expected error message about host mismatch, got ${lastErr}`);
      } finally {
        setNonProdTestEnv();
      }
    }
  },

  // Test 8: connectToDatabase() succeeds with localhost URI without MONGODB_TEST_CLUSTER_DOMAIN
  {
    id: 'TEST_08',
    desc: 'connectToDatabase() succeeds with localhost URI without MONGODB_TEST_CLUSTER_DOMAIN',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      delete process.env.MONGODB_TEST_CLUSTER_DOMAIN;

      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: 'localhost:27017',
        topologyServers: ['localhost:27017']
      });

      const conn = await connectToDatabase({
        uri: 'mongodb://localhost:27017/avani_ai_crm_test',
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert(conn !== null, 'Localhost connection must succeed without MONGODB_TEST_CLUSTER_DOMAIN');
      assert.strictEqual(conn.connection.name, 'avani_ai_crm_test');
    }
  },

  // Test 9: connectToDatabase() succeeds with 127.0.0.1 URI without MONGODB_TEST_CLUSTER_DOMAIN
  {
    id: 'TEST_09',
    desc: 'connectToDatabase() succeeds with 127.0.0.1 URI without MONGODB_TEST_CLUSTER_DOMAIN',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      delete process.env.MONGODB_TEST_CLUSTER_DOMAIN;

      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: '127.0.0.1:27017',
        topologyServers: ['127.0.0.1:27017']
      });

      const conn = await connectToDatabase({
        uri: 'mongodb://127.0.0.1:27017/avani_ai_crm_test',
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert(conn !== null, '127.0.0.1 loopback connection must succeed without MONGODB_TEST_CLUSTER_DOMAIN');
      assert.strictEqual(conn.connection.name, 'avani_ai_crm_test');
    }
  },

  // Test 10: connectToDatabase() fails with Atlas URI when MONGODB_TEST_CLUSTER_DOMAIN is unset
  {
    id: 'TEST_10',
    desc: 'connectToDatabase() fails with Atlas URI when MONGODB_TEST_CLUSTER_DOMAIN is unset',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      delete process.env.MONGODB_TEST_CLUSTER_DOMAIN;

      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: 'some-atlas.xyz123.mongodb.net:27017'
      });

      const conn = await connectToDatabase({
        uri: 'mongodb+srv://u:p@some-atlas.xyz123.mongodb.net/avani_ai_crm_test',
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert.strictEqual(conn, null, 'Atlas non-prod URI must fail closed when MONGODB_TEST_CLUSTER_DOMAIN is unset');
      const lastErr = getDatabaseLastError();
      assert(lastErr && lastErr.includes('UNAUTHORIZED_TEST_CLUSTER_HOSTNAME'), `Expected UNAUTHORIZED_TEST_CLUSTER_HOSTNAME, got ${lastErr}`);
    }
  },

  // Test 11: connectToDatabase() fails when MONGODB_TEST_CLUSTER_DOMAIN is wildcard
  {
    id: 'TEST_11',
    desc: 'connectToDatabase() fails when MONGODB_TEST_CLUSTER_DOMAIN is wildcard',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      process.env.MONGODB_TEST_CLUSTER_DOMAIN = '*.mongodb.net';

      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: 'some-atlas.xyz123.mongodb.net:27017'
      });

      const conn = await connectToDatabase({
        uri: 'mongodb+srv://u:p@some-atlas.xyz123.mongodb.net/avani_ai_crm_test',
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert.strictEqual(conn, null, 'Wildcard domain must fail closed');
      const lastErr = getDatabaseLastError();
      assert(lastErr && lastErr.includes('UNAUTHORIZED_TEST_CLUSTER_HOSTNAME'), `Expected UNAUTHORIZED_TEST_CLUSTER_HOSTNAME, got ${lastErr}`);
    }
  },

  // Test 12: connectToDatabase() fails when MONGODB_TEST_CLUSTER_DOMAIN contains rhpn2gh
  {
    id: 'TEST_12',
    desc: 'connectToDatabase() fails when MONGODB_TEST_CLUSTER_DOMAIN contains rhpn2gh',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      process.env.MONGODB_TEST_CLUSTER_DOMAIN = 'rhpn2gh.mongodb.net';

      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: 'rhpn2gh.mongodb.net:27017'
      });

      const conn = await connectToDatabase({
        uri: 'mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_test',
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert.strictEqual(conn, null, 'Setting test cluster domain to rhpn2gh must fail closed');
      const lastErr = getDatabaseLastError();
      assert(lastErr && lastErr.includes('PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD'), `Expected PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD, got ${lastErr}`);
    }
  },

  // Test 13: connectToDatabase() fails when MONGODB_TEST_CLUSTER_DOMAIN contains 41zrtal
  {
    id: 'TEST_13',
    desc: 'connectToDatabase() fails when MONGODB_TEST_CLUSTER_DOMAIN contains 41zrtal',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      process.env.MONGODB_TEST_CLUSTER_DOMAIN = '41zrtal.mongodb.net';

      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: '41zrtal.mongodb.net:27017'
      });

      const conn = await connectToDatabase({
        uri: 'mongodb+srv://u:p@41zrtal.mongodb.net/avani_ai_crm_test',
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert.strictEqual(conn, null, 'Setting test cluster domain to legacy 41zrtal must fail closed');
      const lastErr = getDatabaseLastError();
      assert(lastErr && lastErr.includes('UNAUTHORIZED_TEST_CLUSTER_HOSTNAME'), `Expected UNAUTHORIZED_TEST_CLUSTER_HOSTNAME, got ${lastErr}`);
    }
  },

  // Test 14: connectToDatabase() re-verifies on reconnect event
  {
    id: 'TEST_14',
    desc: 'connectToDatabase() re-verifies on reconnect event',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      delete process.env.MONGODB_TEST_CLUSTER_DOMAIN;

      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: 'localhost:27017',
        topologyServers: ['localhost:27017']
      });

      const conn = await connectToDatabase({
        uri: 'mongodb://localhost:27017/avani_ai_crm_test',
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert(conn !== null, 'Initial localhost connection should succeed');
      assert(getConnectionCacheForTesting().conn !== null, 'Cache must be populated');

      // Simulate a malicious reconnect where database shifts to production
      mockMongoose.connection.name = 'avani_ai_crm_prod';
      mockMongoose.connection.emit('reconnect');

      // The reconnect handler should detect the mismatch and clear the cache
      assert.strictEqual(getConnectionCacheForTesting().conn, null, 'Cache must be cleared after reconnect mismatch');
    }
  },

  // Test 15: connectToDatabase() clears cached connection and resets readyState on isolation failure
  {
    id: 'TEST_15',
    desc: 'connectToDatabase() clears cached connection and resets readyState on isolation failure',
    run: async () => {
      resetConnectionCacheForTesting();
      setNonProdTestEnv();
      delete process.env.MONGODB_TEST_CLUSTER_DOMAIN;

      const mockMongoose = createMockMongoose({
        dbName: 'avani_ai_crm_test',
        host: 'localhost:27017',
        topologyServers: ['localhost:27017', 'rogue-prod.rhpn2gh.mongodb.net:27017']
      });

      const conn = await connectToDatabase({
        uri: 'mongodb://localhost:27017/avani_ai_crm_test',
        mongooseInstance: mockMongoose,
        skipTls: true
      });

      assert.strictEqual(conn, null, 'connectToDatabase should return null on isolation failure');
      const cache = getConnectionCacheForTesting();
      assert.strictEqual(cache.conn, null, 'cached.conn must be null');
      assert.strictEqual(cache.promise, null, 'cached.promise must be null');
      assert.strictEqual(cache.uri, null, 'cached.uri must be null');
      assert.strictEqual(cache.targetDb, null, 'cached.targetDb must be null');
      assert(cache.lastError !== null, 'cached.lastError must record the violation reason');
    }
  }
];

// ============================================================================
// 5. TEST RUNNER EXECUTION
// ============================================================================

async function runTestSuite() {
  console.log('======================================================================');
  console.log('TASK 5F.2: MONGODB DATABASE ISOLATION SECURITY REMEDIATION TEST SUITE');
  console.log('Date: 18 November 2026 | Environment: Offline Unit | Zero Network');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;
  const results = [];

  // Part 1: Group A (S01 to S44)
  console.log('--- Group A: Unit Regression Scenarios (S01–S44) against src/lib/db.ts ---');
  for (const scenario of scenarios) {
    try {
      const res = scenario.run();
      assert.strictEqual(
        res.allowed,
        scenario.expected.allowed,
        `Expected allowed=${scenario.expected.allowed}, got allowed=${res.allowed}`
      );
      assert.strictEqual(
        res.code,
        scenario.expected.code,
        `Expected code=${scenario.expected.code}, got code=${res.code}`
      );
      passed++;
      results.push({ id: scenario.id, group: 'A', status: 'PASS', code: res.code, desc: scenario.desc });
      console.log(`[PASS] ${scenario.id.padEnd(7)} | Code: ${res.code.padEnd(42)} | ${scenario.desc}`);
    } catch (err) {
      failed++;
      results.push({ id: scenario.id, group: 'A', status: 'FAIL', error: err.message, desc: scenario.desc });
      console.error(`[FAIL] ${scenario.id.padEnd(7)} | Error: ${err.message}`);
    }
  }

  // Part 2: Group B (Tests 1 to 15)
  console.log('\n--- Group B: Lifecycle Integration Scenarios (TEST_01–TEST_15) ---');
  for (const test of groupBTests) {
    try {
      await test.run();
      passed++;
      results.push({ id: test.id, group: 'B', status: 'PASS', desc: test.desc });
      console.log(`[PASS] ${test.id.padEnd(7)} | ${test.desc}`);
    } catch (err) {
      failed++;
      results.push({ id: test.id, group: 'B', status: 'FAIL', error: err.message, desc: test.desc });
      console.error(`[FAIL] ${test.id.padEnd(7)} | Error: ${err.message}`);
    }
  }

  console.log('\n======================================================================');
  console.log(`FINAL RESULTS: ${passed} PASSED, ${failed} FAILED, 0 BLOCKED (Total: ${scenarios.length + groupBTests.length})`);
  console.log('Zero live database connections used | Zero network traffic emitted');
  console.log('Tested directly against src/lib/db.ts using typescript.transpileModule');
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error("Fatal suite execution error:", err);
  process.exit(1);
});
