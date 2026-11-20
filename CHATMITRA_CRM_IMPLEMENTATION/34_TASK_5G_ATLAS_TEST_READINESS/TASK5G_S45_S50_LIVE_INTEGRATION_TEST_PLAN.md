# TASK 5G — LIVE INTEGRATION TEST PLAN: SCENARIOS S45 TO S50
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Role:** QA Architect, Database Reliability Engineer & Security Specialist  
**Status:** **AUTHORITATIVE TEST SPECIFICATION (DESIGN ONLY — NOT EXECUTED)**

---

## 1. Executive Summary & Safety Preconditions

This document specifies the exact execution protocols for the six live integration scenarios (**S45 through S50**) designed to validate the AVANI AI CRM database integration against a real, isolated MongoDB Atlas test database.

> [!CAUTION]
> **MANDATORY SAFETY BOUNDARIES:**  
> - None of these tests may be executed during Task 5G.  
> - None of these tests may EVER be executed against the production cluster (`rhpn2gh.mongodb.net`) or production database (`avani_ai_crm_prod`).  
> - 100% of input data must be synthetic. No production customer records or phone numbers may be used.  
> - Every test must execute automated cleanup of its created synthetic records.

---

## 2. Detailed Test Specifications: S45 to S50

### Scenario S45: Actual Isolated MongoDB Connection & Authentication
- **Objective:** Verify genuine network socket establishment, TLS 1.2+ handshake, SCRAM-SHA-256 user authentication, and same-connection identity binding against the approved Atlas test cluster.
- **Preconditions:**
  - Dedicated Atlas test cluster provisioned in `AVANI-AI-CRM-TESTING`.
  - `MONGODB_TEST_URI` set in `.env.test.local`.
  - `MONGODB_TEST_CLUSTER_DOMAIN` set to exact test cluster FQDN.
  - `APP_MODE=test`, `NODE_ENV=test`, `VERCEL_ENV=local`.
- **Synthetic Input Data:**
  - Database name: `avani_ai_crm_test`.
  - User: `als_crm_test_worker`.
- **Exact Expected Result:**
  - `connectToDatabase()` returns valid Mongoose connection object.
  - `connection.readyState === 1`.
  - `connection.name === 'avani_ai_crm_test'`.
  - `verifySameConnectionIdentity()` returns `{ verified: true, code: 'CONNECTION_BOUND' }`.
- **Cleanup Plan:** Connection closed gracefully via `await mongoose.disconnect()`.
- **Evidence to Collect:** Connection timing logs, server description from `topology.description.servers`, ping response latency.
- **Failure Criteria:** Any timeout, TLS failure, auth failure, or host mismatch.
- **Security Risks:** Risk of connecting to wrong cluster if `MONGODB_TEST_CLUSTER_DOMAIN` is misconfigured (mitigated by preflight and topology check).

---

### Scenario S46: Actual Model Persistence & Retrieval
- **Objective:** Verify real CRUD operations, BSON serialization/deserialization, date coercion, and schema defaults on `Lead` and `Contact` models.
- **Preconditions:** S45 passed; test database is online.
- **Synthetic Input Data:**
  - Synthetic Lead: `leadId: "ALS-TEST-990001"`, `name: "Synthetic Borrower Alpha"`, `phone: "+919999900001"`, `loanType: "Personal Loan"`, `monthlyIncome: 75000`.
  - Synthetic Contact: `phone: "+919999900001"`, `name: "Synthetic Borrower Alpha"`, `optedIn: true`.
- **Exact Expected Result:**
  - `Lead.create()` successfully persists document with assigned `_id`.
  - `Lead.findOne({ leadId: "ALS-TEST-990001" })` returns exact matched document.
  - Schema defaults (`stage: 'NEW_ENQUIRY'`, `qualificationScore: 0`) populated correctly.
- **Cleanup Plan:** `await Lead.deleteMany({ leadId: /^ALS-TEST-/ }); await Contact.deleteMany({ phone: /^\+9199999/ });`.
- **Evidence to Collect:** Created document IDs, queried document field parity diff.
- **Failure Criteria:** Persistence failure, field truncation, or schema default omission.
- **Security Risks:** Data pollution if synthetic markers are omitted (mitigated by strict regex prefix).

---

### Scenario S47: Unique Index Enforcement & Duplicate-Key Handling
- **Objective:** Verify that MongoDB Atlas actively enforces unique constraints on declared unique indexes and that Mongoose catches and bubbles `E11000` duplicate key exceptions.
- **Preconditions:** S45 & S46 passed; unique indexes verified via `verifyIndexSafety()`.
- **Synthetic Input Data:**
  - First Lead: `leadId: "ALS-TEST-UNIQUE-01"`, `phone: "+919999911111"`.
  - Second Lead (Duplicate ID): `leadId: "ALS-TEST-UNIQUE-01"`, `phone: "+919999922222"`.
  - Third Lead (Duplicate Phone): `leadId: "ALS-TEST-UNIQUE-02"`, `phone: "+919999911111"`.
