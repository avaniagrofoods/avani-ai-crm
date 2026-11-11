# AVANI AI CRM — CP-26.3 Production Environment & Safety Audit

**Scope:** Vercel Project `avani-ai-crm` (`Production` environment)  
**Zero Secrets Policy:** Secret values, passwords, API tokens, and MongoDB connection strings are omitted; only presence, environment binding, and non-secret safety flags are audited.

---

## 1. Non-Negotiable Production Safeguards (Verified Pinned in Vercel Production)

| Environment Variable | Required Policy | Vercel Production Status |
| :--- | :--- | :--- |
| `PROVIDER_MODE` | `mock` (Prevent unintended live WhatsApp charges) | Pinned (`mock`, `Encrypted`) |
| `CHATMITRA_INBOUND_AUTO_REPLY_ENABLED` | `false` | Pinned (`false`, `Encrypted`) |
| `BULK_BROADCAST_ENABLED` | `false` | Pinned (`false`, `Encrypted`) |
| `AUTHORIZED_TEST_PHONE_CANONICAL` | `919175635165` | Pinned (`919175635165`, `Encrypted`) |
| `OMNIDM_LIVE_ENABLED` | `false` | Pinned (`false`, `Encrypted`) |

---

## 2. Authentication, RBAC & Cron Security Variables (Pinned in Vercel Production)

| Environment Variable | Purpose | Vercel Production Status |
| :--- | :--- | :--- |
| `SESSION_SECRET` | HMAC-SHA256 signing & verification of HttpOnly `avani_crm_session` cookies | Configured (`Encrypted`, 64-char CSPRNG) |
| `CRM_ADMIN_EMAIL` | Primary ADMIN login identifier (`enquiry@avanifinserv.com`) | Configured (`Encrypted`) |
| `CRM_ADMIN_NAME` | ADMIN display identity (`Sachin Shinde`) | Configured (`Encrypted`) |
| `CRM_ADMIN_PASSWORD_HASH` | SHA-256 salted-rotation-ready digest (`CRM_ADMIN_PASSWORD` plaintext never stored on disk) | Configured (`Encrypted`) |
| `CRM_ADVISOR_EMAIL` | Standard LOAN_ADVISOR login identifier (`operations@avanifinserv.com`) | Configured (`Encrypted`) |
| `CRM_ADVISOR_NAME` | ADVISOR display identity (`Operations Desk`) | Configured (`Encrypted`) |
| `CRM_ADVISOR_PASSWORD_HASH` | SHA-256 digest (`ADVISOR` role scoped access) | Configured (`Encrypted`) |
| `CRON_SECRET` | Constant-time Bearer protection for `/api/cron/process-scheduled` and `/api/cron/follow-ups` | Configured (`Encrypted`, 48-char CSPRNG) |
| `INTERNAL_WORKER_SECRET` | Internal dispatch secret for `/api/whatsapp-webhook-worker` | Configured (`Encrypted`, existing) |

---

## 3. Webhook & Database Configuration Preserved

- `META_APP_SECRET`, `STRICT_META_WEBHOOK_VERIFICATION`, `META_WEBHOOK_VERIFY_TOKEN` — Preserved (`Encrypted`, `Production`).
- `CHATMITRA_API_KEY`, `CHATMITRA_WEBHOOK_SECRET`, `CHATMITRA_VERIFY_TOKEN`, `CHATMITRA_WABA_ID`, `CHATMITRA_API_URL`, `CHATMITRA_BACKEND_URL`, `WHATSAPP_PROVIDER` — Preserved (`Encrypted`, `Production`).
- `MONGODB_URI`, `avani_ai_crm_prod_MONGODB_URI` — Preserved (`Encrypted`, `Production`).
- Legacy/decommissioned fallback secrets were not relied upon by runtime auth or webhook handlers (`src/app/api/meta-webhook/route.ts` rejects missing `META_APP_SECRET` and removed the hardcoded `'avani_secure_token'` fallback).

---

## 4. Operator Rotation Note Before First Live Production Login

Because `CRM_ADMIN_PASSWORD_HASH` and `CRM_ADVISOR_PASSWORD_HASH` were provisioned using randomized CSPRNG hashes without exposing secrets in logs or repository files, the CRM owner should set their chosen `CRM_ADMIN_PASSWORD` (or new `CRM_ADMIN_PASSWORD_HASH` / `CRM_ADVISOR_PASSWORD_HASH`) directly inside **Vercel Project Settings -> Environment Variables (Production)** prior to logging in on `https://avani-ai-crm.vercel.app/login`.
