# TASK 5H.9 — APPS SCRIPT DEPLOYMENT PLAN
**Target Project:** `AVANI_AI_CRM_TEST_GATEWAY` (Future Gate 3 Owner-Approved Action Only)

---

## 1. Future Deployment Checklist
1. Create test spreadsheet `AVANI_AI_CRM_ISOLATED_TEST` with the 9 exact header rows.
2. Open **Extensions -> Apps Script**, name project `AVANI_AI_CRM_TEST_GATEWAY`, and paste `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`.
3. In **Project Settings -> Script Properties**, configure:
   - `GATEWAY_HMAC_SECRET`: Test-only 32+ char random secret (never printed or shared with production).
   - `ALLOWED_SPREADSHEET_ID`: Exact Spreadsheet ID of `AVANI_AI_CRM_ISOLATED_TEST`.
4. Deploy as **Web app** (`Execute as: Me`, `Who has access: Anyone`).
5. Verify `HEALTH_CHECK`, `GET_ALL`, `GET_SNAPSHOT`, `UPSERT_ROW`, `INSERT_IF_ABSENT`, `DELETE_ROW` using canonical JSON envelope `{ requestId, timestampMs, payloadJson, signature }` signed over `${timestampMs}.${requestId}.${payloadJson}`.
6. Confirm `CacheService` best-effort nonce limitation and `LockService.waitLock(10000)` behavior under test load.
