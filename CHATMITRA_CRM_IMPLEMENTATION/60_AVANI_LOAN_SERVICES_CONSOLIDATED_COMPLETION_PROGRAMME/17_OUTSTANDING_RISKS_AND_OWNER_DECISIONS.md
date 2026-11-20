# 17 — OUTSTANDING RISKS AND OWNER DECISIONS
## OPERATIONAL RISK REGISTER & OWNER APPROVAL DECISION ITEMS

**Document Version:** 1.0.0  
**Date:** 2026-11-19T17:15:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Technical Project Manager & Enterprise Risk Officer  

---

### 1. OUTSTANDING RISKS REGISTER

| Risk ID | Risk Description | Severity | Likelihood | Impact | Existing Operational Mitigation |
|---|---|---|---|---|---|
| **RSK-ECO-01** | Unsolicited outbound WhatsApp message dispatch to unconsented leads. | **CRITICAL** | Very Low | Telecommunication regulatory breach (TRAI / Meta). | Outbound messaging endpoints remain disarmed in application configuration. |
| **RSK-ECO-02** | Contamination of test spreadsheet with real customer PII. | **CRITICAL** | Zero | Privacy violation under DPDP Act 2023. | Air-gap enforced; only `[TEST_DATA]` with invalid phone numbers allowed in isolated sheet. |
| **RSK-ECO-03** | Google Apps Script quota limits on burst API writes. | **MEDIUM** | Low | Transient HTTP 429 delays during bulk import. | Client implements exponential backoff and batch row operations. |
| **RSK-ECO-04** | Loss of historical research due to accidental file cleanup. | **HIGH** | Zero | Loss of corporate memory. | Strict read-only file handling rules enforced across Project 1 and Project 2. |
| **RSK-ECO-05** | Production database fallback ambiguity. | **HIGH** | Zero | Data splitting between MongoDB and Sheets. | Hard isolation guard actively blocks customer writes to MongoDB. |

---

### 2. OWNER DECISIONS REQUIRED TO PROCEED TO PRODUCTION

The following 4 explicit decisions are submitted to the system owner:

#### Decision Item 1: Production Spreadsheet Resource Creation
- **Proposed Action:** Designate a dedicated production Google Spreadsheet (`AVANI_AI_CRM_PRODUCTION_MASTER`) to host live customer and lead records once live operations begin.
- **Owner Options:**
  - Option A (Recommended): Create a new isolated production spreadsheet separate from `AVANI_AI_CRM_ISOLATED_TEST`.
  - Option B: Retain `AVANI_AI_CRM_ISOLATED_TEST` as testing sandbox and defer production sheet until launch.

#### Decision Item 2: Production Code Deployment (Git Push & Vercel)
- **Proposed Action:** Stage, commit, and push verified changes in Project 2 to GitHub remote `origin/main` to trigger Vercel deployment.
- **Safety Guarantee:** Outbound WhatsApp messaging and live customer migration remain disarmed.

#### Decision Item 3: Meta Webhook Production Registration
- **Proposed Action:** Register the verified webhook callback URL (`https://www.avanifinserv.com/api/chatmitra-webhook`) in the Meta Developer Console for the WhatsApp Business Account.

#### Decision Item 4: External Cold Physical Backup
- **Proposed Action:** Connect an external NTFS storage drive of $\ge 50$ GB to perform a complete cold snapshot of the development workspace as specified in BLK-004.
