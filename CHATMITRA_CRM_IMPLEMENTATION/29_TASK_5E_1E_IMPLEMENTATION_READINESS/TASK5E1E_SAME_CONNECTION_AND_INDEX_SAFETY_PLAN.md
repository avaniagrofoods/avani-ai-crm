# TASK 5E.1E: SAME-CONNECTION AND INDEX SAFETY IMPLEMENTATION PLAN
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 2026-11-17  
**Status:** APPROVED ARCHITECTURAL PLAN  
**Components:** Three-Way Identity Binding, Production Index Safeguards

---

## 1. Three-Way Same-Connection Identity Binding (`verifySameConnectionIdentity`)

### 1.1 The Threat of Cross-Database / Cross-Socket Drift
In a Node.js serverless/microservices architecture, connection reuse or improper cache keying can lead to:
- A connection opened to the test database being reused for a production route.
- An admin command or collection handle being acquired from a different socket than the verified connection.

### 1.2 The Three-Way Verification Algorithm
Immediately upon acquiring `mongoose.connection`:
```typescript
export function verifySameConnectionIdentity(
  conn: mongoose.Connection,
  expectedDbName: string,
  expectedClusterDomain: string
): void {
  // 1. Mongoose Connection Layer
  const actualDbName = conn.name;
  const actualHost = conn.host;
  const actualPort = conn.port;

  // 2. Underlying Native MongoClient Layer
  const nativeClient = conn.getClient();
  const topologyServers = Array.from(nativeClient.topology?.description?.servers?.keys() || []);

  // Check 1: Database name parity
  if (actualDbName !== expectedDbName) {
    throw new DatabaseIsolationError(
      'IDENTITY_DB_NAME_MISMATCH',
      `Connection DB name '${actualDbName}' does not match expected '${expectedDbName}'`,
      { actualDbName, expectedDbName }
    );
  }

  // Check 2: Host / Topology domain parity
  for (const srv of topologyServers) {
    if (!srv.toLowerCase().includes(expectedClusterDomain.toLowerCase())) {
      throw new DatabaseIsolationError(
        'IDENTITY_HOST_MISMATCH',
        `Connected server '${srv}' does not match expected cluster domain '${expectedClusterDomain}'`,
        { srv, expectedClusterDomain }
      );
    }
  }
}
```

---

## 2. Production Index Safety Plan (`verifyIndexSafety`)

### 2.1 The Peril of `Model.syncIndexes()`
Mongoose's `syncIndexes()` method compares the current Mongoose schema against the database indexes and **drops any index present in the database that is not in the schema**. In a production environment:
- Dropping an index locks collections (or consumes substantial background I/O).
- Dropping compound unique indexes breaks production data integrity constraints.
- Any discrepancy between deployed code version and active database indexes leads to catastrophic, irreversible index drops.

### 2.2 Deep Index Comparison Algorithm
Instead of `syncIndexes()`, a non-destructive verification tool is implemented:
1. **Query Existing Indexes:** `collection.indexes()` retrieves existing index specifications.
2. **Extract Schema Indexes:** `model.schema.indexes()` computes desired schema indexes.
3. **Deep Property Diff:**
   - Compare index key patterns (e.g. `{ leadId: 1, createdAt: -1 }`).
   - Compare index options: `unique`, `sparse`, `expireAfterSeconds` (TTL).
4. **Enforcement Rules:**
   - In `PRODUCTION`: If missing indexes exist, log a non-fatal warning alerting operations. **NEVER DROP** extraneous indexes automatically.
   - In `AUTOMATED_TESTS` / `LOCAL_DEVELOPMENT`: Create missing indexes safely using `createIndexes()`.

### 2.3 Codebase Verification
Full workspace audit confirms: **Zero calls to `syncIndexes()` exist anywhere in `3-AVANI AI CRM/src/`**.
