# AVANI AI CRM — OWNER ACTIONS REQUIRED FOR PRODUCTION RELEASE

**Target Application:** AVANI AI CRM  
**Target Domain:** `https://avani-ai-crm.vercel.app`  
**Current State:** Staging Verified (`● Ready`) | Production Hold (`NOT AUTHORIZED`)  
**Audit Date:** 31 October 2026  
**Document Purpose:** Clear Separation of Responsibilities & Explicit Owner Preconditions

---

## 1. EXECUTIVE SUMMARY: SEPARATION OF RESPONSIBILITIES

Under strict enterprise safety protocols, Antigravity cannot modify Atlas network access rules, alter live production environment variables, execute live customer messaging, or deploy to Production without explicit owner authorization.

This document clearly divides the **Completed Antigravity Actions** from the **Required Owner Actions** to eliminate ambiguity.

---

## 2. COMPLETED ANTIGRAVITY ACTIONS (VERIFIED & OPERATIONAL)

1. **Independent Verification of Current Baseline:**
   - Git repository state documented: Branch `release/stage1-hardening`, HEAD `03612636295405e1e43a46ad3397f6fafa8616c8`.
   - All 20 modified files and untracked files strictly preserved. Zero code discarded.
2. **Preview Cloud Runtime Acceptance:**
   - Verified active Preview deployment `dpl_7fkRwCyMAGEcKAN75hFP1ZYGpPDw` (`https://avani-ai-a05i56ixj-avaniagrofoods1356-4705s-projects.vercel.app`).
   - Verified runtime health via authenticated CLI: `status: "HEALTHY"`, `databaseReady: true`, `appMode: "staging"`, `providerMode: "mock"`.
   - Verified Vercel Team SSO deployment protection (HTTP 302 for unauthenticated requests).
3. **Staging Database Workflow Acceptance:**
   - Executed live synthetic workflow suite (`test_staging_workflow_acceptance.test.cjs`) against staging DB `avani_ai_crm_test` on cluster `rhpn2gh`.
   - 12 / 12 steps passed (synthetic lead creation, contact creation, conversation note persistence, duplicate prevention, consent guard, audit logging, and targeted cleanup with zero residue).
4. **Code-Level Safety Hardening:**
   - Verified `src/lib/db.ts` runtime guards against legacy `cluster0`, cross-app `xj6nhak`, and staging-to-prod connection attempts.
   - Verified DPDP Act 2023 consent validation and opt-out suppression.
   - Verified mock provider safety interceptors.
5. **Static & Regression Testing:**
   - TypeScript compilation: 0 errors (`npx tsc --noEmit`).
   - 89 / 89 local tests passing across 6 test suites.

---

## 3. REQUIRED OWNER ACTIONS (BLOCKING PRODUCTION CUTOVER)

The following 5 actions require the project owner's direct intervention in external consoles:

### OWNER ACTION 1: Resolve MongoDB Atlas Network Exposure (`HIGH PRIORITY`)
- **Current State:** Cluster `avani-loan-services-m0.rhpn2gh.mongodb.net` has `0.0.0.0/0` (Global Ingress) active.
- **Recommended Remediation:**
  1. Log into [Vercel Integrations](https://vercel.com/integrations/mongodbatlas).
  2. Install the **MongoDB Atlas Integration** and link it to Vercel project `avani-ai-crm`.
  3. Select Atlas Organization `sachin's Org - 2026-10-30` and Project `AVANI AI CRM`.
  4. Once connected, delete `0.0.0.0/0` from MongoDB Atlas (`Security → Network Access`).
- **Alternative Temporary Remediation:** In MongoDB Atlas console, edit the `0.0.0.0/0` rule and configure an auto-expiring window (e.g. 24 hours).

---

### OWNER ACTION 2: Update Production `MONGODB_URI` in Vercel (`HIGH PRIORITY`)
- **Current State:** The production `MONGODB_URI` in Vercel was configured 82 days ago (mid-August 2026) and points to a decommissioned cluster (`cluster0.mlcxcp.mongodb.net`). As a result, the live production CRM health is currently reporting `database: {"status": "BLOCKED"}`.
- **Action Required:**
  1. Log into [Vercel Dashboard](https://vercel.com/avaniagrofoods1356-4705s-projects/avani-ai-crm/settings/environment-variables).
  2. Edit `MONGODB_URI` for **Production**.
  3. Set the value to connect to `avani_ai_crm_prod` on the active Atlas cluster (`rhpn2gh`):
     ```
     mongodb+srv://starpowerzlatur2210_db_user:<SECRET_B>@avani-loan-services-m0.rhpn2gh.mongodb.net/avani_ai_crm_prod?authSource=admin&retryWrites=true&w=majority
     ```
  4. Confirm `starpowerzlatur2210_db_user` has `readWrite` access to `avani_ai_crm_prod` in Atlas `Security → Database Users`.

---

### OWNER ACTION 3: Execute Pre-Cutover Production Database Backup
- **Current State:** Free M0 tier does not provide automated point-in-time restores.
- **Action Required:**
  Before releasing new code to production, run a local snapshot using `mongodump`:
  ```bash
  mongodump --uri="<MASKED_PRODUCTION_MONGODB_URI>" --out="./backup_production_pre_cutover"
  ```

---

### OWNER ACTION 4: Review Production Messaging Credentials
- **Current State:** Live production health reports `aisensy.apiKey: "MISSING"`.
- **Action Required:**
  Confirm in Vercel Production Environment Variables that `AISENCY_WABA_API_KEY`, `WHATSAPP_PHONE_NUMBER_ID`, and `META_WEBHOOK_VERIFY_TOKEN` are populated with active, funded credentials.

---

### OWNER ACTION 5: Formal Written Authorization for Production Release
- **Action Required:**
  Once Actions 1 through 4 are complete, provide written approval:
  > *"Production configuration and Atlas network security verified. I authorize Antigravity to proceed with Production Cutover."*
