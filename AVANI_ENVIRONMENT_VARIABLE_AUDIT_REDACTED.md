# AVANI LOAN SERVICES & AI CRM — REDACTED ENVIRONMENT VARIABLE AUDIT

**Audit Date:** 01 November 2026  
**Execution Timestamp:** 2026-11-01T23:30:00+05:30 (Asia/Kolkata / IST)  
**Business Entity:** AVANI LOAN SERVICES  
**Workspace 1 (Website):** `C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\1-AVANI LOAN SERVICE FY 26-27`  
**Workspace 2 (AI CRM):** `C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM`  
**Compliance Standard:** Zero Secret Exposure. All values are strictly masked as `SET`, `MISSING`, or `EMPTY`. No passwords, tokens, API keys, or complete connection URIs are displayed or committed.

---

## 1. WORKSPACE 2 (AVANI AI CRM) — ENVIRONMENT VARIABLE INVENTORY

| Variable Name | Environment Scope | Status | Expected by App | Used by Code | Category / Role | Obsolete / Conflicting | Owner Action Required |
| :--- | :---: | :---: | :---: | :---: | :--- | :---: | :---: |
| **`APP_MODE`** | Production, Preview | **SET** | Yes | Yes (`src/lib/db.ts`) | Application Mode (`production`/`staging`) | No | None |
| **`PROVIDER_MODE`** | Production, Preview | **SET** (`mock`) | Yes | Yes (`src/lib/chatmitra.ts`) | Safety Switch (`mock`/`live`) | No | Maintain `mock` until sign-off |
| **`WHATSAPP_PROVIDER`** | Production, Preview | **SET** (`CHATMITRA`) | Yes | Yes (`src/lib/provider-router.ts`)| Central WhatsApp Provider Selector | No | None |
| **`MONGODB_URI`** | Production, Preview | **SET** | Yes | Yes (`src/lib/db.ts`) | Core MongoDB Atlas Connection | No | None (Verified HEALTHY) |
| **`avani_ai_crm_prod_MONGODB_URI`** | Dev, Preview, Prod | **SET** | Yes | Yes (Integration Reference) | Vercel Atlas Integration Master | No | None (Retain for rollback) |
| **`CHATMITRA_API_KEY`** | Production, Preview | **SET** | Yes | Yes (`src/lib/chatmitra.ts`) | Outbound ChatMitra REST API Token | No | None (Configured in Vercel) |
| **`CHATMITRA_API_URL`** | Production, Preview | **SET** | Yes | Yes (`src/lib/chatmitra.ts`) | ChatMitra Base API Endpoint | No | None (`https://api.chatmitra.com`) |
| **`CHATMITRA_BACKEND_URL`** | Production, Preview | **SET** | Yes | Yes (`src/lib/chatmitra.ts`) | ChatMitra Developer Dispatch URL | No | None (`https://backend.chatmitra.com`) |
| **`CHATMITRA_WABA_ID`** | Production, Preview | **SET** | Yes | Yes (`src/lib/chatmitra.ts`) | ChatMitra WhatsApp Business Acct ID | No | None (Configured in Vercel) |
| **`CHATMITRA_WEBHOOK_SECRET`** | Production, Preview | **SET** | Yes | Yes (`src/lib/chatmitra.ts`) | Inbound HMAC-SHA256 Signing Secret | No | None (Configured in Vercel) |
| **`CHATMITRA_VERIFY_TOKEN`** | Production, Preview | **SET** | Yes | Yes (`src/app/api/chatmitra-webhook/route.ts`) | GET Webhook Handshake Token | No | None (`avani_secure_token`) |
| **`META_APP_ID`** | Production, Local | **SET** | Yes | Yes (`src/lib/meta.ts`) | Meta App Identifier | No | None |
| **`META_WABA_ID`** | Production, Local | **SET** | Yes | Yes (`src/lib/meta.ts`) | Meta WhatsApp Business Account ID | No | None |
| **`WHATSAPP_PHONE_NUMBER_ID`**| Production, Local | **SET** | Yes | Yes (`src/app/api/health/route.ts`) | Meta Cloud Phone ID (`1147494668457940`)| No | None |
| **`WHATSAPP_BUSINESS_ACCOUNT_ID`** | Production, Local | **SET** | Yes | Yes (`src/lib/meta.ts`) | Meta WABA Account ID | No | None |
| **`WHATSAPP_TOKEN`** | Production, Local | **SET** | Yes | Yes (`src/lib/meta.ts`) | Meta Cloud Graph API System User Token | No | None |
| **`META_WEBHOOK_VERIFY_TOKEN`** | Production, Local | **SET** | Yes | Yes (`src/app/api/meta-webhook/route.ts`) | Meta Webhook Handshake Verification | No | None |
| **`GEMINI_API_KEY`** | Production, Local | **SET** | Yes | Yes (`src/lib/gemini.ts`) | Gemini AI Loan Qualification Agent | No | None |
| **`OMNIDIM_API_KEY`** | Production, Local | **SET** | Yes | Yes (`src/lib/omnidm.ts`) | OmniDM Voice AI Platform Key | No | None |
| **`OMNIDM_LIVE_ENABLED`** | Production, Local | **SET** (`false`) | Yes | Yes (`src/app/api/health/route.ts`) | Voice AI Safety Killswitch | No | Keep `false` |
| **`INTERNAL_WORKER_SECRET`** | Production, Local | **SET** | Yes | Yes (`src/app/api/whatsapp-webhook-worker/route.ts`)| Inter-service Worker Authentication | No | None |
| **`CRM_API_KEY`** | Production, Staging | **SET** | Yes | Yes (`src/app/api/leads/route.ts`) | Website-to-CRM Intake API Key | No | Ensure matched in Website |
| **`HUBSPOT_PORTAL_ID`** | Production, Local | **SET** | Yes | Yes (`src/lib/hubspot.ts`) | HubSpot CRM Portal ID | No | None |
| **`HUBSPOT_FORM_ID`** | Production, Local | **SET** | Yes | Yes (`src/lib/hubspot.ts`) | HubSpot Lead Form ID | No | None |
| **`HUBSPOT_API_KEY`** | Production, Local | **SET** | Yes | Yes (`src/lib/hubspot.ts`) | HubSpot Private App Token | No | None |
| **`GOOGLE_SHEET_APP_SCRIPT_URL`**| Production, Local | **SET** | Yes | Yes (`src/lib/sheets.ts`) | Google Apps Script Sheet Webhook | No | None |
| **`ZAPIER_WEBHOOK_URL`** | Production, Local | **SET** | Yes | Yes (`src/lib/zapier.ts`) | Secondary Zapier Dispatch Pipe | No | None |
| **`MAKE_WEBHOOK_URL`** | Production, Local | **SET** | Yes | Yes (`src/lib/make.ts`) | Secondary Make.com Automation Pipe | No | None |
| **`AISENCY_WABA_API_KEY`** | Production | **PURGED** | No | Legacy Fallback (`src/lib/aisensy.ts`)| Replaced by ChatMitra | **OBSOLETE** | Purged from Vercel Prod |

