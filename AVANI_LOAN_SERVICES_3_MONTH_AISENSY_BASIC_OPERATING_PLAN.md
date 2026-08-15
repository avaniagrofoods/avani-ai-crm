# AVANI LOAN SERVICES — 3-MONTH AISENSY BASIC OPERATING PLAN & ARCHITECTURE

```text
============================================================
AVANI LOAN SERVICES — 3-MONTH AISENSY BASIC OPERATING PLAN
============================================================
DATE & TIMESTAMP            : 2026-08-15 23:08:50 IST
PRIMARY CRM SOURCE OF TRUTH : AVANI AI CRM (3-AVANI AI CRM)
AGENTS SERVICE               : AVANI LOAN AGENTS (4-AVANI LOAN AGENTS)
PRODUCTION CRM DEPLOYMENT   : https://avani-ai-crm.vercel.app
PRODUCTION AGENT DEPLOYMENT : https://avani-loan-agents.onrender.com
ACTIVE HARDENING BRANCH     : release/stage1-hardening (Commit f49afae)

CONTROLLED TEST CONTACT     : Dr. Sachin Shinde (AVL-20260811-000001 | +919175635165)
APPROVED SENDER             : +91 72491 08474
AUTHORITATIVE WABA ID       : 1062614709598311
AISENSY PROJECT ID          : 6a670f94d0c39f57eaa6799a
CURRENT AISENSY PLAN        : BASIC (Quarterly - 3 Months Active)

OPERATING MODE              : BASIC PLAN SAFE OPERATING MODE
INBOUND AI WEBHOOK FLAG     : AISENSY_INBOUND_WEBHOOK_ENABLED = false
============================================================
```

---

## 1. Existing Meta Lead Integration Status
- **Endpoint**: `/api/meta-webhook` (`src/app/api/meta-webhook/route.ts`)
- **Status**: **`FUNCTIONAL / READY FOR VERIFICATION`**
- **Capabilities**:
  - Implements `GET` challenge verification for Meta Webhooks.
  - Implements `POST` handling for `field === 'leadgen'`.
  - Automatically queries Meta Graph API (`https://graph.facebook.com/v19.0/${leadgenId}`) using `process.env.WHATSAPP_TOKEN`.
  - Extracts `fullName`, `phone`, `email`, `loanType`, and persists to MongoDB `Lead`.
  - Dispatches immediate WhatsApp welcome template via AiSensy Outbound Campaign API.
  - Synchronizes to Google Sheets Apps Script, Zapier, and HubSpot.

---

## 2. Existing Facebook Lead Form Integration Status
- **Status**: **`IMPLEMENTED IN /api/meta-webhook`**
- **Trigger**: When a user submits an Instant Form on Facebook Ads, Meta transmits the `leadgen_id` to `https://avani-ai-crm.vercel.app/api/meta-webhook`.
- **Permissions Required on Meta App**: `leads_retrieval`, `pages_show_list`, `pages_manage_ads` granted on Business Portfolio `130700309306240`.

---

## 3. Existing Instagram Lead Form Integration Status
- **Status**: **`IMPLEMENTED IN /api/meta-webhook`**
- **Trigger**: Instagram Lead Ad forms share the exact same Meta `leadgen` webhook architecture. When connected to the Facebook Page and Ad Account, leads flow into the same parser.

---

## 4. Existing Messenger Integration Status
- **Status**: **`UNCONFIGURED / NOT IMPLEMENTED`**
- **Forensic Assessment**: Messenger DM automation requires Meta `messages` webhook subscription under the `Page` object (separate from WhatsApp WABA) and Page Access Tokens. This is **intentionally unconfigured** to avoid untested automations.

---

## 5. Existing AiSensy Outbound Integration Status
- **Status**: **`PRODUCTION VERIFIED / 100% OPERATIONAL`**
- **Endpoint**: `POST https://backend.aisensy.com/campaign/t1/api/v2`
- **Authentication**: `process.env.AISENCY_WABA_API_KEY`
- **Capabilities**:
  - Sends approved WhatsApp templates (`Avani_Loan_Welcome`, `doctor_loan_offer`, etc.).
  - Supports dynamic `templateParams` (`name`, `loanType`, `amount`).
  - Supports contact tagging (`tags: ['DOCTOR_LOAN', 'META_LEAD']`).
  - Empirical Outbound UUIDs confirmed (`f48f97ef-bd7d-4f91-9879-a4f14d3ffa83` - `HTTP 200 OK`).

---

## 6. Existing CSV Import Status
- **Endpoint**: `/api/leads/upload` (`src/app/api/leads/upload/route.ts`)
- **Status**: **`PRODUCTION VERIFIED / 100% OPERATIONAL`**
- **Capabilities**:
  - Parses uploaded lead arrays, normalizes phone numbers to `+91XXXXXXXXXX`.
  - Standardizes loan products and profession mapping.
  - Deduplicates via MongoDB `phone` unique index.
  - Generates canonical `leadId` (`AVL-YYYYMMDD-XXXXXX`).

---

## 7. Existing Google Sheets Integration Status
- **Endpoint**: Google Apps Script Webhook
- **Status**: **`PRODUCTION VERIFIED / 100% OPERATIONAL`**
- **Script URL**: `https://script.google.com/macros/s/AKfycbwadPvvLiVgLOUbIcnQm7ZeLEOsh1bamEYVJKi11ub8fZc-EAVugAv2WvgfTc5Izg7A4w/exec`
- **Capabilities**: Logs incoming leads and interaction summaries in real time.

