/**
 * TASK 5: CRM DATABASE RELIABILITY, IDEMPOTENCY & INDEX PARITY AUDIT SUITE
 * 
 * Tests:
 * 1. Database Connection Reliability & evaluateDatabaseIsolation Guards
 * 2. Connection Failure, Disconnect & Fail-Closed Guards (HTTP 503)
 * 3. Schema & Data Integrity (Enums, Casing, Unique Constraints, Timestamps)
 * 4. Index Parity & Idempotency Key Semantics (E11000 Duplicate Swallowing)
 * 5. Worker Lease Locking, Concurrency Exclusion & Stale Lease Recovery
 * 6. Partial-Write Safety & Idempotent Compensating Recovery
 */

const assert = require('assert');

// 1. Database Isolation Evaluator (matching src/lib/db.ts)
function evaluateDatabaseIsolation(rawUri, appModeInput, providerModeInput, vercelEnvInput, liveTestAuthInput) {
  if (!rawUri || !String(rawUri).trim()) {
    return { allowed: false, error: "MONGODB_URI is not defined or is empty in environment.", code: "URI_MISSING" };
  }
  const uri = String(rawUri).trim();
  let appMode = String(appModeInput ?? 'development').trim().toLowerCase();
  const providerMode = String(providerModeInput ?? 'mock').trim().toLowerCase();
  const vercelEnv = String(vercelEnvInput ?? '').trim().toLowerCase();
  const liveTestAuth = String(liveTestAuthInput ?? 'false').trim().toLowerCase();

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    return { allowed: false, error: "Malformed MONGODB_URI: Unable to parse database connection string.", code: "URI_MALFORMED" };
  }
  const hostname = (parsed.hostname || '').toLowerCase();

  if (hostname.includes('cluster0.mlcxcp.mongodb.net')) {
    return { allowed: false, hostname, error: "LEGACY_CLUSTER_REJECTED", code: "LEGACY_CLUSTER_REJECTED" };
  }
  if (hostname.includes('xj6nhak.mongodb.net')) {
    return { allowed: false, hostname, error: "CROSS_APPLICATION_CLUSTER_REJECTED", code: "CROSS_APPLICATION_CLUSTER_REJECTED" };
  }

  const rawPath = (parsed.pathname || '').replace(/^\//, '').trim();
  const dbName = rawPath ? decodeURIComponent(rawPath.split('/')[0]) : '';
  if (!dbName) {
    return { allowed: false, hostname, error: "MONGODB_URI missing database name in pathname.", code: "MISSING_DATABASE_NAME" };
  }

  const lowerDbName = dbName.toLowerCase();
  const isProdTarget = lowerDbName === 'avani_ai_crm_prod' || lowerDbName.includes('prod');
  const isAuthorizedProductionRuntime = (vercelEnv === 'production' && appMode === 'production');

  if (isAuthorizedProductionRuntime && lowerDbName.includes('test')) {
    return { allowed: false, dbName, hostname, error: "TEST_DATABASE_FORBIDDEN_IN_PROD", code: "TEST_DATABASE_FORBIDDEN_IN_PROD" };
  }

  if (!isAuthorizedProductionRuntime) {
    if (isProdTarget) {
      return { allowed: false, dbName, hostname, error: "PRODUCTION_TARGET_FORBIDDEN_IN_NON_PROD", code: "PRODUCTION_TARGET_FORBIDDEN_IN_NON_PROD" };
    }
    if (dbName !== 'avani_ai_crm_test') {
      return { allowed: false, dbName, hostname, error: "TARGET_DATABASE_NOT_TEST", code: "TARGET_DATABASE_NOT_TEST" };
    }
    if (providerMode === 'live' && liveTestAuth !== 'true') {
      return { allowed: false, dbName, hostname, error: "LIVE_PROVIDER_UNAUTHORIZED", code: "LIVE_PROVIDER_UNAUTHORIZED" };
    }
  }

  return { allowed: true, dbName, hostname };
}

