# TASK 5H.11C — COST, PRIVACY AND SECURITY REVIEW
- **Google Sheets Usage:** Free consumer `@gmail.com` account (20M-cell workbook limit, ₹0 direct fee).
- **Apps Script Execution:** Free tier (`6 min/exec`, `30 simultaneous/user`, `50k Properties/day`, `1,000 CacheService items`, ₹0 direct fee).
- **Google Cloud / API / Billing Dependencies:** **None** for `SpreadsheetApp` isolated test architecture; billing NOT activated.
- **Future Scale Limitations:** Public `/exec` (`ANYONE_ANONYMOUS`) exposes execution quotas to DoS if URL leaks; production migration should use Service Account + Sheets API v4 REST and durable KV for A-04.
- **Privacy:** Synthetic `TEST_*` data only; zero real customer data, documents, or recordings.
