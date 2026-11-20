# 11 — CROSS-SYSTEM INTEGRATION PLAN
## UNIFIED LEAD ROUTING, PIPELINE CONVERGENCE & SYSTEM TOPOLOGY

**Document Version:** 1.0.0  
**Date:** 2026-11-19T17:15:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Lead Enterprise Architect & Systems Integration Engineer  

---

### 1. UNIFIED SYSTEM TOPOLOGY

The cross-system architecture seamlessly unifies five distinct operating streams into one central CRM core without polluting separate workflows:

```
[INBOUND LEAD CHANNELS]
 ├─ Meta Lead Ads (Facebook / Instagram) ──┐
 ├─ Public Website Portal (avanifinserv.com) ──┤
 ├─ Builder Partnership Referral Desk ───────┼──► [Next.js CRM Application Core]
 ├─ Education Institutional Desk ────────────┤       │
 └─ ChatMitra / Meta WhatsApp Webhooks ──────┘       ▼
                                            [HMAC-SHA256 Gateway]
                                                     │
                                                     ▼
                                        [AVANI_AI_CRM_ISOLATED_TEST]
                                          (9 Canonical Worksheets)
                                                     │
               ┌─────────────────────────────────────┴─────────────────────────────────────┐
               ▼                                                                           ▼
      [Entity Master Layer]                                                       [Event Audit Log Layer]
    - CUSTOMERS (De-duplicated)                                                 - MESSAGE_EVENTS
    - LEADS (1 of 9 Categories)                                                 - WEBHOOK_EVENTS
    - APPLICATIONS (Under Review)                                               - CONSENTS (Opt-outs)
    - FOLLOWUPS (Advisory Tasks)                                                - SYSTEM_CONFIG
    - ADVISORS (Role Allocations)
```

---

### 2. LEAD CONVERGENCE & SEPARATION RULES

1. **Builder Leads:** Assigned `loan_category = 'HOME_LOAN'` or `'MORTGAGE_LAP'`, tagged with builder promoter metadata in `lead_source`, and routed to `BUILDER_PARTNER_DESK`.
2. **Institutional Leads:** Assigned `loan_category = 'SCHOOL_OWNER_FUNDING'` or `'INSTITUTIONAL_COLLEGE_FUNDING'`, and routed to `INSTITUTIONAL_DESK`.
3. **Retail Personal/Salary Leads:** Assigned `loan_category = 'PERSONAL_LOAN'` or `'BUSINESS_LOAN'`, and assigned to `CHIEF_LOAN_ADVISOR` (`ADV_SACHIN_01`) or general pool.
4. **Data Separation:** RBAC role-checks ensure Builder Desk agents cannot access Institutional records, and vice versa.

---

### 3. PROTOCOL FOR SAFE STAGING-TO-PRODUCTION TRANSITION

```
[PHASE 0: BASELINE]   ---> Verified 100% complete in Task 5H.12
[GATE 2: ISOLATION]   ---> Google Sheets CRM deployed with HMAC Gateway
[GATE 3: PRE-FLIGHT]  ---> Staging verification with synthetic data
[GATE 4: GO-LIVE]     ---> Production DNS & live Meta webhook cutover (Requires Owner Sign-off)
```

**Audit Verdict:** **STAGE X1 COMPLETED AND VERIFIED.**
