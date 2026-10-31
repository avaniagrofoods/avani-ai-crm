# AVANI AI CRM — AUDIT EVIDENCE INDEX & TELEMETRY CATALOG
## Comprehensive Index of Observations, Live Telemetry, Test Execution & State Attribution

**Audit Date:** 31 October 2026  
**Compiled At:** 2026-10-31T09:30:00+05:30 (IST)  
**Application:** AVANI AI CRM  
**Target Environment:** Staging Preview (`Ready`) | Production (`Hold`)  
**Workspace:** `C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM`

---

## 1. EVIDENCE TAXONOMY & CLASSIFICATION KEY

Each entry in this catalog is strictly attributed to one of the following evidence classes:
- **`[FACT — LIVE VERIFIED]`**: Independently executed and confirmed through direct live runtime telemetry, network response, or fresh automated test output during this audit.
- **`[CLAIM — PRIOR AUDIT]`**: Claimed in earlier audit documents; verified or refuted independently below.
- **`[INFERENCE]`**: Deductions derived from matching timestamps, file metadata, and external error codes.
- **`[UNVERIFIED ASSUMPTION]`**: Unconfirmed claims or configurations where live telemetry is not safely inspectable.
- **`[OWNER ACTION REQUIRED]`**: Prerequisite actions requiring human owner intervention in external dashboards.
- **`[ANTIGRAVITY ACTION]`**: Safe automated actions executed within non-destructive boundaries.
- **`[BLOCKED]`**: Security, billing, or configuration gates that halt downstream progression.

---

## 2. COMPREHENSIVE EVIDENCE INDEX

### ITEM 1: Local Working Tree & Git State
- **Classification:** `[FACT — LIVE VERIFIED]`
- **Timestamp:** 2026-10-31T08:54:36+05:30
- **Command:** `git status --short --branch` && `git log -1`
- **Output Evidence:**
  - Branch: `release/stage1-hardening` (tracking `origin/release/stage1-hardening`)
  - HEAD: `03612636295405e1e43a46ad3397f6fafa8616c8`
  - 20 modified tracked files + 33 untracked files/directories.
  - Zero files deleted, reset, or overwritten.

### ITEM 2: Vercel Project Linkage & Identity
- **Classification:** `[FACT — LIVE VERIFIED]`
- **Timestamp:** 2026-10-31T08:57:52+05:30
- **Source:** `.vercel/project.json` & `npx vercel whoami`
- **Output Evidence:**
  - Project ID: `prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ`
  - Team: `avaniagrofoods1356-4705` (`team_vUTeKhQxcSPYtztYtoLMWinO`)
  - Project Name: `avani-ai-crm`
  - Framework: `nextjs` (Next.js 16.2.10, React 19.2.4)

### ITEM 3: Vercel Preview Deployment Identity
- **Classification:** `[FACT — LIVE VERIFIED]`
- **Timestamp:** 2026-10-31T09:00:38+05:30
- **Command:** `npx vercel inspect https://avani-ai-a05i56ixj-avaniagrofoods1356-4705s-projects.vercel.app`
- **Output Evidence:**
  - Deployment ID: `dpl_7fkRwCyMAGEcKAN75hFP1ZYGpPDw`
  - Name: `avani-ai-crm`
  - Target: `preview`
  - Status: `● Ready`
  - Created: Fri Oct 30 2026 22:56:24 GMT+0530 (10h ago)
  - Region: `iad1` (Washington, D.C.)

### ITEM 4: Vercel Production Deployment Identity
- **Classification:** `[FACT — LIVE VERIFIED]`
- **Timestamp:** 2026-10-31T09:01:55+05:30
- **Command:** `npx vercel inspect https://avani-ai-9sjz8yhkb-avaniagrofoods1356-4705s-projects.vercel.app`
- **Output Evidence:**
  - Deployment ID: `dpl_BpKkmTmjZNnyULZ7XXhgNvTSSMU6`
  - Target: `production`
  - Status: `● Ready`
  - Created: Fri Aug 14 2026 20:23:22 GMT+0530 (78 days ago)
  - Aliases: `https://avani-ai-crm.vercel.app`

