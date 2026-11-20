# TASK 5H.5 — FINAL OWNER DECISION REPORT
## Independent Google Sheets CRM Implementation & Security Audit
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Audit Date:** 18 November 2026  
**Cost Incurred:** ₹0 INR / $0 USD

---

## 1. Formal Audit Decision

**DECISION: B – APPROVED WITH SPECIFIC REMEDIATIONS REQUIRED**

Task 5H.4 successfully eliminated MongoDB from the core CRM routes, built a clean 15-module Google Sheets repository layer, blocked `/api/documents/secure-upload` (`410`), and passed `tsc --noEmit` plus all 6 offline test suites. However, **before** authorizing any controlled live Google Account connection testing, the following remediations must be applied:

## 2. Prioritized Findings & Required Remediations

1. **A-01 (CRITICAL) — Align Apps Script Gateway Wire Protocol & Actions:**
   - **Evidence:** `google-sheets-client.ts` sends `X-Avani-*` HTTP headers + `UPSERT_ROW`/`DELETE_ROW`; Apps Script `doPost(e)` cannot read HTTP headers and expects JSON body `{ timestamp, nonce, payloadJson, signature }` + `UPSERT`.
   - **Remediation:** Standardize on a JSON-body signed envelope `{ requestId, timestampMs, payloadJson, signature }` and support `HEALTH_CHECK`, `GET_ALL`, `UPSERT_ROW`, `INSERT_IF_ABSENT`, `DELETE_ROW` (plus batched `GET_SNAPSHOT`).

2. **A-02 (CRITICAL) — Reconcile 9-Tab Schema Between `sheet-schema.ts` and Apps Script:**
   - **Evidence:** Column count/order mismatches on `CUSTOMERS` (8 vs 9), `APPLICATIONS` (10 vs 8), and `CONSENTS` (8 vs 7).
   - **Remediation:** Update `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md` and `TASK_5H_4_GOOGLE_SHEETS_SCHEMA.xlsx` to match `SHEET_COLUMNS` in `src/lib/google-sheets/sheet-schema.ts` 1:1.

3. **A-03 (HIGH) — Disable/Migrate Remaining Legacy MongoDB & Upload/Recording Routes:**
   - **Evidence:** `contacts/upload`, `leads/upload`, `chatmantra-webhook`, `callkaro-webhook`, `omnidim-webhook` (`recordingUrl`), `cron/*`, `broadcasts/*`, and `FileUpload.tsx` still reference MongoDB or file uploads.
   - **Remediation:** Return `410` on `contacts/upload` and `leads/upload`, strip `recordingUrl` in `omnidim-webhook`, and disable/migrate `chatmantra-webhook` and `cron/*`.

4. **A-04 (HIGH) — Mitigate In-Memory Session Revocation Reset Risk:**
   - **Evidence:** `src/lib/auth-store.ts` `sessionRegistry` and `rateLimitRegistry` are process-local `Map`s; `isSessionActiveInDb` defaults to `true` when `!doc`.
   - **Remediation:** Shorten `SESSION_MAX_AGE_SECONDS` to 15–30 minutes (₹0) or adopt a free-tier KV store if approved in a future task.

5. **A-05 & A-06 (MEDIUM) — Apps Script Hardening & Batched Reads:**
   - Add constant-time HMAC check, `CacheService` nonce replay tracking, `ALLOWED_SPREADSHEET_ID` check, Apps Script formula-injection check, and a batched `GET_SNAPSHOT` read action.

---

**Audit Complete.** Awaiting Owner authorization for Task 5H.5 remediation execution.
