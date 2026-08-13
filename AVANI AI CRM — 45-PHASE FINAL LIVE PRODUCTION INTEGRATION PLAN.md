# AVANI AI CRM — 45-PHASE FINAL LIVE PRODUCTION INTEGRATION PLAN

This implementation plan defines the complete production hardening, provider routing, template management, customer reply AI engine, health endpoint creation, and staged campaign rollout strategy for **AVANI LOAN SERVICES**.

## 1. Primary Production Architecture & Lifecycle

```text
FACEBOOK / INSTAGRAM / CSV LEAD
          │
          ▼
     AVANI AI CRM (Single Source of Truth)
          │
          ▼
   CANONICAL LEAD ID (AVL-YYYYMMDD-XXXXXX)
          │
          ▼
   PRODUCT IDENTIFIED (10 Products)
          │
          ▼
   APPROVED WHATSAPP TEMPLATE
          │
          ▼
     AISENSY / META WABA (ProviderRouter)
          │
          ▼
     CUSTOMER PHONE
          │
          ▼
      CUSTOMER REPLY
          │
          ▼
  WEBHOOK (/api/whatsapp-webhook)
          │
          ▼
   WEBHOOK INBOX (Deduplication)
          │
          ▼
     AVANI AI CRM
          │
          ▼
    AVANI AI AGENT (AgentEngine)
          │
    ┌─────┴─────┐
    ▼           ▼
QUALIFICATION  QUESTIONS
    │
    ▼
PRODUCT RULE ENGINE
    │
    ▼
DOCUMENT RULE ENGINE
    │
    ├───────────────┐
    ▼               ▼
DOCUMENTS       HUMAN HANDOFF / OMNIDM (Disabled for now)
PENDING              │
    │                ▼
    │          OmniDM Adapter
    │                │
    └───────┬────────┘
            ▼
         HUBSPOT (Upsert by leadId)
            │
       GOOGLE SHEETS (Update row by leadId)
            │
         ZAPIER (Idempotent eventId)
            │
            ▼
      AVANI AI CRM (Final Lifecycle)
```

---

## Proposed Changes

### Core Provider Router & Template Engine (`3-AVANI AI CRM`)

#### [NEW] [src/lib/provider-router.ts](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/provider-router.ts)
- Implement `ProviderRouter` with explicit support for `AISENSY` and `META_CLOUD`.
- Idempotency key construction: `provider + campaignId + leadId + templateName + journeyStage`.
- Ensure zero duplicate dispatches across providers for the same campaign request.

#### [NEW] [src/app/api/health/route.ts](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/app/api/health/route.ts)
- Create `/api/health` production diagnostic endpoint.
- Checks MongoDB, AiSensy, Meta WABA, Webhook worker, Gemini AI Agent, OmniDM Adapter, HubSpot, Google Sheets, Zapier.
- Returns status `HEALTHY`, `DEGRADED`, or `BLOCKED` with masked credentials.

#### [MODIFY] [src/lib/aisensy.ts](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/aisensy.ts)
- Strictly map low balance / plan limit errors to `BALANCE_BLOCKED`.
- Mask API keys and credentials in all logs, error objects, and audit traces.

#### [MODIFY] [src/app/api/whatsapp-webhook-worker/route.ts](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/app/api/whatsapp-webhook-worker/route.ts)
- Enforce strict AI Agent invocation trigger ONLY when an inbound customer message is received (`eventType === 'INBOUND_MESSAGE'`).
- Ensure AI Agent never responds to its own outbound messages.
- Perform structured JSON extraction for all 10 products and update `Lead` and `Conversation` records atomically.

#### [MODIFY] [src/lib/voice-provider.ts](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/voice-provider.ts)
- Keep `OMNIDM_LIVE_ENABLED=false` enforced.
- Return operational notice: `"OmniDM integration READY — live calling disabled pending recharge."` with state `OMNIDM_READY_DISABLED`.

---

### Scripts & Verification (`3-AVANI AI CRM`)

#### [MODIFY] [scripts/verify_master_go_live.js](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/scripts/verify_master_go_live.js)
- Comprehensive 45-phase verification suite.
- Audits source CSV (`Doctor Data 01 Aug 2026.csv`).
- Verifies `ProviderRouter` idempotency locks.
- Checks `/api/health` diagnostic report.
- Executes `CONTACT_LIMIT = 1` smoke test for Prashant (`+91 91756 35165`).
- Generates `AVANI_AI_CRM_FINAL_PRODUCTION_INTEGRATION_FORENSIC_REPORT.md`.

---

## Verification Plan

### Automated Verification Commands
1. **Production Health Check**: Test `/api/health` endpoint.
2. **Master Verification Suite**: `node scripts/verify_master_go_live.js`.
3. **Local Compilation**: `npm run build` (47 routes, 0 errors).
4. **GitHub & Production Deployment**: Push to `main` branch on `https://github.com/avaniagrofoods/avani-ai-crm.git`.

### Staged Campaign Rollout Gate
- **Stage 0**: Smoke Test (`1` Contact: Prashant `+91 91756 35165`).
- **Stage 1**: Initial Batch (`5` Contacts).
- **Stage 2**: Expanded Batch (`10` Contacts).
- **Stage 3**: Final Batch (`42` Contacts).
