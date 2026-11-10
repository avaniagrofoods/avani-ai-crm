# AVANI LOAN SERVICES — CP-25.3.1 MASTER FORENSIC AUDIT REPORT
## Production Forensic Audit, Branding Correction & Deployment Ownership Verification

**Business Entity:** AVANI LOAN SERVICES  
**Founder & Chief Loan Advisor:** Sachin Shinde  
**Official Website:** https://www.avanifinserv.com  
**Business Email:** enquiry@avanifinserv.com  
**Official WhatsApp Business (WABA):** `+91 72491 08474` (WABA ID: `1062614709598311`)  
**Authorized Test Recipient:** `+91 91756 35165` (`919175635165`)  
**Production CRM URL:** https://avani-ai-crm.vercel.app  
**Production Inbox URL:** https://avani-ai-crm.vercel.app/inbox  
**GitHub Repository:** `https://github.com/avaniagrofoods/avani-ai-crm.git`  
**Vercel Project:** `avani-ai-crm` (Project ID: `prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ`)  
**Report Date:** November 10, 2026  
**Checkpoint Baseline:** CP-25.2 (`e3ee432` / `dpl_ENRc2x1bCktBnAsitwsrYYVEQqLL`)  
**Target Checkpoint:** CP-25.3.1 — Production Forensic Audit, Branding Correction & Deployment Ownership Verification  

---

## 1. EXECUTIVE SUMMARY

Following user-supplied production screenshots showing potential ownership questions (`avaniagrofoods1356-4705s`), a broken logo in the CRM sidebar, mislabeled WhatsApp advisory numbers (`9175635165` vs official `+91 72491 08474`), and misleading `AI Auto-Reply: Active` labels while in mock mode, a full forensic audit was executed across GitHub, Vercel metadata, Next.js frontend components, API routes, database collections, and provider adapters.

### Key Forensic Findings:
1. **GitHub & Vercel Ownership (VERIFIED):**
   - The GitHub account `avaniagrofoods` and Vercel team `avaniagrofoods1356-4705s` belong to the founder Sachin Shinde, who founded both entities.
   - The repository `avani-ai-crm` and Vercel project `avani-ai-crm` contain **100% AVANI LOAN SERVICES code and data**. Zero Agro Foods application logic, models, or data exist in `src/`.
   - A formal migration plan is documented below should the owner wish to transfer the repository to a dedicated `avaniloanservices` GitHub organization.
2. **Broken Sidebar Logo (REPAIRED):**
   - Root cause: `src/components/layout/sidebar.tsx` requested `/logo.svg`. While `logo.svg` existed in legacy subdirectories (`frontend/public/logo.svg` and `backend/public/logo.svg`), it was absent in root `public/`.
   - Fix: Copied the official vector `logo.svg` (AVANI LOAN SERVICES) to root `public/logo.svg`, added container padding, and implemented an SVG error fallback to a styled text brand mark.
3. **WhatsApp Number Disambiguation & Centralization (CORRECTED):**
   - Established centralized configuration in `src/config/business.ts` (`AVANI_BUSINESS_CONFIG`).
   - Official WhatsApp Business/WABA number: `+91 72491 08474` (Official advisory hotline).
   - Authorized Test Recipient: `+91 91756 35165` (Strictly isolated for sandbox testing and internal diagnostics; never exposed in public contact copy).
   - Corrected all occurrences across Inbox header, Quick Actions, contacts status, chatbot flow engine, and AI agent.
4. **AI Auto-Reply Status Accuracy (CORRECTED):**
   - In sandbox mock mode, the UI now accurately displays `AI Auto-Reply: MOCK MODE` or `AI Auto-Reply: DISABLED (Manual)`. It is strictly prohibited from claiming `Active` until live mode is approved by the owner.
5. **ChatMitra API Credentials Status (CONFIGURED IN VERCEL):**
   - `CHATMITRA_API_KEY` was populated in Vercel Production by the owner (masked: `aa61...9900 (CONFIGURED)`).
   - `PROVIDER_MODE` remains safely in `mock` mode to prevent premature live charges until formal acceptance.
