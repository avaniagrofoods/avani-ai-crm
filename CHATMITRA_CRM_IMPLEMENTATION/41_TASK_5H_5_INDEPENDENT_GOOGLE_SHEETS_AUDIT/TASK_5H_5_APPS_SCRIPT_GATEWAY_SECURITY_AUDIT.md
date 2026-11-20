# TASK 5H.5 — APPS SCRIPT GATEWAY SECURITY AUDIT
**Files Audited:** `src/lib/google-sheets/google-sheets-client.ts`, `src/lib/google-sheets/google-auth.ts`, `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`.

---

## 1. CRITICAL FINDING A-01: Gateway Wire Protocol & Action Mismatch
- **Client (`google-sheets-client.ts` lines 397–407 & `google-auth.ts` lines 50–51):**
  - Sends HMAC signature in HTTP headers (`X-Avani-Request-Id`, `X-Avani-Timestamp` in **milliseconds**, `X-Avani-Signature`) and canonical string `${timestamp}.${requestId}.${bodyString}`.
  - Sends actions: `HEALTH_CHECK`, `GET_ALL`, `UPSERT_ROW`, `INSERT_IF_ABSENT`, `DELETE_ROW`.
- **Apps Script (`TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`):**
  - Google Apps Script `doPost(e)` **cannot inspect custom HTTP request headers** (`e` only exposes `e.postData.contents` and `e.parameter`).
  - `verifyGatewayHmac_` expects `{ timestamp (seconds!), nonce, payloadJson, signature }` in the JSON body.
  - Only handles `HEALTH_CHECK`, `GET_ALL`, `UPSERT` (not `UPSERT_ROW`), and `INSERT_IF_ABSENT` (lacks `DELETE_ROW`).
- **Impact:** Live requests would fail authentication (`401`) or action routing (`400`) until aligned.
- **Remediation:** Update `dispatchGatewayRequest` and `doPost(e)` to use a single JSON-body signed envelope `{ requestId, timestampMs, payloadJson, signature }` and support `HEALTH_CHECK`, `GET_ALL`, `UPSERT_ROW`, `INSERT_IF_ABSENT`, and `DELETE_ROW`.

## 2. MEDIUM FINDING A-05: Apps Script Hardening Gaps
- **Non-Constant-Time Signature Compare:** `computed === String(sigHex).toLowerCase()` should use constant-time XOR loop.
- **No Replay Cache in Apps Script:** `verifyGatewayHmac_` checks 300s timestamp window but does not record `requestId` in `CacheService.getScriptCache()` to block replays within 300s.
- **No `ALLOWED_SPREADSHEET_ID` Check:** Add `PropertiesService` check verifying `ss.getId() === allowedId`.
- **No Apps Script Formula-Injection Guard:** Mirror `=`, `+`, `-`, `@`, `\t`, `\r` rejection inside `doPost(e)` before `appendRow` / `setValues`.
- **Positive Controls Confirmed:** No `doGet(e)` handler exists (blocks unauthenticated GET reads); `PropertiesService` holds `GATEWAY_HMAC_SECRET`; `EXPECTED_TABS` allowlists tabs; `LockService` releases in `finally`.