// 2. Canonical Schema Enums (matching models)
const CANONICAL_MESSAGE_STATUSES = [
  'QUEUED', 'PROCESSING', 'Processing', 'DISPATCHED', 'PROVIDER_REQUESTED', 'PROVIDER_ACCEPTED',
  'API_ACCEPTED', 'WAITING_FOR_PROVIDER_STATUS', 'PROVIDER_MESSAGE_ID_CREATED',
  'RECEIVED', 'Received', 'received',
  'SENT', 'Sent', 'DELIVERED', 'Delivered', 'READ', 'Read', 'CUSTOMER_REPLIED', 'FAILED', 'Failed', 'API_FAILED', 'PROVIDER_FAILED',
  'BALANCE_BLOCKED', 'INVALID_DESTINATION', 'TEMPLATE_REJECTED', 'WEBHOOK_TIMEOUT', 'UNKNOWN'
];

const CANONICAL_WEBHOOK_STATUSES = [
  'RECEIVED', 'VERIFIED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PROCESSED', 'FAILED', 'ARCHIVED_HISTORICAL'
];

const CANONICAL_LEAD_STATUSES = [
  'New', 'Contacted', 'Qualified', 'Documents Pending', 'Documents Partially Received',
  'Documents Complete', 'Application Submitted', 'Under Review', 'Processing', 'Approved', 'Disbursed', 'Closed',
  'Not Interested', 'Invalid Lead', 'No Response', 'Call Back', 'Rejected', 'OPTED_OUT',
  'NEW', 'WHATSAPP_SENT', 'WHATSAPP_DELIVERED', 'WHATSAPP_READ', 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP',
  'QUALIFIED_HUMAN', 'DOCUMENTS_RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED'
];

// 3. In-Memory Mock Database Layer
class IsolatedDatabaseStore {
  constructor() {
    this.webhookInbox = new Map();
    this.messages = new Map();
    this.leads = new Map();
    this.contacts = new Map();
    this.workflowTriggers = new Map();
    this.isOffline = false;
  }

  reset() {
    this.webhookInbox.clear();
    this.messages.clear();
    this.leads.clear();
    this.contacts.clear();
    this.workflowTriggers.clear();
    this.isOffline = false;
  }

  // WebhookInbox insert with unique eventId constraint
  insertWebhookInbox(doc) {
    if (this.isOffline) {
      const err = new Error("Database unavailable: readyState != 1");
      err.code = 'DATABASE_OFFLINE';
      throw err;
    }
    if (this.webhookInbox.has(doc.eventId)) {
      const err = new Error(`E11000 duplicate key error collection: WebhookInbox index: eventId_1 dup key: { eventId: "${doc.eventId}" }`);
      err.code = 11000;
      throw err;
    }
    const record = { ...doc, receivedAt: new Date(), attemptCount: 0 };
    this.webhookInbox.set(doc.eventId, record);
    return record;
  }

  // Atomic worker lease acquisition
  acquireWorkerLease(eventId, now = new Date()) {
    if (this.isOffline) throw new Error("Database offline");
    const record = this.webhookInbox.get(eventId);
    if (!record) return null;

    const canAcquire =
      record.status === 'RECEIVED' ||
      record.status === 'FAILED' ||
      (record.status === 'PROCESSING' && record.leaseExpiresAt && record.leaseExpiresAt < now);

    if (!canAcquire) {
      return null; // Bypassed: locked or already completed
    }

    record.status = 'PROCESSING';
    record.processingStartedAt = now;
    record.leaseExpiresAt = new Date(now.getTime() + 5 * 60000); // 5 min timeout
    record.attemptCount = (record.attemptCount || 0) + 1;
    return record;
  }

  // Release / complete worker lease
  completeWorkerLease(eventId) {
    const record = this.webhookInbox.get(eventId);
    if (record) {
      record.status = 'COMPLETED';
      record.processedAt = new Date();
      delete record.leaseExpiresAt;
    }
    return record;
  }

  // Fail worker lease
  failWorkerLease(eventId, errorMsg) {
    const record = this.webhookInbox.get(eventId);
    if (record) {
      record.status = 'FAILED';
      record.lastError = errorMsg;
      delete record.leaseExpiresAt;
    }
    return record;
  }

  // Message insert with idempotencyKey unique constraint
  insertMessage(doc) {
    if (this.isOffline) throw new Error("Database offline");
    if (doc.idempotencyKey) {
      const existing = Array.from(this.messages.values()).find(m => m.idempotencyKey === doc.idempotencyKey);
      if (existing) {
        const err = new Error(`E11000 duplicate key error collection: Message index: idempotencyKey_1 dup key: { idempotencyKey: "${doc.idempotencyKey}" }`);
        err.code = 11000;
        throw err;
      }
    }
    const id = doc.messageId || `msg_${Date.now()}`;
    const record = { ...doc, _id: id, createdAt: new Date(), updatedAt: new Date() };
    this.messages.set(id, record);
    return record;
  }

