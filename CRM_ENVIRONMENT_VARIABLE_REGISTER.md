# AVANI AI CRM — ENVIRONMENT VARIABLE REGISTER & CONFIGURATION MATRIX
**Audit Date:** 31 October 2026  
**Application:** AVANI AI CRM  
**Organization:** AVANI LOAN SERVICES  
**Scope:** Local Development, Vercel Preview (Staging), and Vercel Production

---

## 1. STRICT CREDENTIAL SANITIZATION NOTICE

All variable values documented herein are masked in compliance with strict credential protection standards. No plaintext passwords, API keys, or connection strings are stored or printed.

---

## 2. ENVIRONMENT CONFIGURATION MATRIX

| Variable Name | Required Scope | Local Development | Staging / Preview | Production | Purpose & Validation Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`APP_MODE`** | All | `local` | `staging` | `production` | Governs runtime environment assertions and safety checks |
| **`PROVIDER_MODE`** | All | `mock` | `mock` | `live` | **CRITICAL:** In mock mode, zero real outbound messages/calls are permitted |
| **`WHATSAPP_PROVIDER`** | All | `CHATMITRA` | `CHATMITRA` | `CHATMITRA` | Primary WhatsApp provider (`CHATMITRA` or `AISENSY` for rollback) |
| **`MONGODB_URI`** | All | `.../avani_ai_crm_test` | `.../avani_ai_crm_test` | `.../avani_ai_crm_prod` | Must target cluster `rhpn2gh`. Prod MUST use `avani_ai_crm_prod` |
| **`CHATMITRA_API_KEY`** | Staging / Prod | `mock_key` | Optional / Mock | `cm_live_...` (Masked) | Primary authentication key for ChatMitra REST API |
| **`CHATMITRA_WEBHOOK_SECRET`**| Staging / Prod | `mock_secret` | `test_secret_...` | `sec_live_...` (Masked) | HMAC-SHA256 secret for validating inbound webhook signatures |
| **`CHATMITRA_VERIFY_TOKEN`** | Staging / Prod | `mock_token` | `avani_verify_...` | `avani_prod_...` | Verification handshake token for GET webhook registration |
| **`CHATMITRA_BASE_URL`** | All | `https://api.chatmitra.com` | `https://api.chatmitra.com` | `https://api.chatmitra.com` | ChatMitra REST API base endpoint |
| **`AISENSY_API_KEY`** | Optional | `ai_test_...` | Optional / Mock | `ai_live_...` (Preserved)| Rollback API key for AiSensy WABA adapter |
| **`NEXT_PUBLIC_APP_URL`** | All | `http://localhost:3000` | `https://avani-ai-a05i...app`| `https://avani-ai-crm.vercel.app`| Public root URL used for OAuth callbacks and asset resolution |
| **`NEXTAUTH_SECRET`** | All | 32-char hex | 32-char hex | 32-char hex | Encryption secret for user session tokens |
| **`TWILIO_ACCOUNT_SID`** | Production | Optional | Optional | `AC...` (Masked) | Fallback SMS / emergency messaging account SID |
| **`TWILIO_AUTH_TOKEN`** | Production | Optional | Optional | 32-char auth token | Fallback Twilio authentication token |
| **`OMNIDM_LIVE_ENABLED`**| Production | `false` | `false` | `false` (until live) | Safety gate preventing automated voice AI calling |
| **`META_APP_SECRET`** | Production | Optional | Optional | 32-char hex | Validates incoming Meta Lead Ads HMAC signatures |

---

## 3. AUDIT OF VERCEL ENVIRONMENT MISCONFIGURATIONS

The forensic baseline identified two critical configuration gaps in the live Vercel environment:

1. **Production `MONGODB_URI` Misconfiguration:**
   - Current Production Setting: Points to `cluster0.mlcxcp.mongodb.net` (Dead/decommissioned).
   - Corrected Value: Must point to `avani-loan-services-m0.rhpn2gh.mongodb.net/avani_ai_crm_prod`.
2. **Missing ChatMitra Production Credentials:**
   - `CHATMITRA_API_KEY`, `CHATMITRA_WEBHOOK_SECRET`, and `CHATMITRA_VERIFY_TOKEN` must be added to Vercel Production scope before switching `PROVIDER_MODE=live`.

---

## 4. ENVIRONMENT INTEGRITY GATES

Automated configuration tests in `tests/test_gate5_staging_configuration.test.cjs` verify:
- `src/lib/db.ts` rejects production database strings when `APP_MODE=staging`.
- Staging mode strictly blocks `PROVIDER_MODE=live` unless explicitly authorized.
- Zero credential exposure in application logs.
