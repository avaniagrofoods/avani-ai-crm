# TASK 5F: OFFLINE REGRESSION TEST RESULTS (S01 TO S44)
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 2026-11-18  
**Suite:** `tests/test_database_isolation_hardening.test.cjs`  
**Execution Environment:** Node.js v26.13.1 (Windows 10 x64)  
**Total Scenarios:** 44  
**Results:** **44 PASSED, 0 FAILED, 0 BLOCKED (100% PASS RATE)**

---

## 1. Complete Scenario Results Table

| ID | Test Category | Environment Flags | Target URI | Expected Result | Actual Result | Diagnostic Code | Status |
|---|---|---|---|---|---|---|---|
| **S01** | Missing URI | Unset | None | `allowed: false` | `allowed: false` | `URI_MISSING` | **PASS** |
| **S02** | Whitespace URI | Unset | `   ` | `allowed: false` | `allowed: false` | `URI_MISSING` | **PASS** |
| **S03** | Malformed Scheme | `APP_MODE: test` | `http://localhost/db` | `allowed: false` | `allowed: false` | `URI_MALFORMED` | **PASS** |
| **S04** | Missing DB Path | `APP_MODE: test` | `mongodb://localhost:27017/` | `allowed: false` | `allowed: false` | `MISSING_DATABASE_NAME` | **PASS** |
| **S05** | Decommissioned Host | Any | `mongodb+srv://u:p@cluster0.mlcxcp.mongodb.net/test` | `allowed: false` | `allowed: false` | `LEGACY_CLUSTER_REJECTED` | **PASS** |
| **S06** | Cross-App Host | Any | `mongodb+srv://u:p@xj6nhak.mongodb.net/test` | `allowed: false` | `allowed: false` | `CROSS_APPLICATION_CLUSTER_REJECTED` | **PASS** |
| **S07** | Total Missing Flags | All empty | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** |
| **S08** | Prod + Dev APP_MODE | `VERCEL_ENV: prod, APP_MODE: dev` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | `allowed: false` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** |
| **S09** | Prod + Test APP_MODE | `VERCEL_ENV: prod, APP_MODE: test` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | `allowed: false` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** |
| **S10** | Prod + Dev NODE_ENV | `VERCEL_ENV: prod, APP_MODE: prod, NODE_ENV: dev` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | `allowed: false` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** |
| **S11** | Prod + Test NODE_ENV | `VERCEL_ENV: prod, APP_MODE: prod, NODE_ENV: test` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | `allowed: false` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** |
| **S12** | Preview + Prod Mode | `VERCEL_ENV: preview, APP_MODE: prod` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** |
| **S13** | Preview + Prod NODE | `VERCEL_ENV: preview, APP_MODE: test, NODE_ENV: prod` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** |
| **S14** | Preview Valid Test | `VERCEL_ENV: preview, APP_MODE: test` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: true` | `allowed: true` | `VALID_TEST_CONNECTION` | **PASS** |
| **S15** | Preview Valid Dev | `VERCEL_ENV: preview, APP_MODE: dev` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: true` | `allowed: true` | `VALID_TEST_CONNECTION` | **PASS** |
| **S16** | Local Missing Indicators | `VERCEL_ENV: '', APP_MODE: '', NODE_ENV: ''` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** |
| **S17** | Local Valid Dev | `VERCEL_ENV: '', APP_MODE: development` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: true` | `allowed: true` | `VALID_TEST_CONNECTION` | **PASS** |
| **S18** | Local Valid Test | `VERCEL_ENV: '', APP_MODE: test` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: true` | `allowed: true` | `VALID_TEST_CONNECTION` | **PASS** |
| **S19** | Local Dev from NODE_ENV | `VERCEL_ENV: '', NODE_ENV: development` | `mongodb://127.0.0.1:27017/avani_ai_crm_test` | `allowed: true` | `allowed: true` | `VALID_TEST_CONNECTION` | **PASS** |
| **S20** | Local Test from NODE_ENV | `VERCEL_ENV: '', NODE_ENV: test` | `mongodb://127.0.0.1:27017/avani_ai_crm_test` | `allowed: true` | `allowed: true` | `VALID_TEST_CONNECTION` | **PASS** |
| **S21** | Local Prod NODE_ENV | `VERCEL_ENV: '', APP_MODE: dev, NODE_ENV: production` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** |
| **S22** | Unrecognized VERCEL_ENV | `VERCEL_ENV: staging, APP_MODE: test` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** |
| **S23** | Unrecognized APP_MODE | `VERCEL_ENV: '', APP_MODE: qa` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | **PASS** |
| **S24** | Authorized Production | `VERCEL_ENV: prod, APP_MODE: prod` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | `allowed: true` | `allowed: true` | `VALID_PROD_CONNECTION` | **PASS** |
| **S25** | Prod Trailing Dot | `VERCEL_ENV: prod, APP_MODE: prod` | `mongodb+srv://u:p@rhpn2gh.mongodb.net./avani_ai_crm_prod` | `allowed: true` | `allowed: true` | `VALID_PROD_CONNECTION` | **PASS** |
| **S26** | Prod Uppercase Host | `VERCEL_ENV: prod, APP_MODE: prod` | `mongodb+srv://u:p@RHPN2GH.MONGODB.NET/avani_ai_crm_prod` | `allowed: true` | `allowed: true` | `VALID_PROD_CONNECTION` | **PASS** |
| **S27** | Prod Target Test DB | `VERCEL_ENV: prod, APP_MODE: prod` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `TEST_DATABASE_FORBIDDEN_IN_PROD` | **PASS** |
| **S28** | Prod Wrong DB Name | `VERCEL_ENV: prod, APP_MODE: prod` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/other_db` | `allowed: false` | `allowed: false` | `INVALID_PRODUCTION_DATABASE_NAME` | **PASS** |
| **S29** | Prod Unauthorized Host | `VERCEL_ENV: prod, APP_MODE: prod` | `mongodb://127.0.0.1:27017/avani_ai_crm_prod` | `allowed: false` | `allowed: false` | `UNAUTHORIZED_PRODUCTION_CLUSTER_HOSTNAME` | **PASS** |
| **S30** | Non-Prod Target Prod DB | `APP_MODE: test` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | `allowed: false` | `allowed: false` | `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` | **PASS** |
| **S31** | **Non-Prod Target Prod Host + Test DB** | `APP_MODE: test` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_test` | **`allowed: false`** | **`allowed: false`** | **`PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD`** | **PASS** |
| **S32** | Non-Prod Trailing Dot Prod | `APP_MODE: test` | `mongodb+srv://u:p@rhpn2gh.mongodb.net./avani_ai_crm_test` | `allowed: false` | `allowed: false` | `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` | **PASS** |
| **S33** | Non-Prod Valid 127.0.0.1 | `APP_MODE: test` | `mongodb://127.0.0.1:27017/avani_ai_crm_test` | `allowed: true` | `allowed: true` | `VALID_TEST_CONNECTION` | **PASS** |
| **S34** | Non-Prod Valid localhost | `APP_MODE: test` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: true` | `allowed: true` | `VALID_TEST_CONNECTION` | **PASS** |
| **S35** | Non-Prod Valid IPv6 | `APP_MODE: test` | `mongodb://[::1]:27017/avani_ai_crm_test` | `allowed: true` | `allowed: true` | `VALID_TEST_CONNECTION` | **PASS** |
| **S36** | Multi-Host All Valid | `APP_MODE: test` | `mongodb://127.0.0.1:27017,localhost:27018/avani_ai_crm_test` | `allowed: true` | `allowed: true` | `VALID_TEST_CONNECTION` | **PASS** |
| **S37** | Multi-Host Seed Poison (Prod) | `APP_MODE: test` | `mongodb://127.0.0.1:27017,rhpn2gh.mongodb.net:27017/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` | **PASS** |
| **S38** | Multi-Host Seed Poison (Unknown)| `APP_MODE: test` | `mongodb://127.0.0.1:27017,unknown-host:27017/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME` | **PASS** |
| **S39** | SRV with Port Specified | `APP_MODE: test` | `mongodb+srv://localhost:27017/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `URI_MALFORMED` | **PASS** |
| **S40** | SRV with Multi-Host | `APP_MODE: test` | `mongodb+srv://host1,host2/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `URI_MALFORMED` | **PASS** |
| **S41** | Subdomain Prefix Spoof | `APP_MODE: test` | `mongodb+srv://u:p@attacker-rhpn2gh.mongodb.net/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME` | **PASS** |
| **S42** | Domain Suffix Spoof | `APP_MODE: test` | `mongodb+srv://u:p@rhpn2gh.mongodb.net.attacker.com/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME` | **PASS** |
| **S43** | Percent-Encoded Auth | `APP_MODE: test` | `mongodb://user%40corp:pass%40123@127.0.0.1:27017/avani_ai_crm_test` | `allowed: true` | `allowed: true` | `VALID_TEST_CONNECTION` | **PASS** |
| **S44** | Double @ Authority Smuggle | `APP_MODE: test` | `mongodb://user@host1@host2/avani_ai_crm_test` | `allowed: false` | `allowed: false` | `URI_MALFORMED` | **PASS** |

---

## 2. Additional Safeguard Verification Results

- **SEC-DNS-01:** Valid test cluster DNS-SRV topology verified $\rightarrow$ **`PASS` (`TOPOLOGY_VERIFIED`)**
- **SEC-DNS-02:** Rogue external node rejected in test profile $\rightarrow$ **`PASS` (`UNAUTHORIZED_TOPOLOGY_NODE`)**
- **SEC-ID-01:** Same connection identity binding verified $\rightarrow$ **`PASS` (`CONNECTION_BOUND`)**
- **SEC-ID-02:** Live DB name mismatch correctly rejected $\rightarrow$ **`PASS` (`LIVE_DB_NAME_MISMATCH`)**

---

## 3. Test Invariants & Safety Confirmations
- Live database connections: **0**
- Network sockets opened: **0**
- Secrets or credentials printed in stdout/stderr: **0**
- Execution time: **22ms**