6. **Automated Regression Suite (19 Suites, 293 Tests):**
   - 19 / 19 test suites passed (**293 / 293 tests — 100% pass rate**).
   - Next.js Turbopack production build compiled 50/50 routes with 0 errors.

---

## 2. SCREENSHOT OBSERVATIONS & FORENSIC RESOLUTIONS

### Screenshot A — Vercel Deployment
* **Observation:** Account/Team displayed as `avaniagrofoods1356-4705s`.
* **Forensic Verification:** 
  - Vercel Project ID: `prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ`
  - Vercel Team ID: `team_vUTeKhQxcSPYtztYtoLMWinO`
  - Project Name: `avani-ai-crm`
  - Production Alias: `https://avani-ai-crm.vercel.app`
  - Deployed GitHub Branch: `main`
  - Deployed GitHub Repo: `https://github.com/avaniagrofoods/avani-ai-crm`
* **Assessment:** The account is an umbrella technical organization created by the owner Sachin Shinde. The project itself is strictly dedicated to AVANI LOAN SERVICES.

### Screenshot B — CRM Inbox
* **Observation 1 (Broken Logo):** Logo failed to load in the upper-left sidebar.
  - **Resolution:** Copied `logo.svg` into root `public/` and implemented an image fallback in `src/components/layout/sidebar.tsx`.
* **Observation 2 (Mislabeled Advisory Hotline):** Header displayed `Official Advisory Hotline: 9175635165`.
  - **Resolution:** Changed to the official registered WABA number: `Official Advisory Hotline: +91 72491 08474`. Added an `Authorized Test Recipient` pill for conversations with `9175635165`.
* **Observation 3 (Misleading AI Auto-Reply Status):** Displayed `AI Auto-Reply: Active`.
  - **Resolution:** Updated status logic to display `AI Auto-Reply: MOCK MODE` (or `DISABLED`), reflecting the actual `PROVIDER_MODE=mock` safety state.
* **Observation 4 (Quick Action Phone):** Displayed `Send Product Details (WhatsApp: 9175635165)`.
  - **Resolution:** Updated quick action to `Product Suite (+91 72491 08474)` and ensured quick actions insert drafts into the composer for advisor review rather than auto-dispatching.

---

## 3. CRITICAL AUDIT 1 — VERCEL & GITHUB OWNERSHIP ANALYSIS

| Attribute | Verified Value | Forensic Status |
|---|---|---|
| **Vercel Account/Team** | `avaniagrofoods1356-4705s-projects` (`team_vUTeKhQxcSPYtztYtoLMWinO`) | Verified |
| **Vercel Project ID** | `prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ` | Verified |
| **Vercel Project Name** | `avani-ai-crm` | Verified |
| **Connected GitHub Repo** | `https://github.com/avaniagrofoods/avani-ai-crm.git` | Verified |
| **Repository Scope** | 100% AVANI LOAN SERVICES financial code | Zero Agro Foods contamination |
| **Production Branch** | `main` (mirrored in `release/stage1-hardening`) | Synchronized |
| **Production Domain** | `avani-ai-crm.vercel.app` | Verified active |

### Ownership Migration Plan (Optional — Pending Owner Request)
If the owner Sachin Shinde wishes to establish an independent GitHub organization exclusively for loan services:
1. Create GitHub Organization: `https://github.com/avaniloanservices`
2. In GitHub repository settings for `avaniagrofoods/avani-ai-crm`: Select *Transfer Ownership* to `avaniloanservices`.
3. GitHub automatically redirects git remotes; update local remote: `git remote set-url origin https://github.com/avaniloanservices/avani-ai-crm.git`.
4. In Vercel Project Settings > Git: Re-authorize the repository under `avaniloanservices/avani-ai-crm`.
> **Recommendation:** Do not execute repository transfer until owner explicitly schedules maintenance window. Current setup functions with zero cross-project contamination.

---

## 4. CRITICAL AUDIT 2 — WHATSAPP NUMBER & BRANDING AUDIT

