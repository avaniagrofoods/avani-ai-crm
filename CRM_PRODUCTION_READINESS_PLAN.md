# AVANI AI CRM — PRODUCTION READINESS PLAN
## Comprehensive Architecture, Security, Cutover & Governance Blueprint

**Target Application:** AVANI AI CRM  
**Target Domain:** `https://avani-ai-crm.vercel.app/`  
**Business:** AVANI LOAN SERVICES (`https://www.avanifinserv.com/`)  
**Audit & Preparation Date:** 31 October 2026  
**Document Classification:** Production Readiness & Release Architecture  
**Execution Authorization Status:** **`HOLD — NO PRODUCTION CHANGES AUTHORIZED`**

---

## 1. OBJECTIVE & CURRENT READINESS POSTURE

The objective of this plan is to outline the exact requirements, technical architecture, configuration prerequisites, and post-release verification steps required to transition AVANI AI CRM safely into Production once all blocking items are resolved by the business owner.

### Current Readiness Scorecard:
- **Application Code:** **`READY`** (TypeScript 0 errors, 89/89 local tests passing, consent handling & opt-out active).
- **Staging Preview Runtime:** **`READY`** (`dpl_7fkRwCyMAGEcKAN75hFP1ZYGpPDw` healthy, connected to staging database).
- **Atlas Network Security:** **`BLOCKED`** (`0.0.0.0/0` ingress rule active; requires owner selection of Marketplace integration or auto-expiring rule).
- **Production Database Configuration:** **`BLOCKED`** (Production `MONGODB_URI` in Vercel is 82 days old and points to an offline cluster; live production health reports database `BLOCKED`).
- **Database Backup & Disaster Recovery:** **`BLOCKED`** (Atlas Free M0 lacks automated continuous backup; manual pre-cutover snapshot required).
- **Production Cutover Authorization:** **`HOLD`** (Explicit owner sign-off required).

---

## 2. PRODUCTION ARCHITECTURE & TARGET TOPOLOGY

### 2.1 Target Infrastructure Mapping

| Component | Intended Production Target | Current Staging Equivalent | Verification Requirement |
|---|---|---|---|
| **Hosting Platform** | Vercel Serverless (Node 24.x) | Vercel Preview (`dpl_7fkRwCyMAGEcKAN75hFP1ZYGpPDw`) | Vercel Project `avani-ai-crm` |
| **Domain** | `https://avani-ai-crm.vercel.app` | `https://avani-ai-a05i56ixj-...vercel.app` | Verified aliased to production |
| **Database Cluster** | `avani-loan-services-m0.rhpn2gh.mongodb.net` | Same Atlas Free M0 Cluster | Dedicated cluster for AI CRM |
| **Target Database** | `avani_ai_crm_prod` | `avani_ai_crm_test` | Strict logical partition |
| **Database User** | `starpowerzlatur2210_db_user` | `starpowerzlatur2210_db_user` | Scoped to `readWrite@avani_ai_crm_prod` |
| **Outbound Messaging** | AiSensy WABA / Meta Cloud / ChatMantra | Mock Provider Mode (`PROVIDER_MODE=mock`) | Verified live credentials required |
| **Voice AI Agent** | OmniDM / Vapi (Ready / Disabled) | Disabled (`OMNIDM_LIVE_ENABLED=false`) | Wallet recharge & explicit auth |

---

## 3. PRODUCTION CONFIGURATION PREREQUISITES (OWNER ACTIONS)

Before initiating cutover, the following environment variables must be reviewed, verified, and configured in the Vercel dashboard (`Settings → Environment Variables → Production`):

### 3.1 Mandatory Production Variables

| Variable Name | Required Scope | Required Target Value Specification | Safety / Security Rationale |
|---|---|---|---|
| `APP_MODE` | Production | `production` | Enforces production runtime paths; enables strict production guards. |
| `PROVIDER_MODE` | Production | `mock` (initially for cutover smoke test) → `live` (after smoke test) | Prevents accidental mass broadcast during initial cutover verification. |
| `MONGODB_URI` | Production | `mongodb+srv://...rhpn2gh.mongodb.net/avani_ai_crm_prod` | Connects to active production database on verified cluster `rhpn2gh`. |
| `NEXT_PUBLIC_APP_URL` | Production | `https://avani-ai-crm.vercel.app` | Canonical domain for webhooks, redirects, and relative URLs. |
| `CRM_API_KEY` | Production | Strong random 32+ character hex token | Protects intake routes (`/api/leads`, `/api/contacts`) against unauthenticated flooding. |
| `AISENCY_WABA_API_KEY` | Production | Valid AiSensy WABA API key | Enables official WhatsApp Business messaging. |
| `WHATSAPP_PHONE_NUMBER_ID`| Production | Meta WABA Phone Number ID (`1147494668457940`) | Identifies WhatsApp sender phone. |
| `WHATSAPP_TOKEN` | Production | Valid Meta System User Access Token | Authorizes Meta Cloud WhatsApp dispatch. |
| `META_WEBHOOK_VERIFY_TOKEN`| Production | Secure webhook secret | Authenticates incoming Meta webhook verification challenges. |
| `CHATMANTRA_WEBHOOK_SECRET`| Production | Shared HMAC-SHA256 secret | Authorizes incoming ChatMantra webhook events. |

