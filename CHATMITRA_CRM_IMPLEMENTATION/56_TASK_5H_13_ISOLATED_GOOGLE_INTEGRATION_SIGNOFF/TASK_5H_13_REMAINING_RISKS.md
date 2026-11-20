# TASK 5H.13 — REPORT 13
## Remaining Technical Risks & Pre-Production Open Items

- **Task:** 5H.13 — Section 13 & 16 Risk Tracking
- **Project Scope:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

---

### 1. Isolated Test Environment Risks (Immediate)

| Risk ID | Risk Description | Severity | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-TEST-01** | Deployment blocked on syntax error | HIGH | CLOSED | Clean JavaScript extracted into `src/lib/google-sheets/gateway.gs`; ready for Owner paste. |
| **RSK-TEST-02** | Schema mismatch on `CUSTOMERS` tab | HIGH | MITIGATED | Explicit 8-column header specification provided; delete columns I-P in Google Sheet. |
| **RSK-TEST-03** | Public Web App URL leakage | HIGH | LOW | URL stored solely in local `.env.local`; never committed to Git or printed in reports. |

---

### 2. Mandatory Pre-Production Open Items (Section 16)

The following items are strictly out-of-scope for isolated testing and **MUST** be resolved before any production deployment or real customer data migration:

1. **Durable Cross-Instance Session Revocation:** Replace in-memory token blacklist with a distributed key-value store (e.g., Upstash Redis) to ensure session invalidation propagates across Vercel serverless function instances.
2. **Distributed Rate Limiting:** Replace in-memory rate limiter with distributed token-bucket rate limiter.
3. **Formal Backup & Disaster Recovery:** Establish automated daily backups of Google Sheets to secondary storage with tested restore verification.
4. **Live Provider Webhook Verification:** Verify end-to-end production webhooks (Meta WhatsApp Business API, ChatMitra, Omnidim) with real cryptographic secret validation.
5. **Production Privacy & Retention Compliance:** Formal owner sign-off on data retention, borrower consent logs, and audit trail immutability.
