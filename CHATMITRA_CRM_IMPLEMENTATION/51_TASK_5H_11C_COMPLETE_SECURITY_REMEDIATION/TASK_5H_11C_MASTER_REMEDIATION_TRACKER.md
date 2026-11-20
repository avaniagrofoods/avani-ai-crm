# TASK 5H.11C — MASTER REMEDIATION TRACKER
**Date:** 19 November 2026

| ID | Finding | Severity | Remediation Applied | Verification Method | Final Status |
|----|---------|----------|---------------------|---------------------|--------------|
| **REM-01** | Active Version 1 deployment (`07:56`) | **HIGH** | Containment/archive plan & exact confirmation prompt prepared; not archived without Owner approval. | Read-only audit | **PENDING OWNER ACTION** |
| **REM-02** | Google account not connected (`gsheets` oauth2) | **HIGH** | Documented missing sign-in; zero credentials requested in chat. | `list_plugin_accounts` | **PENDING OWNER ACTION** |
| **REM-03** | Live Web App access permissions (`Who has access`) | **HIGH** | Cannot inspect live Apps Script UI without Owner session; flagged for archive/redeploy under Gate 3. | Read-only audit | **PENDING OWNER ACTION** |
| **REM-04** | `ALLOWED_SPREADSHEET_ID` fail-open if unset + caller override | **CRITICAL** | Fixed in `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md` to fail closed (`403`) if empty/mismatched and reject caller `cmd.spreadsheetId` (`400`). | `test_task5h11c_gateway_security.test.cjs` (`G04`) | **RESOLVED (OFFLINE)** |
| **REM-05** | HMAC-SHA256 client-to-gateway byte parity | **HIGH** | Verified production `signAppsScriptGatewayRequest()` against sandboxed `doPost(e)` `constantTimeEqualHex_`. | `test_task5h11c_gateway_security.test.cjs` (`G01`, `G02`) | **RESOLVED (OFFLINE)** |
| **REM-06** | Replay protection (`timestampMs` + `CacheService`) | **MEDIUM** | Verified >300s expiry rejection & duplicate `requestId` rejection (`401`); documented `CacheService` best-effort eviction limit. | `test_task5h11c_gateway_security.test.cjs` (`G03`) | **RESOLVED (OFFLINE)** |
| **REM-07** | Formula injection & 64 KB payload cap | **MEDIUM** | Verified `=IMPORTXML` (`400`) & >64 KB (`400`) blocked in Apps Script `doPost(e)` + `sheet-validation.ts`. | `test_task5h11c_gateway_security.test.cjs` (`G05`) | **RESOLVED (OFFLINE)** |
| **REM-08** | `LockService` acquire/release & idempotent writes | **MEDIUM** | Verified `waitLock(10000)` acquired and released in `finally` on both error and success paths. | `test_task5h11c_gateway_security.test.cjs` (`G05`, `G06`) | **RESOLVED (OFFLINE)** |
| **REM-09** | Nine-tab schema parity | **HIGH** | Verified 1:1 parity across `sheet-schema.ts`, Apps Script `EXPECTED_TABS`, and `TASK_5H_4_GOOGLE_SHEETS_SCHEMA.xlsx`. | `test_task5h7_remediations.test.cjs` (`A-02`) | **RESOLVED (OFFLINE)** |
| **REM-10** | Zero MongoDB fallback & Zero document/media upload | **HIGH** | Confirmed zero MongoDB fallback in `src/lib/google-sheets/*`; upload routes return `410`. | `test_task5h4`, `test_task5h7` | **RESOLVED (OFFLINE)** |
| **REM-11** | Plaintext `/exec` URL in `AVANI_AI_CRM_ISOLATED_TEST.txt` | **MEDIUM** | Documented for Owner removal/rotation after archiving Version 1 (original file preserved untouched). | Read-only audit | **PENDING OWNER ACTION** |
| **REM-12** | A-04 durable cross-instance revocation & rate limiting | **HIGH (Prod)** | `SESSION_MAX_AGE_SECONDS = 1800` verified; production KV/Redis remediation design documented. | `test_task5h7_remediations.test.cjs` (`A-04`) | **PARTIALLY REMEDIATED (PROD OPEN)** |