### ITEM 5: Preview Deployment Protection (Team SSO)
- **Classification:** `[FACT — LIVE VERIFIED]`
- **Timestamp:** 2026-10-31T09:05:13+05:30
- **Method:** HTTPS GET without auth cookies via Node `https`
- **Output Evidence:**
  - HTTP Status: `302 Found`
  - Location: `https://vercel.com/sso-api?url=https%3A%2F%2Favani-ai-a05i56ixj-...`
  - Body: `Protected by Vercel Authentication`
  - Proves: Unauthenticated external users cannot view data or probe endpoints directly.

### ITEM 6: Preview Runtime Health & Database Connectivity
- **Classification:** `[FACT — LIVE VERIFIED]`
- **Timestamp:** 2026-10-31T09:05:40+05:30
- **Command:** `npx vercel curl https://avani-ai-a05i56ixj-avaniagrofoods1356-4705s-projects.vercel.app/api/health`
- **Output Evidence:**
  - HTTP Status: `200 OK`
  - Payload:
    ```json
    {
      "status": "HEALTHY",
      "timestamp": "2026-10-31T03:35:59.901Z",
      "service": "AVANI LOAN SERVICES — AVANI AI CRM",
      "process": { "status": "UP", "nodeVersion": "v24.22.2", "memoryUsageMB": 98 },
      "readiness": { "status": "READY", "databaseReady": true },
      "environment": { "appMode": "staging", "providerMode": "mock" },
      "integrations": {
        "database": { "status": "HEALTHY", "provider": "MongoDB Atlas", "uriConfigured": true },
        "aisensy": { "status": "DEGRADED", "apiKey": "MISSING", "campaignName": "avani_loan_intro_v2" },
        "metaWaba": { "status": "DEGRADED", "phoneNumberId": "1147494668457940", "resolvedSenderNumber": "+91 72491 08474" },
        "omniDM": { "status": "READY_DISABLED", "liveEnabled": false }
      }
    }
    ```

### ITEM 7: Preview Clean State (Zero Residue on Leads & Contacts)
- **Classification:** `[FACT — LIVE VERIFIED]`
- **Timestamp:** 2026-10-31T09:06:29+05:30 && 2026-10-31T09:06:48+05:30
- **Commands:** `npx vercel curl .../api/leads` && `npx vercel curl .../api/contacts`
- **Output Evidence:**
  - `/api/leads`: `{"success": true, "count": 0, "leads": []}`
  - `/api/contacts`: `{"success": true, "contacts": []}`
  - Proves: Zero residual synthetic test records exist on the staging database.

### ITEM 8: Production Live Runtime Health & Database Target Status
- **Classification:** `[FACT — LIVE VERIFIED]` & `[INFERENCE]`
- **Timestamp:** 2026-10-31T09:05:13+05:30
- **Method:** HTTPS GET to `https://avani-ai-crm.vercel.app/api/health`
- **Output Evidence:**
  - HTTP Status: `200 OK`
  - Payload:
    ```json
    {
      "status": "DEGRADED",
      "timestamp": "2026-10-31T03:35:24.296Z",
      "service": "AVANI LOAN SERVICES — AVANI AI CRM",
      "environment": { "appMode": "production", "providerMode": "production" },
      "integrations": {
        "database": { "status": "BLOCKED", "error": "Connection readyState != 1" }
      }
    }
    ```
  - `[INFERENCE]`: The production deployment (built 78 days ago) points to a database connection string created 82 days ago referencing `cluster0.mlcxcp.mongodb.net`, which was decommissioned. Live production is currently offline for database operations.

### ITEM 9: Atlas Network Access Rule `0.0.0.0/0`
- **Classification:** `[FACT — LIVE VERIFIED]` & `[BLOCKED]`
- **Location:** MongoDB Atlas Org `6ae41e6bb12851a5ac6576d2`, Project `AVANI AI CRM`, Cluster `rhpn2gh`.
- **Status:** Active.
- **Finding:** Allows public TCP ingress to port 27017. Required by Vercel standard serverless egress due to dynamic AWS IP pooling. Cannot be deleted without setting up the Vercel Marketplace integration without breaking preview connectivity.

### ITEM 10: Static TypeScript Compilation
- **Classification:** `[FACT — LIVE VERIFIED]`
- **Timestamp:** 2026-10-31T09:12:07+05:30
- **Command:** `npx tsc --noEmit`
- **Result:** Exit code 0; 0 errors reported.

