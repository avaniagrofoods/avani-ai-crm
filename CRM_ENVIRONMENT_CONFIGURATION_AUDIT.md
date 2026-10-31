# AVANI AI CRM — ENVIRONMENT CONFIGURATION & CREDENTIAL AUDIT
**Audit Date:** 31 October 2026  
**Application:** AVANI AI CRM  
**Organization:** AVANI LOAN SERVICES  
**Scope:** Local, Development, Preview (Staging), and Production

---

## 1. SANITIZED ENVIRONMENT REGISTER

All variable values are strictly masked in compliance with credential protection directives.

| Variable Name | Provider / Domain | Required Scope | Configured Status | Secret Classification | Validation & Forensic Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`APP_MODE`** | Core Runtime | Preview, Production | Configured (Both) | Operational Flag | Sets `staging` in Preview; `production` in Prod |
| **`PROVIDER_MODE`** | Messaging Core | Preview, Production | Configured (Both) | Operational Flag | Sets `mock` in Preview; `production` in Prod |
| **`WHATSAPP_PROVIDER`** | Central Router | Preview, Production | Code Default (`CHATMITRA`)| Operational Flag | Defaults to `CHATMITRA`; switchable to `AISENSY` |
| **`MONGODB_URI` (Preview)** | MongoDB Atlas | Preview Scope | **Configured (21h ago)** | Confidential URI | Points to `rhpn2gh/avani_ai_crm_test` (HEALTHY) |
| **`MONGODB_URI` (Prod)** | MongoDB Atlas | Production Scope | **STALE (82d ago)** | Confidential URI | **BLOCKED:** Points to dead cluster `mlcxcp` |
| **`CHATMITRA_API_KEY`** | ChatMitra | Production Scope | **MISSING** | Secret API Key | Required for live ChatMitra dispatch |
| **`CHATMITRA_WEBHOOK_SECRET`**| ChatMitra | Production Scope | **MISSING** | Secret Key | Required for live webhook HMAC verification |
| **`CHATMITRA_VERIFY_TOKEN`** | ChatMitra | Production Scope | **MISSING** | Secret Token | Required for live webhook GET registration |
| **`CHATMITRA_BASE_URL`** | ChatMitra | All Scopes | Default Constant | Public URL | Defaults to `https://api.chatmitra.com` |
| **`CHATMITRA_BACKEND_URL`** | ChatMitra | All Scopes | Default Constant | Public URL | Defaults to `https://backend.chatmitra.com` |
| **`AISENCY_WABA_API_KEY`** | AiSensy (Rollback) | Production Scope | Configured (82d ago) | Secret API Key | Preserved for standby zero-downtime rollback |
| **`WHATSAPP_TOKEN`** | Meta Cloud API | Production Scope | Configured (82d ago) | Secret Token | Direct Meta Cloud API system user token |
| **`WHATSAPP_PHONE_NUMBER_ID`**| Meta Cloud API | Production Scope | Configured (`1147494668457940`)| Public Identifier| Mapped to sender `+91 72491 08474` |
| **`WHATSAPP_BUSINESS_ACCOUNT_ID`**| Meta Cloud API | Production Scope | Configured (`1062614709598311`)| Public Identifier| Authoritative WABA ID |
| **`META_WEBHOOK_VERIFY_TOKEN`**| Meta Cloud API | Production Scope | Configured (82d ago) | Secret Token | Handshake token for Meta webhook |
| **`NEXT_PUBLIC_APP_URL`** | Core Routing | Production Scope | Configured | Public URL | `https://avani-ai-crm.vercel.app` |
| **`OMNIDM_API_KEY`** | Voice AI | Production Scope | Configured (82d ago) | Secret API Key | Voice calling provider key |
| **`OMNIDM_LIVE_ENABLED`**| Voice AI Safety | Production Scope | Default (`false`) | Safety Flag | Prevents automated dialing in non-live modes |

---

## 2. SEPARATION AUDIT & DATA ISOLATION

1. **Preview vs. Production Database Separation:**
   - Preview uses a dedicated database user scoped strictly to `avani_ai_crm_test`.
   - Production credentials are never copied into the Preview environment.
   - Guard in `src/lib/db.ts` rejects any staging connection attempt targeting `avani_ai_crm_prod`.
2. **Provider Isolation:**
   - Messaging credentials for ChatMitra are verified separately from AiSensy credentials.
   - Database connection strings are verified separately from messaging tokens.
3. **Mock Mode Lockdown:**
   - Preview remains locked in `PROVIDER_MODE=mock`. Live messaging is forbidden in staging.

---

## 3. AUDIT CONCLUSION

The environment structure is properly partitioned. Production cutover requires owner insertion of the 3 ChatMitra production variables and updating the production `MONGODB_URI`.
