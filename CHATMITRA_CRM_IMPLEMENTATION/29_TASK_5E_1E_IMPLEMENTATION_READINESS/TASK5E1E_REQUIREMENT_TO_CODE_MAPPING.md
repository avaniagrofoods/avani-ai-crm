# TASK 5E.1E: REQUIREMENT TO CODE MAPPING SPECIFICATION
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 2026-11-17  
**Status:** APPROVED ARCHITECTURAL BLUEPRINT  
**Target:** Implementation of Task 5E.1D Specification in `src/lib/db.ts`

---

## 1. Traceability Architecture Matrix

| Specification Requirement (Task 5E.1D) | Target Function in `src/lib/db.ts` | Lines / Scope | Purpose & Verification |
| :--- | :--- | :--- | :--- |
| **Req 1: 42-Row Runtime Classification** | `classifyRuntimeEnvironment()` | Helper (lines 40–95) | Strictly maps (`VERCEL_ENV`, `APP_MODE`, `NODE_ENV`) to 4 mutually exclusive profiles; fails closed with `UNKNOWN_OR_INVALID`. |
| **Req 2: Authority Sanitization** | `parseAndSanitizeConnectionUri(uri)` | Helper (lines 97–135) | Checks `(uri.match(/@/g) || []).length === 1`; catches unencoded `@` authority smuggling before driver parser. |
| **Req 3: Multi-Host URI Extraction** | `extractHostnamesFromUri(uri)` | Helper (lines 137–170) | Uses `new MongoClient(uri).options` to extract SRV parent or individual replica set seeds without network activity. |
| **Req 4: Hostname Allow/Denylist** | `validateClusterHostnames(hosts, profile)` | Helper (lines 172–205) | Verifies hostnames against approved test cluster domain; rejects `rhpn2gh.mongodb.net` in non-prod. |
| **Req 5: Database Whitelist/Denylist** | `validateDatabaseName(dbName, profile)` | Helper (lines 207–235) | Enforces `avani_ai_crm` (prod) vs `avani_ai_crm_test` / `avani_ai_crm_preview` (non-prod); denylists all others. |
| **Req 6: Isolation Preflight Orchestrator** | `evaluateDatabaseIsolation(options?)` | Exported Function (lines 237–290) | Runs Reqs 1–5 in sequence; returns structured `EvaluationResult` or throws `DB_ISOLATION_ERROR`. |
| **Req 7: Pre-Connection DNS-SRV Validation** | `verifySrvDnsTopology(srvHost, profile)` | Async Helper (lines 292–330) | Resolves `_mongodb._tcp.<srvHost>` via `dns.promises.resolveSrv`; validates all target node domains. |
| **Req 8: Post-Connection Live Topology Check**| `verifyPostConnectionTopology(client, profile)` | Async Helper (lines 332–365) | Inspects `client.topology.description.servers`; verifies live socket addresses match authorized cluster. |
| **Req 9: Three-Way Identity Binding** | `verifySameConnectionIdentity(conn, client)` | Helper (lines 367–395) | Reconciles Mongoose `connection.host`/`port`/`name` against driver `topology`. |
| **Req 10: Production Index Safety** | `verifyIndexSafety(model, conn)` | Helper (lines 397–440) | Performs deep schema-vs-database index diff; blocks `syncIndexes()` or destructive drops in production. |

---

## 2. Target Function Signatures & Type Definitions

```typescript
export type RuntimeProfile = 
  | 'PRODUCTION'
  | 'VERCEL_PREVIEW'
  | 'LOCAL_DEVELOPMENT'
  | 'AUTOMATED_TESTS'
  | 'UNKNOWN_OR_INVALID';

export interface EvaluationResult {
  allowed: boolean;
  runtimeProfile: RuntimeProfile;
  databaseName: string;
  hostnames: string[];
  isSrv: boolean;
  srvHost?: string;
  error?: string;
  errorCode?: string;
}

export class DatabaseIsolationError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(`[DATABASE_ISOLATION_ERROR:${code}] ${message}`);
    this.name = 'DatabaseIsolationError';
    this.code = code;
    this.details = details;
  }
}
```

---

## 3. Backward Compatibility Assurances
- **Public API:** `connectToDatabase()`, `ensureDatabaseConnection()`, `getDatabase()`, and `evaluateDatabaseIsolation()` remain 100% backward compatible.
- **Return Types:** Existing callers expecting `Promise<typeof mongoose>` or `Promise<Connection>` receive identical types.
- **Fail-Safe Mechanism:** In the event of an isolation violation, a detailed `DatabaseIsolationError` is thrown, preventing any socket connection from opening.
