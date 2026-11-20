# TASK 5H.6 — A-01 REMEDIATION BLUEPRINT: CANONICAL APPS SCRIPT GATEWAY PROTOCOL
**Severity:** CRITICAL | **Status:** Blueprint Ready (No Code Modified)

---

## 1. Root Cause Verified in Source
- `src/lib/google-sheets/google-sheets-client.ts` (lines 397–407) currently sends authentication metadata in HTTP headers (`X-Avani-Request-Id`, `X-Avani-Timestamp` in ms, `X-Avani-Signature`) and actions `UPSERT_ROW` / `DELETE_ROW`.
- Google Apps Script Web Apps (`doPost(e)`) only receive `e.postData.contents` and `e.parameter`—custom HTTP headers are **not** accessible to `doPost(e)`. Furthermore, `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md` expected `{ timestamp (seconds), nonce, payloadJson, signature }` and action `UPSERT`, with no `DELETE_ROW` or `GET_SNAPSHOT`.

## 2. Canonical JSON Request Envelope (`POST` body)
```json
{
  "requestId": "REQ-1795013102826-a1b2c3d4e5f6",
  "timestampMs": 1795013102826,
  "payloadJson": "{\"action\":\"UPSERT_ROW\",\"tab\":\"CUSTOMERS\",\"primaryKeyColumn\":\"customer_id\",\"primaryKeyValue\":\"CUST-101\",\"rowValues\":[\"CUST-101\",\"Ramesh\",\"+919876543210\",\"Pune\",\"WEBSITE\",\"2026-11-18T15:00:00.000Z\",\"2026-11-18T15:00:00.000Z\",\"ACTIVE\"]}",
  "signature": "<64-char lowercase hex HMAC-SHA256>"
}
```
- **HMAC Canonical String:** `${timestampMs}.${requestId}.${payloadJson}` signed with UTF-8 `GOOGLE_SHEETS_GATEWAY_SECRET` (`>= 16` chars, recommended 32+ chars).
- **Timestamp Format & Skew:** Epoch milliseconds (`timestampMs`), permitted skew `±300,000 ms` (5 minutes).
- **Request ID / Nonce:** Minimum 16 chars (`REQ-<epochMs>-<12hex>`), checked against `CacheService.getScriptCache()` (TTL 600s) to reject replays within the 5-minute window.

## 3. Canonical JSON Response Envelope
Apps Script `ContentService` always returns HTTP 200 at the transport layer, so logical status is carried in `status` + `ok` + `code`:
```json
{
  "ok": true,
  "status": 200,
  "code": "OK",
  "requestId": "REQ-1795013102826-a1b2c3d4e5f6",
  "data": { "created": true, "inserted": true }
}
```
Error response:
```json
{
  "ok": false,
  "status": 401,
  "code": "GOOGLE_SHEETS_AUTH_FAILED",
  "requestId": "REQ-...",
  "error": "Invalid HMAC signature"
}
```

## 4. Supported Actions & Validation Matrix

| Action | Required Params inside `payloadJson` | Validation & Behavior |
|--------|--------------------------------------|-----------------------|
| `HEALTH_CHECK` | none | Verifies spreadsheet ID allowlist + all 9 tab headers; returns `{ spreadsheetName, schemaVersion, tabs }`. |
| `GET_ALL` | `tab` | Validates `tab` in `EXPECTED_TABS` and exact header row; returns `{ headers, rows }`. |
| `GET_SNAPSHOT` | `tabs` (array of tab names) | Validates each tab & header row; returns `{ tabs: { [tab]: { headers, rows } } }` in 1 HTTP call. |
| `UPSERT_ROW` | `tab`, `primaryKeyColumn`, `primaryKeyValue`, `rowValues` | Acquires `LockService` (`waitLock(10000)`), validates formula safety & column count, updates matching PK row or appends. |
| `INSERT_IF_ABSENT` | `tab`, `primaryKeyColumn`, `primaryKeyValue`, `rowValues` | Acquires `LockService`, returns `{ inserted: false, existingRow }` if PK exists, else appends `{ inserted: true }`. |
| `DELETE_ROW` | `tab`, `primaryKeyColumn`, `primaryKeyValue` | Acquires `LockService`, deletes matching PK row, returns `{ deleted: true | false }`. |

## 5. Compatibility & Rollback Plan
- Update `signAppsScriptGatewayRequest()` in `google-auth.ts`, `dispatchGatewayRequest()` in `google-sheets-client.ts`, and `doPost(e)` in `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md` together in Phase 1.
- Rollback: Restore `.bak.pre_task5h4` or revert the Phase 1 commit; `MOCK_IN_MEMORY` transport remains unaffected for offline tests.
