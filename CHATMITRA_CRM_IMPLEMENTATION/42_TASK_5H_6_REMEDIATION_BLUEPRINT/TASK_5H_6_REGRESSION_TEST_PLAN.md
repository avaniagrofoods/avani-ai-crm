# TASK 5H.6 — REGRESSION & REMEDIATION TEST PLAN
**Scope:** Offline/Mock Verification + Future Controlled Live Google Test Account Verification

---

## 1. Offline / Mock Test Suite Plan (Zero Network, ₹0)

| Test ID | Objective | Preconditions | Procedure & Expected Result | Pass Criteria |
|---------|-----------|---------------|-----------------------------|---------------|
| **T-5H6-01** | TypeScript & Baseline Regression | All Phase 1–4 edits applied | Run `tsc --noEmit` + all 6 existing offline suites (`test_task5h4`, `test_database_isolation_hardening`, `test_task3`, `test_task3b`, `test_task4`, `test_task5`). | Exit code `0`, `0` TS errors, `100%` pass. |
| **T-5H6-02** | Gateway JSON Envelope & HMAC Contract (A-01) | Mock `fetch` capturing POST body | Call `signAppsScriptGatewayRequest()` + `dispatchGatewayRequest()`; verify JSON body `{ requestId, timestampMs, payloadJson, signature }`, zero `X-Avani-*` header dependency, and `UPSERT_ROW`/`DELETE_ROW`/`GET_SNAPSHOT` handling. | Exact envelope match + valid HMAC. |
| **T-5H6-03** | 9-Tab Canonical Schema Parity (A-02) | `SHEET_COLUMNS` & Apps Script `EXPECTED_TABS` | Assert exact tab count (9), column counts, and exact column order for all 9 tabs (`CUSTOMERS` 8, `APPLICATIONS` 10, `CONSENTS` 8, etc.). | `0` column mismatches. |
| **T-5H6-04** | Residual MongoDB & Upload Route Retirement (A-03) | Routes updated | Call `POST /api/contacts/upload`, `POST /api/leads/upload`, `POST /api/chatmantra-webhook` -> expect `410`; call `omnidim-webhook` with `recording_url` -> verify `recordingUrl` is not persisted. | HTTP `410` & zero `recordingUrl` storage. |
| **T-5H6-05** | Session Expiry & Multi-Instance Notice (A-04) | `SESSION_MAX_AGE_SECONDS = 1800` | Sign session token and verify `exp - iat === 1800`; verify logout revokes on current instance. | `exp - iat === 1800`. |
| **T-5H6-06** | Apps Script Security & Replay Controls (A-05) | Simulated `doPost` harness | Test tampered HMAC (`401`), skewed timestamp >300s (`401`), replayed `requestId` (`401`), wrong `ALLOWED_SPREADSHEET_ID` (`403`), >64KB body (`400`), `=IMPORTXML` cell (`400`). | All 6 abuse cases rejected. |
| **T-5H6-07** | Partial-Write Recovery & `GET_SNAPSHOT` (A-06) | `MOCK_IN_MEMORY` fault injection | Fail `LEADS` write after `CUSTOMERS` succeeds, then retry `registerOrUpdateCustomerLead()` -> verify 1 customer + 1 lead; verify `listHydratedLeads()` uses 1 `GET_SNAPSHOT` call. | Zero duplicates; 1 snapshot read. |
| **T-5H6-08** | Opt-Out & Webhook Regression | Existing 5H.4 + 3B + 4 suites | Verify `STOP`, `थांबवा`, `रोकें`, `रोको`, `roken` suppression and media attachment rejection (`MEDIA_IGNORED`). | 100% pass. |

## 2. Controlled Live Google Test Account Tests (Requires Future Owner Authorization)
- **T-LIVE-01:** Deploy `Code.gs` to a dedicated test-only spreadsheet `AVANI_LOAN_SERVICES_CRM_TEST`, run `HEALTH_CHECK` -> `200 OK` with all 9 tabs verified.
- **T-LIVE-02:** Execute synthetic `UPSERT_ROW`, `INSERT_IF_ABSENT` (duplicate), `GET_SNAPSHOT`, and `DELETE_ROW` cleanup against test spreadsheet only.
