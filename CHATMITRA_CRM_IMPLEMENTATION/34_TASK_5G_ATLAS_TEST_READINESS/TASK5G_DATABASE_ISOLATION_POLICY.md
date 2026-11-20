# TASK 5G — DATABASE ISOLATION POLICY SPECIFICATION
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Role:** Senior Application Security Engineer & Systems Architect  
**Status:** **AUTHORITATIVE REPOSITORY POLICY**

---

## 1. Overview & Policy Objective

This policy defines the cryptographic, architectural, and operational rules governing database connection isolation for AVANI AI CRM. It establishes the mandatory behavior required across production, preview, local development, and automated test execution environments.

---

## 2. Mutually Exclusive Runtime Profiles & Precedence

The application determines its execution profile via `classifyRuntimeEnvironment(vercelEnv, appMode, nodeEnv)`:

```
                      ┌───────────────────────────────────────┐
                      │    Read Environment Indicators:       │
                      │ VERCEL_ENV, APP_MODE, NODE_ENV        │
                      └──────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
     VERCEL_ENV === 'production'                    VERCEL_ENV !== 'production'
                 │                                               │
     ┌───────────┴───────────┐                       ┌───────────┴───────────┐
     │                       │                       │                       │
APP_MODE === 'prod'     APP_MODE !== 'prod'      APP_MODE or NODE_ENV    VERCEL_ENV === 'preview'
NODE_ENV === 'prod'     or NODE_ENV !== 'prod'   === 'production'        Dev/Test flags valid
     │                       │                       │                       │
     ▼                       ▼                       ▼                       ▼
 PRODUCTION              FAIL CLOSED             FAIL CLOSED          VERCEL_PREVIEW
 (rhpn2gh exclusively)   (UNKNOWN_OR_INVALID)    (Contamination)      (avani_ai_crm_test)
```

---

## 3. Policy Matrix: Runtime vs Host vs Database

| Profile | Allowed Cluster Host(s) | Allowed Database Name | Disallowed Operations |
| :--- | :--- | :--- | :--- |
| **`PRODUCTION`** | `rhpn2gh.mongodb.net` (and primary/secondary shard members) | `avani_ai_crm_prod` exclusively | Any connection to localhost, test clusters, or targeting `avani_ai_crm_test`. Any execution of `autoIndex: true`. |
| **`VERCEL_PREVIEW`**| Approved `MONGODB_TEST_CLUSTER_DOMAIN` or loopback | `avani_ai_crm_test` exclusively | Any connection to `rhpn2gh.mongodb.net`. Any targeting of `avani_ai_crm_prod` or preview DBs. |
| **`LOCAL_DEVELOPMENT`**| Approved `MONGODB_TEST_CLUSTER_DOMAIN` or loopback (`localhost`, `127.0.0.1`, `[::1]`) | `avani_ai_crm_test` exclusively | Any connection to `rhpn2gh.mongodb.net`. Any targeting of `avani_ai_crm_prod`. |
| **`AUTOMATED_TESTS`**| Approved `MONGODB_TEST_CLUSTER_DOMAIN` or loopback (`localhost`, `127.0.0.1`, `[::1]`) | `avani_ai_crm_test` exclusively | Any connection to `rhpn2gh.mongodb.net`. Any targeting of `avani_ai_crm_prod`. |
| **`UNKNOWN_OR_INVALID`**| **NONE** | **NONE** | **ALL CONNECTIONS BLOCKED (Fails Closed)** |

---

## 4. Reconnection & Topology Drift Policy

1. **Active Socket Re-Validation:**  
   In the event of network disruption, MongoDB Atlas replica set failover, or driver reconnection, the Mongoose connection listener (`connection.on('reconnect')`) immediately executes `verifySameConnectionIdentity()`.
2. **Immediate Cache Purge on Mismatch:**  
   If a reconnected socket is found to have changed database name or cluster host, the cached connection is instantly cleared (`cached.conn = null; cached.promise = null;`), logging a critical security alert.
3. **No Cross-Profile Connection Sharing:**  
   If the target URI or target database name differs from the cached connection, the connection cache is automatically discarded before establishing a new socket.

---

## 5. Violation Response & Escalation Protocol

Whenever a database isolation violation is detected by the application:
1. **Immediate Socket Severance:** Any open socket is immediately terminated via `await m.connection.close()`.
2. **Exception Raised:** A structured `DatabaseIsolationError` is instantiated with the specific violation code (e.g. `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD`, `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME`, `LIVE_DB_NAME_MISMATCH`).
3. **Audit Logging:** The violation details (attempted URI, target host, profile) are written to stderr.
4. **Operations Alert:** An automated webhook alert is dispatched to operations if Slack channels are configured.
