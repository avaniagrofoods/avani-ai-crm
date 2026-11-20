# TASK 5H.8 — A-05 GATEWAY SECURITY VERIFICATION
**Status:** VERIFIED (Source-Level Apps Script Controls Confirmed; Live Runtime NOT VERIFIED)

## 1. Line-by-Line Inspection of `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`
- **Constant-Time HMAC (`constantTimeEqualHex_`, lines 213–220):** Checks `a.length !== 64 || a.length !== b.length` before the XOR loop, safely handling unequal-length inputs.
- **Timestamp & Skew (`verifyGatewayRequest_`, lines 195–197):** Validates `isFinite(timestampMs)` and `Math.abs(Date.now() - timestampMs) <= 300000` (5 minutes).
- **Nonce Replay (`CacheService`, lines 198–202, 209):** Checks `cache.get('nonce_' + requestId)` and stores for `600` seconds. **Documented Limitation:** `CacheService` is best-effort under memory pressure and does not provide absolute replay immunity.
- **Spreadsheet ID Allowlist (lines 79–82):** Reads `ALLOWED_SPREADSHEET_ID` from `PropertiesService.getScriptProperties()`, which cannot be overridden by caller-supplied payloads.
- **Action & Tab Allowlists:** Enforces `ALLOWED_ACTIONS` and `EXPECTED_TABS` before any sheet access.
- **Request Size Limit:** Enforces `MAX_BODY_BYTES = 65536` (64 KB) before `JSON.parse`.
- **Formula Injection (`isUnsafeFormulaCell_`, lines 184–189):** Rejects leading `=`, `+`, `-`, `@`, `\t`, `\r` and `IMPORTXML`/`IMPORTHTML`/`IMPORTRANGE`/`cmd|` across all `UPSERT_ROW` and `INSERT_IF_ABSENT` cells (allowing valid `+91[6-9]\d{9}` on `mobile_number`).
- **Error Sanitization:** Returns generic codes without stack traces or secrets.
