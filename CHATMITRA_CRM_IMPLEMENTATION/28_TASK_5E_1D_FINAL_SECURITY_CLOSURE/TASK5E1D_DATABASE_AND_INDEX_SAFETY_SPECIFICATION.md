# TASK 5E.1D — DATABASE & INDEX SAFETY SPECIFICATION
## STRICT BOUNDARIES FOR SYNTHETIC TESTING AND SCHEMA PARITY

**Date:** 17 November 2026

---

## 1. MANDATORY DATABASE BOUNDARIES

1. **Exclusive Target:** All non-production execution is locked to database `avani_ai_crm_test`.
2. **Production Denylist:** Target `avani_ai_crm_prod` is permanently rejected in non-production.
3. **Cluster Air-Gap:** Hostname `rhpn2gh.mongodb.net` is permanently rejected in non-production.
4. **No Production Data Ingestion:** Test databases must never receive exports or mongodump restores of production customer data. All records are 100% synthetic fixtures generated in-memory.
5. **No Destructive Database Drops:** `db.dropDatabase()` and `db.dropCollection()` are strictly forbidden in automated test suites. Cleanup is performed exclusively via targeted deletions matching synthetic prefixes (`test_task5a_*`).

---

## 2. INDEX SYNCHRONIZATION SAFEGUARDS FOR `Model.syncIndexes()`

`Model.syncIndexes()` is an administrative reconciliation method that creates declared indexes and drops undeclared indexes. To ensure it never compromises production:

1. **Pre-Execution Index Capture:**
   The test runner queries and records all existing indexes via `await collection.indexes()`.
2. **Execution Gate:**
   `syncIndexes()` may only execute if:
   - `activeVerifiedConnection` is confirmed.
   - Live database name is strictly `avani_ai_crm_test`.
   - Positive live topology verification has passed.
3. **Deep Definition Comparison:**
   Post-execution verification inspects the live indexes and asserts:
   - Exact key specifications: `{ providerMessageId: 1 }`, `{ idempotencyKey: 1, tenantId: 1 }`.
   - Exact unique flags: `unique: true` on idempotency and provider keys.
   - Exact TTL expiration values: `expireAfterSeconds: 86400` on telemetry.
4. **Zero Production Invocation:**
   `syncIndexes()` is never called in production server initialization or runtime request handlers.
