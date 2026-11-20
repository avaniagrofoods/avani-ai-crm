# TASK 5H.11F — REPORT 9
## Gate 2 Isolated Resource Pre-Creation Checklist

- **Task:** 5H.11F — Action F Preparation
- **Target Resources:**
  1. Google Spreadsheet: `AVANI_AI_CRM_ISOLATED_TEST`
  2. Apps Script Project: `AVANI_AI_CRM_TEST_GATEWAY` (Container-bound)
- **Status:** **PRE-FLIGHT VERIFIED — PENDING OWNER GATE 2 AUTHORIZATION**

---

### 1. Mandatory Pre-Flight Criteria Checklist

Every requirement below must be met before creating test resources:

- [x] **Criterion 1 — Version 1 Containment:** Version 1 deployment (`AKfycbwu...HAJMI`) confirmed archived. Former `/exec` URL is inactive.
- [x] **Criterion 2 — Document Redaction:** All plaintext `/exec` URLs removed from `AVANI_AI_CRM_ISOLATED_TEST.txt` and project docs.
- [x] **Criterion 3 — Synthetic Data Isolation:** Zero real customer or borrower records will be used. All seed rows must use synthetic prefixes (`TEST_CUST_`, `TEST_LEAD_`, `TEST_APP_`).
- [x] **Criterion 4 — Nine-Tab Canonical Structure:** Spreadsheet must contain exactly 9 tabs (`CUSTOMERS`, `LEADS`, `APPLICATIONS`, `FOLLOWUPS`, `CONSENTS`, `MESSAGE_EVENTS`, `WEBHOOK_EVENTS`, `ADVISORS`, `SYSTEM_CONFIG`).
- [x] **Criterion 5 — No MongoDB Fallback:** CRM database layer operates purely with Google Sheets for core business records.
- [x] **Criterion 6 — Production CRM Disconnection:** The production Next.js instance, live Vercel deployments, and production database remain completely disconnected from this test sheet.
- [x] **Criterion 7 — Dedicated Test Account:** Resources must reside under the dedicated test Google account; personal or production Google Drive spaces are strictly prohibited.
- [x] **Criterion 8 — No Apps Script Deployment in Gate 2:** The Apps Script project will be created container-bound and populated with `gateway.gs` code, but **WILL NOT BE DEPLOYED** as a Web App until formal Gate 3 approval.
- [x] **Criterion 9 — Secret Storage Isolation:** The HMAC secret is generated cryptographically and never committed to Git, hardcoded in `.gs` source files, or logged in Markdown reports.
- [x] **Criterion 10 — Zero Paid Expenditure:** Creation uses standard free Google Drive/Sheets capabilities; zero billing or paid subscriptions enabled.

---

### 2. Execution Sequence for Gate 2

When the Owner provides the formal Gate 2 authorization:
1. **Spreadsheet Creation:** Create a new Google Spreadsheet titled `AVANI_AI_CRM_ISOLATED_TEST`.
2. **Sheet Tabs Configuration:** Rename the default sheet to `CUSTOMERS`, create the remaining 8 canonical tabs, and populate header rows matching `src/lib/google-sheets/sheet-schema.ts`.
3. **Container-Bound Script Creation:** In the spreadsheet menu, navigate to *Extensions $\rightarrow$ Apps Script*. Name the project `AVANI_AI_CRM_TEST_GATEWAY`.
4. **Code Population:** Paste the hardened `gateway.gs` code from `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`. Save the project.
5. **Stop Condition:** Do NOT click Deploy. Halt and present the Gate 2 Completion Report.
