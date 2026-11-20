# TASK 5H.11B — APPS SCRIPT SOURCE SECURITY AUDIT
**Audit Date:** 19 November 2026

## 1. Local Documented Source vs Live Deployed Version 1
- **Local Reference (`TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`):** Contains `doPost(e)` (no `doGet(e)`), `constantTimeEqualHex_`, `MAX_CLOCK_SKEW_MS = 300000`, `CacheService` nonce tracking, `ALLOWED_SPREADSHEET_ID`, `GATEWAY_HMAC_SECRET`, `EXPECTED_TABS`, `isUnsafeFormulaCell_`, `MAX_BODY_BYTES = 65536`, `LockService.waitLock(10000)`, and sanitized errors.
- **Live Deployed Version 1 Code & `ScriptProperties`:** **NOT VERIFIED** — Antigravity has no read-only access to the live Apps Script editor or `PropertiesService` store without an authenticated Google session. Therefore, whether Version 1 actually contains the remediated Task 5H.7 code, whether `doGet(e)` is absent, and whether `GATEWAY_HMAC_SECRET` / `ALLOWED_SPREADSHEET_ID` are set are all **NOT VERIFIED**.
