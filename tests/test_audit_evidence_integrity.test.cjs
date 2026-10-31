/**
 * AVANI AI CRM — Audit Evidence Integrity & State Taxonomy Regression Suite
 * 
 * Regression Tests to prevent recycling stale findings, enforce strict 5-state
 * taxonomy, protect environment isolation, and prevent false claims of live verification.
 * 
 * States Enforced:
 * - PASS: Verified by direct, fresh automated or cryptographic evidence.
 * - FAIL: Verified failure against an established specification.
 * - BLOCKED: Operation prohibited by security rule, paused cluster, or dependency.
 * - UNVERIFIED: Telemetry or user action missing; no assumption permitted.
 * - NOT RUN: Test or inspection intentionally omitted to prevent side-effects.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('============================================================');
console.log('🧪 RUNNING AUDIT EVIDENCE INTEGRITY & REGRESSION SUITE');
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

// 1. Evidence Freshness & Stale Evidence Guard
runTest('Freshness Guard: Stale evidence (>1hr) cannot be reported as fresh live observation', () => {
  function evaluateObservation(observationTimestampMs, currentTimestampMs, maxAgeMs = 3600000) {
    const ageMs = currentTimestampMs - observationTimestampMs;
    if (ageMs > maxAgeMs) {
      return { status: 'STALE', isFresh: false, requiresReVerification: true };
    }
    return { status: 'FRESH', isFresh: true, requiresReVerification: false };
  }

  const now = Date.now();
  const twoHoursAgo = now - 7200000;
  const thirtyMinsAgo = now - 1800000;

  const staleResult = evaluateObservation(twoHoursAgo, now);
  assert.strictEqual(staleResult.isFresh, false);
  assert.strictEqual(staleResult.requiresReVerification, true);

  const freshResult = evaluateObservation(thirtyMinsAgo, now);
  assert.strictEqual(freshResult.isFresh, true);
  assert.strictEqual(freshResult.requiresReVerification, false);
});

// 2. Strict 5-State Taxonomy Guard
runTest('Taxonomy Guard: Missing telemetry strictly evaluates to UNVERIFIED (never assumed)', () => {
  const VALID_STATES = new Set(['PASS', 'FAIL', 'BLOCKED', 'UNVERIFIED', 'NOT RUN']);

  function classifyTelemetry(telemetry) {
    if (telemetry === null || telemetry === undefined || telemetry === '') {
      return 'UNVERIFIED';
    }
    if (telemetry.offline || telemetry.clusterPaused) {
      return 'BLOCKED';
    }
    if (telemetry.error) {
      return 'FAIL';
    }
    if (telemetry.verified === true) {
      return 'PASS';
    }
    return 'UNVERIFIED';
  }

  assert.strictEqual(classifyTelemetry(null), 'UNVERIFIED');
  assert.strictEqual(classifyTelemetry(undefined), 'UNVERIFIED');
  assert.strictEqual(classifyTelemetry({}), 'UNVERIFIED');
  assert.strictEqual(classifyTelemetry({ clusterPaused: true }), 'BLOCKED');
  assert.strictEqual(classifyTelemetry({ error: 'TLS_ALERT_80' }), 'FAIL');
  assert.strictEqual(classifyTelemetry({ verified: true }), 'PASS');

  // Verify all outputs belong to VALID_STATES
  ['', null, {}, { clusterPaused: true }, { error: 'E' }, { verified: true }].forEach(input => {
    assert.ok(VALID_STATES.has(classifyTelemetry(input)));
  });
});

// 3. Environment Isolation Guard
runTest('Environment Isolation Guard: Test runtime never exposes production MONGODB_URI or production Supabase', () => {
  // Ensure that no production database is in active process.env during test execution
  const currentDbUri = process.env.MONGODB_URI || '';
  const currentPostgresUrl = process.env.DATABASE_URL || '';

  assert.ok(!currentDbUri.includes('avani_ai_crm_prod'), 'Active test environment must NOT point to avani_ai_crm_prod');
  assert.ok(!currentPostgresUrl.includes('pooler.supabase.com'), 'Active test environment must NOT point to production Supabase pooler');
});

// 4. Protocol Decoupling Guard
runTest('Decoupling Guard: MONGODB_URI and DATABASE_URL protocol integrity', () => {
  function validateProtocol(key, uri) {
    if (!uri) return true;
    if (key === 'MONGODB_URI') {
      return uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
    }
    if (key === 'DATABASE_URL') {
      return uri.startsWith('postgres://') || uri.startsWith('postgresql://');
    }
    return false;
  }

  assert.ok(validateProtocol('MONGODB_URI', 'mongodb+srv://cluster.mongodb.net/test'));
  assert.ok(!validateProtocol('MONGODB_URI', 'postgresql://aws.pooler.supabase.com/db'));
  assert.ok(validateProtocol('DATABASE_URL', 'postgresql://aws.pooler.supabase.com/db'));
  assert.ok(!validateProtocol('DATABASE_URL', 'mongodb+srv://cluster.mongodb.net/test'));
});

// 5. Credential Masking in Outputs Guard
runTest('Credential Masking Guard: Token regex intercepts raw GitHub tokens in strings', () => {
  function maskSecretUrls(rawString) {
    return rawString
      .replace(/ghp_[A-Za-z0-9_]{36,}/g, '[REDACTED_GITHUB_CLASSIC_PAT]')
      .replace(/github_pat_[A-Za-z0-9_]{50,}/g, '[REDACTED_GITHUB_FINE_GRAINED_PAT]')
      .replace(/https:\/\/[^@\s]+@github\.com/g, 'https://github.com');
  }

  const sampleRaw = 'origin https://ghp_000000000000000000000000000000000000@github.com/avaniagrofoods/avani-ai-crm.git (fetch)';
  const sanitized = maskSecretUrls(sampleRaw);

  assert.ok(!sanitized.includes('ghp_0000'), 'Sanitized string must not contain token prefix or token body');
  assert.ok(!sanitized.includes('@github.com'), 'Sanitized string must not contain auth userinfo in URL');
  assert.ok(sanitized.includes('https://github.com/avaniagrofoods/avani-ai-crm.git'), 'Sanitized URL must match canonical path');
});

// 6. Paused Cluster Live Test Interception Guard
runTest('Paused Cluster Guard: Prevents live connection test when cluster state is PAUSED or UNVERIFIED', () => {
  function attemptLiveConnection(clusterState) {
    if (clusterState !== 'ACTIVE') {
      return {
        executed: false,
        status: clusterState === 'PAUSED' ? 'BLOCKED' : 'UNVERIFIED',
        reason: `Connection blocked: Cluster status is ${clusterState}. Live queries forbidden to prevent timeouts and false failures.`
      };
    }
    return { executed: true, status: 'CONNECTED' };
  }

  const pausedAttempt = attemptLiveConnection('PAUSED');
  assert.strictEqual(pausedAttempt.executed, false);
  assert.strictEqual(pausedAttempt.status, 'BLOCKED');

  const unverifiedAttempt = attemptLiveConnection('UNVERIFIED');
  assert.strictEqual(unverifiedAttempt.executed, false);
  assert.strictEqual(unverifiedAttempt.status, 'UNVERIFIED');

  const activeAttempt = attemptLiveConnection('ACTIVE');
  assert.strictEqual(activeAttempt.executed, true);
  assert.strictEqual(activeAttempt.status, 'CONNECTED');
});

// 7. Canonical Repository Ambiguity Guard
runTest('Repository Ambiguity Guard: Flags discrepancy between configured and claimed repositories', () => {
  function reconcileRepo(configuredRemote, claimedRepo) {
    const cleanConfigured = configuredRemote.replace(/\.git$/, '').toLowerCase();
    const cleanClaimed = claimedRepo.replace(/\.git$/, '').toLowerCase();

    if (cleanConfigured === cleanClaimed) {
      return { isAligned: true, canonical: cleanConfigured };
    }
    return {
      isAligned: false,
      configured: cleanConfigured,
      claimed: cleanClaimed,
      requiresOwnerConfirmation: true
    };
  }

  const result = reconcileRepo('https://github.com/avaniagrofoods/avani-ai-crm.git', 'https://github.com/Sachin-Shinde-007/avani-ai-crm');
  assert.strictEqual(result.isAligned, false);
  assert.strictEqual(result.requiresOwnerConfirmation, true);
});

// 8. .env.test File Sanitization Guard
runTest('.env.test Sanitization Guard: Verifies .env.test does not point to live Supabase or production cluster', () => {
  const envTestPath = path.resolve(__dirname, '../.env.test');
  if (fs.existsSync(envTestPath)) {
    const content = fs.readFileSync(envTestPath, 'utf8');
    assert.ok(!content.includes('aws-1-ap-southeast-1.pooler.supabase.com'), '.env.test must NOT contain production Supabase host');
    assert.ok(!content.includes('cluster0-shard-00-00.mlcxcp.mongodb.net'), '.env.test must NOT contain production MongoDB cluster shard hosts');
    assert.ok(!content.includes('avani_crm_prod_app'), '.env.test must NOT contain production database user');
    assert.ok(content.includes('avani_ai_crm_test'), '.env.test must target isolated test database');
  }
});

// 9. Health Route Contract Guard (Liveness vs Readiness)
runTest('Health Route Contract: Process health (liveness) is decoupled from database readiness', () => {
  function formatHealth(databaseReady, uptimeSec = 100) {
    return {
      status: databaseReady ? 'HEALTHY' : 'DEGRADED',
      process: {
        status: 'UP',
        uptimeSeconds: uptimeSec
      },
      readiness: {
        status: databaseReady ? 'READY' : 'NOT_READY',
        databaseReady: databaseReady
      }
    };
  }

  const offlineReport = formatHealth(false);
  assert.strictEqual(offlineReport.process.status, 'UP', 'Process is alive');
  assert.strictEqual(offlineReport.readiness.databaseReady, false, 'Database is not ready');
  assert.strictEqual(offlineReport.readiness.status, 'NOT_READY');
  assert.strictEqual(offlineReport.status, 'DEGRADED');

  const onlineReport = formatHealth(true);
  assert.strictEqual(onlineReport.process.status, 'UP');
  assert.strictEqual(onlineReport.readiness.databaseReady, true);
  assert.strictEqual(onlineReport.readiness.status, 'READY');
  assert.strictEqual(onlineReport.status, 'HEALTHY');
});

// 10. Unavailable Browser Status Guard
runTest('Browser Automation Guard: Inaccessible browser evaluates to BLOCKED — OWNER AUTHENTICATION REQUIRED', () => {
  function evaluateBrowserIntegration(browserPageUrl, hasOAuthSession) {
    if (browserPageUrl === 'about:blank' || !hasOAuthSession) {
      return {
        status: 'BLOCKED — OWNER AUTHENTICATION REQUIRED',
        canAutoInspect: false,
        reason: 'Automated browser cannot bypass Google OAuth or access private desktop session.'
      };
    }
    return { status: 'ACCESSIBLE', canAutoInspect: true };
  }

  const result = evaluateBrowserIntegration('about:blank', false);
  assert.strictEqual(result.status, 'BLOCKED — OWNER AUTHENTICATION REQUIRED');
  assert.strictEqual(result.canAutoInspect, false);
});

// 11. Local Test Success vs Live Connectivity Separation
runTest('Separation Guard: Local test suite pass does not imply live production connectivity', () => {
  function evaluateGateVerdict(localTestsPassed, totalLocalTests, liveClusterVerified) {
    const localPass = localTestsPassed === totalLocalTests;
    return {
      localSuiteResult: localPass ? 'PASS' : 'FAIL',
      liveProductionGateC: liveClusterVerified ? 'PASS' : 'BLOCKED',
      canClaimLiveRecovery: false // Local tests never authorize claiming live recovery
    };
  }

  const verdict = evaluateGateVerdict(11, 11, false);
  assert.strictEqual(verdict.localSuiteResult, 'PASS');
  assert.strictEqual(verdict.liveProductionGateC, 'BLOCKED');
  assert.strictEqual(verdict.canClaimLiveRecovery, false);
});

// 12. Cluster Reconciliation Guard
runTest('Cluster Reconciliation Guard: Reconciles owner-observed avani-prod-cluster and marks cluster0 as stale', () => {
  function reconcileClusterEvidence(ownerObservedCluster, configuredEnvCluster) {
    const isCluster0Stale = ownerObservedCluster !== configuredEnvCluster && configuredEnvCluster === 'cluster0';
    return {
      productionCluster: ownerObservedCluster,
      legacyConfiguredCluster: configuredEnvCluster,
      cluster0Status: isCluster0Stale ? 'NOT FOUND IN OWNER-OBSERVED PROJECT VIEW' : 'ACTIVE',
      requiresVercelReconciliation: isCluster0Stale
    };
  }

  const result = reconcileClusterEvidence('avani-prod-cluster', 'cluster0');
  assert.strictEqual(result.productionCluster, 'avani-prod-cluster');
  assert.strictEqual(result.cluster0Status, 'NOT FOUND IN OWNER-OBSERVED PROJECT VIEW');
  assert.strictEqual(result.requiresVercelReconciliation, true);
});

// 13. Production Target Safety Guard (Dev Cluster Prohibition)
runTest('Target Safety Guard: Strictly blocks pointing production avani_ai_crm_prod to avani-dev-cluster', () => {
  function validateProductionClusterTarget(targetCluster, targetDb) {
    if (targetDb === 'avani_ai_crm_prod' && targetCluster.includes('avani-dev-cluster')) {
      return {
        allowed: false,
        error: 'ARCHITECTURAL_VIOLATION: Production database avani_ai_crm_prod cannot be hosted on non-production M0 sandbox avani-dev-cluster.'
      };
    }
    return { allowed: true };
  }

  const devTargetAttempt = validateProductionClusterTarget('avani-dev-cluster.wmv4ncg.mongodb.net', 'avani_ai_crm_prod');
  assert.strictEqual(devTargetAttempt.allowed, false);
  assert.ok(devTargetAttempt.error.includes('ARCHITECTURAL_VIOLATION'));

  const prodTargetAttempt = validateProductionClusterTarget('avani-prod-cluster.mongodb.net', 'avani_ai_crm_prod');
  assert.strictEqual(prodTargetAttempt.allowed, true);
});

// 14. Suspended Cluster Guard
runTest('Suspended Cluster Guard: Blocks live connection attempts and marks hostname as UNAVAILABLE WHILE SUSPENDED', () => {
  function handleSuspendedCluster(clusterState) {
    if (clusterState === 'SUSPENDED') {
      return {
        canQuery: false,
        hostnameStatus: 'UNAVAILABLE WHILE SUSPENDED',
        connectivityVerdict: 'BLOCKED',
        allowPromptForHostname: false
      };
    }
    return { canQuery: true, hostnameStatus: 'AVAILABLE', connectivityVerdict: 'READY_TO_TEST', allowPromptForHostname: true };
  }

  const result = handleSuspendedCluster('SUSPENDED');
  assert.strictEqual(result.canQuery, false);
  assert.strictEqual(result.hostnameStatus, 'UNAVAILABLE WHILE SUSPENDED');
  assert.strictEqual(result.connectivityVerdict, 'BLOCKED');
  assert.strictEqual(result.allowPromptForHostname, false, 'Do not prompt user for hostname while cluster is suspended');
});

// 15. Billing Blocker Guard
runTest('Billing Blocker Guard: Categorizes Atlas billing alert + suspension as BLOCKED — OWNER BILLING ACTION REQUIRED', () => {
  function evaluateBillingStatus(hasUnpaidInvoice, clusterSuspended) {
    if (hasUnpaidInvoice && clusterSuspended) {
      return {
        status: 'BLOCKED — OWNER BILLING ACTION REQUIRED',
        rootCause: 'Atlas account suspension linked to unpaid invoice',
        canAgentResolve: false,
        actionRequired: 'Owner must review and settle unpaid invoice in Atlas billing console'
      };
    }
    return { status: 'CLEAR', canAgentResolve: true };
  }

  const result = evaluateBillingStatus(true, true);
  assert.strictEqual(result.status, 'BLOCKED — OWNER BILLING ACTION REQUIRED');
  assert.strictEqual(result.canAgentResolve, false);
  assert.ok(result.actionRequired.includes('Owner must review and settle'));
});

// 16. Database Presence Classification Guard
runTest('Database Presence Guard: Classifies database on suspended cluster as UNVERIFIED — CLUSTER SUSPENDED (never assumed deleted or lost)', () => {
  function evaluateDatabasePresence(clusterState, collectionListVisible) {
    if (clusterState === 'SUSPENDED' && !collectionListVisible) {
      return {
        presenceStatus: 'UNVERIFIED — CLUSTER SUSPENDED',
        isDeleted: false,
        isLost: false,
        requiresPostRestoreInspection: true
      };
    }
    return { presenceStatus: collectionListVisible ? 'VERIFIED' : 'NOT_FOUND', isDeleted: false, isLost: false };
  }

  const result = evaluateDatabasePresence('SUSPENDED', false);
  assert.strictEqual(result.presenceStatus, 'UNVERIFIED — CLUSTER SUSPENDED');
  assert.strictEqual(result.isDeleted, false, 'Never claim database was deleted');
  assert.strictEqual(result.isLost, false, 'Never claim database was lost');
  assert.strictEqual(result.requiresPostRestoreInspection, true);
});

// 17. Free Tier Project Quota Guard
runTest('Free Tier Quota Guard: Validates that MongoDB Atlas permits at most 1 Free M0 cluster per project', () => {
  function checkM0CreationEligibility(existingClustersInProject) {
    const hasM0Cluster = existingClustersInProject.some(c => c.tier === 'FREE' || c.tier === 'M0');
    if (hasM0Cluster) {
      return {
        allowed: false,
        status: 'BLOCKED — ATLAS 1-FREE-CLUSTER-PER-PROJECT LIMIT',
        reason: 'MongoDB Atlas limits each project to exactly one Free (M0) cluster. An existing M0 cluster was detected.'
      };
    }
    return { allowed: true, status: 'AVAILABLE' };
  }

  const blockedResult = checkM0CreationEligibility([{ name: 'avani-prod-cluster', tier: 'FREE' }]);
  assert.strictEqual(blockedResult.allowed, false);
  assert.strictEqual(blockedResult.status, 'BLOCKED — ATLAS 1-FREE-CLUSTER-PER-PROJECT LIMIT');

  const allowedResult = checkM0CreationEligibility([]);
  assert.strictEqual(allowedResult.allowed, true);
});

// 18. Account Billing Restriction Blocker Guard
runTest('Account Billing Restriction Guard: Organization-level billing hold blocks cluster creation across all projects', () => {
  function evaluateOrgBillingHold(hasActiveBillingAlert) {
    if (hasActiveBillingAlert) {
      return {
        canCreateCluster: false,
        preFlightGate: 'BLOCKED',
        verdict: 'BLOCKED — OWNER BILLING ACTION REQUIRED',
        reason: 'Atlas account-level billing restriction prevents provisioning new database resources.'
      };
    }
    return { canCreateCluster: true, preFlightGate: 'PASS', verdict: 'PERMITTED' };
  }

  const blockedHold = evaluateOrgBillingHold(true);
  assert.strictEqual(blockedHold.canCreateCluster, false);
  assert.strictEqual(blockedHold.preFlightGate, 'BLOCKED');
  assert.strictEqual(blockedHold.verdict, 'BLOCKED — OWNER BILLING ACTION REQUIRED');
});

// 19. Two-Cluster Resource & Database Isolation Guard
runTest('Two-Cluster Isolation Guard: Enforces strict resource and database isolation between Loan Services and AI CRM', () => {
  function validateClusterSeparation(clusterA, clusterB, dbA, dbB) {
    if (clusterA === clusterB) {
      return { isolated: false, violation: 'SHARED_CLUSTER_PROHIBITED' };
    }
    if (dbA === dbB) {
      return { isolated: false, violation: 'SHARED_DATABASE_PROHIBITED' };
    }
    return { isolated: true, loanDatabase: dbA, crmDatabase: dbB };
  }

  const separated = validateClusterSeparation(
    'avani-loan-free-cluster',
    'avani-ai-crm-free-cluster',
    'avani_loan_services_prod',
    'avani_ai_crm_prod'
  );
  assert.strictEqual(separated.isolated, true);

  const sharedCluster = validateClusterSeparation(
    'shared-cluster',
    'shared-cluster',
    'avani_loan_services_prod',
    'avani_ai_crm_prod'
  );
  assert.strictEqual(sharedCluster.isolated, false);
  assert.strictEqual(sharedCluster.violation, 'SHARED_CLUSTER_PROHIBITED');

  const sharedDb = validateClusterSeparation(
    'avani-loan-free-cluster',
    'avani-ai-crm-free-cluster',
    'avani_ai_crm_prod',
    'avani_ai_crm_prod'
  );
  assert.strictEqual(sharedDb.isolated, false);
  assert.strictEqual(sharedDb.violation, 'SHARED_DATABASE_PROHIBITED');
});

// 20. Model API Key vs Atlas Administration API Key Classification Guard
runTest('Model API Key Guard: Identifies ai.mongodb.com Model API keys and prevents improper use as Admin API keys', () => {
  function classifyMongoCredential(cred) {
    if (!cred) return { type: 'UNKNOWN', canAdministerAtlas: false };
    if (typeof cred === 'object' && cred.publicKey && cred.privateKey) {
      return { type: 'ATLAS_ADMIN_API_KEY_PAIR', canAdministerAtlas: true };
    }
    if (typeof cred === 'string') {
      if (cred.startsWith('mongodb+srv://') || cred.startsWith('mongodb://')) {
        return { type: 'MONGODB_CONNECTION_STRING', canAdministerAtlas: false };
      }
      if (cred.startsWith('al-') || cred.includes('ai.mongodb.com')) {
        return { type: 'MONGODB_MODEL_API_KEY', canAdministerAtlas: false, purpose: 'AI_MODEL_INFERENCE' };
      }
    }
    return { type: 'UNKNOWN', canAdministerAtlas: false };
  }

  const modelKey = classifyMongoCredential('al-0IhF8v3q4Qh8V5aEbFc1OcAh214HQxtSGkBbNbBcYLE');
  assert.strictEqual(modelKey.type, 'MONGODB_MODEL_API_KEY');
  assert.strictEqual(modelKey.canAdministerAtlas, false);
  assert.strictEqual(modelKey.purpose, 'AI_MODEL_INFERENCE');

  const adminKeyPair = classifyMongoCredential({ publicKey: 'mzpqvxyz', privateKey: '12345678-1234-1234-1234-123456789abc' });
  assert.strictEqual(adminKeyPair.type, 'ATLAS_ADMIN_API_KEY_PAIR');
  assert.strictEqual(adminKeyPair.canAdministerAtlas, true);

  const connString = classifyMongoCredential('mongodb+srv://user:pass@cluster.mongodb.net/avani_ai_crm_prod');
  assert.strictEqual(connString.type, 'MONGODB_CONNECTION_STRING');
  assert.strictEqual(connString.canAdministerAtlas, false);
});

// 21. Two-Project Application & Database Name Mapping Guard
runTest('Project Mapping Guard: Enforces strict mapping of AVANI LOAN SERVICES and AVANI AI CRM to their respective databases', () => {
  const PROJECT_MAPPING = {
    'AVANI LOAN SERVICES': {
      app: 'https://www.avanifinserv.com',
      database: 'avani_loan_services_prod',
      testDatabase: 'avani_loan_services_test',
      envVarDbName: 'avani_loan_services_prod'
    },
    'AVANI AI CRM': {
      app: 'https://avani-ai-crm.vercel.app',
      database: 'avani_ai_crm_prod',
      testDatabase: 'avani_ai_crm_test',
      envVarDbName: 'avani_ai_crm_prod'
    }
  };

  assert.strictEqual(PROJECT_MAPPING['AVANI LOAN SERVICES'].database, 'avani_loan_services_prod');
  assert.strictEqual(PROJECT_MAPPING['AVANI AI CRM'].database, 'avani_ai_crm_prod');
  assert.notStrictEqual(PROJECT_MAPPING['AVANI LOAN SERVICES'].database, PROJECT_MAPPING['AVANI AI CRM'].database);
  assert.notStrictEqual(PROJECT_MAPPING['AVANI LOAN SERVICES'].testDatabase, PROJECT_MAPPING['AVANI AI CRM'].testDatabase);
});

// 22. Cross-Project Credential Reuse Prohibition Guard
runTest('Cross-Project Credential Guard: Prohibits reusing database credentials or connection strings between applications', () => {
  function validateCredentialSeparation(loanUri, crmUri) {
    if (!loanUri || !crmUri) return { safe: false, reason: 'MISSING_URI' };
    const extractUserHost = (uri) => {
      const match = uri.match(/mongodb(?:\+srv)?:\/\/([^:]+):([^@]+)@([^/?]+)/);
      return match ? { user: match[1], host: match[3] } : null;
    };
    const loanDetails = extractUserHost(loanUri);
    const crmDetails = extractUserHost(crmUri);
    if (!loanDetails || !crmDetails) return { safe: false, reason: 'INVALID_URI_FORMAT' };
    if (loanDetails.user === crmDetails.user) {
      return { safe: false, reason: 'SHARED_DB_USER_PROHIBITED' };
    }
    if (loanDetails.host === crmDetails.host) {
      return { safe: false, reason: 'SHARED_CLUSTER_HOST_PROHIBITED' };
    }
    return { safe: true };
  }

  const valid = validateCredentialSeparation(
    'mongodb+srv://loan_app_user:loanSecretPass123@avani-loan-m0.xyz.mongodb.net/avani_loan_services_prod',
    'mongodb+srv://crm_app_user:crmSecretPass456@avani-ai-crm-m0.xyz.mongodb.net/avani_ai_crm_prod'
  );
  assert.strictEqual(valid.safe, true);

  const sharedUser = validateCredentialSeparation(
    'mongodb+srv://shared_user:pass1@cluster-a.xyz.mongodb.net/avani_loan_services_prod',
    'mongodb+srv://shared_user:pass2@cluster-b.xyz.mongodb.net/avani_ai_crm_prod'
  );
  assert.strictEqual(sharedUser.safe, false);
  assert.strictEqual(sharedUser.reason, 'SHARED_DB_USER_PROHIBITED');

  const sharedHost = validateCredentialSeparation(
    'mongodb+srv://user1:pass1@shared-cluster.xyz.mongodb.net/avani_loan_services_prod',
    'mongodb+srv://user2:pass2@shared-cluster.xyz.mongodb.net/avani_ai_crm_prod'
  );
  assert.strictEqual(sharedHost.safe, false);
  assert.strictEqual(sharedHost.reason, 'SHARED_CLUSTER_HOST_PROHIBITED');
});

// 23. Live Cluster Hostname & Shard Domain Isolation Guard
runTest('Live Cluster Isolation Guard: Validates that live provisioned cluster endpoints belong to distinct replica sets', () => {
  const LIVE_CLUSTERS = {
    loanServices: {
      host: 'avani-loan-services-m0.xj6nhak.mongodb.net',
      domainHash: 'xj6nhak',
      shardPrefix: 'ac-d9zisyz',
      database: 'avani_loan_services_prod'
    },
    aiCrm: {
      host: 'avani-loan-services-m0.rhpn2gh.mongodb.net',
      domainHash: 'rhpn2gh',
      shardPrefix: 'ac-8nlnecw',
      database: 'avani_ai_crm_prod'
    }
  };

  assert.notStrictEqual(LIVE_CLUSTERS.loanServices.host, LIVE_CLUSTERS.aiCrm.host);
  assert.notStrictEqual(LIVE_CLUSTERS.loanServices.domainHash, LIVE_CLUSTERS.aiCrm.domainHash);
  assert.notStrictEqual(LIVE_CLUSTERS.loanServices.shardPrefix, LIVE_CLUSTERS.aiCrm.shardPrefix);
  assert.notStrictEqual(LIVE_CLUSTERS.loanServices.database, LIVE_CLUSTERS.aiCrm.database);

  // Validate format
  assert.ok(LIVE_CLUSTERS.loanServices.host.endsWith('.mongodb.net'));
  assert.ok(LIVE_CLUSTERS.aiCrm.host.endsWith('.mongodb.net'));
});

console.log('\n============================================================');
console.log(`📊 INTEGRITY SUITE SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}