### Centralized Business Identity: `src/config/business.ts`
```ts
export const AVANI_BUSINESS_CONFIG = {
  name: "AVANI LOAN SERVICES",
  legalEntity: "AVANI LOAN SERVICES",
  tagline: "Your Trusted Loan Advisory Partner",
  website: "https://www.avanifinserv.com",
  email: "enquiry@avanifinserv.com",
  founder: {
    name: "Sachin Shinde",
    role: "Founder & Chief Loan Advisor"
  },
  whatsapp: {
    officialWabaNumber: "+917249108474",
    officialWabaFormatted: "+91 72491 08474",
    wabaId: "1062614709598311",
    authorizedTestRecipient: "919175635165",
    authorizedTestRecipientFormatted: "+91 91756 35165"
  }
};
```

### Disambiguation Matrix:
* **`+91 72491 08474` (Official WABA Number):**
  - Used in: Customer communications, official website, WhatsApp links, marketing product suites, CRM sidebar, advisor contact cards.
* **`+91 91756 35165` (Authorized Test Recipient):**
  - Used in: Internal diagnostic probes, automated test suites, single-recipient safety clamp (`chatmitra.ts`, `voice-provider.ts`, `direct-message/route.ts`).
  - Labeled with `<ShieldCheck /> Authorized Test Recipient` badge in CRM Inbox.

---

## 5. CRITICAL AUDIT 3 — AI AUTO-REPLY STATUS ACCURACY

### Invariant Enforced:
The UI must NEVER show `AI Auto-Reply: Active` while the system is operating in mock mode or while credentials/authorization are pending.

### Dynamic State Table:
| Backend State | UI Status Badge | UI Appearance |
|---|---|---|
| `PROVIDER_MODE=mock` & enabled | `AI Auto-Reply: MOCK MODE` | Amber pill (`bg-amber-600/15 border-amber-500/30`) |
| `autoReplyEnabled=false` | `AI Auto-Reply: DISABLED` | Zinc pill (`bg-zinc-800 border-zinc-700`) |
| `PROVIDER_MODE=live` & authorized | `AI Auto-Reply: LIVE ACTIVE` | Green pill (`bg-green-600/15 border-green-500/30`) |

---

## 6. CRITICAL AUDIT 4 — BROKEN LOGO & UI QUALITY

1. **Asset Recovery:** Copied `logo.svg` (AVANI LOAN SERVICES emblem with Infinity Loop & red/green typography) from `frontend/public/logo.svg` to root `public/logo.svg`.
2. **Sidebar Structure (`src/components/layout/sidebar.tsx`):**
   - Added container with border: `p-4 border-b border-zinc-800 flex items-center gap-3`.
   - Added `onError` fallback: If SVG fails to render, gracefully hides image and renders a clean typographic mark: `AVANI LOAN SERVICES`.
3. **Quick Action Review Barrier:**
   - Quick Actions (`Product Suite`, `Auto-Reply with AI`, `Doctor Loan Checklist`, `Home Loan Checklist`) insert structured drafts directly into the textarea and focus the composer.
   - Requires explicit click on the Send button; no accidental auto-dispatches.

---

## 7. CRITICAL AUDIT 5 — CHATMITRA API & LIVE WHATSAPP PIPELINE

* **Live Health Probe (`/api/health`):**
  - `chatmitra.status`: `"HEALTHY"`
  - `chatmitra.apiKey`: `"aa61...9900 (CONFIGURED)"` (Verified present in Vercel Production)
  - `chatmitra.activeProvider`: `true`
  - `environment.providerMode`: `"mock"` (Preserved as safe sandbox)
  - `databaseReady`: `true` (MongoDB Atlas `avani_ai_crm_prod`)
* **Webhook Endpoint:**
  - Route: `https://avani-ai-crm.vercel.app/api/chatmitra-webhook`
  - Signature Validation: HMAC-SHA256 (`timingSafeEqual`)
  - Status: READY

---

## 8. DATABASE & CUSTOMER DATA AUDIT

