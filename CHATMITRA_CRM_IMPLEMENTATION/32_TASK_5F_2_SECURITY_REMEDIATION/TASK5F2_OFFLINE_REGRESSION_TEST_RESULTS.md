# TASK 5F.2 — OFFLINE REGRESSION TEST SUITE RESULTS (S01–S44 & TEST_01–TEST_15)
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Auditor:** Senior Application Security Engineer & Systems Architect  
**Test Suite:** `tests/test_database_isolation_hardening.test.cjs`  
**Execution Environment:** 100% Offline (Zero Network Requests, Zero Sockets, Zero Credentials)  
**Total Tests:** 59 | **Passed:** 59 | **Failed:** 0 | **Blocked:** 0 | **Pass Rate:** 100.0%

---

## 1. Executive Summary

The expanded offline test suite was executed in Project 2 (`3-AVANI AI CRM`). All 44 unit regression scenarios (Group A) and all 15 lifecycle integration scenarios (Group B) executed directly against `src/lib/db.ts` via in-memory dynamic transpilation (`ts.transpileModule`).

Every scenario passed with zero errors and zero warnings.

---

## 2. Group A: Unit Regression Scenarios (S01 to S44)

| Scenario ID | Test Category / Objective | Expected Code | Status | Verification Note |
| :--- | :--- | :--- | :--- | :--- |
| **S01** | Missing URI (null/undefined) | `URI_MISSING` | **PASS** | Fails closed on absent URI |
| **S02** | Whitespace-only URI string | `URI_MISSING` | **PASS** | Rejects whitespace string |
| **S03** | Malformed connection scheme (`http://`) | `URI_MALFORMED` | **PASS** | Rejects non-mongodb scheme |
| **S04** | Missing database name in pathname | `MISSING_DATABASE_NAME` | **PASS** | Rejects URI without DB name |
| **S05** | Decommissioned cluster (`cluster0.mlcxcp`) | `LEGACY_CLUSTER_REJECTED` | **PASS** | Rejects legacy cluster |
| **S06** | Cross-app cluster (`xj6nhak` Loan Services) | `CROSS_APPLICATION_CLUSTER_REJECTED` | **PASS** | Rejects Loan Services cluster |
| **S07** | Total missing environment indicators | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** | Fails closed on missing flags |
| **S08** | Conflicting prod/dev flags (prod Vercel + dev App) | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** | Rejects conflicting prod/dev flags |
| **S09** | Conflicting prod/test flags (prod Vercel + test App) | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** | Rejects conflicting prod/test flags |
| **S10** | Prod Vercel + dev NODE_ENV | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** | Rejects prod with dev NODE_ENV |
| **S11** | Prod Vercel + test NODE_ENV | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** | Rejects prod with test NODE_ENV |
| **S12** | Preview Vercel claiming prod APP_MODE | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** | Rejects preview claiming prod mode |
| **S13** | Preview Vercel with prod NODE_ENV | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** | Rejects preview with prod NODE_ENV |
| **S14** | Preview valid test runtime profile | `VALID_TEST_CONNECTION` | **PASS** | Permits authorized preview test |
| **S15** | Preview valid dev runtime profile | `VALID_TEST_CONNECTION` | **PASS** | Permits authorized preview dev |
| **S16** | Local execution with empty flags | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** | Rejects empty local execution |
| **S17** | Local valid development profile | `VALID_TEST_CONNECTION` | **PASS** | Permits local dev on localhost |
| **S18** | Local valid test profile | `VALID_TEST_CONNECTION` | **PASS** | Permits local test on localhost |
| **S19** | Inferred local dev from NODE_ENV | `VALID_TEST_CONNECTION` | **PASS** | Inferred local dev from NODE_ENV |
| **S20** | Inferred local test from NODE_ENV | `VALID_TEST_CONNECTION` | **PASS** | Inferred local test from NODE_ENV |
| **S21** | Local execution claiming prod NODE_ENV | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** | Rejects local claiming prod NODE_ENV |
| **S22** | Unrecognized VERCEL_ENV (`staging`) | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** | Rejects staging VERCEL_ENV |
| **S23** | Unrecognized APP_MODE (`qa`) | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** | Rejects qa APP_MODE |
| **S24** | Authorized live production runtime | `VALID_PROD_CONNECTION` | **PASS** | Authorized live production runtime |
| **S25** | Prod hostname with trailing dot normalized | `VALID_PROD_CONNECTION` | **PASS** | Normalized trailing dot prod |
| **S26** | Prod hostname in uppercase normalized | `VALID_PROD_CONNECTION` | **PASS** | Normalized uppercase prod |
| **S27** | Production runtime targeting test DB | `TEST_DATABASE_FORBIDDEN_IN_PROD` | **PASS** | Prod runtime cannot use test DB |
| **S28** | Production runtime targeting wrong DB name | `INVALID_PRODUCTION_DATABASE_NAME` | **PASS** | Prod must use avani_ai_crm_prod |
| **S29** | Production runtime on loopback host | `UNAUTHORIZED_PRODUCTION_CLUSTER_HOSTNAME` | **PASS** | Prod cannot use localhost |
| **S30** | Non-prod runtime targeting production DB | `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` | **PASS** | Non-prod cannot touch prod DB |
| **S31** | **PRIMARY DEFECT TEST:** Non-prod on prod host + test DB | `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` | **PASS** | **CRITICAL DEFECT REMEDIATED** |
| **S32** | Non-prod on prod host with trailing dot | `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` | **PASS** | Trailing dot prod host blocked |
| **S33** | Non-prod valid `127.0.0.1` loopback | `VALID_TEST_CONNECTION` | **PASS** | Permits 127.0.0.1 loopback |
| **S34** | Non-prod valid `localhost` | `VALID_TEST_CONNECTION` | **PASS** | Permits localhost |
| **S35** | Non-prod valid IPv6 loopback (`[::1]`) | `VALID_TEST_CONNECTION` | **PASS** | Permits IPv6 loopback |
| **S36** | Multi-host seed list with all valid test hosts | `VALID_TEST_CONNECTION` | **PASS** | Multi-seed valid test hosts |
| **S37** | Multi-host seed list poisoned with prod node | `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` | **PASS** | Rejects mixed seed list with prod |
| **S38** | Multi-host seed list poisoned with rogue node | `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME` | **PASS** | Rejects mixed seed list with rogue |
| **S39** | SRV URI specifying explicit port number | `URI_MALFORMED` | **PASS** | Rejects port in SRV |
| **S40** | SRV URI specifying multiple comma hosts | `URI_MALFORMED` | **PASS** | Rejects multi-host in SRV |
| **S41** | Subdomain prefix spoof attempt | `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME` | **PASS** | Rejects prefix spoof |
| **S42** | Domain suffix spoof attempt | `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME` | **PASS** | Rejects suffix spoof |
| **S43** | Percent-encoded authentication credentials | `VALID_TEST_CONNECTION` | **PASS** | Handles percent-encoded auth |
| **S44** | Double `@` authority smuggling attack | `URI_MALFORMED` | **PASS** | Rejects unencoded multiple @ |