---

## 8. Existing Zapier Integration Status
- **Endpoint**: Zapier Catch Hook
- **Status**: **`PRODUCTION VERIFIED / 100% OPERATIONAL`**
- **Hook URL**: `https://hooks.zapier.com/hooks/catch/26860693/44xndib/`
- **Capabilities**: Receives structured lead events for downstream CRM automation.

---

## 9. Missing Components (For Full AI Inbound)
- **AiSensy Webhook Allocation**: Currently `0 / 0` on the `BASIC` plan. Inbound customer replies cannot trigger `AgentEngine` automatically.

---

## 10. Exact Files Requiring Changes (Zero-Refactor Flag Architecture)
- **`src/models/Lead.ts`**:
  - Ensure canonical `source` enum covers:
    `['FACEBOOK_LEAD_FORM', 'INSTAGRAM_LEAD_FORM', 'FACEBOOK_MESSENGER', 'INSTAGRAM_DM', 'WHATSAPP', 'WEBSITE', 'CSV', 'REFERRAL', 'OTHER']`.
  - Ensure `status` enum reflects:
    `['NEW', 'WHATSAPP_SENT', 'WHATSAPP_DELIVERED', 'WHATSAPP_READ', 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP', 'QUALIFIED_HUMAN', 'DOCUMENTS_PENDING', 'DOCUMENTS_RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED']`.
- **`src/app/api/whatsapp-webhook-worker/route.ts`**:
  - Guard `AgentEngine` execution with `process.env.AISENSY_INBOUND_WEBHOOK_ENABLED === 'true'`.

---

## 11. Minimal Implementation Plan

### Step 1: Standardize Canonical `source` & `status` in `src/models/Lead.ts`
Add the standard 9 sources and 12 statuses.

### Step 2: Configure AiSensy Campaign Product Mappings
Map products to approved AiSensy campaign templates:
- `PERSONAL_LOAN` ➔ `personal_loan_welcome`
- `BUSINESS_LOAN` ➔ `business_loan_welcome`
- `DOCTOR_LOAN` ➔ `Avani_Loan_Welcome` / `doctor_loan_offer`
- `HOME_LOAN` ➔ `home_loan_welcome`
- `MORTGAGE_LOAN` ➔ `mortgage_loan_welcome`
- `EDUCATION_LOAN_INDIA` ➔ `education_loan_india_welcome`
- `EDUCATION_LOAN_GLOBAL` ➔ `education_loan_global_welcome`
- `SCHOOL_FUNDING` ➔ `school_funding_welcome`
- `COLLEGE_FUNDING` ➔ `college_funding_welcome`

### Step 3: Enforce Feature Flag `AISENSY_INBOUND_WEBHOOK_ENABLED=false`
Ensure inbound webhooks do not trigger unverified AI states.

---

## 12. Test Plan
1. **Outbound Trigger Test**: Insert a single controlled lead (`AVL-20260811-000001` | `+91 91756 35165`) with `source: 'FACEBOOK_LEAD_FORM'`.
2. **AiSensy Dispatch**: Confirm outbound WhatsApp template is dispatched and received on device with status `WHATSAPP_SENT`.
3. **Customer Reply**: Customer replies on WhatsApp ➔ Appears in **AiSensy Live Chat** for Human Agent follow-up.
4. **CRM Sync**: Lead status updates to `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` upon agent handling.

---

## 13. 3-Month Operating Workflow

```text
[Lead Generation: Meta Lead Ads / CSV / Website]
                     │
                     ▼
             [AVANI AI CRM]
      • Phone Normalization (+91)
      • Duplicate Check & Storage
      • Campaign Template Resolution
                     │
                     ▼ (AiSensy Outbound API)
       [Customer WhatsApp Device]
      • Receives Meta-Approved Template
                     │
                     ▼ (Customer Replies: "I want to apply")
         [AiSensy Live Chat Inbox]
      • Real-Time Alert to Sales Team
      • Human Agent Handles Loan Consultation
      • Collects Documents & Updates CRM
```

---

## 14. Future PRO Webhook Migration Plan

When the AiSensy plan is upgraded to **PRO** (or Webhook add-on enabled):

1. **AiSensy Dashboard**: Enter `https://avani-ai-crm.vercel.app/api/whatsapp-webhook` in Developer Hub ➔ Project Webhooks.
2. **Environment Variable**: Switch `AISENSY_INBOUND_WEBHOOK_ENABLED=true` in Vercel.
3. **Instant Activation**: The existing `WebhookInbox` ➔ `whatsapp-webhook-worker` ➔ `AgentEngine` architecture immediately assumes automated 24/7 AI qualification with zero codebase refactoring.

---

## FINAL STATUS MATRIX

```text
============================================================
AVANI LOAN SERVICES — SYSTEM OPERATIONAL STATUS
============================================================
APPLICATION                  : READY
AISENSY OUTBOUND             : READY
AISENSY BROADCAST            : READY
AISENSY LIVE CHAT            : READY
CUSTOM AI WHATSAPP INBOUND   : BLOCKED (0/0 Webhooks on BASIC Plan)
META LEAD AUTOMATION         : VERIFY / IMPLEMENT WHERE SUPPORTED
BULK AI AUTOREPLY            : DISABLED
GO-LIVE MODE                 : BASIC PLAN SAFE OPERATING MODE
============================================================
```