- **Exact Expected Result:**
  - First Lead succeeds.
  - Second Lead throws MongoServerError code `11000` (E11000 duplicate key error collection: `leads` index: `leadId_1`).
  - Third Lead throws MongoServerError code `11000` on `phone_1`.
  - Second and third documents are NOT persisted.
- **Cleanup Plan:** `await Lead.deleteMany({ leadId: /^ALS-TEST-UNIQUE/ });`.
- **Evidence to Collect:** Error object code, keyPattern, keyValue, and error name.
- **Failure Criteria:** Duplicate record allowed to persist; silent failure without exception.
- **Security Risks:** Uniqueness bypass leading to duplicate customer profiles.

---

### Scenario S48: Concurrent Idempotency & Duplicate Webhook Handling
- **Objective:** Verify that concurrent incoming webhook requests with identical idempotency keys are atomically deduplicated by the database index.
- **Preconditions:** S45 passed; `WebhookInbox` model connected.
- **Synthetic Input Data:**
  - Concurrent payload 1: `eventId: "EVT-TEST-IDEMP-001"`, `provider: "chatmitra"`, `payload: { text: "Hello" }`.
  - Concurrent payload 2: Exact identical `eventId: "EVT-TEST-IDEMP-001"` dispatched simultaneously via `Promise.all([insert1, insert2])`.
- **Exact Expected Result:**
  - Exactly one insert succeeds (`status: 'RECEIVED'`).
  - Exactly one insert fails with `E11000 duplicate key error collection: webhookinboxes index: eventId_1`.
  - Collection contains exactly 1 document with `eventId: "EVT-TEST-IDEMP-001"`.
- **Cleanup Plan:** `await WebhookInbox.deleteMany({ eventId: /^EVT-TEST-/ });`.
- **Evidence to Collect:** Promise results (1 fulfilled, 1 rejected with E11000), collection count.
- **Failure Criteria:** Race condition allowing both events to persist; double-credit event processing.
- **Security Risks:** Double outbound customer message or duplicate financial loan creation.

---

### Scenario S49: Atomic Worker Lease, Retry & Recovery
- **Objective:** Verify atomic acquisition of worker leases using `findOneAndUpdate` on `WebhookInbox`, lease timeout recovery, and completed task protection.
- **Preconditions:** S48 passed.
- **Synthetic Input Data:**
  - Event: `eventId: "EVT-TEST-LEASE-001"`, `status: "RECEIVED"`.
- **Exact Expected Result:**
  - Worker 1 executes `findOneAndUpdate({ eventId, status: 'RECEIVED' }, { status: 'PROCESSING', lockedAt: now })` -> Returns document (lease acquired).
  - Worker 2 executes identical lease acquisition -> Returns `null` (safely bypassed).
  - Simulate worker crash: lease expires (`lockedAt` set to 10 minutes ago).
  - Recovery worker queries `lockedAt < (now - 5min)` -> Successfully re-acquires lease.
  - Worker marks `status: 'COMPLETED'`.
  - Subsequent workers cannot acquire lease.
- **Cleanup Plan:** `await WebhookInbox.deleteMany({ eventId: /^EVT-TEST-LEASE/ });`.
- **Evidence to Collect:** Atomic state transition timestamps and lease lock IDs.
- **Failure Criteria:** Multiple workers acquiring lease simultaneously.
- **Security Risks:** Split-brain processing and message flooding.

---

### Scenario S50: Connection Interruption, Failure Handling & Isolation Rejection
- **Objective:** Verify graceful recovery from socket disconnection and immediate runtime termination if an unauthorized URI is injected into an active process.
- **Preconditions:** S45 passed.
- **Synthetic Input Data:**
  - Part 1: Simulate network drop (`mongoose.connection.close()`).
  - Part 2: Attempt injection of `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_test` into `connectToDatabase()`.
- **Exact Expected Result:**
  - Part 1: Application calls return `503 Service Unavailable` rather than crashing process; reconnects when database restored.
  - Part 2: `connectToDatabase({ uri: PROD_URI })` immediately rejects with `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD`. Zero network socket opened to production.
- **Cleanup Plan:** Restore connection to `avani_ai_crm_test`.
- **Evidence to Collect:** Error logs, readyState progression, rejection exception stack.
- **Failure Criteria:** Reconnect attempts hanging indefinitely; production URI accepted in test profile.
- **Security Risks:** Critical: Connecting to production cluster during test execution.
