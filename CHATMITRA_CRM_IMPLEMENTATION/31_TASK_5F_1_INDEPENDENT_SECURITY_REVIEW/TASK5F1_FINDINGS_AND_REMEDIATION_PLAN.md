# TASK 5F.1: FINDINGS AND REMEDIATION PLAN
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 2026-11-18  
**Audit Role:** Independent Senior Application Security Reviewer  
**Classification:** FINDINGS AND TARGETED REMEDIATIONS

---

## 1. Findings Register

| Finding ID | Severity | Component / Location | Description | Security Consequence | Remediation Plan | Live DB Required? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **F-01** | **HIGH** | `tests/test_database_isolation_hardening.test.cjs` (lines 18–281) | Test suite embeds internal copies of isolation functions rather than directly importing `src/lib/db.ts`. | Future changes to `src/lib/db.ts` could introduce regressions that the test suite would not detect. | Refactor test runner to dynamically transpile and import `src/lib/db.ts` using `typescript.transpileModule`. | No |
| **F-02** | **HIGH** | `src/lib/db.ts` (lines 616–673) | `verifySrvDnsTopology()` and `verifySameConnectionIdentity()` are exported helpers but are not invoked inside `connectToDatabase()`. | Live connections undergo preflight string evaluation but do not automatically execute pre-connection DNS-SRV checks or post-connection identity binding. | Wire both helpers directly into the connection pipeline in `connectToDatabase()`, with graceful fallback for local/non-SRV hosts. | Yes (during Live Integration Phase) |
| **F-03** | **MEDIUM** | `src/lib/db.ts` (lines 291–295) | `isAuthorizedTestHost()` hardcodes placeholder test domain `41zrtal.mongodb.net`. | When a real Atlas test cluster is provisioned under a different domain, it will fail closed as unauthorized. | Parameterize authorized test cluster domain via `process.env.MONGODB_TEST_CLUSTER_DOMAIN`. | No |
| **F-04** | **LOW** | `src/lib/db.ts` (lines 454–466) | Non-production strictly requires `dbName === 'avani_ai_crm_test'`, rejecting preview-specific database names. | Prevents `VERCEL_PREVIEW` deployments from targeting `avani_ai_crm_preview`. | Permit `avani_ai_crm_preview` specifically when `runtimeProfile === 'VERCEL_PREVIEW'`. | No |
| **F-05** | **LOW** | `tests/test_task5a_mongodb_integration.test.cjs` (lines 19–71) | Legacy test suite embeds obsolete Task 5A evaluator that permits `rhpn2gh` on test DB. | Running this old test suite exercises outdated logic rather than the new hardened code. | Refactor `test_task5a_mongodb_integration.test.cjs` during the live integration phase to import `src/lib/db.ts`. | Yes (during Live Integration Phase) |

---

## 2. Prioritized Remediation Roadmap

1. **Remediation 1 (Immediate / Pre-Live Testing):** Refactor `tests/test_database_isolation_hardening.test.cjs` to dynamically transpile and import `src/lib/db.ts`. Verify that all 44 offline scenarios continue to pass 100% against the actual exported file.
2. **Remediation 2 (Pre-Live Testing):** Parameterize `isAuthorizedTestHost()` using an environment variable (`MONGODB_TEST_CLUSTER_DOMAIN`) so that the newly provisioned test cluster is recognized cleanly.
3. **Remediation 3 (Live Integration Phase):** Wire `verifySrvDnsTopology()` and `verifySameConnectionIdentity()` into `connectToDatabase()` and validate them in the live test suite (Scenarios S45–S50).
