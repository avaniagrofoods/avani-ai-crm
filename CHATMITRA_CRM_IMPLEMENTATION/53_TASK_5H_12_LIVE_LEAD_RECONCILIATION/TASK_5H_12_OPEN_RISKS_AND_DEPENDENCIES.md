# TASK 5H.12 — OPEN RISKS AND DEPENDENCIES REGISTER
## SECURITY, PRIVACY & PRODUCTION READINESS RISK AUDIT

**Document Version:** 1.0.0  
**Date:** 2026-11-19T16:55:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Technical Project Manager & Data Protection Auditor  

---

### 1. OPEN RISKS & MITIGATION MATRIX

| Risk ID | Risk Description | Severity | Impact | Mitigation Strategy & Operational Safeguard |
|---|---|---|---|---|
| **RISK-5H12-01** | Accidental import of live customer PII into test sheet. | **CRITICAL** | Privacy violation under DPDP Act 2023. | **MITIGATED:** Strict programmatic filter enforced. Only `[TEST_DATA]` with invalid phone numbers (`+9199990001XX`) can be ingested into `AVANI_AI_CRM_ISOLATED_TEST`. |
| **RISK-5H12-02** | Google Apps Script quota exhaustion (daily read/write limits). | **MEDIUM** | Gateway throttles during heavy batch processing. | **MITIGATED:** Client implements exponential backoff and batch row operations. Live imports must be paced. |
| **RISK-5H12-03** | Inadvertent trigger of live WhatsApp or AI calling campaigns. | **HIGH** | Unsolicited messages to customers. | **MITIGATED:** External communication channels remain disabled in `.env.local` and application configuration. |
| **RISK-5H12-04** | Live source sheet (`AVANI LOAN SERVICE FY26-27`) accidental modification. | **HIGH** | Corrupts operational business lead data. | **MITIGATED:** Live source URL is completely decoupled from the CRM client. The CRM client only has the ID of `AVANI_AI_CRM_ISOLATED_TEST`. |
| **RISK-5H12-05** | Production database fallback ambiguity. | **HIGH** | Data written to MongoDB instead of Sheets. | **MITIGATED:** Database isolation guard enforces zero MongoDB customer fallback. Tests confirm strict disconnection. |

---

### 2. EXTERNAL DEPENDENCIES

1. **Gate 3 Authorization (Production Readiness):** Transition from isolated synthetic testing to staging or production migration requires explicit written authorization from the system owner.
2. **Meta Webhook Endpoint Registration:** Connecting live Meta Lead Ads directly to the CRM requires updating the Meta Developer App webhook callback URL to the verified Next.js production endpoint once deployed.
3. **Google Service Account Credentials:** Direct server-to-server Google Sheets API access (bypassing Apps Script Web App) remains optional and deferred until enterprise scaling requires it.
