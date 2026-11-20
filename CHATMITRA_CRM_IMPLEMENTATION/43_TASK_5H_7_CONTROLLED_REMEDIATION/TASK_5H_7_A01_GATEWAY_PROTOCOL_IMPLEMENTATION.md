# TASK 5H.7 — A-01 GATEWAY PROTOCOL IMPLEMENTATION
**Original Risk (CRITICAL):** `google-sheets-client.ts` sent `X-Avani-*` HTTP headers + `UPSERT_ROW`/`DELETE_ROW`, whereas Apps Script `doPost(e)` cannot inspect HTTP headers and expected `{ timestamp, nonce, payloadJson, signature }` + `UPSERT`.

## Changes Made
1. `src/lib/google-sheets/google-auth.ts`: `signAppsScriptGatewayRequest()` now produces `{ requestId, timestampMs, payloadJson, signature }` signed with `${timestampMs}.${requestId}.${payloadJson}` in `bodyString`.
2. `src/lib/google-sheets/google-sheets-client.ts`: `dispatchGatewayRequest()` sends only `Content-Type: application/json` + `envelope.bodyString`; fixed `getAllRows()` action from `GET_ROWS` to `GET_ALL`; added `getSnapshot()` (`GET_SNAPSHOT`); parses canonical `{ ok, status, code, requestId, data, error }`.
3. `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`: Updated `doPost(e)` to parse the exact JSON envelope and handle all 6 canonical actions (`HEALTH_CHECK`, `GET_ALL`, `GET_SNAPSHOT`, `UPSERT_ROW`, `INSERT_IF_ABSENT`, `DELETE_ROW`).

## Remaining Limitations
- Live Apps Script HTTP execution is not claimed until tested in an approved isolated Google test environment (`T-LIVE-01`).
