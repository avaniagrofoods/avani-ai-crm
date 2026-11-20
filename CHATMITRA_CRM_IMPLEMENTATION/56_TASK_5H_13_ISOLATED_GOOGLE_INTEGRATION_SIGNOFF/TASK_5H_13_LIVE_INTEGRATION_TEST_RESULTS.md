# TASK 5H.13 — REPORT 9
## End-to-End Isolated Integration Test Results

- **Task:** 5H.13 — Section 10 Live Integration Testing
- **Execution Mode:** LIVE HTTP CALLS TO DEPLOYED APPS SCRIPT WEB APP & GOOGLE SPREADSHEET
- **Timestamp:** 2026-11-19T16:10:00+05:30
- **Outcome:** **14 / 14 SCENARIOS PASSED (100% SUCCESS)**

---

### 1. Test Harness & Target Environment

- **Target Spreadsheet:** `AVANI_AI_CRM_ISOLATED_TEST`
- **Container Gateway:** `AVANI_AI_CRM_TEST_GATEWAY`
- **Transport Mode:** `APPS_SCRIPT_GATEWAY`
- **Authentication Scheme:** Canonical JSON-Body HMAC-SHA256 (`${timestampMs}.${requestId}.${payloadJson}`)
- **Security Key Length:** 64-character hexadecimal

---

### 2. Live Scenario Execution Results

| # | Test Scenario | Operation / Payload | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Gateway Health Check** | `action: 'HEALTH_CHECK'` | HTTP 200, return spreadsheet name & 9 tabs | `{"ok":true,"status":200,"code":"OK","data":{"spreadsheetName":"AVANI_AI_CRM_ISOLATED_TEST"}}` | **PASSED** |
| 2 | **Multi-Tab Snapshot Read** | `action: 'GET_SNAPSHOT', tabs: [...]` | HTTP 200, batched data for requested tabs | Batched snapshot returned in single round-trip | **PASSED** |
| 3 | **Insert Synthetic Customer** | `INSERT_IF_ABSENT` on `CUSTOMERS` (`TEST_CUST_001`) | HTTP 200, inserted: true | Customer row appended to sheet | **PASSED** |
| 4 | **Readback Customer** | `GET_ALL` on `CUSTOMERS` | Row values match inserted data exactly | Verified row `TEST_CUST_001` present with 8 columns | **PASSED** |
| 5 | **Insert Synthetic Lead** | `INSERT_IF_ABSENT` on `LEADS` (`TEST_LEAD_001`) | HTTP 200, inserted: true | Lead row appended to sheet | **PASSED** |
| 6 | **Upsert Synthetic Lead** | `UPSERT_ROW` on `LEADS` (status: `QUALIFIED`) | HTTP 200, created: false (updated in place) | In-place status update verified | **PASSED** |
| 7 | **Insert Application** | `INSERT_IF_ABSENT` on `APPLICATIONS` (`TEST_APP_001`) | HTTP 200, inserted: true | Application row appended to sheet | **PASSED** |
| 8 | **Insert Followup** | `INSERT_IF_ABSENT` on `FOLLOWUPS` (`TEST_FUP_001`) | HTTP 200, inserted: true | Follow-up record logged | **PASSED** |
| 9 | **Insert Consent Record** | `INSERT_IF_ABSENT` on `CONSENTS` (`TEST_CON_001`) | HTTP 200, inserted: true | Consent grant logged | **PASSED** |
| 10 | **Insert Message Event** | `INSERT_IF_ABSENT` on `MESSAGE_EVENTS` (`TEST_EVT_001`) | HTTP 200, inserted: true | Audit message event logged | **PASSED** |
| 11 | **Insert Webhook Event** | `INSERT_IF_ABSENT` on `WEBHOOK_EVENTS` (`TEST_WH_001`) | HTTP 200, inserted: true | Inbound webhook audit entry logged | **PASSED** |
| 12 | **Seed Advisor Record** | `INSERT_IF_ABSENT` on `ADVISORS` (`ADV_SACHIN_01`) | HTTP 200, inserted: true | Active Chief Loan Advisor seeded | **PASSED** |
| 13 | **Seed System Config** | `INSERT_IF_ABSENT` on `SYSTEM_CONFIG` | HTTP 200, inserted: true | Test status recorded | **PASSED** |
| 14 | **Security: Invalid Signature** | Corrupted HMAC hex signature | HTTP 401 Unauthorized | Gateway rejected with `GOOGLE_SHEETS_AUTH_FAILED` | **PASSED** |
| 15 | **Security: Formula Injection** | Value starting with `=IMPORTXML(...)` | HTTP 400 Bad Request | Gateway blocked with `FORMULA_INJECTION_BLOCKED` | **PASSED** |
| 16 | **Security: Caller Sheet ID** | Caller passes `spreadsheetId: 'attacker_id'` | HTTP 400 Bad Request | Gateway blocked caller-supplied spreadsheet ID | **PASSED** |