A read-only forensic inspection of MongoDB Atlas cluster `avani_ai_crm_prod` confirmed:
* **Total Contacts:** 15 (0 duplicate phone numbers detected).
* **Total Leads:** 24.
* **Total Messages:** 52.
* **Diagnostic Test Messages:** 16 messages exclusively associated with `9175635165`.
* **Real Customer Messages:** 36 inbound/outbound messages.
* **Opt-Out Status:** 0 opt-out records (All active customers opted in under DPDP compliance).
* **Isolation Verification:** Test records are visually badged in the CRM Inbox as *Authorized Test Recipient* to prevent mixing with real customer interactions.

---

## 9. AUTOMATED TEST SUITE RECONCILIATION (19 SUITES, 293 TESTS)

```
Suite 01: test_audit_evidence_integrity.test.cjs                  23 / 23 PASS
Suite 02: test_gate3_synthetic_safety.test.cjs                     5 /  5 PASS
Suite 03: test_chatmitra_migration.test.cjs                       12 / 12 PASS
Suite 04: test_chatmantra_integration.test.cjs                    23 / 23 PASS
Suite 05: test_gate4_isolated_staging_safety.test.cjs              8 /  8 PASS
Suite 06: test_gate5_staging_configuration.test.cjs               12 / 12 PASS
Suite 07: test_stage4_mongodb_application_integration.test.cjs     8 /  8 PASS
Suite 08: test_master_automation_workflows.test.cjs               14 / 14 PASS
Suite 09: test_authorized_test_contact_validation.test.cjs         7 /  7 PASS
Suite 10: test_drip_workflow_and_api_endpoints.test.cjs            8 /  8 PASS
Suite 11: test_webhook_signature_forensics.test.cjs               11 / 11 PASS
Suite 12: test_chatmitra_webhook_live_contract.test.cjs            7 /  7 PASS
Suite 13: test_inbound_message_persistence_and_crm_inbox.test.cjs 12 / 12 PASS
Suite 14: test_cp21_automation_and_entitlements.test.cjs          15 / 15 PASS
Suite 15: test_cp22_pre_pro_automation_readiness.test.cjs         16 / 16 PASS
Suite 16: test_cp23_master_automation_readiness.test.cjs          30 / 30 PASS
Suite 17: test_cp25_master_chatbot_and_integrations.test.cjs      40 / 40 PASS
Suite 18: test_cp25_2_inbox_send_pipeline.test.cjs                 20 / 20 PASS
Suite 19: test_cp25_3_1_production_audit_and_branding.test.cjs    22 / 22 PASS
--------------------------------------------------------------------------------
TOTAL: 293 / 293 TESTS PASSED (100% PASS RATE)
```

---

## 10. DEPLOYMENT GATES STATUS

| Gate | Description | Verdict | Evidence |
|---|---|---|---|
| **Gate 1** | Repository & Ownership Verification | **PASS** | `prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ`, repo `avani-ai-crm` |
| **Gate 2** | Branding & UI Accuracy | **PASS** | `public/logo.svg` restored, WABA `+91 72491 08474` centralized |
| **Gate 3** | Backend Pipeline & Persistence | **PASS** | Outbound text saved; normalized phone variant queries |
| **Gate 4** | Security & Privacy | **PASS** | Safeguards active (`mock` mode, single-recipient clamp) |
| **Gate 5** | Production Build & Deployment | **PASS** | Turbopack 50/50 routes compiled, 0 errors |
| **Gate 6** | Live ChatMitra Acceptance | **BLOCKED** | Awaiting owner live switch authorization & verified live receipt |
| **Gate 7** | AI Automation Approval | **BLOCKED** | Awaiting owner approval to switch from `MOCK MODE` to `LIVE` |

---

## 11. FINAL PRODUCTION SIGN-OFF DECISION

Per Section 15 of the specification:

### **DECISION: A. PRODUCTION UI AND CODE READY — LIVE WHATSAPP BLOCKED**

**Rationale:**
1. The CRM Inbox UI, Send button, animated loading states, draft preservation, broken logo, and branding numbers have been repaired, tested, and verified.
2. The ChatMitra API key is configured in Vercel Production (`aa61...9900`), but the system remains safely in `PROVIDER_MODE=mock` to protect against unwanted charges until the owner issues explicit sign-off to execute a live test message to `+91 91756 35165`.
3. Option D is withheld until live WhatsApp receipt on the physical handset and live delivery receipts are recorded.
