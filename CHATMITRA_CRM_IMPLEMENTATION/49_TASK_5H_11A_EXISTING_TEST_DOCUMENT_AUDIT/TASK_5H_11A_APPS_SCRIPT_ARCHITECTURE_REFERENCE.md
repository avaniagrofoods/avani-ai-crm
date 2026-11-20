# TASK 5H.11A — APPS SCRIPT ARCHITECTURE REFERENCE
**Intended Project:** `AVANI_AI_CRM_TEST_GATEWAY` (Container-bound to `AVANI_AI_CRM_ISOLATED_TEST`)  
**Source Reference:** `CHATMITRA_CRM_IMPLEMENTATION/40_TASK_5H_4_GOOGLE_SHEETS_IMPLEMENTATION/TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`

- **Verified Architectural Controls in Source Documentation:**
  - Container-bound `SpreadsheetApp` access (no GCP project / Sheets API v4 required for test).
  - Canonical JSON request envelope `{ requestId, timestampMs, payloadJson, signature }` signed with constant-time HMAC-SHA256 (`constantTimeEqualHex_`) over `${timestampMs}.${requestId}.${payloadJson}`.
  - 300,000 ms clock-skew validation + `CacheService.getScriptCache()` best-effort nonce check (600s TTL, 1,000-item cap).
  - `ALLOWED_SPREADSHEET_ID` from `ScriptProperties` + `EXPECTED_TABS` + `ALLOWED_ACTIONS` allowlists.
  - 64 KB (`MAX_BODY_BYTES = 65536`) payload size limit + server-side `isUnsafeFormulaCell_()` formula-injection guard.
  - `LockService.getScriptLock().waitLock(10000)` released in `finally`.
- **Live Deployed Code Verification:** **NOT VERIFIED** (prohibited to inspect/call live deployment in Task 5H.11A).
