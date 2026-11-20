# 06 — SECURITY AND COMPLIANCE AUDIT
## DPDP ACT 2023, PII MINIMISATION & SESSION SECURITY REASSESSMENT

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-19T21:45:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Application Security Auditor & Data Protection Officer  

---

### 1. DATA MINIMISATION & ZERO-DOCUMENT STORAGE AUDIT

The auditor inspected the CRM codebase for compliance with the **Digital Personal Data Protection Act (DPDP Act 2023)**:

| Information Asset | System Treatment | Codebase Enforcement Point | Compliance Verdict |
|---|---|---|---|
| **Aadhaar Copies & Numbers** | Strictly prohibited; dropped from schema | Excluded from `sheet-schema.ts` | **COMPLIANT** |
| **PAN Card Copies & Tax IDs** | Strictly prohibited; dropped from schema | Excluded from `sheet-schema.ts` | **COMPLIANT** |
| **Bank Statements & Salary Slips** | Upload endpoint disabled; returns HTTP 410 | `src/app/api/documents/secure-upload/route.ts` | **COMPLIANT** |
| **WhatsApp Media Attachments** | Inbound images/docs rejected safely | `src/app/api/whatsapp-webhook-worker/route.ts` line 148 | **COMPLIANT** |
| **CIBIL / Credit Score Data** | Dropped from CRM lead intake | Sanitized during lead registration | **COMPLIANT** |
| **Formula Injection Strings** | Auto-escaped with single quote (`'`) | `gateway.gs` sanitized row mapper | **COMPLIANT** |

---

### 2. RE-EVALUATION OF FINDING A-04 (SESSION SECURITY)

**Finding A-04:** In-memory session revocation and in-memory rate limiting are not distributed across multi-instance serverless functions.

**Audit Findings & Risk Profile:**
1. **Isolated & Single-Instance Staging:** In-memory tracking operates with 100% reliability for single-instance runtimes.
2. **Multi-Instance Serverless Limitation:** On Vercel, requests are distributed across dynamic serverless container instances. A session token revoked on Instance 1 is not immediately visible on Instance 2 until the JWT token naturally expires.
3. **Current Safeguard:** JWT expiration is set to 15 minutes (`JWT_EXPIRY = '15m'`), limiting the window of exposure.
4. **Remediation Recommendation:** For production enterprise scaling, introduce a centralized low-latency store (e.g. Upstash Redis / Redis Free Tier) for instantaneous distributed session revocation and global rate limiting.
5. **Audit Classification:** **P2 — OPERATIONAL LIMITATION (ACCEPTED FOR GATE 3 STAGING; MUST BE MONITORED IN PRODUCTION).**
