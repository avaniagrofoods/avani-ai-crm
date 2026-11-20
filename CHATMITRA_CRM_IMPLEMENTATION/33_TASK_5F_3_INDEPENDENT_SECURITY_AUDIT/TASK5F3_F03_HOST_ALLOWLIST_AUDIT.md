# TASK 5F.3 — FINDING F-03 AUDIT: HOST ALLOWLIST & TEST CLUSTER CONFIGURATION
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Auditor:** Senior Application Security Auditor & Systems Architect  
**Component:** `3-AVANI AI CRM/src/lib/db.ts` (`getApprovedTestClusterDomain()`, `isAuthorizedTestHost()`)  
**Finding Status:** **REMEDIATED & VERIFIED CLOSED**

---

## 1. Finding F-03 Background & Audit Objective

Finding **F-03** (raised in Task 5F.1) identified that `src/lib/db.ts` hardcoded the placeholder test cluster domain `41zrtal.mongodb.net`. When a real MongoDB Atlas test cluster is provisioned, its randomized cluster ID will differ from `41zrtal`, causing all test connections to be rejected as unauthorized.

The audit objective is to independently inspect:
1. Eradication of hardcoded `41zrtal.mongodb.net`.
2. Validation of `MONGODB_TEST_CLUSTER_DOMAIN` environment variable.
3. Behavior when unset, empty, or whitespace (fail-closed for Atlas, allowed for loopback).
4. Prevention of wildcard, production (`rhpn2gh`), legacy, and spoofed domains.
5. Loopback isolation (`localhost`, `127.0.0.1`, `::1`, `[::1]`).

---

## 2. Line-by-Line Code Inspection

In `src/lib/db.ts` (lines 59–92):
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

  // 3. Reject legacy or cross-app cluster or legacy placeholder
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

In `src/lib/db.ts` (lines 97–116):
```typescript
export function isAuthorizedTestHost(host: string): boolean {
  if (!host) return false;
  const clean = host.toLowerCase().replace(/\.+$/, '');

  if (AUTHORIZED_TEST_DOMAINS.includes(clean)) return true;

  const approvedTestDomain = getApprovedTestClusterDomain();
  if (!approvedTestDomain) {
    return false; // Fail closed if test cluster domain is not configured
  }

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

## 3. Threat Vector Analysis & Mitigation

| Attack / Misconfiguration Vector | Validation Rule Enforced | Auditor Test Evidence | Result |
| :--- | :--- | :--- | :--- |
| **Unset `MONGODB_TEST_CLUSTER_DOMAIN` with Atlas URI** | `!raw -> return null; !approvedTestDomain -> return false;` | `TEST_10` in test suite | **BLOCKED (Fail-Closed)** |
| **Empty or Whitespace Value** | `!String(raw).trim() -> return null;` | Unit assertion | **BLOCKED (Fail-Closed)** |
| **Wildcard Domain Injection (`*.mongodb.net`)** | `domain.includes('*') -> return null;` | `TEST_11` in test suite | **BLOCKED** |
| **Production Domain Injection (`rhpn2gh.mongodb.net`)** | `domain.includes('rhpn2gh') -> return null;` | `TEST_12` in test suite | **BLOCKED** |
| **Legacy Placeholder Injection (`41zrtal.mongodb.net`)** | `domain.includes('41zrtal') -> return null;` | `TEST_13` in test suite | **BLOCKED** |
| **Subdomain Prefix Spoof (`attacker-rhpn2gh.mongodb.net`)** | `clean === approvedTestDomain \|\| clean.endsWith('.' + approvedTestDomain)` | Scenario `S41` in test suite | **BLOCKED** |
| **Domain Suffix Spoof (`rhpn2gh.mongodb.net.attacker.com`)** | Must end with `.mongodb.net` | Scenario `S42` in test suite | **BLOCKED** |
| **Multi-Host Seed Poisoning (Mixed Prod/Test)** | Every host in seed list checked individually | Scenario `S37` in test suite | **BLOCKED** |
| **Localhost / Loopback Authorization** | `AUTHORIZED_TEST_DOMAINS.includes(clean)` | `TEST_08`, `TEST_09`, `S33`, `S34`, `S35` | **ALLOWED (Safely Scoped)** |

---

## 4. Loopback Scope Verification

The `AUTHORIZED_TEST_DOMAINS` array is defined at line 48 of `src/lib/db.ts`:
```typescript
export const AUTHORIZED_TEST_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]'
];
```
**Auditor Assessment:** Verified.
- Narrowly scoped to standard local loopback identifiers.
- Does not contain wildcards, CIDR blocks, or external domains.
- Cannot be leveraged by an external hostname to bypass Atlas isolation.

---

## 5. Auditor Conclusion

Finding F-03 is **100% remediated, verified, and closed**. Dynamic test cluster domain configuration is secure, strictly validated, and fails closed under all error and tampering conditions.
