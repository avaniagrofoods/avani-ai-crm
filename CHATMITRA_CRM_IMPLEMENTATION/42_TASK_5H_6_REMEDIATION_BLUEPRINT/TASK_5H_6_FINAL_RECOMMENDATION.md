# TASK 5H.6 — FINAL RECOMMENDATION
## Google Sheets CRM Remediation Architecture & Implementation Blueprint
**Project:** AVANI LOAN SERVICES – ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026 | **Mode:** Strictly Read-Only | **Budget:** ₹0 INR / $0 USD

---

## 1. Final Verdict
**A. Blueprint complete – ready for owner review.**

## 2. Actual Files Inspected & Exact Evidence Verified
- `src/lib/google-sheets/*` (15 modules): Confirmed `google-sheets-client.ts:397-407` sends `X-Avani-*` HTTP headers + `UPSERT_ROW`/`DELETE_ROW` (A-01); `sheet-schema.ts:34-124` defines `CUSTOMERS` (8), `APPLICATIONS` (10), `CONSENTS` (8) vs Apps Script 9/8/7 (A-02).
- `src/lib/auth.ts:14` & `src/lib/auth-store.ts:35-84`: Confirmed `SESSION_MAX_AGE_SECONDS = 28800` (8h) and process-local `Map` revocation/rate-limit registries defaulting `!doc` to `true` (A-04).
- `src/app/api/contacts/upload/route.ts`, `leads/upload/route.ts`, `chatmantra-webhook/route.ts`, `callkaro-webhook/route.ts`, `omnidim-webhook/route.ts:146-147`, `cron/follow-ups/route.ts`, `cron/process-scheduled/route.ts`, `broadcasts/create/route.ts`, `src/components/FileUpload.tsx:278`: Confirmed active MongoDB / CSV upload / `recordingUrl` references (A-03).
- `src/lib/optout-engine.ts` & `src/lib/db.ts`: Confirmed Task 3B (`रोकें`, `थांबवा`, `STOP`) and Task 5F/5F.2 isolation safeguards remain intact.

## 3. Findings Status
- **A-01 (CRITICAL):** Confirmed & blueprinted (JSON-body signed envelope + 6 actions).
- **A-02 (CRITICAL):** Confirmed & blueprinted (`sheet-schema.ts` as single source of truth).
- **A-03 (HIGH):** Confirmed & classified route-by-route.
- **A-04 (HIGH):** Confirmed (`8h` expiry + in-memory `Map` limits); zero-cost 30-min expiry mitigation + honest multi-instance limitation documented.
- **A-05 & A-06 (MEDIUM):** Confirmed & blueprinted (Apps Script constant-time HMAC, `CacheService` nonce cache, `ALLOWED_SPREADSHEET_ID`, formula guard, `GET_SNAPSHOT` batching).

## 4. Unresolved Risks Requiring Owner Decision
- Multi-instance durable session revocation cannot be solved with ₹0 in-memory storage alone (requires OD-04).
- `CacheService` in Apps Script is best-effort under memory pressure (not absolute replay immunity).

## 5. Read-Only Confirmation
Confirmed: **Zero** source files, tests, configurations, `.bak.pre_task5h4` backups, databases, Google accounts, or deployments were modified during Task 5H.6. Stopping now and awaiting Owner authorization before Task 5H.7.
