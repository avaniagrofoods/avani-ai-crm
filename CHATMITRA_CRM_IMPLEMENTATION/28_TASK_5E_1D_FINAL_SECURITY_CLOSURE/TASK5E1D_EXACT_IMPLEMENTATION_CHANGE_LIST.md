# TASK 5E.1D — EXACT IMPLEMENTATION CHANGE LIST
## SPECIFICATION FOR MINIMAL SURGICAL MODIFICATIONS (PENDING APPROVAL)

**Status:** PROPOSED SPECIFICATION ONLY (ZERO SOURCE CODE MODIFICATIONS PERFORMED)  
**Date:** 17 November 2026

---

## 1. TARGET FILES & SCOPE RESTRAINT

In strict adherence to the minimal change directive:
- Exactly 3 files are identified.
- Zero unrelated files, packages, or architectural layers are modified.

| File Path | Nature of Change | Lines Affected | Security Purpose | Live DB Required? |
|---|---|---|---|---|
| `3-AVANI AI CRM/src/lib/db.ts` | **Modify** | ~65 lines modified | Implement pre-sanitized `MongoClient` parser, 5-profile classifier without `Any`, and exact allowlists. | NO (Pure code logic) |
| `3-AVANI AI CRM/tests/test_database_isolation_hardening.test.cjs` | **Create** | ~280 lines (new test) | Implement the 50-scenario regression suite to mathematically prove zero regression. | NO (Unit scenarios S01–S44); YES (Scenarios S45–S50) |
| `3-AVANI AI CRM/tests/test_task5a_mongodb_integration.test.cjs` | **Update** | ~35 lines modified | Bind live connection identity and deep index verification before running Category 4 tests. | YES (Runs against test cluster) |

---

## 2. DETAILED DIFF SPECIFICATION FOR `src/lib/db.ts`

