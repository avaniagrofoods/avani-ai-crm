# TASK 5H.11C — APPS SCRIPT SECURITY REMEDIATION
**File Remediated:** `CHATMITRA_CRM_IMPLEMENTATION/40_TASK_5H_4_GOOGLE_SHEETS_IMPLEMENTATION/TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md` (mirrored to Project 1)

## 1. Security Defects Fixed in Task 5H.11C
1. **Fail-Closed `ALLOWED_SPREADSHEET_ID` Guard:** Replaced `if (allowedSpreadsheetId && ss.getId() !== allowedSpreadsheetId)` (which failed OPEN if `ALLOWED_SPREADSHEET_ID` was unset) with `if (!allowedSpreadsheetId || ss.getId() !== allowedSpreadsheetId)` returning `403 GOOGLE_SHEETS_AUTH_FAILED`.
2. **Caller-Supplied `spreadsheetId` Rejection:** Explicitly rejects any request containing `cmd.spreadsheetId !== undefined` with `400 GOOGLE_SHEETS_VALIDATION_FAILED`.

## 2. Verified Controls (Offline `vm` Harness `test_task5h11c_gateway_security.test.cjs`)
- Constant-time HMAC-SHA256 (`constantTimeEqualHex_`), 300s clock-skew check, `CacheService` best-effort nonce check (600s TTL; 1,000-item cap documented), 64 KB cap, `ALLOWED_ACTIONS`, `EXPECTED_TABS`, `isUnsafeFormulaCell_()`, and `LockService.waitLock(10000)` released in `finally`.
- **Honest DoS Limitation:** HMAC protects authorized operations but does not prevent unauthenticated callers who discover `/exec` from consuming execution quotas.