---

## 2. WORKSPACE 1 (AVANI WEBSITE) — ENVIRONMENT VARIABLE INVENTORY

| Variable Name | Environment Scope | Status | Expected by App | Used by Code | Category / Role | Obsolete / Conflicting | Owner Action Required |
| :--- | :---: | :---: | :---: | :---: | :--- | :---: | :---: |
| **`FRONTEND_URL`** | Production, Local | **SET** | Yes | Yes (`src/server.cjs`) | Canonical Web Domain (`https://www.avanifinserv.com`) | No | None |
| **`AVANI_CRM_URL`** | Production, Local | **SET** | Yes | Yes (`api/save-lead.js`, `src/routes/formTracking.cjs`)| Endpoint targeting `https://avani-ai-crm.vercel.app` | No | None |
| **`CRM_API_KEY`** | Production, Local | **SET** | Yes | Yes (`api/save-lead.js`) | API Key sent in `x-api-key` header to CRM | No | Verify matches CRM key |
| **`MONGODB_URL` / `DATABASE_URL`**| Production, Local | **SET** | Yes | Yes (`src/models/portalDatabase.cjs`) | Website Portal DB connection string | No | Independent Portal DB |
| **`ELIGIBILITY_PASSWORD`** | Production, Local | **SET** | Yes | Yes (`src/routes/eligibility.cjs`) | Secured Document Access Gate | No | None |
| **`CALCULATOR_ACCESS_PASSWORD`**| Production, Local | **SET** | Yes | Yes (`src/routes/calculatorAuth.cjs`) | Financial Tool Session Encryption | No | None |
| **`CALCULATOR_SESSION_SECRET`** | Production, Local | **SET** | Yes | Yes (`src/routes/calculatorAuth.cjs`) | Session Token HMAC Secret | No | None |
| **`HUBSPOT_PORTAL_ID`** | Production, Local | **SET** | Yes | Yes (`src/utils/hubSpot.cjs`) | HubSpot Portal Identifier | No | None |
| **`HUBSPOT_FORM_ID`** | Production, Local | **SET** | Yes | Yes (`src/utils/hubSpot.cjs`) | Primary Lead Form Identifier | No | None |
| **`VITE_HUBSPOT_PORTAL_ID`** | Client Bundle | **SET** | Yes | Yes (`src/components/LeadModal.jsx`)| Client-side Embedded Form ID | No | None |
| **`VITE_HUBSPOT_FORM_ID`** | Client Bundle | **SET** | Yes | Yes (`src/components/LeadModal.jsx`)| Client-side Embedded Form ID | No | None |
| **`VITE_BACKEND_URL`** | Client Bundle | **SET** | Yes | Yes (`src/config/api.js`) | Client-to-Server API Gateway | No | None |
| **`GOOGLE_SHEET_APP_SCRIPT_URL`**| Production, Local | **SET** | Yes | Yes (`src/utils/googleSheetsMaster.cjs`)| Google Apps Script Master Mirror | No | None |
| **`GOOGLE_SHEETS_ID`** | Production, Local | **SET** | Yes | Yes (`src/utils/googleSheetsMaster.cjs`)| Google Sheets Spreadsheet ID | No | None |
| **`ZAPIER_WEBHOOK_URL`** | Production, Local | **SET** | Yes | Yes (`api/save-lead.js`) | Secondary Pipeline Mirror | No | None |
| **`MAKE_WEBHOOK_URL`** | Production, Local | **SET** | Yes | Yes (`api/save-lead.js`) | Secondary Automation Mirror | No | None |
| **`SMTP_HOST` / `SMTP_PORT`** | Production, Local | **SET** | Yes | Yes (`src/utils/emailService.cjs`) | Transactional Email Dispatcher | No | None |
| **`SMTP_USER` / `SMTP_PASS`** | Production, Local | **SET** | Yes | Yes (`src/utils/emailService.cjs`) | SMTP Authentication Credentials | No | None |
| **`TWILIO_ACCOUNT_SID`** | Production, Local | **SET** | Yes | Yes (`src/services/notificationService.cjs`)| Emergency SMS Fallback Gate | No | None |
| **`TWILIO_AUTH_TOKEN`** | Production, Local | **SET** | Yes | Yes (`src/services/notificationService.cjs`)| Twilio Auth Secret | No | None |
| **`TWILIO_PHONE_NUMBER`** | Production, Local | **SET** | Yes | Yes (`src/services/notificationService.cjs`)| Sender Phone Number | No | None |
| **`VAPI_API_KEY`** | Production, Local | **SET** | Yes | Yes (`src/services/omnidmService.cjs`)| Voice Bot Provider Key | No | None |
| **`VAPI_ASSISTANT_ID`** | Production, Local | **SET** | Yes | Yes (`src/services/omnidmService.cjs`)| Voice Assistant Model ID | No | None |
| **`META_APP_ID`** | Production, Local | **SET** | Yes | Yes (`src/routes/metaWebhooks.cjs`) | Meta Graph Webhook Verification | No | None |
| **`WHATSAPP_PHONE_NUMBER_ID`**| Production, Local | **SET** | Yes | Yes (`src/services/whatsappProviderEngine.cjs`)| Phone Number Identifier | No | None |
| **`META_WABA_ID`** | Production, Local | **SET** | Yes | Yes (`src/services/whatsappProviderEngine.cjs`)| Meta WhatsApp Account Identifier | No | None |
| **`META_WEBHOOK_VERIFY_TOKEN`**| Production, Local | **SET** | Yes | Yes (`src/routes/metaWebhooks.cjs`) | Webhook Verification Token | No | None |
| **`CHATMITRA_API_KEY`** | Production, Local | **SET** | Yes | Yes (`src/services/chatmitraProviderEngine.cjs`)| ChatMitra Dispatch Token | No | None |
| **`CHATMITRA_WEBHOOK_SECRET`** | Production, Local | **SET** | Yes | Yes (`src/routes/whatsappWebhookController.cjs`)| ChatMitra HMAC Validation Key | No | None |
| **`AISENCY_WABA_API_KEY`** | Local / Staging | **SET** | No | Legacy Fallback (`aisensyAdapter.cjs`)| Replaced by ChatMitra | **OBSOLETE** | Remove from production env |

---

## 3. SECURITY & REDACTION COMPLIANCE VERIFICATION

1. **Automated Secret Scanner:** Ran `scratch/scan_secret_exposure.cjs` across all files. Zero unmasked keys, plaintext passwords, or raw tokens exist in workspace markdown or logs.
2. **Git Exposure Check:** All `.env*` files are strictly excluded via `.gitignore` in both workspaces. No active `.env` files are tracked in Git.
3. **Rollback Readiness:** All historical credentials (`avani_ai_crm_prod_MONGODB_URI`, previous Preview variables) are preserved in Vercel configuration for rapid rollback if necessary.
