# TASK 5E.1D — SAME-CONNECTION IDENTITY ASSURANCE SPECIFICATION
## MATHEMATICAL BINDING BETWEEN PREFLIGHT EVALUATION AND TEST OPERATIONS

**Date:** 17 November 2026

---

## 1. PREVENTING CONNECTION POOL DIVERGENCE

In complex integration test suites, race conditions or improper lifecycle handling can cause an unverified second connection to be created (e.g. via global Mongoose fallback or secondary connection calls).

To guarantee that the connection performing database writes or index operations is **identically the same connection** that passed preflight and live topology verification, the test runner must enforce **Strict Connection Binding**:

```typescript
interface VerifiedTestConnection {
  connection: mongoose.Connection;
  preflight: DatabaseIsolationResult;
  authorizedNodes: Set<string>;
  verifiedAt: Date;
}

let activeVerifiedConnection: VerifiedTestConnection | null = null;
```

---

## 2. ENFORCEMENT RULES FOR TEST WRITES AND INDEX OPERATIONS

Before any call to `Model.create()`, `Model.syncIndexes()`, or document persistence:

1. **Active Identity Check:**
   ```javascript
   assert.notStrictEqual(activeVerifiedConnection, null, "FATAL: No verified connection active.");
   assert.strictEqual(model.db.id, activeVerifiedConnection.connection.id, "FATAL: Model is bound to an unverified connection instance!");
   ```
2. **Database Name Binding:**
   ```javascript
   assert.strictEqual(model.db.name, 'avani_ai_crm_test', "FATAL: Model database is not avani_ai_crm_test!");
   ```
3. **Live Socket Verification:**
   ```javascript
   assert.strictEqual(activeVerifiedConnection.connection.readyState, 1, "FATAL: Connection dropped or inactive.");
   ```
4. **Re-Verification on Reconnect:**
   If the connection experiences a disconnect/reconnect cycle (Test 4.6), the full live topology reconciliation must be re-executed before any subsequent write operations are permitted.