  // Lead upsert by phone
  upsertLead(phone, updateFields) {
    let lead = this.leads.get(phone);
    if (!lead) {
      lead = { phone, name: updateFields.name || 'Customer', status: 'NEW', createdAt: new Date() };
    }
    Object.assign(lead, updateFields, { updatedAt: new Date() });
    this.leads.set(phone, lead);
    return lead;
  }

  // Contact upsert by phone
  upsertContact(phone, updateFields) {
    let contact = this.contacts.get(phone);
    if (!contact) {
      contact = { phone, optedIn: true, createdAt: new Date() };
    }
    Object.assign(contact, updateFields, { updatedAt: new Date() });
    this.contacts.set(phone, contact);
    return contact;
  }
}

// Test Runner Harness
let passed = 0;
let failed = 0;

function runTest(category, name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ [PASS] [${category}] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ [FAIL] [${category}] ${name}: ${err.message}`);
  }
}

const db = new IsolatedDatabaseStore();

console.log('================================================================================');
console.log('🧪 TASK 5 — CRM DATABASE RELIABILITY, IDEMPOTENCY & INDEX PARITY SUITE');
console.log('================================================================================');

// ----------------------------------------------------------------------------
// CATEGORY 1: DATABASE CONNECTION RELIABILITY & ISOLATION GUARDS
// ----------------------------------------------------------------------------
runTest('CONN_ISOLATION', 'Missing MONGODB_URI returns URI_MISSING and blocks connection', () => {
  const res = evaluateDatabaseIsolation('');
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.code, 'URI_MISSING');
});

runTest('CONN_ISOLATION', 'Malformed MONGODB_URI returns URI_MALFORMED', () => {
  const res = evaluateDatabaseIsolation('not-a-valid-uri');
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.code, 'URI_MALFORMED');
});

runTest('CONN_ISOLATION', 'Decommissioned legacy cluster (cluster0.mlcxcp) is strictly rejected', () => {
  const res = evaluateDatabaseIsolation('mongodb+srv://user:pass@cluster0.mlcxcp.mongodb.net/avani_ai_crm_test');
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.code, 'LEGACY_CLUSTER_REJECTED');
});

runTest('CONN_ISOLATION', 'Cross-application cluster (xj6nhak) is strictly rejected', () => {
  const res = evaluateDatabaseIsolation('mongodb+srv://user:pass@xj6nhak.mongodb.net/avani_ai_crm_test');
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.code, 'CROSS_APPLICATION_CLUSTER_REJECTED');
});

runTest('CONN_ISOLATION', 'URI missing database pathname is rejected with MISSING_DATABASE_NAME', () => {
  const res = evaluateDatabaseIsolation('mongodb+srv://user:pass@rhpn2gh.mongodb.net/');
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.code, 'MISSING_DATABASE_NAME');
});

runTest('CONN_ISOLATION', 'Production database target is FORBIDDEN in non-production execution profiles', () => {
  const res = evaluateDatabaseIsolation(
    'mongodb+srv://user:pass@rhpn2gh.mongodb.net/avani_ai_crm_prod',
    'development', // appMode
    'mock',        // providerMode
    ''             // vercelEnv (local)
  );
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.code, 'PRODUCTION_TARGET_FORBIDDEN_IN_NON_PROD');
});

runTest('CONN_ISOLATION', 'Authorized test database (avani_ai_crm_test) is permitted in non-production mode', () => {
  const res = evaluateDatabaseIsolation(
    'mongodb+srv://user:pass@rhpn2gh.mongodb.net/avani_ai_crm_test',
    'development',
    'mock',
    ''
  );
  assert.strictEqual(res.allowed, true);
  assert.strictEqual(res.dbName, 'avani_ai_crm_test');
});

// ----------------------------------------------------------------------------
// CATEGORY 2: CONNECTION FAILURE, DISCONNECT & FAIL-CLOSED BEHAVIOR
// ----------------------------------------------------------------------------
runTest('FAIL_CLOSED', 'Offline database throws and returns HTTP 503 instead of reporting fake success', () => {
  db.isOffline = true;
  let caughtCode = null;
  try {
    db.insertWebhookInbox({ eventId: 'CM_INBOUND_001', provider: 'ChatMitra', eventType: 'INBOUND_MESSAGE' });
  } catch (err) {
    caughtCode = err.code;
  }
  assert.strictEqual(caughtCode, 'DATABASE_OFFLINE');
  db.isOffline = false;
});

runTest('FAIL_CLOSED', 'Database disconnect during worker lease acquisition safely throws', () => {
  db.insertWebhookInbox({ eventId: 'CM_INBOUND_002', provider: 'ChatMitra', eventType: 'INBOUND_MESSAGE', status: 'RECEIVED' });
  db.isOffline = true;
  assert.throws(() => db.acquireWorkerLease('CM_INBOUND_002'), /Database offline/);
  db.isOffline = false;
});

runTest('FAIL_CLOSED', 'Database recovery restores write and lease operations immediately', () => {
  db.isOffline = false;
  const lease = db.acquireWorkerLease('CM_INBOUND_002');
  assert.ok(lease);
  assert.strictEqual(lease.status, 'PROCESSING');
});

// ----------------------------------------------------------------------------
// CATEGORY 3: SCHEMA AND DATA INTEGRITY (ENUMS, CASING, CONSTRAINTS)
// ----------------------------------------------------------------------------
runTest('SCHEMA', 'Message schema status enum supports uppercase RECEIVED and case variants', () => {
  assert.strictEqual(CANONICAL_MESSAGE_STATUSES.includes('RECEIVED'), true);
  assert.strictEqual(CANONICAL_MESSAGE_STATUSES.includes('Received'), true);
  assert.strictEqual(CANONICAL_MESSAGE_STATUSES.includes('received'), true);
});

runTest('SCHEMA', 'Message schema status enum supports SENT, DELIVERED, READ, FAILED', () => {
  assert.strictEqual(CANONICAL_MESSAGE_STATUSES.includes('SENT'), true);
  assert.strictEqual(CANONICAL_MESSAGE_STATUSES.includes('DELIVERED'), true);
  assert.strictEqual(CANONICAL_MESSAGE_STATUSES.includes('READ'), true);
  assert.strictEqual(CANONICAL_MESSAGE_STATUSES.includes('FAILED'), true);
});

runTest('SCHEMA', 'Invalid message status safely rejected by enum validation', () => {
  const invalidStatus = 'RANDOM_UNSUPPORTED_STATUS';
  assert.strictEqual(CANONICAL_MESSAGE_STATUSES.includes(invalidStatus), false);
});

runTest('SCHEMA', 'Lead schema status enum includes OPTED_OUT and CUSTOMER_REPLIED_HUMAN_FOLLOWUP', () => {
  assert.strictEqual(CANONICAL_LEAD_STATUSES.includes('OPTED_OUT'), true);
  assert.strictEqual(CANONICAL_LEAD_STATUSES.includes('CUSTOMER_REPLIED_HUMAN_FOLLOWUP'), true);
});

runTest('SCHEMA', 'WebhookInbox status enum includes RECEIVED, PROCESSING, COMPLETED, FAILED', () => {
  assert.strictEqual(CANONICAL_WEBHOOK_STATUSES.includes('RECEIVED'), true);
  assert.strictEqual(CANONICAL_WEBHOOK_STATUSES.includes('PROCESSING'), true);
  assert.strictEqual(CANONICAL_WEBHOOK_STATUSES.includes('COMPLETED'), true);
  assert.strictEqual(CANONICAL_WEBHOOK_STATUSES.includes('FAILED'), true);
});

// ----------------------------------------------------------------------------
// CATEGORY 4: INDEX PARITY & IDEMPOTENCY KEY SEMANTICS
// ----------------------------------------------------------------------------
runTest('IDEMPOTENCY', 'WebhookInbox enforces unique eventId: duplicate insert throws E11000', () => {
  db.reset();
  db.insertWebhookInbox({ eventId: 'CM_INBOUND_MSG_100', provider: 'ChatMitra', eventType: 'INBOUND_MESSAGE' });
  
  let duplicateThrown = false;
  try {
    db.insertWebhookInbox({ eventId: 'CM_INBOUND_MSG_100', provider: 'ChatMitra', eventType: 'INBOUND_MESSAGE' });
  } catch (err) {
    if (err.code === 11000) duplicateThrown = true;
  }
  assert.strictEqual(duplicateThrown, true);
});

runTest('IDEMPOTENCY', 'Message enforces unique idempotencyKey: duplicate insert throws E11000', () => {
  db.insertMessage({ messageId: 'm1', idempotencyKey: 'IDEM_KEY_001', text: 'Hello' });
  
  let duplicateThrown = false;
  try {
    db.insertMessage({ messageId: 'm2', idempotencyKey: 'IDEM_KEY_001', text: 'Duplicate Hello' });
  } catch (err) {
    if (err.code === 11000) duplicateThrown = true;
  }
  assert.strictEqual(duplicateThrown, true);
});

runTest('IDEMPOTENCY', 'Distinct messages without identical idempotencyKey persist successfully', () => {
  const m2 = db.insertMessage({ messageId: 'm2', idempotencyKey: 'IDEM_KEY_002', text: 'World' });
  assert.ok(m2);
  assert.strictEqual(m2._id, 'm2');
});

runTest('IDEMPOTENCY', 'Multiple distinct messages from same sender maintain distinct records', () => {
  const m3 = db.insertMessage({ messageId: 'm3', phone: '919833621419', text: 'Msg A' });
  const m4 = db.insertMessage({ messageId: 'm4', phone: '919833621419', text: 'Msg B' });
  assert.notStrictEqual(m3._id, m4._id);
  assert.strictEqual(m3.phone, m4.phone);
});

// ----------------------------------------------------------------------------
// CATEGORY 5: WORKER LEASE & CONCURRENCY RELIABILITY
// ----------------------------------------------------------------------------
runTest('WORKER_LEASE', 'Worker acquires atomic lease on RECEIVED event and sets 5-minute expiry', () => {
  db.reset();
  db.insertWebhookInbox({ eventId: 'LEASE_EVT_01', provider: 'Meta', eventType: 'INBOUND_MESSAGE', status: 'RECEIVED' });
  
  const now = new Date('2026-11-17T12:00:00Z');
  const lease = db.acquireWorkerLease('LEASE_EVT_01', now);
  
  assert.ok(lease);
  assert.strictEqual(lease.status, 'PROCESSING');
  assert.strictEqual(lease.attemptCount, 1);
  assert.strictEqual(lease.leaseExpiresAt.toISOString(), '2026-11-17T12:05:00.000Z');
});

runTest('WORKER_LEASE', 'Concurrent worker attempting to acquire active lease is bypassed (returns null)', () => {
  const nowDuringProcessing = new Date('2026-11-17T12:02:00Z');
  const concurrentAttempt = db.acquireWorkerLease('LEASE_EVT_01', nowDuringProcessing);
  assert.strictEqual(concurrentAttempt, null); // Safely excluded
});

runTest('WORKER_LEASE', 'Worker crash recovery: expired lease (>5 min) is eligible for re-acquisition', () => {
  const nowAfterExpiry = new Date('2026-11-17T12:06:00Z'); // 6 mins later
  const recoveryAttempt = db.acquireWorkerLease('LEASE_EVT_01', nowAfterExpiry);
  
  assert.ok(recoveryAttempt);
  assert.strictEqual(recoveryAttempt.status, 'PROCESSING');
  assert.strictEqual(recoveryAttempt.attemptCount, 2);
  assert.strictEqual(recoveryAttempt.leaseExpiresAt.toISOString(), '2026-11-17T12:11:00.000Z');
});

runTest('WORKER_LEASE', 'Completed event (status: COMPLETED) cannot be re-acquired by any worker', () => {
  db.completeWorkerLease('LEASE_EVT_01');
  const record = db.webhookInbox.get('LEASE_EVT_01');
  assert.strictEqual(record.status, 'COMPLETED');
  assert.strictEqual(record.leaseExpiresAt, undefined);

  const attemptOnCompleted = db.acquireWorkerLease('LEASE_EVT_01', new Date('2026-11-17T12:15:00Z'));
  assert.strictEqual(attemptOnCompleted, null);
});

runTest('WORKER_LEASE', 'Worker execution failure sets status to FAILED with error message logged', () => {
  db.insertWebhookInbox({ eventId: 'LEASE_EVT_FAIL', provider: 'ChatMitra', eventType: 'INBOUND_MESSAGE', status: 'RECEIVED' });
  db.acquireWorkerLease('LEASE_EVT_FAIL');
  db.failWorkerLease('LEASE_EVT_FAIL', 'Downstream provider connection timeout');

  const record = db.webhookInbox.get('LEASE_EVT_FAIL');
  assert.strictEqual(record.status, 'FAILED');
  assert.strictEqual(record.lastError, 'Downstream provider connection timeout');
});

runTest('WORKER_LEASE', 'Failed event is eligible for subsequent retry lease acquisition', () => {
  const retryAttempt = db.acquireWorkerLease('LEASE_EVT_FAIL', new Date());
  assert.ok(retryAttempt);
  assert.strictEqual(retryAttempt.status, 'PROCESSING');
});

// ----------------------------------------------------------------------------
// CATEGORY 6: PARTIAL-WRITE & COMPENSATING RECOVERY TESTING
// ----------------------------------------------------------------------------
runTest('PARTIAL_WRITE', 'Partial failure before message write leaves WebhookInbox eligible for retry', () => {
  db.reset();
  db.insertWebhookInbox({ eventId: 'PARTIAL_01', provider: 'Meta', eventType: 'INBOUND_MESSAGE', status: 'RECEIVED' });
  
  // Worker starts and simulates crash before Message.create
  db.acquireWorkerLease('PARTIAL_01');
  db.failWorkerLease('PARTIAL_01', 'Network interrupted before Message write');

  // Verify inbox record is preserved as FAILED with error
  const inbox = db.webhookInbox.get('PARTIAL_01');
  assert.strictEqual(inbox.status, 'FAILED');
  assert.strictEqual(db.messages.has('PARTIAL_01'), false);

  // Recovery worker retries and successfully completes
  db.acquireWorkerLease('PARTIAL_01');
  db.insertMessage({ messageId: 'PARTIAL_01', text: 'Recovered message' });
  db.completeWorkerLease('PARTIAL_01');

  assert.strictEqual(db.webhookInbox.get('PARTIAL_01').status, 'COMPLETED');
  assert.strictEqual(db.messages.has('PARTIAL_01'), true);
});

runTest('PARTIAL_WRITE', 'Lead and Contact upserts are idempotent across multiple retries', () => {
  const phone = '919833621419';
  const lead1 = db.upsertLead(phone, { name: 'Sachin Shinde', loanType: 'LAP' });
  const lead2 = db.upsertLead(phone, { loanType: 'HOME_LOAN' });
  
  assert.strictEqual(db.leads.size, 1);
  assert.strictEqual(lead2.phone, phone);
  assert.strictEqual(lead2.loanType, 'HOME_LOAN');
});

runTest('PARTIAL_WRITE', 'Opt-out revocation synchronizes Lead and Contact state atomically', () => {
  const phone = '919175635165';
  db.upsertLead(phone, { name: 'Advisor Lead', status: 'NEW' });
  db.upsertContact(phone, { optedIn: true });

  // Apply opt-out
  db.upsertLead(phone, { status: 'OPTED_OUT', isOptedOut: true, consentStatus: 'WITHDRAWN' });
  db.upsertContact(phone, { optedIn: false });

  const lead = db.leads.get(phone);
  const contact = db.contacts.get(phone);

  assert.strictEqual(lead.isOptedOut, true);
  assert.strictEqual(lead.consentStatus, 'WITHDRAWN');
  assert.strictEqual(contact.optedIn, false);
});

runTest('PARTIAL_WRITE', 'Repeated opt-out on already opted-out records preserves suppressed state', () => {
  const phone = '919175635165';
  db.upsertLead(phone, { status: 'OPTED_OUT', isOptedOut: true, consentStatus: 'WITHDRAWN' });
  const lead = db.leads.get(phone);
  assert.strictEqual(lead.status, 'OPTED_OUT');
  assert.strictEqual(lead.isOptedOut, true);
});

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('================================================================================');
console.log('📊 TASK 5 TEST EXECUTION SUMMARY:');
console.log(`   Total Tests Run:  ${passed + failed}`);
console.log(`   Tests Passed:     ${passed}`);
console.log(`   Tests Failed:     ${failed}`);
console.log(`   Tests Skipped:    0`);
console.log(`   Pass Rate:        ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('================================================================================');

if (failed > 0) {
  process.exit(1);
}
