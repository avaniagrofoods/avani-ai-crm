# TASK 5H.10 — GATE 2 AUTHORIZATION REQUIREMENTS (NOT EXECUTED)
**Status:** **NOT APPROVED — AWAITING SEPARATE EXPLICIT OWNER AUTHORIZATION**

---

## 1. Exact Resources & Actions Requiring Gate 2 Approval
1. **Google Account Required:** Dedicated standard free consumer `@gmail.com` test account owned by AVANI LOAN SERVICES (avoids corporate Workspace domain restrictions on `ANYONE_ANONYMOUS` web apps; ₹0 cost, no GCP project or billing required).
2. **Exact Spreadsheet to Create:**
   - **Name:** `AVANI_AI_CRM_ISOLATED_TEST`
   - **Sharing:** Private ("Restricted — Only people with access", never public link).
   - **9-Tab Structure (Exact Headers from `src/lib/google-sheets/sheet-schema.ts`):**
     `CUSTOMERS` (8), `LEADS` (10), `APPLICATIONS` (10), `FOLLOWUPS` (10), `CONSENTS` (8), `MESSAGE_EVENTS` (8), `WEBHOOK_EVENTS` (8), `ADVISORS` (6), `SYSTEM_CONFIG` (3).
3. **Future Gate 3 Apps Script Resource (Separate Approval Required):**
   - Container-bound Apps Script project `AVANI_AI_CRM_TEST_GATEWAY` (`USER_DEPLOYING` + `ANYONE_ANONYMOUS` + `GATEWAY_HMAC_SECRET` + `ALLOWED_SPREADSHEET_ID`).
   - **Why `ANYONE_ANONYMOUS` is required for test:** Headless Node.js `fetch()` cannot pass interactive Google login cookies required by `MYSELF` or `ANYONE`.
4. **Endpoint Abuse Controls & Emergency Shutdown Procedure:**
   - Confidential `/exec` URL (never committed or exposed to browser), 64 KB cap, constant-time HMAC-SHA256, `CacheService` nonce check, `ALLOWED_SPREADSHEET_ID`.
   - **Emergency Shutdown:** In Apps Script **Deploy -> Manage deployments**, archive/disable the Web App deployment immediately (revokes `/exec` in <5 seconds) and clear `GATEWAY_HMAC_SECRET` in `ScriptProperties`.
5. **Expected Quotas, Workload & Cost:**
   - ₹0 direct cost; Scenarios A–C (35 / 350 / 1,750 `doPost` runs) paced <= 30 req/min within 30 simultaneous executions/user & 50,000 Properties/day limits. Zero billing account required.
6. **Data Isolation & Synthetic-Data Rules:**
   - Strictly `TEST_*` / `TEST_EVENT_*` records and synthetic mobiles (`+919000000001`–`+919000000099`). Zero real customer data, PAN, Aadhaar, or documents.
7. **Cleanup & Rollback Procedure:**
   - After Gate 5 audit: delete all synthetic `TEST_*` rows (or trash `AVANI_AI_CRM_ISOLATED_TEST`), archive the Gate 3 deployment, and remove local `.env.test` test URL/secret.

**Explicit Gate 2 Owner Sign-Off Required Before Any Resource Creation.**
