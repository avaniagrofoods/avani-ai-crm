# TASK 5H.10 — GATE 1 OWNER APPROVAL PACKAGE
**Status:** Ready for Explicit Owner Decision (Zero Live Resources Created)

1. **Corrected Architecture:** `AVANI_AI_CRM_ISOLATED_TEST` + bound `AVANI_AI_CRM_TEST_GATEWAY` (`SpreadsheetApp`, not Sheets API v4 REST).
2. **Access Model:** `USER_DEPLOYING` ("Execute as: Me") + `ANYONE_ANONYMOUS` ("Anyone") + HMAC-SHA256 JSON envelope (acceptable for **isolated test only**; Service Account + Sheets API v4 recommended for production).
3. **Google Account:** Standard free `@gmail.com` account (no GCP project, no billing, no OAuth consent screen).
4. **9-Tab Test Schema:** Exact 9 tabs from `src/lib/google-sheets/sheet-schema.ts` (`CUSTOMERS` 8, `LEADS` 10, `APPLICATIONS` 10, `FOLLOWUPS` 10, `CONSENTS` 8, `MESSAGE_EVENTS` 8, `WEBHOOK_EVENTS` 8, `ADVISORS` 6, `SYSTEM_CONFIG` 3).
5. **Staged Gates (Strict Separation):**
   - **Gate 1 (Current):** Approve this corrected test plan. *(Does NOT authorize Gate 2.)*
   - **Gate 2:** Separate approval to create `AVANI_AI_CRM_ISOLATED_TEST` (restricted sharing, 9 header rows).
   - **Gate 3:** Separate approval to deploy `AVANI_AI_CRM_TEST_GATEWAY` (`Code.gs` + `GATEWAY_HMAC_SECRET` + `ALLOWED_SPREADSHEET_ID`).
   - **Gate 4:** Separate approval to set local `.env.test` (`SAFE_MODE_FORCE_SUPPRESS=true`) and run `IT-A01`–`IT-E06` with `TEST_*` synthetic data.
   - **Gate 5:** Independent read-only live test audit & test-row cleanup verification.
