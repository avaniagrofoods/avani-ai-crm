# AVANI AI CRM — PRODUCTION ROLLBACK PLAN & DISASTER RECOVERY RUNBOOK
## Emergency Procedures, Rollback Triggers & Rapid Mitigation Protocols

**Application:** AVANI AI CRM  
**Target Domain:** `https://avani-ai-crm.vercel.app`  
**Known Stable Production Deployment:** `dpl_BpKkmTmjZNnyULZ7XXhgNvTSSMU6`  
**Document Classification:** Disaster Recovery & Operational Continuity  
**Effective Date:** 31 October 2026

---

## 1. ROLLBACK TRIGGERS (WHEN TO EXECUTE IMMEDIATELY)

A production rollback must be initiated immediately upon detection of any of the following triggers:

1. **Trigger A (Runtime Failure):** Post-deployment production health check `/api/health` returns HTTP 500, HTTP 503, or fails to respond within 15 seconds.
2. **Trigger B (Database Failure):** `/api/health` reports `database: {"status": "BLOCKED"}` or connection timeouts persist for >60 seconds.
3. **Trigger C (Isolation Breach):** Programmatic logs report `CROSS-APPLICATION BREACH` or attempts to connect to `avani_loan_services_*` or `xj6nhak`.
4. **Trigger D (Messaging Loop):** Provider dispatches duplicate WhatsApp messages or sends unsolicited messages to non-consenting users.
5. **Trigger E (Data Corruption):** Unintended schema mutations or missing records observed after deployment.

---

## 2. EMERGENCY ROLLBACK PROCEDURES

### PROCEDURE 1: Instant Vercel Deployment Rollback (< 60 Seconds)
If the new production deployment fails or causes errors, roll back immediately to the prior stable deployment:

1. **Via Vercel CLI:**
   ```bash
   npx vercel rollback dpl_BpKkmTmjZNnyULZ7XXhgNvTSSMU6
   ```
2. **Via Vercel Web Console:**
   - Go to [Vercel Dashboard](https://vercel.com/avaniagrofoods1356-4705s-projects/avani-ai-crm).
   - Click **Deployments**.
   - Locate prior stable deployment `dpl_BpKkmTmjZNnyULZ7XXhgNvTSSMU6` (Created 14 Aug 2026).
   - Click the three-dots menu (`...`) and select **Promote to Production** / **Rollback to this Deployment**.

---

### PROCEDURE 2: Immediate Outbound Messaging Fail-Safe (< 2 Minutes)
If a provider issue or messaging runaway occurs:

1. In Vercel Project Settings → `Environment Variables`:
   - Set `PROVIDER_MODE` = `mock` for **Production**.
2. Trigger an immediate redeployment:
   ```bash
   npx vercel redeploy
   ```
3. **Result:** All outgoing WhatsApp, SMS, Meta, and Voice requests will be immediately intercepted and routed to the in-memory/ledger mock store. Zero external network messages will be sent to customers.

---

### PROCEDURE 3: Production Database Snapshot Restoration (< 10 Minutes)
If data corruption occurred during a failed cutover:

1. **Prerequisite:** Pre-cutover snapshot directory `backup_pre_cutover_<TIMESTAMP>` created via `mongodump`.
2. **Restore Command:**
   ```bash
   mongorestore --uri="<MASKED_PRODUCTION_MONGODB_URI>" --drop "./backup_pre_cutover_<TIMESTAMP>/avani_ai_crm_prod"
   ```
3. **Verification Command:**
   Verify document counts and index integrity in `mongosh`:
   ```javascript
   use avani_ai_crm_prod;
   db.leads.countDocuments();
   db.contacts.countDocuments();
   db.leads.getIndexes();
   ```

---

## 3. POST-ROLLBACK VERIFICATION CHECKLIST

After executing any rollback procedure, verify:

- [ ] 1. Domain `https://avani-ai-crm.vercel.app` loads without 502/504 errors.
- [ ] 2. `/api/health?check=liveness` returns `HTTP/2 200 OK`.
- [ ] 3. No live customer notifications are exiting the system.
- [ ] 4. Incident timeline, trigger cause, and error logs are documented for post-mortem review.
- [ ] 5. Operations team is notified via Slack or email.
