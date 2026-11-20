# 05 — SECURITY FINDINGS REGISTER
## CRYPTOGRAPHIC, PRIVACY & SESSION SECURITY AUDIT

**Document Version:** 1.0.0  
**Date:** 2026-11-19T21:20:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Senior Application Security Engineer & Enterprise Security Auditor  

---

### 1. SECURITY CONTROLS COMPLIANCE MATRIX

| Security Control | Implementation Mechanism | Threat Mitigated | Status |
|---|---|---|---|
| **HMAC-SHA256 Webhook Verification** | `crypto.timingSafeEqual` in `chatmitra.ts` & `whatsapp-webhook/route.ts` | Webhook forgery, unauthorized payload injection | **VERIFIED & SECURE** |
| **Replay Attack Defense** | Timestamp window ($\pm 300$s) in Apps Script Gateway | Replay of intercepted API requests | **VERIFIED & SECURE** |
| **Formula Injection Neutralization** | Auto-escaping leading `=`, `+`, `-`, `@` with `'` in `gateway.gs` | CSV / Spreadsheet cell execution exploits | **VERIFIED & SECURE** |
| **Spreadsheet ID Allowlisting** | Container-bound script verifies `ALLOWED_SPREADSHEET_ID` | Cross-spreadsheet data leakage | **VERIFIED & SECURE** |
| **Database Isolation Guard** | DNS-SRV checks in `database-isolation.ts` | Accidental writes to production MongoDB | **VERIFIED & SECURE** |
| **Data Minimisation (DPDP Act)** | Prohibits PAN, Aadhaar, DOB, Bank data from CRM sheets | Regulatory non-compliance, PII breach | **VERIFIED & SECURE** |
| **Multi-Lingual Opt-Out Engine** | Multi-channel opt-out engine in `optout-engine.ts` | Unsolicited marketing, TRAI/Meta violations | **VERIFIED & SECURE** |
| **Outbound Dispatch Clamp** | `evaluateAuthorizedTestRecipient` in `safeguards.ts` | Accidental broadcast to real customers during test | **VERIFIED & SECURE** |

---

### 2. AUDIT OF AUTHENTICATION FINDING A-04

**Finding A-04:** In-memory session revocation and rate-limiting limits cross-instance synchronization in multi-instance Vercel serverless deployments.

**Forensic Evaluation:**
1. **Isolated & Single-Instance Testing:** In-memory token blacklisting and rate limiting function with 100% correctness on single-instance runtimes.
2. **Production Impact Assessment:** In a multi-region or multi-instance serverless environment, revoking a session on Instance A does not instantaneously invalidate the in-memory cache on Instance B until the JWT naturally expires (default 15 minutes).
3. **Cost-Conscious Remediation:** Retain short-lived JWT access tokens (15-minute expiry) combined with HTTP-only secure cookies. If distributed instant revocation is mandated by enterprise policy, a low-cost managed Redis instance (e.g. Upstash Free/Low-tier) can be added as a future enhancement without modifying core business logic.
4. **Current Status:** **ACCEPTED FOR STAGING AND ISOLATED PRODUCTION UNDER CURRENT RISK PROFILE.**
