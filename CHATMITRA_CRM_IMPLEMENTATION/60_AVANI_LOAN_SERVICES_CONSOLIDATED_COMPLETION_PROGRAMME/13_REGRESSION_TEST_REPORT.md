# 13 — REGRESSION TEST REPORT
## COMPREHENSIVE AUTOMATED TEST EXECUTION RECORD

**Document Version:** 1.0.0  
**Date:** 2026-11-19T17:15:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Independent QA Auditor & Lead Test Automation Engineer  
**Execution Environment:** Node.js v26.13.1 on Windows  
**Execution Timestamp:** 2026-11-19T16:47:09+05:30  

---

### 1. TYPESCRIPT STRICT COMPILER CHECK

```
Command: node node_modules/typescript/bin/tsc --noEmit
Exit Code: 0
Standard Output: (clean compilation, 0 errors)
Standard Error: None
Result: 100% PASS
```

---

### 2. OFFLINE AUTOMATED REGRESSION TEST SUITES

All 8 mandated test suites were executed sequentially. Each test evaluates security contracts, schema integrity, and event routing:

| # | Test Suite Path | Verification Purpose | Test Cases | Passed | Failed | Status |
|---|---|---|---|---|---|---|
| 1 | `tests/test_task5h11c_gateway_security.test.cjs` | Gateway HMAC, replay tolerance, signature validation | 7 | 7 | 0 | **PASS** |
| 2 | `tests/test_task5h7_remediations.test.cjs` | Webhook parameter checks, rate limits, headers | 5 | 5 | 0 | **PASS** |
| 3 | `tests/test_task5h4_google_sheets_crm.test.cjs` | Schema validator, row serializer, CRM client | 6 | 6 | 0 | **PASS** |
| 4 | `tests/test_database_isolation_hardening.test.cjs` | Mongo prod cluster rejection, DNS-SRV isolation | 6 | 6 | 0 | **PASS** |
| 5 | `tests/test_task4_meta_webhook_verification.test.cjs` | Meta sha256 signature verification, event router | 4 | 4 | 0 | **PASS** |
| 6 | `tests/test_task5_crm_database_reliability.test.cjs` | Retry backoff, transactional isolation, deadlocks | 3 | 3 | 0 | **PASS** |
| 7 | `tests/test_task3_chatmitra_webhook_hardening.test.cjs` | Secret verification, raw body hash, idempotency | 3 | 3 | 0 | **PASS** |
| 8 | `tests/test_task3b_hindi_optout_regression.test.cjs` | Hindi / Marathi / English opt-out keywords | 3 | 3 | 0 | **PASS** |

**Summary Metrics:**
- **Total Test Suites Executed:** 8
- **Total Test Cases Executed:** 37
- **Total Passed Tests:** 37 (100.0%)
- **Total Failed Tests:** 0 (0.0%)
- **Offline Quality Score:** **100% PASS**

---

### 3. LIVE VS OFFLINE VERIFICATION BOUNDARY

| Test Category | Execution Mechanism | Network Destination | Verification Target |
|---|---|---|---|
| **Offline Suites (1–8)** | Local Node.js test harness | Localhost / Mocks | Logic, typing, crypto math, regex, contract schemas |
| **Live Gateway Probes** | `scratch/run_live_e2e_tests.cjs` | `script.google.com` | Live Google Sheets API, HMAC auth, Apps Script execution |
| **Synthetic Ingestion** | `scratch/import_synthetic_test_leads.cjs` | `script.google.com` | Live row appending, primary key deduplication, schema check |

**Audit Verdict:** **STAGE Q1 AND Q2 COMPLETED AND VERIFIED.**
