# TASK 5H.10 — GOOGLE ACCOUNT & CLOUD REQUIREMENTS
**Access Date:** 18 November 2026

| Component / Access Mechanism | Google Account | Google Cloud Project | Billing Account | Sheets API v4 Enablement | OAuth Consent Screen |
|------------------------------|----------------|----------------------|-----------------|--------------------------|----------------------|
| **Apps Script `SpreadsheetApp` + `USER_DEPLOYING` + `ANYONE_ANONYMOUS`** *(Selected for Test)* | **Mandatory** (Free consumer `@gmail.com` works) | **Not Required** (uses default internal Apps Script container) | **Not Required** | **Not Required** | **Not Required** |
| **Apps Script `USER_ACCESSING`** | Mandatory | Conditional | Not Required | Not Required | Conditional (per-user prompt) |
| **Sheets API v4 REST (Service Account)** *(Future Prod Option)* | Mandatory | **Mandatory** | Not Required (free tier) | **Mandatory** | Not Required (Service Account) |
| **Sheets API v4 REST (OAuth)** | Mandatory | **Mandatory** | Not Required | **Mandatory** | **Mandatory** |
