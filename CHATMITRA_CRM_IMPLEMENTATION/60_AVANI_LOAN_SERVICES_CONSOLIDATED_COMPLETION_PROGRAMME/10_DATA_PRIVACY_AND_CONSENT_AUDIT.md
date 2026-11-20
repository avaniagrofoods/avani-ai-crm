# 10 — DATA PRIVACY AND CONSENT AUDIT REPORT
## DPDP ACT 2023 COMPLIANCE, SENSITIVE PII REDACTION & CONSENT CONTROLS

**Document Version:** 1.0.0  
**Date:** 2026-11-19T17:15:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Data Protection Auditor & Enterprise Security Lead  

---

### 1. LEGAL COMPLIANCE & PRIVACY MANDATE

Under India's **Digital Personal Data Protection Act (DPDP Act 2023)**:
1. **Purpose Limitation:** Customer personal data collected for loan advisory may not be processed for unrelated activities.
2. **Data Minimisation:** Collecting excessive identifiers (PAN, Aadhaar, DOB, Bank Statements) prior to lender sanction is strictly prohibited from shared master sheets.
3. **Consent Revocation:** Data principals must be provided simple, multi-lingual mechanisms to withdraw consent, which must be immediately enforced.

---

### 2. REDACTED & PROHIBITED SENSITIVE FIELDS

The following fields are strictly quarantined and prohibited from entering Google Sheets CRM master tables:

| Sensitive Field Category | Source Presence | Google Sheets Treatment | Compliance Action |
|---|---|---|---|
| **PAN / Income Tax ID** | Legacy eligibility forms | **COMPLETELY DROPPED** | Excluded from `sheet-schema.ts` |
| **Aadhaar Number** | Legacy eligibility forms | **COMPLETELY DROPPED** | Prohibited under UIDAI regulations |
| **Date of Birth (DOB)** | Legacy web forms | **COMPLETELY DROPPED** | Age inference only at lender stage |
| **CIBIL / Credit Score** | Lead qualification form | **COMPLETELY DROPPED** | Financial profiling restricted |
| **Bank Statements & Financials** | Document uploader | **COMPLETELY DROPPED** | Media storage disarmed |
| **Employment / Salary Slips** | Eligibility calculator | **COMPLETELY DROPPED** | Unnecessary at CRM lead stage |

---

### 3. CONSENT LIFECYCLE & AUDIT TRAIL

All consent events are captured in the canonical `CONSENTS` worksheet:
- `consent_id`: Deterministic event ID (`CON_<TIMESTAMP>_<CUST_ID>`)
- `customer_id`: Unique customer reference
- `channel`: `WHATSAPP`, `WEB_FORM`, `CALL`
- `consent_status`: `GRANTED`, `DENIED`, `WITHDRAWN`, `PENDING`
- `consent_source`: Inbound campaign tag or form ID
- `optout_status`: `OPTED_IN` or `OPTED_OUT`

**Audit Verdict:** **STAGE C10 COMPLETED AND VERIFIED.**
