# TASK 5H.6 — EXECUTIVE SUMMARY
## Google Sheets CRM Remediation Architecture & Implementation Blueprint
**Project:** AVANI LOAN SERVICES – ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026 | **Mode:** Strictly Read-Only | **Budget:** ₹0 INR / $0 USD  
**Final Verdict:** **A. Blueprint complete – ready for owner review.**

---

## 1. Objective & Verification Outcome
This blueprint provides an implementation-ready, zero-cost remediation design for all six findings (**A-01 through A-06**) identified in Task 5H.5, verified directly against Project 2 source code (`3-AVANI AI CRM`) without modifying any source files, tests, configs, backups, or live Google/MongoDB services.

| Finding | Severity | Blueprint Summary |
|---------|----------|-------------------|
| **A-01** | **CRITICAL** | Standardize client (`google-sheets-client.ts`, `google-auth.ts`) and Apps Script (`doPost(e)`) on a single JSON-body signed envelope `{ requestId, timestampMs, payloadJson, signature }` because Google Apps Script `doPost(e)` cannot inspect custom HTTP request headers (`X-Avani-*`). Support `HEALTH_CHECK`, `GET_ALL`, `UPSERT_ROW`, `INSERT_IF_ABSENT`, `DELETE_ROW`, and batched `GET_SNAPSHOT`. |
| **A-02** | **CRITICAL** | Establish `SHEET_COLUMNS` in `src/lib/google-sheets/sheet-schema.ts` as the single 9-tab canonical source of truth and reconcile all column mismatches in Apps Script (`CUSTOMERS` 8 cols, `APPLICATIONS` 10 cols, `CONSENTS` 8 cols) and `TASK_5H_4_GOOGLE_SHEETS_SCHEMA.xlsx`. |
| **A-03** | **HIGH** | Classify all 38+ remaining MongoDB/model files and upload/recording paths (`contacts/upload`, `leads/upload`, `chatmantra-webhook`, `callkaro-webhook`, `omnidim-webhook` `recordingUrl`, `cron/*`, `broadcasts/*`, `FileUpload.tsx`) with explicit per-route actions (Migrate, Disable HTTP 410, or Strip Media). |
| **A-04** | **HIGH** | Document the exact 8-hour `SESSION_MAX_AGE_SECONDS` (`src/lib/auth.ts:14`) and process-local `Map` behavior (`src/lib/auth-store.ts`), compare 3 zero-cost/low-cost options, and recommend short-lived signed sessions (15–30 min) + explicit multi-instance revocation trade-off disclosure (never claiming shorter expiry equals durable revocation). |
| **A-05** | **MEDIUM** | Harden Apps Script `doPost(e)` with constant-time XOR HMAC compare, `CacheService.getScriptCache()` nonce tracking (noting best-effort eviction limits), `ALLOWED_SPREADSHEET_ID` check, payload size cap, and server-side formula-injection blocking. |
| **A-06** | **MEDIUM** | Add batched `GET_SNAPSHOT` read action (reducing 6 `GET_ALL` calls per dashboard/leads render to 1 call), document non-atomic multi-tab writes with idempotent retry recovery, and preserve capped exponential backoff (`maxRetries = 2`). |