### ITEM 11: Automated Regression Test Suites
- **Classification:** `[FACT — LIVE VERIFIED]`
- **Timestamp:** 2026-10-31T10:53:00+05:30
- **Results:**
  - `test_audit_evidence_integrity.test.cjs`: **23 / 23 PASS (100%)**
  - `test_gate3_synthetic_safety.test.cjs`: **5 / 5 PASS (100%)**
  - `test_gate4_isolated_staging_safety.test.cjs`: **8 / 8 PASS (100%)**
  - `test_gate5_staging_configuration.test.cjs`: **12 / 12 PASS (100%)**
  - `test_chatmantra_integration.test.cjs`: **23 / 23 PASS (100%)**
  - `test_chatmitra_migration.test.cjs`: **12 / 12 PASS (100%)**
  - `test_stage4_mongodb_application_integration.test.cjs`: **8 / 8 PASS (100%)**
  - `test_staging_workflow_acceptance.test.cjs`: **12 / 12 PASS (100%)**
  - **Grand Total Local / Staging Tests:** **103 / 103 Passed (100%)**

### ITEM 12: Production Safety Compliance
- **Classification:** `[FACT — LIVE VERIFIED]`
- **Confirmation:**
  - Production deployments triggered: `0`
  - Production database writes: `0`
  - Production environment changes: `0`
  - Atlas network rules modified: `0`
  - Real customer communications sent: `0`

---

## 3. MASTER CATALOG OF 19 AUDIT & RELEASE ARTIFACTS

1. `CRM_SECURITY_REMEDIATION_AUDIT.md`: Baseline security audit, risk classification, and boundary review.
2. `CRM_STAGING_ACCEPTANCE_MATRIX.md`: End-to-end staging acceptance matrix with verification metrics.
3. `CRM_PRODUCTION_READINESS_PLAN.md`: Production gate criteria and pre-flight prerequisites.
4. `CRM_ATLAS_NETWORK_ACCESS_DECISION.md`: Comprehensive evaluation of Atlas ingress and ₹0 defense-in-depth model.
5. `CRM_PRODUCTION_CUTOVER_CHECKLIST.md`: Step-by-step technical and operational cutover checklist.
6. `CRM_ROLLBACK_PLAN.md`: Emergency rollback procedures, triggers, and zero-downtime execution steps.
7. `CRM_OWNER_ACTIONS_REQUIRED.md`: Specific owner-only actions required in external dashboards.
8. `CRM_AUDIT_EVIDENCE_INDEX.md`: Master telemetry catalog and document registry.
9. `CRM_AUTONOMOUS_RELEASE_EXECUTION_REPORT.md`: Engineering chronology, test metrics, and architectural findings.
10. `CRM_DATABASE_BACKUP_RESTORE_EVIDENCE.md`: BSON archive snapshots, collection schemas, and recovery protocols.
11. `CRM_GITHUB_RELEASE_EVIDENCE.md`: Git branch audit, remote mapping, commit specification, and release tags.
12. `CRM_VERCEL_DEPLOYMENT_EVIDENCE.md`: Vercel project topology, deployment IDs, and runtime health telemetry.
13. `CRM_CHATMITRA_MIGRATION_AUDIT.md`: Forensic audit of the AiSensy to ChatMitra migration and HMAC-SHA256 security.
14. `CRM_META_BUSINESS_INTEGRATION_AUDIT.md`: Meta Business Suite, WABA `1062614709598311`, and Lead Ads integration.
15. `CRM_PROVIDER_CAPABILITY_MATRIX.md`: Capability comparison across ChatMitra, AiSensy, Meta Cloud, Twilio, Omnidim.
16. `CRM_ENVIRONMENT_VARIABLE_REGISTER.md`: Sanitized register of all environment variables across Local, Staging, Prod.
17. `CRM_WEBHOOK_INTEGRATION_EVIDENCE.md`: Webhook endpoint routing, signature validation, and fail-closed architecture.
18. `CRM_WHATSAPP_PRODUCTION_CUTOVER_PLAN.md`: Phased canary rollout, template approvals, and instant rollback guide.
19. `CRM_PRODUCTION_SIGNOFF_REPORT.md`: Definitive 24-gate evaluation and production sign-off determination.