---

## 4. DATABASE & DATA MODEL READINESS

### 4.1 Index Verification Requirements
Prior to pointing production traffic to `avani_ai_crm_prod`, the owner or DBA must confirm the existence of required unique indexes to enforce data integrity:

```javascript
// 1. Leads collection
db.leads.createIndex({ leadId: 1 }, { unique: true });
db.leads.createIndex({ phone: 1 }, { unique: true });
db.leads.createIndex({ normalizedMobile: 1 });
db.leads.createIndex({ status: 1 });
db.leads.createIndex({ createdAt: -1 });

// 2. Contacts collection
db.contacts.createIndex({ phone: 1 }, { unique: true });
db.contacts.createIndex({ email: 1 });

// 3. Conversations collection
db.conversations.createIndex({ conversationId: 1 }, { unique: true });
db.conversations.createIndex({ leadId: 1 });
db.conversations.createIndex({ phone: 1 });

// 4. Messages collection
db.messages.createIndex({ idempotencyKey: 1 }, { unique: true });
db.messages.createIndex({ providerMessageId: 1 });
db.messages.createIndex({ phone: 1 });

// 5. WebhookInboxes collection
db.webhookinboxes.createIndex({ eventId: 1 }, { unique: true });
db.webhookinboxes.createIndex({ idempotencyKey: 1 }, { unique: true });

// 6. ProviderLedgers collection
db.providerledgers.createIndex({ idempotencyKey: 1 });
db.providerledgers.createIndex({ correlationId: 1 });
```

### 4.2 Migration Strategy
- AVANI AI CRM uses Mongoose schema-on-read models with programmatic defaults.
- No heavy SQL-style destructive schema migrations are required.
- The `src/lib/db.ts` runtime initializes connection pools and collection mappings automatically on cold-start.

---

## 5. BACKUP, RESTORE & DISASTER RECOVERY PROCEDURES

### 5.1 Backup Limitation on Free M0 Tier
- MongoDB Atlas Free Tier M0 does **not** include automated continuous backups or Point-in-Time Restore (PITR).
- **Mandatory Pre-Cutover Backup:** The owner must execute a manual authenticated snapshot via `mongodump`:
  ```bash
  mongodump --uri="<MASKED_PRODUCTION_MONGODB_URI>" --out="./backup_pre_cutover_$(date +%Y%m%d_%H%M%S)"
  ```
- Backups must be stored securely offsite on encrypted storage.

### 5.2 Restore Procedure
In the event of accidental data corruption:
```bash
mongorestore --uri="<MASKED_PRODUCTION_MONGODB_URI>" --drop "./backup_pre_cutover_<TIMESTAMP>/avani_ai_crm_prod"
```

---

## 6. MONITORING, ALERTING & LOG SANITIZATION

1. **Liveness Probe:** Uptime monitors (e.g. BetterStack, UptimeRobot) should query:
   `https://avani-ai-crm.vercel.app/api/health?check=liveness` (Returns HTTP 200 immediately without database query).
2. **Readiness Probe:** CRM operations monitors should query:
   `https://avani-ai-crm.vercel.app/api/health` (Validates database connection, provider status, and node memory).
3. **Automated Alerting:** `src/lib/db.ts` is configured with `sendSlackAlert` to pipe immediate notifications to the operations channel if database connectivity drops.
4. **Log Sanitization:** All logs must continue passing through `maskCredential` to guarantee that API keys, tokens, and database passwords are never printed to Vercel runtime logs.

---

## 7. RELEASE GATES & OWNER SIGN-OFF PROTOCOL

The release execution follows a strict 4-stage progression:

```
[STAGE 1: SECURITY CLEARANCE]  --> Owner resolves Atlas network ingress & sets expiring rule/Marketplace integration.
               |
[STAGE 2: PRE-CUTOVER BACKUP]   --> Owner takes mongodump snapshot of avani_ai_crm_prod.
               |
[STAGE 3: VERCEL CONFIG UPDATE] --> Owner updates Production MONGODB_URI in Vercel to rhpn2gh/avani_ai_crm_prod.
               |
[STAGE 4: SMOKE TEST & PROMOTION] -> Antigravity/Owner executes zero-write health check, verifies HTTP 200 HEALTHY.
```

Production deployment will **not** proceed until Stage 1, 2, and 3 are formally cleared by the owner.
