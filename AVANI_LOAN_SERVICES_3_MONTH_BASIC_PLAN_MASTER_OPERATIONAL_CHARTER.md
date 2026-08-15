# AVANI LOAN SERVICES — 3-MONTH BASIC PLAN MASTER OPERATIONAL CHARTER

```text
================================================================================
AVANI LOAN SERVICES — 3-MONTH BASIC PLAN MASTER OPERATIONAL CHARTER
================================================================================
DATE & TIMESTAMP            : 2026-08-15 23:26:00 IST
PRIMARY CRM SOURCE OF TRUTH : AVANI AI CRM (3-AVANI AI CRM)
AGENTS SERVICE               : AVANI LOAN AGENTS (4-AVANI LOAN AGENTS)
PRODUCTION CRM DEPLOYMENT   : https://avani-ai-crm.vercel.app
PRODUCTION AGENT DEPLOYMENT : https://avani-loan-agents.onrender.com
ACTIVE HARDENING BRANCH     : release/stage1-hardening (Commit 3e50719)

CONTROLLED TEST CONTACT     : Dr. Sachin Shinde (AVL-20260811-000001 | +919175635165)
APPROVED WHATSAPP SENDER    : +91 72491 08474
AUTHORITATIVE WABA ID       : 1062614709598311
AISENSY PROJECT ID          : 6a670f94d0c39f57eaa6799a
CURRENT AISENSY PLAN        : BASIC (Quarterly - 3 Months Active)

SYSTEM OPERATING MODE       : GREEN — BASIC PLAN SAFE OPERATING MODE
                              WITH EXPLICIT INBOUND AI LIMITATION
================================================================================
```

---

## 1. Operating Mode & System Configuration

```text
================================================================================
CRITICAL PRODUCTION FEATURE FLAGS & CONFIGURATION
================================================================================
• AISENSY_INBOUND_WEBHOOK_ENABLED : false (Enforced due to 0/0 Webhooks on BASIC)
• OMNIDM_LIVE_ENABLED             : false (Zero Live Voice Calling / ₹0.00 spent)
• PROVIDER_MODE                   : live (AiSensy Outbound Active)
• AGENTENGINE_STATE               : PRODUCTION-READY (Guarded / Synthetic Testable)
================================================================================
```

---

## 2. Active Production Funnel Architecture

```text
               [META ADS: FACEBOOK & INSTAGRAM]
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
     [Facebook Lead Form]          [Instagram Lead Form]
               └──────────────┬──────────────┘
                              │ (Instant Form Submission)
                              ▼
            [Meta Leadgen Webhook: /api/meta-webhook]
                              │
                              ▼
          [Meta Graph API Lead Details Retrieval]
                              │
                              ▼
                      [AVANI AI CRM]
            • Normalize Phone (+91XXXXXXXXXX)
            • Deduplicate by Phone & Lead Identity
            • Classify Loan Product
            • Store Canonical Lead in MongoDB
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
   [Downstream Automations]         [AiSensy Outbound API]
   • Google Sheets Sync             • Select Approved Template
   • HubSpot Upsert                 • Dynamic Template Params
   • Zapier Stream                  • Tag: [PRODUCT, SOURCE]
                                             │
                                             ▼
                                 [Customer WhatsApp Device]
                                 • Receives Loan Sanction Offer
                                             │
                                             ▼ (Customer Replies)
                                   [AiSensy Live Chat]
                                             │
                                             ▼
                                  [Human Loan Advisor]
                                 • Live Consultation
                                 • 5-Document Collection
                                 • Update Lead Status in CRM
```

---

## 3. Meta Lead Form Ingest Engines

### A. Facebook Lead Forms (`FACEBOOK_LEAD_FORM`)
- **Webhook Endpoint**: `https://avani-ai-crm.vercel.app/api/meta-webhook`
- **GET Verification**: Verified (`hub.mode === 'subscribe'` returns challenge with `HTTP 200 OK`).
- **POST Ingestion**: Handled under `field === 'leadgen'`, fetches full field data (`name`, `phone`, `email`, `loan_type`) from Meta Graph API `v19.0`.
- **Deduplication**: MongoDB upsert on normalized `phone` with zero duplicate lead creation.
- **Immediate Response**: Dispatches approved AiSensy WhatsApp template and logs provider UUID.

### B. Instagram Lead Forms (`INSTAGRAM_LEAD_FORM`)
- **Status**: Enabled and shares the identical Meta `leadgen` ingest pipeline.
- **Source Attribution**: Persisted as `INSTAGRAM_LEAD_FORM`.
- **Distinction**: Clearly separated from Instagram Direct Messages (DMs).

---

## 4. Channels Kept as FUTURE (Zero False Claims)

```text
================================================================================
UNCONFIGURED / FUTURE CHANNEL REGISTRY
================================================================================
• FACEBOOK_MESSENGER : FUTURE / NOT CONFIGURED (Requires Page-Level Meta App Setup)
• INSTAGRAM_DM       : FUTURE / NOT CONFIGURED (Requires Instagram Messaging API)
================================================================================
```
*Note: All advertising traffic is strictly directed to Meta Instant Lead Forms or Click-to-WhatsApp ads.*