---

## 3. Group B: Lifecycle Integration Scenarios (TEST_01 to TEST_15)

| Test ID | Scenario Description | Mock Configuration | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TEST_01** | Full `connectToDatabase()` lifecycle with valid non-prod params | Mock DNS + Mock Mongoose (`avani_ai_crm_test`) | Connection succeeds, returns instance | **PASS** |
| **TEST_02** | Full `connectToDatabase()` lifecycle with valid prod params | Mock DNS + Mock Mongoose (`avani_ai_crm_prod`, prod flags) | Connection succeeds, returns instance | **PASS** |
| **TEST_03** | `connectToDatabase()` aborts on SRV pointing to prod host | Mock DNS returns `rhpn2gh` node | Aborts connection before connect | **PASS** |
| **TEST_04** | `connectToDatabase()` aborts on SRV pointing to external rogue host | Mock DNS returns `evil-node.attacker.com` | Aborts connection before connect | **PASS** |
| **TEST_05** | `connectToDatabase()` aborts on post-connect topology containing prod node | Mock topology includes `rhpn2gh` member | Closes connection, resets cache | **PASS** |
| **TEST_06** | `connectToDatabase()` aborts on same-connection database mismatch | Mock connection returns `avani_ai_crm_prod` | Closes connection, resets cache | **PASS** |
| **TEST_07** | `connectToDatabase()` aborts on same-connection host mismatch | Mock connection returns `rogue-cluster` | Closes connection, resets cache | **PASS** |
| **TEST_08** | `connectToDatabase()` succeeds with `localhost` without test domain set | `delete process.env.MONGODB_TEST_CLUSTER_DOMAIN` | Connects cleanly to localhost | **PASS** |
| **TEST_09** | `connectToDatabase()` succeeds with `127.0.0.1` without test domain set | `delete process.env.MONGODB_TEST_CLUSTER_DOMAIN` | Connects cleanly to 127.0.0.1 | **PASS** |
| **TEST_10** | `connectToDatabase()` fails with Atlas URI when test domain is unset | Atlas non-prod URI + unset domain env | Fails closed (`UNAUTHORIZED_TEST_CLUSTER_HOSTNAME`) | **PASS** |
| **TEST_11** | `connectToDatabase()` fails when test domain is wildcard (`*.mongodb.net`) | Wildcard domain in env | Fails closed (`UNAUTHORIZED_TEST_CLUSTER_HOSTNAME`) | **PASS** |
| **TEST_12** | `connectToDatabase()` fails when test domain contains `rhpn2gh` | Production host set as test domain | Fails closed (`PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD`) | **PASS** |
| **TEST_13** | `connectToDatabase()` fails when test domain contains legacy `41zrtal` | Legacy placeholder set in env | Fails closed (`UNAUTHORIZED_TEST_CLUSTER_HOSTNAME`) | **PASS** |
| **TEST_14** | `connectToDatabase()` re-verifies on reconnect event | Malicious reconnect to prod DB emitted | Reconnect handler purges cache | **PASS** |
| **TEST_15** | `connectToDatabase()` clears cache and resets readyState on isolation failure | Rogue prod node in topology | Returns null, cache completely purged | **PASS** |

---

## 4. Summary & Verification Metrics

- **Total Scenarios Evaluated:** 59
- **Passed Scenarios:** 59
- **Failed Scenarios:** 0
- **Blocked Scenarios:** 0
- **Pass Rate:** 100.0%
- **Live Database Sockets Used:** 0
- **Network Packets Emitted:** 0