```diff
--- a/src/lib/db.ts
+++ b/src/lib/db.ts
@@ -1,4 +1,5 @@
 import mongoose from "mongoose";
+import { MongoClient } from "mongodb";
 import { sendSlackAlert } from "./alerts";
 
@@ -16,6 +17,21 @@ export interface DatabaseIsolationResult {
   allowed: boolean;
   dbName?: string;
   error?: string;
   code?: string;
   hostname?: string;
+  profile?: string;
+  hosts?: string[];
+  isSrv?: boolean;
 }
+
+export enum RuntimeProfile {
+  PRODUCTION = 'PRODUCTION',
+  VERCEL_PREVIEW = 'VERCEL_PREVIEW',
+  LOCAL_DEVELOPMENT = 'LOCAL_DEVELOPMENT',
+  AUTOMATED_TESTS = 'AUTOMATED_TESTS',
+  UNKNOWN_OR_INVALID = 'UNKNOWN_OR_INVALID'
+}
+
+export const AUTHORIZED_PRODUCTION_HOSTNAMES = new Set<string>(['rhpn2gh.mongodb.net']);
+export const AUTHORIZED_TEST_HOSTNAMES = new Set<string>(['127.0.0.1', 'localhost', '::1']);
@@ -46,12 +62,37 @@ export function evaluateDatabaseIsolation(
   let appMode = String(appModeInput ?? process.env.APP_MODE ?? '').trim().toLowerCase();
   const providerMode = String(providerModeInput ?? process.env.PROVIDER_MODE ?? 'mock').trim().toLowerCase();
   const vercelEnv = String(vercelEnvInput ?? process.env.VERCEL_ENV ?? '').trim().toLowerCase();
   const liveTestAuth = String(liveTestAuthInput ?? process.env.LIVE_TEST_AUTHORIZATION ?? 'false').trim().toLowerCase();
+  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase();
 
-  if (!appMode) {
-    appMode = (process.env.NODE_ENV === 'production' && vercelEnv === 'production') ? 'production' : 'development';
-  }
+  // Step 1: Zero-Trust Mutually Exclusive Runtime Classification (No "Any" Fallbacks)
+  let profile = RuntimeProfile.UNKNOWN_OR_INVALID;
+  const isProdEnv = vercelEnv === 'production';
+  const isProdMode = appMode === 'production';
+  const isProdNode = nodeEnv === 'production';
+
+  if (isProdEnv || isProdMode || isProdNode) {
+    // Production must be strictly aligned across all indicators
+    if (isProdEnv && isProdMode && (nodeEnv === 'production' || nodeEnv === '')) {
+      profile = RuntimeProfile.PRODUCTION;
+    } else {
+      profile = RuntimeProfile.UNKNOWN_OR_INVALID;
+    }
+  } else if (vercelEnv === 'preview') {
+    const validPreviewModes = new Set(['preview', 'development', 'test', '']);
+    const validPreviewNodes = new Set(['development', 'test', '']);
+    profile = (validPreviewModes.has(appMode) && validPreviewNodes.has(nodeEnv))
+      ? RuntimeProfile.VERCEL_PREVIEW
+      : RuntimeProfile.UNKNOWN_OR_INVALID;
+  } else if (vercelEnv === '' || vercelEnv === 'local') {
+    if (appMode === 'test' || nodeEnv === 'test') {
+      profile = (appMode === '' || appMode === 'test') ? RuntimeProfile.AUTOMATED_TESTS : RuntimeProfile.UNKNOWN_OR_INVALID;
+    } else if (appMode === 'development' || appMode === 'local' || nodeEnv === 'development') {
+      profile = (appMode === '' || appMode === 'development' || appMode === 'local') ? RuntimeProfile.LOCAL_DEVELOPMENT : RuntimeProfile.UNKNOWN_OR_INVALID;
+    } else {
+      profile = RuntimeProfile.UNKNOWN_OR_INVALID;
+    }
+  }
+
+  if (profile === RuntimeProfile.UNKNOWN_OR_INVALID) {
+    return { allowed: false, error: "INVALID_OR_UNKNOWN_RUNTIME_PROFILE: Execution environment is unapproved, missing, or conflicting.", code: "INVALID_OR_UNKNOWN_RUNTIME_PROFILE", profile };
+  }
@@ -67,5 +108,36 @@ export function evaluateDatabaseIsolation(
-  const hostname = (parsed.hostname || '').toLowerCase();
+  // Step 2: Pre-sanitize authority to reject multiple @ characters
+  const schemeEnd = uri.indexOf('://');
+  if (schemeEnd === -1) {
+    return { allowed: false, error: "URI_MALFORMED", code: "URI_MALFORMED", profile };
+  }
+  const afterScheme = uri.slice(schemeEnd + 3);
+  const pathStart = afterScheme.search(/[/?]/);
+  const authority = pathStart !== -1 ? afterScheme.slice(0, pathStart) : afterScheme;
+  if ((authority.match(/@/g) || []).length > 1) {
+    return { allowed: false, error: "URI_MALFORMED: Multiple @ characters detected in authority", code: "URI_MALFORMED", profile };
+  }
+
+  // Step 3: In-Memory Driver Parsing (Zero Network)
+  let client: MongoClient;
+  try {
+    client = new MongoClient(uri);
+  } catch (err: any) {
+    return { allowed: false, error: `MALFORMED_URI: ${err.message}`, code: "URI_MALFORMED", profile };
+  }
+  const isSrv = Boolean(client.options.srvHost);
+  const dbName = client.options.dbName;
+  if (!dbName) {
+    return { allowed: false, error: "MISSING_DATABASE_NAME", code: "MISSING_DATABASE_NAME", profile };
+  }
+  const hosts = isSrv
+    ? [client.options.srvHost.toLowerCase().trim().replace(/\.+$/, '')]
+    : client.options.hosts.map(h => (h.host || '').toLowerCase().trim().replace(/\.+$/, '')).filter(Boolean);
+  if (hosts.length === 0) {
+    return { allowed: false, error: "EMPTY_HOST_LIST", code: "URI_MALFORMED", profile };
+  }
```
