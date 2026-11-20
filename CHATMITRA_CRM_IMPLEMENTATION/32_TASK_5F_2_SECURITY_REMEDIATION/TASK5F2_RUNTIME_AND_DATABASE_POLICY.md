# TASK 5F.2 — RUNTIME CLASSIFICATION & DATABASE ISOLATION POLICY
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Auditor:** Senior Application Security Engineer & Systems Architect  
**Status:** **AUTHORITATIVE POLICY SPECIFICATION**  
**Component:** `src/lib/db.ts`

---

## 1. Executive Summary & Policy Scope

This document specifies the authoritative runtime classification rules, environment variable precedence, and database naming constraints governing AVANI AI CRM.

Per the Owner Acceptance Decision:
1. **Finding F-04 Database Policy Decision:** `avani_ai_crm_test` remains the **sole approved non-production database name**. No preview-specific database names (e.g. `avani_ai_crm_preview`) are permitted.
2. Any non-production environment attempting to target `avani_ai_crm_prod` or any database other than `avani_ai_crm_test` is strictly blocked.
3. Production runtime is strictly bound to `rhpn2gh.mongodb.net` and `avani_ai_crm_prod`.

---

## 2. Five Mutually Exclusive Runtime Profiles

Every application process is classified into exactly one of five distinct runtime profiles:

| Runtime Profile | Classification Criteria | Permitted Cluster Host | Permitted Database |
| :--- | :--- | :--- | :--- |
| **`PRODUCTION`** | `VERCEL_ENV=production` AND `APP_MODE=production` AND `NODE_ENV=production` (or empty) | `rhpn2gh.mongodb.net` (and replica set members) | `avani_ai_crm_prod` exclusively |
| **`VERCEL_PREVIEW`** | `VERCEL_ENV=preview` AND `APP_MODE` in (`preview`, `development`, `test`, `dev`, `""`) AND `NODE_ENV` in (`development`, `test`, `dev`, `""`) | Approved `MONGODB_TEST_CLUSTER_DOMAIN` or loopback | `avani_ai_crm_test` exclusively |
| **`LOCAL_DEVELOPMENT`** | (`VERCEL_ENV=""` or `local`) AND `APP_MODE` in (`development`, `local`) AND `NODE_ENV` in (`development`, `""`) | Approved `MONGODB_TEST_CLUSTER_DOMAIN` or loopback (`localhost`, `127.0.0.1`, `[::1]`) | `avani_ai_crm_test` exclusively |
| **`AUTOMATED_TESTS`** | (`VERCEL_ENV=""` or `local`) AND `APP_MODE=test` (or `NODE_ENV=test`) | Approved `MONGODB_TEST_CLUSTER_DOMAIN` or loopback (`localhost`, `127.0.0.1`, `[::1]`) | `avani_ai_crm_test` exclusively |
| **`UNKNOWN_OR_INVALID`** | Any missing, unrecognized, or conflicting combination | **NONE (Fails Closed)** | **NONE (Fails Closed)** |

---

## 3. Zero-Trust Contamination Protection Rules

1. **Production Claim in Non-Production Vercel:**  
   If `VERCEL_ENV !== 'production'` (e.g. `preview`, `local`, or unset) but `APP_MODE=production` or `NODE_ENV=production`, the system treats this as runtime contamination and immediately resolves to `UNKNOWN_OR_INVALID` (Scenarios S12, S13, S21).
2. **Conflicting Production Flags:**  
   If `VERCEL_ENV=production` but `APP_MODE=dev` or `NODE_ENV=dev`, the runtime fails closed as `UNKNOWN_OR_INVALID` (Scenarios S08, S10).
3. **Missing Environment Indicators:**  
   If all runtime indicators are empty or whitespace, the system fails closed as `UNKNOWN_OR_INVALID` (Scenarios S07, S16).

---

## 4. Database Name Binding Policy

### Production Runtime Rules:
- If `dbName === 'avani_ai_crm_test'` or contains `test` -> **BLOCKED** (`TEST_DATABASE_FORBIDDEN_IN_PROD`, Scenario S27).
- If `dbName !== 'avani_ai_crm_prod'` -> **BLOCKED** (`INVALID_PRODUCTION_DATABASE_NAME`, Scenario S28).
- If target host is loopback or non-prod -> **BLOCKED** (`UNAUTHORIZED_PRODUCTION_CLUSTER_HOSTNAME`, Scenario S29).

### Non-Production Runtime Rules:
- If target host matches `rhpn2gh.mongodb.net` or ends with `.rhpn2gh.mongodb.net` -> **BLOCKED** (`PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD`, Scenarios S30, S31, S32).
- If `dbName === 'avani_ai_crm_prod'` or contains `prod` -> **BLOCKED** (`PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD`, Scenario S30).
- If `dbName !== 'avani_ai_crm_test'` -> **BLOCKED** (`TARGET_DATABASE_NOT_TEST`).
- If target host does not match loopback or `MONGODB_TEST_CLUSTER_DOMAIN` -> **BLOCKED** (`UNAUTHORIZED_TEST_CLUSTER_HOSTNAME`, Scenario S38).

---

## 5. Mathematical Proof of Isolation

The Task 5E defect (`evaluateDatabaseIsolation` allowing test database on production host `rhpn2gh.mongodb.net`) is proven impossible:

```typescript
// Non-Production Execution Profiles:
const hasProdHost = cleanHosts.some(h => h === PROD_CLUSTER_HOST || h.endsWith('.' + PROD_CLUSTER_HOST));
if (hasProdHost) {
  return {
    allowed: false,
    runtimeProfile: profile,
    dbName,
    hostname: primaryHost,
    hostnames: cleanHosts,
    error: `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD: Non-production environment cannot connect to production cluster ${PROD_CLUSTER_HOST}.`,
    code: "PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD"
  };
}
```

Because `hasProdHost` check occurs **before** any database name check, under no circumstances can a non-production runtime connect to `rhpn2gh.mongodb.net`, regardless of whether the database name is `avani_ai_crm_test`, `test`, or any other string.
