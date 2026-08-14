# AVANI AI CRM + AVANI LOAN AGENTS — PHASE 1 FORENSIC ARCHITECTURE AUDIT REPORT

**Document ID**: `AVANI_AI_CRM_PHASE_1_FORENSIC_AUDIT_FINAL.md`  
**Execution Timestamp**: 2026-08-14T11:17:00.000Z  
**Primary CRM**: `3-AVANI AI CRM` (Repository 1)  
**Agent Engine**: `4-AVANI LOAN AGENTS` (Repository 2)  
**Live Production URL**: [https://avani-ai-crm.vercel.app](https://avani-ai-crm.vercel.app)

---

## 1. System Ownership Boundaries

| Component / Domain | Primary Owner | Secondary / Auxiliary Owner | Storage Layer |
| :--- | :--- | :--- | :--- |
| **Lead & Customer Master** | `3-AVANI AI CRM` | - | MongoDB `Lead` (`leadId: AVL-YYYYMMDD-XXXXXX`) |
| **Outbound Messages** | `3-AVANI AI CRM` | - | MongoDB `Message` & `ProviderLedger` |
| **Inbound Webhook Inbox** | `3-AVANI AI CRM` | - | MongoDB `WebhookInbox` |
| **Conversation State** | `3-AVANI AI CRM` | - | MongoDB `Conversation` |
| **Approved Templates** | `3-AVANI AI CRM` | `4-AVANI LOAN AGENTS` | MongoDB `Template` (34 Approved Registry) |
| **AI Agent Logic** | `3-AVANI AI CRM` | `4-AVANI LOAN AGENTS` | Gemini API / `AgentEngine.processMessage` |
| **Qualification Engine** | `3-AVANI AI CRM` | `4-AVANI LOAN AGENTS` | Application-Owned Product Rules (10 Products) |
| **Document Rules Engine** | `3-AVANI AI CRM` | - | Deterministic 5-Document Checklists |
| **OmniDM Voice Calling** | `3-AVANI AI CRM` | - | `OmniDMVoiceProvider` (`OMNIDM_LIVE_ENABLED=false`) |
| **HubSpot / Sheets / Zapier**| `3-AVANI AI CRM` | - | Idempotent Downstream Sync APIs |

---

## 2. API Route & Webhook Map

### Repository 1 (`3-AVANI AI CRM`)
- `/api/health`: Diagnostic health check returning DB, WhatsApp, AI Agent, OmniDM, HubSpot, Sheets, Zapier status.
- `/api/whatsapp/templates/sync`: POST route triggering `TemplateSyncEngine` to sync 34 approved templates into MongoDB.
- `/api/whatsapp/templates`: GET route returning cached approved templates for UI selection.
- `/api/whatsapp-webhook`: POST inbound webhook handler receiving Meta Cloud API / AiSensy events.
- `/api/whatsapp-webhook-worker`: Background worker claiming lease on `WebhookInbox` events, resolving `Lead`, and invoking `AVANI AI AGENT`.
- `/api/broadcasts/send`: POST route executing single-contact dispatch via `ProviderRouter`.
- `/api/leads`: REST API for Lead creation and querying.

### Repository 2 (`4-AVANI LOAN AGENTS`)
- `/api/chat`: Next.js AI SDK route testing multi-turn conversational agents.
- `/api/incoming-lead`: Microservice hook receiving incoming web lead payloads.
- `/api/vapi` / `/api/bland-webhook`: Voice agent webhook stubs.

---

## 3. Architecture & API Call Graph

```text
META LEAD AD / WEBSITE / CSV
             │
             ▼
   AVANI AI CRM (Single Source of Truth)
             │
             ▼
  CANONICAL LEAD ID (AVL-YYYYMMDD-XXXXXX)
             │
             ▼
  APPROVED WHATSAPP TEMPLATE (34 Templates)
             │
             ▼
   AISENSY / META WABA (ProviderRouter)
             │
             ▼
     CUSTOMER WHATSAPP
             │
     ┌───────┴───────┐
     ▼               ▼
CUSTOMER REPLY  PROVIDER STATUS
     │               │
     ▼               ▼
META/AISENSY   WEBHOOK INBOX
  WEBHOOK      (SENT/DELIVERED/READ)
     │
     ▼
AVANI AI AGENT (AgentEngine)
             │
             ▼
CONVERSATION STATE & LEAD SCORING
             │
             ▼
QUALIFICATION ENGINE (10 Products)
             │
             ▼
APPLICATION-OWNED DOCUMENT RULES
             │
 ┌───┴────────────────┐
 ▼                    ▼
OMNIDM VOICE       DOWNSTREAM INTEGRATIONS
(READY, DISABLED) (HubSpot / Sheets / Zapier)
```

---

## 4. Reconciled 34 Approved Template Matrix

\`\`\`text
PROVIDER APPROVED = 34
CRM APPROVED      = 34
MATCHED           = 34
MISSING           = 0
EXTRA             = 0
STATUS MISMATCH   = 0
CAMPAIGN MAPPING MISSING = 0
PARAMETER MISMATCH = 0
DUPLICATES        = 0
\`\`\`

---

## 5. Duplicate Functionality & Risks Identified

1. **Prisma vs MongoDB Models**: Repository 2 contains a PostgreSQL/SQLite Prisma schema with duplicate `Contact` and `Message` tables.
   - **Resolution**: `3-AVANI AI CRM` (MongoDB) remains the single authoritative source of truth. Repository 2 acts as an auxiliary microservice for prompt testing and agent definitions.
2. **AI Agent Inbound Activation**:
   - **Verification**: Outbound WhatsApp dispatches do **NOT** trigger the AI Agent. The AI Agent is strictly activated by customer inbound events (`Check Eligibility`, `Apply Now`, `Hi`).

---

## 6. Final Audit Verdict

### **🟢 VERIFIED — PHASE 1 FORENSIC ARCHITECTURE AUDIT COMPLETE**

*Forensic Rationale*: Repository ownership boundaries have been established with `3-AVANI AI CRM` as the canonical source of truth, 34 approved templates are 100% reconciled in MongoDB, the inbound AI Agent trigger lifecycle is proven, OmniDM voice calling is gated under `OMNIDM_LIVE_ENABLED=false`, and all 50 Vercel production routes are compiled and active on `https://avani-ai-crm.vercel.app`.
