# TASK 5H.5 — GOOGLE QUOTA AND COST REVIEW
**Cost Ceiling:** ₹0 INR / $0 USD (100% Free-Tier Verification)

---

## 1. Official Google Free-Tier Quotas Verified
1. **Google Sheets API v4 (Free Tier):**
   - **300 read/write requests per minute per project**
   - **60 read/write requests per minute per user**
   - **10,000,000 cells maximum per spreadsheet** (no per-day billing when staying within per-minute quotas; requires $0 Google Cloud project only if using Service Account REST API, or **$0 with zero Cloud project** when using Google Apps Script).
2. **Google Apps Script Consumer Free Tier:**
   - **6 minutes maximum execution time per invocation**
   - **30 simultaneous executions**
   - **20,000 `UrlFetchApp` calls/day** (N/A for inbound `doPost` from Next.js)
   - **Zero billing / zero credit card required** for standard Google account + bound Apps Script Web App.

## 2. Conservative Request Budget & Recommendations
- **Current Usage Profile (`listHydratedLeads()`):** Issues 6 `GET_ALL` calls per dashboard/leads load; `registerOrUpdateCustomerLead()` issues up to 4–6 calls. At **10 concurrent dashboard refreshes/min**, this reaches ~60 req/min (the per-user ceiling).
- **Recommendations:**
  1. Add a batched `GET_SNAPSHOT` action in Apps Script returning all CRM tabs in 1 HTTP call (6x quota reduction).
  2. Keep `executeWithControlledBackoff()` capped at `maxRetries = 2` (3 total attempts) with exponential backoff + jitter for `429`/`503` only, never infinite loops.
  3. Monitor `writeCount`/`readCount` telemetry and return `429 GOOGLE_SHEETS_QUOTA_EXCEEDED` cleanly.
