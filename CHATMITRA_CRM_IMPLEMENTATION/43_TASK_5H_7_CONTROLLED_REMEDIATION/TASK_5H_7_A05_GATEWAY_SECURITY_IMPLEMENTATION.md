# TASK 5H.7 — A-05 GATEWAY SECURITY IMPLEMENTATION
**Original Risk (MEDIUM):** Apps Script `verifyGatewayHmac_` lacked constant-time compare, nonce replay tracking, spreadsheet ID allowlist, payload size limit, and server-side formula-injection check.

## Changes Made in `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`
- Implemented `constantTimeEqualHex_()` over 64-char hex HMAC-SHA256 digests.
- Enforced `MAX_BODY_BYTES = 65536` (64 KB) and `MAX_CLOCK_SKEW_MS = 300000` (5 min).
- Added `CacheService.getScriptCache()` nonce tracking (`NONCE_TTL_SECONDS = 600`).
- Added `ALLOWED_SPREADSHEET_ID` property check (`403` on mismatch) and `ALLOWED_ACTIONS` / `EXPECTED_TABS` allowlists.
- Added `isUnsafeFormulaCell_()` rejecting `=`, `+`, `-`, `@`, `\t`, `\r`, `IMPORTXML`, etc. (allowing valid `+91[6-9]\d{9}` on `mobile_number`).
- Sanitized error responses without stack traces or secret exposure.

## Documented Limitation
- Apps Script `CacheService` is best-effort and may evict entries under memory pressure; replay protection is not claimed as cryptographically absolute.
