# TASK 5E.1D — FINAL 50-SCENARIO REGRESSION MATRIX
## EXHAUSTIVE SECURITY & BOUNDARY TEST SPECIFICATION

**Suite:** `tests/test_database_isolation_hardening.test.cjs`  
**Date:** 17 November 2026

---

## 1. 50-SCENARIO SPECIFICATION MATRIX

| ID | Test Category | Environment Flags | Target URI | Expected Result | Expected Code | Test Type | Security Purpose |
|---|---|---|---|---|---|---|---|
| **S01** | Missing URI | Unset | None | `allowed: false` | `URI_MISSING` | Unit | Fails closed on absent URI |
| **S02** | Whitespace URI | Unset | `   ` | `allowed: false` | `URI_MISSING` | Unit | Rejects whitespace string |
| **S03** | Malformed Scheme | `APP_MODE: 'test'` | `http://localhost/db` | `allowed: false` | `URI_MALFORMED` | Unit | Rejects non-mongo scheme |
| **S04** | Missing DB Path | `APP_MODE: 'test'` | `mongodb://localhost:27017/` | `allowed: false` | `MISSING_DATABASE_NAME` | Unit | Rejects URI without DB name |
| **S05** | Decommissioned Host | Any | `mongodb+srv://u:p@cluster0.mlcxcp.mongodb.net/test` | `allowed: false` | `LEGACY_CLUSTER_REJECTED` | Unit | Rejects legacy cluster |
| **S06** | Cross-App Host | Any | `mongodb+srv://u:p@xj6nhak.mongodb.net/test` | `allowed: false` | `CROSS_APPLICATION_CLUSTER_REJECTED` | Unit | Rejects Loan Services cluster |
| **S07** | Total Missing Flags | All empty | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | Unit | Fails closed on missing indicators |
| **S08** | Prod + Dev APP_MODE | `VERCEL_ENV: 'prod', APP_MODE: 'dev'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | Unit | Rejects conflicting prod/dev flags |
| **S09** | Prod + Test APP_MODE | `VERCEL_ENV: 'prod', APP_MODE: 'test'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | Unit | Rejects conflicting prod/test flags |
| **S10** | Prod + Dev NODE_ENV | `VERCEL_ENV: 'prod', APP_MODE: 'prod', NODE_ENV: 'dev'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | Unit | Rejects prod with dev NODE_ENV |
| **S11** | Prod + Test NODE_ENV | `VERCEL_ENV: 'prod', APP_MODE: 'prod', NODE_ENV: 'test'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | Unit | Rejects prod with test NODE_ENV |
| **S12** | Preview + Prod Mode | `VERCEL_ENV: 'preview', APP_MODE: 'prod'` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | Unit | Rejects preview claiming prod mode |
| **S13** | Preview + Prod NODE | `VERCEL_ENV: 'preview', APP_MODE: 'test', NODE_ENV: 'prod'` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | Unit | Rejects preview with prod NODE_ENV |
| **S14** | Preview Valid Test | `VERCEL_ENV: 'preview', APP_MODE: 'test'` | `mongodb://localhost:27017/avani_ai_crm_test` | **`allowed: true`** | `VALID_TEST_CONNECTION` | Unit | Permits authorized preview test |
| **S15** | Preview Valid Dev | `VERCEL_ENV: 'preview', APP_MODE: 'dev'` | `mongodb://localhost:27017/avani_ai_crm_test` | **`allowed: true`** | `VALID_TEST_CONNECTION` | Unit | Permits authorized preview dev |
| **S16** | Local Missing Indicators | `VERCEL_ENV: '', APP_MODE: '', NODE_ENV: ''` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | Unit | Rejects empty local execution |
| **S17** | Local Valid Dev | `VERCEL_ENV: '', APP_MODE: 'development'` | `mongodb://localhost:27017/avani_ai_crm_test` | **`allowed: true`** | `VALID_TEST_CONNECTION` | Unit | Permits local dev on localhost |
| **S18** | Local Valid Test | `VERCEL_ENV: '', APP_MODE: 'test'` | `mongodb://localhost:27017/avani_ai_crm_test` | **`allowed: true`** | `VALID_TEST_CONNECTION` | Unit | Permits local test on localhost |
| **S19** | Local Dev from NODE_ENV | `VERCEL_ENV: '', NODE_ENV: 'development'` | `mongodb://127.0.0.1:27017/avani_ai_crm_test` | **`allowed: true`** | `VALID_TEST_CONNECTION` | Unit | Inferred local dev from NODE_ENV |
| **S20** | Local Test from NODE_ENV | `VERCEL_ENV: '', NODE_ENV: 'test'` | `mongodb://127.0.0.1:27017/avani_ai_crm_test` | **`allowed: true`** | `VALID_TEST_CONNECTION` | Unit | Inferred local test from NODE_ENV |
| **S21** | Local Prod NODE_ENV | `VERCEL_ENV: '', APP_MODE: 'dev', NODE_ENV: 'production'` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | Unit | Rejects local claiming prod NODE_ENV |
| **S22** | Unrecognized VERCEL_ENV | `VERCEL_ENV: 'staging', APP_MODE: 'test'` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | Unit | Rejects staging VERCEL_ENV |
| **S23** | Unrecognized APP_MODE | `VERCEL_ENV: '', APP_MODE: 'qa'` | `mongodb://localhost:27017/avani_ai_crm_test` | `allowed: false` | `INVALID_OR_UNKNOWN_RUNTIME_PROFILE` | Unit | Rejects qa APP_MODE |
| **S24** | Authorized Production | `VERCEL_ENV: 'prod', APP_MODE: 'prod'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | **`allowed: true`** | `VALID_PROD_CONNECTION` | Unit | Authorized live production runtime |
| **S25** | Prod Trailing Dot | `VERCEL_ENV: 'prod', APP_MODE: 'prod'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net./avani_ai_crm_prod` | **`allowed: true`** | `VALID_PROD_CONNECTION` | Unit | Normalized trailing dot prod |
| **S26** | Prod Uppercase Host | `VERCEL_ENV: 'prod', APP_MODE: 'prod'` | `mongodb+srv://u:p@RHPN2GH.MONGODB.NET/avani_ai_crm_prod` | **`allowed: true`** | `VALID_PROD_CONNECTION` | Unit | Normalized uppercase prod |
| **S27** | Prod Target Test DB | `VERCEL_ENV: 'prod', APP_MODE: 'prod'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_test` | `allowed: false` | `TEST_DATABASE_FORBIDDEN_IN_PROD` | Unit | Prod runtime cannot use test DB |
| **S28** | Prod Wrong DB Name | `VERCEL_ENV: 'prod', APP_MODE: 'prod'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/other_db` | `allowed: false` | `INVALID_PRODUCTION_DATABASE_NAME` | Unit | Prod must use avani_ai_crm_prod |
| **S29** | Prod Unauthorized Host | `VERCEL_ENV: 'prod', APP_MODE: 'prod'` | `mongodb://127.0.0.1:27017/avani_ai_crm_prod` | `allowed: false` | `UNAUTHORIZED_PRODUCTION_CLUSTER_HOSTNAME` | Unit | Prod cannot use localhost |
| **S30** | Non-Prod Target Prod DB | `APP_MODE: 'test'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_prod` | `allowed: false` | `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` | Unit | Non-prod cannot touch prod DB |
| **S31** | **Non-Prod Target Prod Host + Test DB** | `APP_MODE: 'test'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net/avani_ai_crm_test` | **`allowed: false`** | **`PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD`** | Unit | **PRIMARY DEFECT TEST** |
| **S32** | Non-Prod Trailing Dot Prod | `APP_MODE: 'test'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net./avani_ai_crm_test` | `allowed: false` | `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` | Unit | Trailing dot prod host blocked |
| **S33** | Non-Prod Valid 127.0.0.1 | `APP_MODE: 'test'` | `mongodb://127.0.0.1:27017/avani_ai_crm_test` | **`allowed: true`** | `VALID_TEST_CONNECTION` | Unit | Permits 127.0.0.1 |
| **S34** | Non-Prod Valid localhost | `APP_MODE: 'test'` | `mongodb://localhost:27017/avani_ai_crm_test` | **`allowed: true`** | `VALID_TEST_CONNECTION` | Unit | Permits localhost |
| **S35** | Non-Prod Valid IPv6 | `APP_MODE: 'test'` | `mongodb://[::1]:27017/avani_ai_crm_test` | **`allowed: true`** | `VALID_TEST_CONNECTION` | Unit | Permits IPv6 loopback |
| **S36** | Multi-Host All Valid | `APP_MODE: 'test'` | `mongodb://127.0.0.1:27017,localhost:27018/avani_ai_crm_test` | **`allowed: true`** | `VALID_TEST_CONNECTION` | Unit | Multi-seed valid test hosts |
| **S37** | Multi-Host Seed Poison (Prod) | `APP_MODE: 'test'` | `mongodb://127.0.0.1:27017,rhpn2gh.mongodb.net:27017/avani_ai_crm_test` | `allowed: false` | `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` | Unit | Rejects mixed seed list with prod |
| **S38** | Multi-Host Seed Poison (Unknown)| `APP_MODE: 'test'` | `mongodb://127.0.0.1:27017,unknown-host:27017/avani_ai_crm_test` | `allowed: false` | `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME` | Unit | Rejects mixed seed list with rogue |
| **S39** | SRV with Port Specified | `APP_MODE: 'test'` | `mongodb+srv://localhost:27017/avani_ai_crm_test` | `allowed: false` | `URI_MALFORMED` | Unit | Rejects port in SRV |
| **S40** | SRV with Multi-Host | `APP_MODE: 'test'` | `mongodb+srv://host1,host2/avani_ai_crm_test` | `allowed: false` | `URI_MALFORMED` | Unit | Rejects multi-host in SRV |
| **S41** | Subdomain Prefix Spoof | `APP_MODE: 'test'` | `mongodb+srv://u:p@attacker-rhpn2gh.mongodb.net/avani_ai_crm_test` | `allowed: false` | `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME` | Unit | Rejects prefix spoof |
| **S42** | Domain Suffix Spoof | `APP_MODE: 'test'` | `mongodb+srv://u:p@rhpn2gh.mongodb.net.attacker.com/avani_ai_crm_test` | `allowed: false` | `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME` | Unit | Rejects suffix spoof |
| **S43** | Percent-Encoded Auth | `APP_MODE: 'test'` | `mongodb://user%40corp:pass%40123@127.0.0.1:27017/avani_ai_crm_test` | **`allowed: true`** | `VALID_TEST_CONNECTION` | Unit | Handles percent-encoded auth |
| **S44** | Double @ Authority Smuggle | `APP_MODE: 'test'` | `mongodb://user@host1@host2/avani_ai_crm_test` | `allowed: false` | `URI_MALFORMED` | Unit | Rejects unencoded multiple @ |
| **S45** | DNS SRV Topology Match | `APP_MODE: 'test'` | Authorized Test SRV | **`PASS`** | `TOPOLOGY_VERIFIED` | Live DB | Discovered nodes match DNS SRV |
| **S46** | DNS SRV Topology Mismatch | `APP_MODE: 'test'` | Authorized Test SRV | `FAIL` | `UNAUTHORIZED_TOPOLOGY_NODE` | Live DB | Rejects node not in DNS SRV |
| **S47** | Live DB Name Mismatch | `APP_MODE: 'test'` | Authorized Test SRV | `FAIL` | `LIVE_DB_NAME_MISMATCH` | Live DB | Rejects if connected DB is not test |
| **S48** | Same Connection Binding | `APP_MODE: 'test'` | Authorized Test SRV | **`PASS`** | `CONNECTION_BOUND` | Live DB | Verifies model connection matches guard |
| **S49** | Index Deep Parity Valid | `APP_MODE: 'test'` | Authorized Test SRV | **`PASS`** | `INDEX_PARITY_VERIFIED` | Live DB | Exact key & unique flag match |
| **S50** | Reconnect Cycle Re-Verify | `APP_MODE: 'test'` | Authorized Test SRV | **`PASS`** | `RECONNECT_VERIFIED` | Live DB | Full topology re-check on reconnect |
