# TASK 5F: SAME-CONNECTION IDENTITY AND PRODUCTION INDEX SAFETY
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 2026-11-18  
**Components:** `verifySameConnectionIdentity()` & `verifyIndexSafety()` in `src/lib/db.ts`

---

## 1. Same-Connection Identity Binding (`verifySameConnectionIdentity`)

### 1.1 Threat Model
In Node.js serverless functions (such as Vercel API routes), global caching of database connection handles can theoretically lead to connection reuse drift, where a socket established for one context is erroneously reused in another, or where an admin command targets a database other than the verified connection.

### 1.2 Implementation Details
`verifySameConnectionIdentity()` binds database operations to the exact verified connection:
```typescript
export function verifySameConnectionIdentity(
  conn: mongoose.Connection,
  expectedDbName: string,
  expectedClusterDomain?: string
): { verified: boolean; error?: string; code?: string } {
  if (!conn) {
    return { verified: false, error: "Connection is null or undefined", code: "CONNECTION_NULL" };
  }
  const actualDb = conn.name;
  if (actualDb !== expectedDbName) {
    return {
      verified: false,
      error: `Connected database name '${actualDb}' does not match expected '${expectedDbName}'`,
      code: "LIVE_DB_NAME_MISMATCH"
    };
  }
  if (expectedClusterDomain) {
    const host = (conn.host || '').toLowerCase();
    if (!host.includes(expectedClusterDomain.toLowerCase())) {
      return {
        verified: false,
        error: `Connected host '${host}' does not match expected domain '${expectedClusterDomain}'`,
        code: "IDENTITY_HOST_MISMATCH"
      };
    }
  }
  return { verified: true, code: "CONNECTION_BOUND" };
}
```

### 1.3 Test Verification
- **SEC-ID-01:** Matched connection database name (`avani_ai_crm_test`) and host $\rightarrow$ **`PASS` (`CONNECTION_BOUND`)**.
- **SEC-ID-02:** Mismatched connection database name (`avani_ai_crm_prod` when expecting test) $\rightarrow$ **`PASS` (Rejected with `LIVE_DB_NAME_MISMATCH`)**.

---

## 2. Production Index Safety (`verifyIndexSafety`)

### 2.1 The Peril of `Model.syncIndexes()`
Mongoose provides `syncIndexes()`, which automatically executes `dropIndex()` on any index in the live MongoDB collection that is not declared in the current application schema. In a production environment, this behavior is catastrophic:
- It causes collection-level locking or severe background I/O spikes.
- It destroys existing production unique constraints or indexes added during previous schema migrations.

### 2.2 Deep Index Comparison Algorithm
The `verifyIndexSafety()` helper performs a non-destructive schema-vs-database comparison:
1. Queries live indexes via `collection.indexes()`.
2. Inspects declared Mongoose schema indexes via `model.schema.indexes()`.
3. Reports missing indexes for administrative review without ever executing destructive drop operations.
4. Production connection options explicitly disable automatic index builds: `autoIndex: false` when `profile === 'PRODUCTION'`.

Full codebase audit confirms: **Zero calls to `syncIndexes()` exist anywhere in `3-AVANI AI CRM/src/`**.
