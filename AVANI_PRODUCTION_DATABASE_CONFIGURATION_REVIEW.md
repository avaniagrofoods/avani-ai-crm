# AVANI AI CRM — PRODUCTION DATABASE CONFIGURATION REVIEW
## Forensic Review of Production Environment Variables, Host Targets & Cutover Preconditions

**Project:** AVANI AI CRM (`https://avani-ai-crm.vercel.app`)  
**Workspace:** `C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM`  
**Execution Timestamp:** 31 October 2026, 08:25 IST (`2026-10-31T02:55:00Z`)  
**Target Production Cluster:** `avani-loan-services-m0.rhpn2gh.mongodb.net`  
**Target Production Database:** `avani_ai_crm_prod`  
**Production Status:** **`HOLD — NOT AUTHORIZED`** (Zero production mutations executed)

---

## 1. PRODUCTION ENVIRONMENT VARIABLE INVENTORY & METADATA

Audited safely via `npx vercel env ls production`. Zero plaintext credentials or connection strings are printed:

| Variable Name | Scope | Configured Age | Encryption Status | Audit Classification |
|---|---|---|---|:---:|
| `MONGODB_URI` | Production | 82 days ago (Aug 2026) | Encrypted (Vercel Secret Store) | **`REPORTED`** |
| `APP_MODE` | Production | 82 days ago | Encrypted | **`REPORTED`** |
| `PROVIDER_MODE` | Production | 82 days ago | Encrypted | **`REPORTED`** |
| `WHATSAPP_TOKEN` | Production | 82 days ago | Encrypted | **`REPORTED`** |
| `AISENCY_WABA_API_KEY` | Production | 82 days ago | Encrypted | **`REPORTED`** |
| `WHATSAPP_PHONE_NUMBER_ID` | Production | 82 days ago | Encrypted | **`REPORTED`** |
| `NEXT_PUBLIC_APP_URL` | Production | 82 days ago | Encrypted | **`REPORTED`** |
| `GEMINI_API_KEY` | Production | 82 days ago | Encrypted | **`REPORTED`** |
| `OMNIDIM_API_KEY` | Production | 82 days ago | Encrypted | **`REPORTED`** |
| `WHATSAPP_BUSINESS_ACCOUNT_ID`| Production | 82 days ago | Encrypted | **`REPORTED`** |
| `META_WEBHOOK_VERIFY_TOKEN` | Production | 82 days ago | Encrypted | **`REPORTED`** |
| `INTERNAL_WORKER_SECRET` | Production | 82 days ago | Encrypted | **`REPORTED`** |
| `DATABASE_URL` | Production, Preview, Dev | 95 days ago | Encrypted | **`REPORTED`** |
| `ZAPIER_WEBHOOK_URL` | Production, Preview, Dev | 95 days ago | Encrypted | **`REPORTED`** |
| `HUBSPOT_API_KEY` | Production, Preview, Dev | 95 days ago | Encrypted | **`REPORTED`** |
| `BLAND_API_KEY` | Production, Preview, Dev | 95 days ago | Encrypted | **`REPORTED`** |
| `BLAND_ENCRYPTED_KEY` | Production, Preview, Dev | 95 days ago | Encrypted | **`REPORTED`** |
| `VAPI_API_KEY` | Production, Preview, Dev | 94 days ago | Encrypted | **`REPORTED`** |
| `VAPI_ASSISTANT_ID` | Production, Preview, Dev | 94 days ago | Encrypted | **`REPORTED`** |

---

## 2. PRODUCTION `MONGODB_URI` TARGET VERIFICATION

### 2.1 Safe Verification Method
- Running `npx vercel env pull` for the `production` environment downloads protected/encrypted variables with redacted values (`""`) for standard CLI access to prevent secret leakage.
- Direct runtime decryption via CLI: **`NOT VERIFIED`** (Correct security behavior of Vercel secret vault).

### 2.2 Forensic Attribution of Target Host
- **Timestamp Analysis:** In Vercel, the production `MONGODB_URI` was created **82 days ago** (early August 2026).
- **Local Artifact Inspection:** The uncommitted [`.env.production`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/.env.production) file on disk, created in the same time frame (16 August 2026), points to:
  `cluster0.mlcxcp.mongodb.net/avani_ai_crm_prod`.
- **DNS Resolution Status of `cluster0.mlcxcp.mongodb.net`:** Fails with `ECONNREFUSED` / DNS query failure. This cluster was decommissioned or suspended.
- **Classification:** **`REPORTED (TARGETS DECOMMISSIONED CLUSTER0)`** based on creation timestamp and matching `.env.production` metadata.

---

## 3. PRODUCTION RUNTIME DEPENDENCY & RISKS

### 3.1 Does Production Runtime Currently Depend on this Variable?
- **Current Active Production Deployment:** `https://avani-ai-9sjz8yhkb-avaniagrofoods1356-4705s-projects.vercel.app` (Age: `77d ago`).
- **Dependency:** Yes. The legacy production deployment currently references this encrypted production environment variable.
- **Operating State:** Because the legacy deployment was built 77 days ago, changing this variable without a coordinated deployment could immediately impact any active database operations on the production domain.

### 3.2 Operational Risk of Modifying Production `MONGODB_URI`
- **High Risk without Coordinated Release:** Updating the variable prematurely without verifying that `avani_ai_crm_prod` has initialized collections and index structures will cause serverless cold-start connection timeouts or authorization rejections.
- **Strict Compliance:** In accordance with instructions, **zero modifications** have been made to Production environment variables.

---

## 4. PRECONDITIONS FOR PRODUCTION UPDATE

Before updating the Production `MONGODB_URI`, the following preconditions must be satisfied:

1. **Owner Explicit Authorization:** Written approval from project owner to initiate production cutover.
2. **Production Database Preparation:**
   - Confirm database user `starpowerzlatur2210_db_user` has `readWrite` permissions on `avani_ai_crm_prod` on cluster `avani-loan-services-m0.rhpn2gh.mongodb.net`.
   - Verify unique indexes on `leads` (`leadId: 1`, `phone: 1`), `contacts` (`phone: 1`), `conversations` (`conversationId: 1`), and `webhookinboxes` (`eventId: 1`).
3. **Pre-Cutover Schema Backup:** Execute an authenticated `mongodump` of `avani_ai_crm_prod` prior to cutover.
4. **Coordinated Vercel Promotion:** Update `MONGODB_URI` for `Production` environment in Vercel settings simultaneously with running `vercel deploy --prod` to ensure deployment code matches environment configuration.

---

## 5. SUMMARY STATUS

- **Production Configuration:** **`REPORTED (STALE / 82 DAYS OLD)`**
- **Direct Decryption via CLI:** **`NOT VERIFIED (ENCRYPTED IN VERCEL)`**
- **Production Gate Verdict:** **`HOLD — NOT AUTHORIZED`**
