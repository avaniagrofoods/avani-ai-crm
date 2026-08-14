# AVANI AI CRM — 52-PHASE MASTER PRODUCTION INTEGRATION PLAN

This plan defines the end-to-end architecture and implementation strategy for **AVANI LOAN SERVICES**:
1. Server-side approved WhatsApp template synchronization API (`/api/whatsapp/templates/sync` and `/api/whatsapp/templates`).
2. Template status enforcement (`APPROVED`, `PENDING`, `REJECTED`, `PAUSED`) and UI integration.
3. Inbound customer reply AI Agent activation pipeline (`Customer Inbound Event ➔ WebhookInbox ➔ Lead Resolution ➔ Conversation State ➔ AgentEngine ➔ Product & Document Rules ➔ Outbound AI Response`).
4. Downstream integration sync (HubSpot, Google Sheets, Zapier).
5. OmniDM voice calling safety gate (`OMNIDM_LIVE_ENABLED=false`).

---

## 1. Integrated Business Platform Architecture

```text
FACEBOOK / INSTAGRAM / META / CSV LEAD
                │
                ▼
      AVANI AI CRM (Single Source of Truth)
                │
                ▼
   CANONICAL LEAD ID (AVL-YYYYMMDD-XXXXXX)
                │
                ▼
    SERVER-SYNCED APPROVED TEMPLATE
                │
                ▼
      AISENSY / META WABA (ProviderRouter)
                │
                ▼
        CUSTOMER WHATSAPP
                │
        ┌───────┴───────┐
        ▼               ▼
CUSTOMER REPLY   PROVIDER STATUS
        │               │
        ▼               ▼
 META/AISENSY     WEBHOOK INBOX
   WEBHOOK        (SENT / DELIVERED / READ)
        │
        ▼
   AVANI AI AGENT (AgentEngine)
        │
        ▼
  QUALIFICATION & PRODUCT RULES
        │
        ▼
  APPLICATION-OWNED DOCUMENT RULES
        │
  ┌─────┴─────────────────┐
  ▼                       ▼
OMNIDM VOICE           DOWNSTREAM INTEGRATIONS
(READY, DISABLED)    (HubSpot / Sheets / Zapier)
```

---

## 2. Proposed Changes

### Template Synchronization & Management (`3-AVANI AI CRM`)

#### [NEW] [src/models/Template.ts](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/models/Template.ts)
- Create `Template` Mongoose model:
  - `templateId`: String (unique)
  - `templateName`: String
  - `language`: String
  - `category`: String
  - `status`: String (`APPROVED`, `PENDING`, `REJECTED`, `PAUSED`, `DISABLED`)
  - `components`: Array of components (header, body, footer, buttons)
  - `productMapping`: Array of product enums
  - `provider`: String (`AiSensy`, `MetaCloud`)
  - `lastSyncedAt`: Date

#### [NEW] [src/app/api/whatsapp/templates/sync/route.ts](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/app/api/whatsapp/templates/sync/route.ts)
- Server-side template synchronization route.
- Fetches real templates from Meta Graph API `v25.0` (`/${WABA_ID}/message_templates`) / AiSensy API.
- Upserts templates into MongoDB `Template` collection with status, language, category, components, and variables.
- Returns JSON list of synchronized approved templates.

#### [NEW] [src/app/api/whatsapp/templates/route.ts](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/app/api/whatsapp/templates/route.ts)
- Returns cached approved templates from MongoDB for UI selection.

#### [MODIFY] [src/app/broadcasts/page.tsx](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/app/broadcasts/page.tsx)
- Dynamically loads approved templates from `/api/whatsapp/templates`.
- Displays `[APPROVED]` badge and template details in UI dropdown.
- Blocks selecting or sending rejected or pending templates.

---

### Inbound AI Agent Activation & Rules Engine (`3-AVANI AI CRM`)

#### [MODIFY] [src/app/api/whatsapp-webhook/route.ts](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/app/api/whatsapp-webhook/route.ts)
- Deduplicates inbound webhooks via `WebhookInbox`.
- Triggers background worker for customer replies (`text`, `button_reply`, `list_reply`).

#### [MODIFY] [src/app/api/whatsapp-webhook-worker/route.ts](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/app/api/whatsapp-webhook-worker/route.ts)
- Normalizes phone numbers to resolve canonical `Lead`.
- Activates `AgentEngine.processMessage` strictly on customer inbound events.
- Evaluates application-owned product rules and 5-document Doctor checklist.
- Dispatches AI response back to customer via `sendAiSensyWhatsApp`.
- Idempotently updates HubSpot, Google Sheets, and Zapier.

---

### Verification Suite & Master Forensic Report (`3-AVANI AI CRM`)

#### [NEW] [scripts/verify_master_integration_52.js](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/scripts/verify_master_integration_52.js)
- Comprehensive end-to-end verification script testing:
  1. `/api/health` diagnostic report.
  2. Server-side template synchronization (`/api/whatsapp/templates/sync`).
  3. Lead resolution (`AVL-20260811-000001`).
  4. Inbound customer reply AI Agent activation.
  5. Qualification and document rules evaluation.
  6. Downstream integration idempotency (HubSpot, Sheets, Zapier).
  7. Generates `AVANI_AI_CRM_MASTER_PRODUCTION_INTEGRATION_FORENSIC_FINAL.md`.

---

## Verification Plan

### Automated Commands
1. **Template Sync Check**: POST `/api/whatsapp/templates/sync`
2. **Health Check**: GET `/api/health`
3. **Master 52-Phase Verification Script**: `node scripts/verify_master_integration_52.js`
4. **Local Production Compilation**: `npm run build` (All routes compiled, 0 errors)
5. **GitHub & Production Push**: Push to `main` branch on `https://github.com/avaniagrofoods/avani-ai-crm.git`
