# TASK 5H.9 — GOOGLE ACCOUNT & API REQUIREMENTS
**Access Date:** 18 November 2026

---

## 1. Requirements Classification (Apps Script Gateway Architecture)

| Requirement | Classification | Details & Official Source |
|-------------|----------------|---------------------------|
| **Standard Free Google Account** | **REQUIRED** | Sufficient to create `AVANI_AI_CRM_ISOLATED_TEST` and deploy a container-bound Apps Script Web App (`Execute as: Me`). Official docs: https://developers.google.com/apps-script/guides/web (accessed 2026-11-18). |
| **Apps Script Web App (`Execute as: Me`, `Who has access: Anyone`)** | **REQUIRED** | Needed so the local Node.js CRM server can POST signed JSON envelopes without interactive Google login. Security is enforced inside `doPost(e)` via HMAC-SHA256 + `ALLOWED_SPREADSHEET_ID` + `CacheService` nonce check (anonymous unauthenticated callers are rejected with `401`). |
| **Google Cloud Project** | **NOT REQUIRED** | Container-bound Apps Script projects use a default internal script project and do not require creating a GCP project or billing account. |
| **Google Sheets REST API v4 Enablement** | **NOT REQUIRED** | Apps Script accesses the bound spreadsheet via native `SpreadsheetApp`, avoiding Sheets API v4 OAuth/Service Account setup. |
| **OAuth 2.0 Consent Screen / Service Account** | **NOT REQUIRED** | Only needed if switching to direct Sheets API v4 REST calls in `google-auth.ts` (`createServiceAccountJwtAssertion`). |
| **Google Workspace Paid Plan** | **NOT REQUIRED** | Consumer free Google account supports 6-min execution limit and `LockService`/`CacheService`. |
| **Spreadsheet Permissions** | **REQUIRED (Narrowest)** | Private to the single test owner account ("Restricted — Only people with access"); **never** shared as "Anyone with the link". |
