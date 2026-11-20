# 08 — REMAINING RISKS AND DEPENDENCIES REGISTER
## OPERATIONAL RISK ASSESSMENT & OWNER DECISION ITEMS

**Document Version:** 1.0.0  
**Date:** 2026-11-19T21:20:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Technical Project Manager & Enterprise Risk Officer  

---

### 1. OPERATIONAL RISK MATRIX

| Risk ID | Risk Description | Severity | Likelihood | Impact | Operational Safeguard / Mitigation |
|---|---|---|---|---|---|
| **RSK-INT-01** | Accidental broadcast to real leads during testing. | **CRITICAL** | Zero | Unsolicited marketing breach. | Hard recipient clamp (`evaluateAuthorizedTestRecipient`) blocks live sends in non-production. |
| **RSK-INT-02** | Contamination of test sheet with real customer PII. | **CRITICAL** | Zero | DPDP Act violation. | Strict synthetic-only rule enforced; zero real PII in `AVANI_AI_CRM_ISOLATED_TEST`. |
| **RSK-INT-03** | Google Apps Script quota limits on burst API writes. | **MEDIUM** | Low | HTTP 429 throttling. | Client implements exponential backoff and batch row operations. |
| **RSK-INT-04** | Out-of-order WhatsApp delivery status callbacks. | **MEDIUM** | Low | Status regression. | Monotonic state transitions enforced in `canTransitionStatus` (`sent` $\rightarrow$ `delivered` $\rightarrow$ `read`). |
| **RSK-INT-05** | Production database fallback ambiguity. | **HIGH** | Zero | Data splitting between MongoDB and Sheets. | Hard isolation guard actively blocks customer writes to MongoDB. |

---

### 2. OWNER ACTIONS REQUIRED FOR GATE 4 PRODUCTION GO-LIVE

To transition the verified system into live production operations, the owner must provide explicit decision on the following 3 items:

1. **Designate Production Google Spreadsheet:** Confirm whether to create a dedicated production spreadsheet (`AVANI_AI_CRM_PRODUCTION_MASTER`) or use the current verified sheet.
2. **Authorise Git Push & Production Vercel Deploy:** Authorise staging and committing Project 2 changes to GitHub `origin/main` to trigger the production Vercel build.
3. **Register Meta Webhook Callback:** Update the production callback URL in the Meta Developer Console (`https://www.avanifinserv.com/api/chatmitra-webhook`).
