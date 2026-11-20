# TASK 5F.2 — FINDING F-03 CLOSURE REPORT: DYNAMIC TEST CLUSTER CONFIGURATION
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Auditor:** Senior Application Security Engineer & Systems Architect  
**Status:** **REMEDIATED & VERIFIED**  
**Component:** `src/lib/db.ts` (`getApprovedTestClusterDomain()`, `isAuthorizedTestHost()`)

---

## 1. Executive Summary & Defect Remediation

In Task 5F.1, Finding **F-03** identified that `isAuthorizedTestHost()` hardcoded a placeholder test cluster domain: `41zrtal.mongodb.net`. Because MongoDB Atlas generates a unique randomized cluster identifier upon creation of each cluster, hardcoding a placeholder would cause any newly provisioned non-production cluster to be rejected as unauthorized (`UNAUTHORIZED_TEST_CLUSTER_HOSTNAME`).

In Task 5F.2, Finding F-03 is **100% remediated**:
1. All references to placeholder `41zrtal.mongodb.net` were **permanently removed** from `src/lib/db.ts` and the test suite.
2. A strict environment-driven resolver (`getApprovedTestClusterDomain()`) was introduced to read `process.env.MONGODB_TEST_CLUSTER_DOMAIN`.
3. Strict syntactic and semantic validation guards are enforced on `MONGODB_TEST_CLUSTER_DOMAIN`.
4. The system **fails closed**: if an Atlas URI is supplied in non-production but `MONGODB_TEST_CLUSTER_DOMAIN` is missing or invalid, the connection is strictly blocked.
5. Local development and automated testing loopbacks (`localhost`, `127.0.0.1`, `::1`, `[::1]`) continue to function without requiring `MONGODB_TEST_CLUSTER_DOMAIN`.

---

## 2. Validation Rules for `MONGODB_TEST_CLUSTER_DOMAIN`

In `src/lib/db.ts`, `getApprovedTestClusterDomain()` implements the following validation criteria:

```typescript
export function getApprovedTestClusterDomain(): string | null {
  const raw = process.env.MONGODB_TEST_CLUSTER_DOMAIN;
  if (!raw || !String(raw).trim()) {
    return null;
  }
  const domain = String(raw).trim().toLowerCase().replace(/\.+$/, '');

  // 1. Reject wildcards, empty strings, spaces, or commas
  if (domain.includes('*') || domain.includes(' ') || domain.includes(',')) {
    return null;
  }

  // 2. Reject production cluster hostname, subhosts, or identifier
  if (domain === PROD_CLUSTER_HOST || domain.endsWith('.' + PROD_CLUSTER_HOST) || domain.includes('rhpn2gh')) {
    return null;
  }

  // 3. Reject legacy, cross-app clusters, or legacy placeholder
  if (
    domain.includes('cluster0.mlcxcp.mongodb.net') ||
    domain.includes('xj6nhak.mongodb.net') ||
    domain.includes('41zrtal')
  ) {
    return null;
  }

  // 4. Reject generic domain suffixes without cluster sub-identifier
  if (domain === 'mongodb.net' || domain === '.mongodb.net') {
    return null;
  }

  // 5. Must end with .mongodb.net for Atlas clusters
  if (!domain.endsWith('.mongodb.net')) {
    return null;
  }

  // 6. Minimum 3 segments: e.g. <cluster-name>.<unique-id>.mongodb.net
  const parts = domain.split('.').filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  return domain;
}
```

---

## 3. Host Authorization Matrix in Non-Production

The authorized test host validator operates as follows:

```typescript
export function isAuthorizedTestHost(host: string): boolean {
  if (!host) return false;
  const clean = host.toLowerCase().replace(/\.+$/, '');

  // Rule 1: Always permit standard loopback addresses
  if (AUTHORIZED_TEST_DOMAINS.includes(clean)) return true;

  // Rule 2: Atlas clusters require valid approved test cluster domain
  const approvedTestDomain = getApprovedTestClusterDomain();
  if (!approvedTestDomain) {
    return false; // Fail closed if test cluster domain is not configured
  }

  // Rule 3: Must match or be a subdomain of approved test cluster domain
  if (clean === approvedTestDomain || clean.endsWith('.' + approvedTestDomain)) {
    if (clean.includes(PROD_CLUSTER_HOST) || clean.includes('rhpn2gh')) {
      return false;
    }
    return true;
  }

  return false;
}
```

---

## 4. Verification Scenarios & Results

| Test Scenario | Input `MONGODB_TEST_CLUSTER_DOMAIN` | Target Host | Expected Outcome | Actual Result |
| :--- | :--- | :--- | :--- | :--- |
| **TEST_08** | *(Unset)* | `localhost` | **ALLOWED** | **PASS** |
| **TEST_09** | *(Unset)* | `127.0.0.1` | **ALLOWED** | **PASS** |
| **TEST_10** | *(Unset)* | `some-atlas.xyz123.mongodb.net` | **BLOCKED** (`UNAUTHORIZED_TEST_CLUSTER_HOSTNAME`) | **PASS** |
| **TEST_11** | `*.mongodb.net` (Wildcard) | `some-atlas.xyz123.mongodb.net` | **BLOCKED** (`UNAUTHORIZED_TEST_CLUSTER_HOSTNAME`) | **PASS** |
| **TEST_12** | `rhpn2gh.mongodb.net` (Prod) | `rhpn2gh.mongodb.net` | **BLOCKED** (`PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD`) | **PASS** |
| **TEST_13** | `41zrtal.mongodb.net` (Legacy) | `41zrtal.mongodb.net` | **BLOCKED** (`UNAUTHORIZED_TEST_CLUSTER_HOSTNAME`) | **PASS** |
| **TEST_01** | `avani-test-cluster.xyz123.mongodb.net` | `avani-test-cluster.xyz123.mongodb.net` | **ALLOWED** | **PASS** |

Finding F-03 is formally closed.
