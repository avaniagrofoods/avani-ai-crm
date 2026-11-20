# TASK 5H.10 — SHEETS API V4 VS APPS SCRIPT QUOTA REVIEW
**Access Date:** 18 November 2026  
**Active Implementation:** `GoogleSheetsClient` (`src/lib/google-sheets/google-sheets-client.ts`) uses **Google Apps Script `SpreadsheetApp`** (`APPS_SCRIPT_GATEWAY`). Sheets API v4 REST is **not** used by the current client (`createServiceAccountJwtAssertion` in `google-auth.ts` is an unused optional helper).

---

## 1. Google Apps Script Quotas (Active Architecture)
Source: `https://developers.google.com/apps-script/guides/services/quotas` & `https://developers.google.com/apps-script/reference/cache/cache` (accessed 2026-11-18).

| Quota | Consumer Free (`@gmail.com`) | Google Workspace | Impact on AVANI AI CRM |
|-------|------------------------------|------------------|------------------------|
| **Max Execution Time** | 6 min / execution | 6 min / execution | Single `GET_SNAPSHOT` or `UPSERT_ROW` completes in <2s for test sizes. |
| **Simultaneous Executions / User** | 30 | 30 | `USER_DEPLOYING` shares 30 concurrent slots across all callers. |
| **Simultaneous Executions / Script** | 1,000 | 1,000 | Secondary ceiling above per-user 30 limit. |
| **Properties Read/Write** | 50,000 / day | 500,000 / day | 2 `PropertiesService` reads per `doPost` (`ALLOWED_SPREADSHEET_ID`, `GATEWAY_HMAC_SECRET`). |
| **URL Fetch Calls** | 20,000 / day | 100,000 / day | 0 used by inbound `doPost(e)`. |
| **`CacheService` Limits** | 100 KB/key, 250-char key, 1,000 items max, 600s max TTL | Same | Exceeding 1,000 nonces in 10 min evicts 900 oldest items. |
| **`LockService.waitLock(10000)`** | 10s lock timeout | 10s lock timeout | Serializes writes; bursts >10s throw lock timeout (`503`). |

## 2. Google Sheets API v4 Quotas (Reference Only — Not Used by `APPS_SCRIPT_GATEWAY`)
Source: `https://developers.google.com/workspace/sheets/api/limits` (accessed 2026-11-18).
- **Read/Write Limits:** 300 requests/min/project; 60 requests/min/user/project (tracked separately for reads and writes; batching counts as 1 request). Exceeding returns HTTP `429 RESOURCE_EXHAUSTED` requiring exponential backoff with jitter.

## 3. Re-Calculated Task 5H.9 Scenarios (Using Actual `APPS_SCRIPT_GATEWAY` Architecture)

| Scenario | Gateway Executions | `SpreadsheetApp` Ops | Sheets API v4 REST Calls | Properties Reads | Retry Overhead (Est. 5%) |
|----------|--------------------|----------------------|--------------------------|------------------|--------------------------|
| **A – Small** (10 leads, 20 reads, 10 writes, 5 webhooks) | ~35 `doPost` runs | ~35 tab ops | **0** | ~70 | ~2 |
| **B – Moderate** (100 leads, 200 reads, 100 writes, 50 webhooks) | ~350 `doPost` runs | ~350 tab ops | **0** | ~700 | ~18 |
| **C – Larger** (500 leads, 1,000 reads, 500 writes, 250 webhooks) | ~1,750 `doPost` runs | ~1,750 tab ops | **0** | ~3,500 | ~88 (pace <= 20–30 req/min to avoid `30` simultaneous lock contention) |
