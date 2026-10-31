# AVANI AI CRM — PRODUCTION CUTOVER CHECKLIST & EXECUTION RUNBOOK
## Pre-Cutover Validation, Phased Execution, Stop Conditions & Verification Protocol

**Application:** AVANI AI CRM  
**Target Domain:** `https://avani-ai-crm.vercel.app`  
**Execution Date:** Scheduled Post-Security Clearance (Current State: 31 October 2026)  
**Execution Authority:** STRICTLY RESERVED FOR OWNER AUTHORIZATION  
**Current Execution Status:** **`HOLD — EXECUTION PROHIBITED`**

---

## 1. PRE-CUTOVER OWNER PRIVATE VERIFICATION (PHASE 0)

The owner must verify each item privately prior to authorizing any cutover steps:

- [ ] **1. Atlas Security Decision:** Confirm Vercel-MongoDB Atlas Marketplace integration installed OR temporary TTL rule configured in Atlas console.
- [ ] **2. Production Database Privilege:** Verify in Atlas `Security → Database Users` that `starpowerzlatur2210_db_user` has `readWrite@avani_ai_crm_prod` privileges on cluster `rhpn2gh`.
- [ ] **3. Pre-Cutover Database Backup:** Execute `mongodump` of `avani_ai_crm_prod` (even if empty) to capture baseline schema/indexes:
  ```bash
  mongodump --uri="<MASKED_PRODUCTION_URI>" --out="./backup_pre_cutover"
  ```
- [ ] **4. Production Messaging Account Status:** Verify AiSensy / Meta Cloud WABA balance and wallet status for sender `+91 72491 08474`.
- [ ] **5. Verification of Current Production Deployment ID:** Confirm prior deployment `dpl_BpKkmTmjZNnyULZ7XXhgNvTSSMU6` is noted for instant rollback.

---

## 2. PRE-CUTOVER STOP CONDITIONS (HALT IMMEDIATELY IF ANY APPLY)

Execution must **IMMEDIATELY HALT** and rollback if:
1. `0.0.0.0/0` is deleted in Atlas without establishing the Vercel integration first (causes instant preview/staging drop).
2. Production `MONGODB_URI` contains `avani_loan_services_prod` or `xj6nhak` (cross-application data breach).
3. Production `MONGODB_URI` contains `cluster0.mlcxcp.mongodb.net` (legacy decommissioned host).
4. Live health check `/api/health` returns HTTP 500/503 or `readyState != 1` after updating variables.
5. `PROVIDER_MODE=live` is enabled before completing mock-mode smoke tests.
6. Real customer records are observed during smoke testing.

---

## 3. PHASED EXECUTION SEQUENCE

### Stage 1: Owner Actions (Environment Configuration)
*Only the business owner performs these actions in the respective provider dashboards:*

- [ ] **Step 1.1:** Log in to Vercel Dashboard → `avani-ai-crm` → `Settings` → `Environment Variables`.
- [ ] **Step 1.2:** Locate `MONGODB_URI` for **Production** environment.
- [ ] **Step 1.3:** Update the value to point to `avani_ai_crm_prod` on cluster `avani-loan-services-m0.rhpn2gh.mongodb.net`:
  ```
  mongodb+srv://starpowerzlatur2210_db_user:<SECRET_B>@avani-loan-services-m0.rhpn2gh.mongodb.net/avani_ai_crm_prod?authSource=admin&retryWrites=true&w=majority
  ```
- [ ] **Step 1.4:** Confirm `APP_MODE` is `production` for Production.
- [ ] **Step 1.5:** Set `PROVIDER_MODE` to `mock` initially for Production (safety gate during initial cutover smoke test).
- [ ] **Step 1.6:** Verify `CRM_API_KEY` is configured for Production.

---

### Stage 2: Antigravity Actions (Post-Authorization Deployment & Verification)
*Executed ONLY after written confirmation from the owner that Stage 1 is complete:*

- [ ] **Step 2.1:** Execute pre-flight build check locally:
  ```bash
  npx tsc --noEmit
  ```
- [ ] **Step 2.2:** Deploy release candidate to Vercel Production:
  ```bash
  npx vercel deploy --prod
  ```
- [ ] **Step 2.3:** Record the newly created Production Deployment ID and URL.
- [ ] **Step 2.4:** Perform read-only production liveness probe:
  ```bash
  curl -I https://avani-ai-crm.vercel.app/api/health?check=liveness
  ```
  *(Must return `HTTP/2 200 OK`)*
- [ ] **Step 2.5:** Perform read-only production readiness probe:
  ```bash
  curl https://avani-ai-crm.vercel.app/api/health
  ```
  *(Must return `status: "HEALTHY"`, `databaseReady: true`, `appMode: "production"`, `database.status: "HEALTHY"`)*
- [ ] **Step 2.6:** Verify root dashboard renders cleanly:
  ```bash
  curl -I https://avani-ai-crm.vercel.app/
  ```
  *(Must return `HTTP/2 200 OK`)*

---

### Stage 3: Phased Provider Live Activation (Owner Action)
*Executed after successful completion of Stage 2:*

- [ ] **Step 3.1:** In Vercel Environment Variables, update `PROVIDER_MODE` from `mock` to `live` for **Production**.
- [ ] **Step 3.2:** Trigger a redeploy to apply the live provider setting:
  ```bash
  npx vercel redeploy
  ```
- [ ] **Step 3.3:** Submit a single real test inquiry through the website lead form using owner's verified test phone.
- [ ] **Step 3.4:** Verify welcome WhatsApp template delivery from `+91 72491 08474`.
- [ ] **Step 3.5:** Verify lead intake record in production database `avani_ai_crm_prod`.

---

## 4. POST-CUTOVER SIGN-OFF & HANDOVER

| Verification Item | Required Result | Verified By | Sign-off Timestamp |
|---|---|---|---|
| **Production Health** | `status: "HEALTHY"` | Antigravity / Owner | Pending Cutover |
| **Database Readiness** | `databaseReady: true` | Antigravity / Owner | Pending Cutover |
| **Zero Cross-Application Data** | No Loan Services data in CRM | Antigravity / Owner | Pending Cutover |
| **Provider Dispatch** | Verified on owner test phone | Owner | Pending Cutover |
| **Rollback Standby** | Verified operational | Antigravity | Pending Cutover |