---

## 5. Product ➔ Meta-Approved Template Mapping Matrix

| Loan Product Category | Canonical Loan Type | Approved AiSensy Template Name | Dynamic Variables |
| :--- | :--- | :--- | :--- |
| **Doctor Loans** | `Doctor Loan` | `doctor_loan_offer` / `Avani_Loan_Welcome` | `{{1}}` Name, `{{2}}` Doctor Loan |
| **Business Loans** | `Business Loan` | `business_loan_welcome` | `{{1}}` Name, `{{2}}` Business Loan |
| **Home Loans** | `Home Loan` | `home_loan_welcome` | `{{1}}` Name, `{{2}}` Home Loan |
| **Mortgage Loans / LAP** | `Mortgage Loan` | `mortgage_loan_welcome` | `{{1}}` Name, `{{2}}` Mortgage Loan |
| **Personal Loans** | `Personal Loan` | `Avani_Loan_Welcome` | `{{1}}` Name, `{{2}}` Personal Loan |
| **Global Education** | `Education Loan (Global)` | `education_loan_global_welcome` | `{{1}}` Name, `{{2}}` Global Education |
| **Domestic Education**| `Education Loan (India)` | `education_loan_india_welcome` | `{{1}}` Name, `{{2}}` Education Loan |
| **School Infrastructure**| `School Funding` | `school_funding_welcome` | `{{1}}` Name, `{{2}}` School Funding |
| **College Funding** | `College Funding` | `college_funding_welcome` | `{{1}}` Name, `{{2}}` College Funding |

---

## 6. Customer Replies & Human Live Chat Model

1. **Why Inbound AI is Blocked**: AiSensy BASIC plan exposes `0/0` Webhook Forwarding allocation.
2. **Operational Flow**:
   - Customer replies to a WhatsApp broadcast or lead ad welcome message.
   - Reply arrives instantly in **AiSensy Live Chat** (`https://app.aisensy.com/projects/6a670f94d0c39f57eaa6799a/livechat`).
   - Human Loan Advisor engages within 5 minutes, reviews loan requirements, collects documents, and updates status in AVANI AI CRM.

---

## 7. Canonical CRM Status Lifecycle

```text
[NEW]
  │
  ▼
[WHATSAPP_SENT]
  │
  ▼
[WHATSAPP_DELIVERED]
  │
  ▼
[WHATSAPP_READ]
  │
  ▼
[CUSTOMER_REPLIED_HUMAN_FOLLOWUP]
  │
  ▼
[QUALIFIED_HUMAN]
  │
  ▼
[DOCUMENTS_PENDING] ──► [DOCUMENTS_RECEIVED] ──► [UNDER_REVIEW] ──► [APPROVED] ──► [CLOSED]
```

---

## 8. Safety & Release Lock Matrix

```text
================================================================================
PRODUCTION SAFETY LOCKS ENFORCEMENT
================================================================================
• CONTACT_LIMIT            : 🟢 1 (Dr. Sachin Shinde +91 91756 35165 for E2E Tests)
• STAGE_2                  : 🟢 LOCKED
• 3-LEAD PILOT             : 🟢 LOCKED (Until explicit approval)
• 10-LEAD PILOT            : 🟢 LOCKED (Until explicit approval)
• 37 DOCTOR LOAN LEADS     : 🟢 LOCKED (No autonomous CRM blasting)
• 52 IMPORT-READY LEADS    : 🟢 LOCKED (No autonomous CRM blasting)
• CRM BULK AUTONOMOUS BLAST: 🟢 FORBIDDEN (AiSensy native broadcasts used instead)
• LIVE AI VOICE CALLING    : 🟢 FORBIDDEN (OMNIDM_LIVE_ENABLED = false)
================================================================================
```

---

## 9. Future AiSensy PRO Migration Protocol (Zero-Refactor Switch)

When the 3-month BASIC plan concludes or is upgraded to **PRO**:

1. **AiSensy Portal**: Go to **Developer Hub ➔ Project Webhooks ➔ Add Webhook**:
   - Webhook URL: `https://avani-ai-crm.vercel.app/api/whatsapp-webhook`
   - Events: `Inbound Messages`, `Button Replies`, `Status Updates`.
2. **Empirical Verification**: Send 1 live WhatsApp message to verify real WAMID and `WebhookInbox` creation.
3. **Toggle Environment Variable**: In Vercel Project Settings, set `AISENSY_INBOUND_WEBHOOK_ENABLED=true`.
4. **Autonomous AI Activation**: `AgentEngine` assumes autonomous 24/7 qualification with **zero code modifications**.

---

## 10. Final Master Acceptance Verdict

```text
================================================================================
FINAL MASTER OPERATING VERDICT:
🟢 GREEN — BASIC PLAN SAFE OPERATING MODE
           WITH EXPLICIT INBOUND AI LIMITATION
================================================================================
```
