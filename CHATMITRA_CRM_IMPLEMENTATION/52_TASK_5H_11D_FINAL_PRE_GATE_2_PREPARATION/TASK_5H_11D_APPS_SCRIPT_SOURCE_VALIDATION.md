# TASK 5H.11D — APPS SCRIPT SOURCE VALIDATION (OFFLINE ONLY)
- **Validated File:** `CHATMITRA_CRM_IMPLEMENTATION/40_TASK_5H_4_GOOGLE_SHEETS_IMPLEMENTATION/TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`
- **Verified Offline Controls (`test_task5h11c_gateway_security.test.cjs` — 6/6 PASSED):**
  - Canonical JSON-body envelope `{ requestId, timestampMs, payloadJson, signature }` over `${timestampMs}.${requestId}.${payloadJson}`
  - Constant-time HMAC (`constantTimeEqualHex_`), 300s clock skew, `CacheService` nonce replay check (best-effort)
  - Fail-closed `ALLOWED_SPREADSHEET_ID` (`403` when empty or mismatched) + caller `cmd.spreadsheetId` rejection (`400`)
  - 64 KB cap, `ALLOWED_ACTIONS`, `EXPECTED_TABS` (9 tabs), `isUnsafeFormulaCell_()`, `LockService.waitLock(10000)` released in `finally`.
- **Live Google Apps Script Execution:** **NOT VERIFIED** (offline `vm` sandbox only).
