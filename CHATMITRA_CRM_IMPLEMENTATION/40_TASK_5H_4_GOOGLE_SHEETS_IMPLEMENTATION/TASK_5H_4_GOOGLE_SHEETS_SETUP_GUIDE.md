# TASK 5H.4 — GOOGLE SHEETS SETUP GUIDE
**Status:** Reference Guide for Future Owner-Authorized Provisioning (NOT Executed in Task 5H.4)

---

## 1. Zero-Cost Prerequisites
1. Standard free Google account owned by AVANI LOAN SERVICES.
2. Create one spreadsheet named `AVANI_LOAN_SERVICES_CRM_MASTER`.
3. Create the exact 9 tabs and paste the exact header rows from `TASK_5H_4_GOOGLE_SHEETS_SCHEMA.xlsx` (`CUSTOMERS`, `LEADS`, `APPLICATIONS`, `FOLLOWUPS`, `CONSENTS`, `MESSAGE_EVENTS`, `WEBHOOK_EVENTS`, `ADVISORS`, `SYSTEM_CONFIG`).

## 2. Google Apps Script Gateway Setup
1. Open **Extensions -> Apps Script** inside `AVANI_LOAN_SERVICES_CRM_MASTER`.
2. Paste the script from `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`.
3. In **Project Settings -> Script Properties**, add `GATEWAY_HMAC_SECRET` (minimum 32 random characters).
4. Click **Deploy -> New deployment -> Web app** (`Execute as: Me`, `Who has access: Anyone`) and copy the Web App URL.

## 3. CRM Environment Variables (Future Live Integration Only)
- `GOOGLE_SHEETS_TRANSPORT_MODE=APPS_SCRIPT_GATEWAY`
- `GOOGLE_SHEETS_GATEWAY_URL=<Apps Script Web App URL>`
- `GOOGLE_SHEETS_GATEWAY_SECRET=<matching GATEWAY_HMAC_SECRET>`
- `SESSION_SECRET=<32+ char secret>`
- `INTERNAL_WORKER_SECRET=<32+ char secret>`
- `CHATMITRA_WEBHOOK_SECRET=<provider secret>`
