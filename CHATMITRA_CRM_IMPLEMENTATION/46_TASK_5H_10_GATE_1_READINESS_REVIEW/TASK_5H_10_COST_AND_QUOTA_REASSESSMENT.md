# TASK 5H.10 — COST AND QUOTA REASSESSMENT
**Financial Cost vs Technical/Operational Limitations**

---

## 1. Direct Financial Cost
- **Isolated Test Environment (`AVANI_AI_CRM_ISOLATED_TEST` + `AVANI_AI_CRM_TEST_GATEWAY`):** **₹0 INR / $0 USD** direct Google fee on a standard free Google account.

## 2. Operational & Technical Limitations (Not "Free & Unlimited")
- **Google Account Restrictions:** Consumer `@gmail.com` accounts are capped at 50,000 `PropertiesService` calls/day, 90 min/day trigger runtime, and 30 simultaneous executions; Google Workspace domain policies may restrict `ANYONE_ANONYMOUS` web apps if a corporate Workspace account is used instead of a personal `@gmail.com` test account.
- **Future Durable Session Storage (A-04):** Solving multi-instance session revocation (`auth-store.ts`) requires an external KV/Redis store (e.g., Upstash free tier or paid Redis) if scaled beyond a single instance.
- **Quota Exhaustion / API Changes:** Unpaced bursts >30 concurrent calls or public `/exec` URL abuse can exhaust Apps Script execution slots without billing alerts.
- **Maintenance Overhead:** Manual `Code.gs` copy/paste deployments and periodic pruning of `MESSAGE_EVENTS`/`WEBHOOK_EVENTS`.
