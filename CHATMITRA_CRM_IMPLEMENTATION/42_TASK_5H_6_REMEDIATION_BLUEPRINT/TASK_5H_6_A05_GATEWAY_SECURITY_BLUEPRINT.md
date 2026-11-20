# TASK 5H.6 — A-05 REMEDIATION BLUEPRINT: APPS SCRIPT GATEWAY SECURITY
**Severity:** MEDIUM | **Target:** `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md` (future `Code.gs`)

---

## 1. Security Control Matrix

| Control | Current Gap in 5H.4 Apps Script | Proposed Remediation |
|---------|---------------------------------|----------------------|
| **Constant-Time HMAC** | Uses `computed === String(sigHex).toLowerCase()` | Implement constant-time char-code XOR loop (`constantTimeEqualHex_`) over equal-length 64-char hex strings. |
| **Nonce Replay Protection** | No nonce tracking in Apps Script | Store `nonce:<requestId>` in `CacheService.getScriptCache()` for `600` seconds; reject if `cache.get(...) !== null`. **Honest Limitation:** `CacheService` is best-effort and may evict under memory pressure, so replay protection is strong within normal load but not cryptographically absolute. |
| **Timestamp Validation** | 300s check in seconds | Align to `timestampMs` (`Math.abs(Date.now() - Number(req.timestampMs)) <= 300000`). |
| **Spreadsheet ID Allowlist** | Calls `getActiveSpreadsheet()` blindly | Verify `ss.getId() === PropertiesService.getScriptProperties().getProperty('ALLOWED_SPREADSHEET_ID')`. |
| **Payload Size & Input Limits** | No max body size check | Reject `rawBody.length > 65536` (64 KB) before `JSON.parse`. |
| **Formula Injection Guard** | Relies only on Next.js client | Add `isUnsafeFormulaCell_(val)` in `doPost` rejecting leading `=`, `+`, `-`, `@`, `\t`, `\r` (except valid `+91[6-9]\d{9}` E.164 phones) before `appendRow`/`setValues`. |
| **Error Sanitization** | Returns `String(err)` | Return generic sanitized error codes (`GOOGLE_SHEETS_UNAVAILABLE`, `GOOGLE_SHEETS_SCHEMA_INVALID`, `GOOGLE_SHEETS_AUTH_FAILED`) without stack traces or secret names. |

## 2. Validation Sequence in `doPost(e)`
1. Reject if `e.postData.contents.length > 65536` -> `400`.
2. Parse JSON envelope `{ requestId, timestampMs, payloadJson, signature }`.
3. Validate `requestId` format (`>= 16` chars) & `timestampMs` within `±300,000 ms`.
4. Constant-time HMAC-SHA256 verification against `GATEWAY_HMAC_SECRET` in `ScriptProperties`.
5. Check & record `requestId` in `CacheService.getScriptCache()` (600s TTL).
6. Verify `ss.getId() === ALLOWED_SPREADSHEET_ID` and action in allowlist (`HEALTH_CHECK`, `GET_ALL`, `GET_SNAPSHOT`, `UPSERT_ROW`, `INSERT_IF_ABSENT`, `DELETE_ROW`).
7. Acquire `LockService.getScriptLock().waitLock(10000)` for mutations, validate tab/headers/formula safety, execute, and `releaseLock()` in `finally`.
