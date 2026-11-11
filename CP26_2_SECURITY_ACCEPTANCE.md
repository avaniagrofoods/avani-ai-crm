# AVANI AI CRM — CP-26.2 GATE 7 & GATE 8: SECURITY & SAFEGUARD ACCEPTANCE REPORT

**Milestone:** CP-26.2 Final Data-Integrity & Revenue Acceptance  
**Inspection Scope:** Production environment configuration (`npx vercel env ls production`), API route handlers, webhook authentication, RBAC/privacy controls, and messaging safety clamps. Zero secret values or connection strings are exposed in this report.

---

## 1. Verified Enforced Security Controls (PASS)

| Control | File / Evidence Verified | Observed Behaviour | Status |
|---|---|---|---|
| **ChatMitra Webhook HMAC-SHA256** | `src/app/api/chatmitra-webhook/route.ts` L64–74 & `src/lib/chatmitra.ts` L75–101 | When `CHATMITRA_WEBHOOK_SECRET` is configured (verified present in `npx vercel env ls production`), missing signature header or invalid HMAC (`crypto.timingSafeEqual`) is rejected with **HTTP 401**. Malformed JSON/payload returns **HTTP 400**; offline DB fails closed with **HTTP 503**. | **PASS** |
| **Internal Webhook Worker Auth** | `src/app/api/whatsapp-webhook-worker/route.ts` L20–24 | Checks `x-worker-auth` header against `INTERNAL_WORKER_SECRET` (present in Vercel Production); rejects mismatches with **HTTP 401**. | **PASS** *(see hardening note)* |
| **Secure Document Upload RBAC & Signed Token** | `src/app/api/documents/secure-upload/route.ts` & `src/lib/consent-privacy.ts` L99–182 | `GET` requires valid HMAC-signed expiring token or advisor RBAC role check (`canAccessDocumentRecord`: `ADMIN`, `CHIEF_ADVISOR`, `SENIOR_ADVISOR`, `LOAN_ADVISOR`); encrypts metadata via AES-256-GCM (`encryptDocumentReference`). | **PASS** *(see fallback note)* |
| **DPDP Consent Enforcement** | `src/app/api/leads/route.ts` | Denies lead creation with **HTTP 403** when `serviceConsent === 'DENIED'`, enforces valid Indian phone (`400`), and records consent/opt-out flags (`consent-privacy.ts` L34–54). | **PASS** |
| **Sensitive Chat Data Interception & Log Redaction** | `src/lib/consent-privacy.ts` L61–94, L188–198 | Detects PAN, Aadhaar, and OTP/PIN patterns in chat (`detectSensitiveDataInChat`) and redacts them in `sanitizeForLog`. | **PASS** |
| **Staging vs Production DB Isolation** | `src/lib/db.ts` | Rejects legacy/cross-app URIs and blocks `avani_ai_crm_prod` whenever `APP_MODE`/`VERCEL_ENV` indicates staging/preview (`avani_ai_crm_test` enforced). | **PASS** |

---

## 2. Critical Security & Authorization Gaps Identified (HONEST DISCLOSURE)

The following **4 verified security gaps** exist in the codebase / Vercel configuration and block an unconditional security sign-off (**Gate 7 = CONDITIONAL PASS / GAPS OPEN**):

1. **Missing User-Session Authentication & RBAC on Core CRM API Routes (HIGH RISK):**
   - There is **no `src/middleware.ts`** enforcing session authentication.
   - `GET /api/leads`, `GET / PATCH /api/leads/[id]`, `POST /api/leads/[id]/assign`, `GET / POST / PATCH /api/leads/[id]/tasks`, `POST /api/leads/[id]/application`, `GET /api/dashboard/metrics`, `GET / POST /api/lenders`, and `GET / POST /api/advisors` **do not validate user authentication tokens or advisor roles** (`x-advisor-role` or session JWT/NextAuth). Any caller with URL access can read lead PII/financials or mutate stages/disbursements/revenue.
   - Additionally, `POST /api/leads` only checks `x-api-key` if `CRM_API_KEY` is configured — and **`CRM_API_KEY` is NOT listed in `npx vercel env ls production`**, leaving `POST /api/leads` unauthenticated in production.

2. **`POST /api/meta-webhook` Lacks HMAC Signature Verification (MEDIUM-HIGH RISK):**
   - `src/app/api/meta-webhook/route.ts` L24–190 parses `await request.json()` directly without verifying Meta's `X-Hub-Signature-256` against `META_APP_SECRET`, even though `META_APP_SECRET` and `STRICT_META_WEBHOOK_VERIFICATION` exist in Vercel Production env vars.
   - Note also: `GET /api/chatmitra-webhook` L29 accepts fallback `|| token === 'avani_secure_token' || challenge`, allowing any GET probe carrying a `challenge` query param to echo `200`.

3. **Hardcoded Fallback Signing/Encryption Keys in Code (MEDIUM RISK):**
   - `src/app/api/whatsapp-webhook-worker/route.ts` L20 falls back to `'dev_secret_only'` if `INTERNAL_WORKER_SECRET` is unset; `src/lib/consent-privacy.ts` L110 & L175 fall back to `'avani_doc_portal_signing_key'` and `'avani_default_encryption_key_32b'` (and neither `DOCUMENT_PORTAL_SECRET` nor `DOCUMENT_ENCRYPTION_KEY` appears in `npx vercel env ls production`, though `INTERNAL_WORKER_SECRET` IS set in Production and reused as secondary fallback).

4. **Safeguard Variables Rely on Code Defaults Instead of Explicit Vercel Production Pins:**
   - Inspection of `npx vercel env ls production` confirmed `CHATMITRA_WEBHOOK_SECRET`, `CHATMITRA_API_KEY`, `META_APP_SECRET`, `INTERNAL_WORKER_SECRET`, `MONGODB_URI`, and `APP_MODE` are present, while explicit keys `PROVIDER_MODE`, `CHATMITRA_INBOUND_AUTO_REPLY_ENABLED`, `BULK_BROADCAST_ENABLED`, `OMNIDM_LIVE_ENABLED`, and `AUTHORIZED_TEST_PHONE_CANONICAL` are **not explicitly defined** in Vercel Production.

---

## 3. Gate 8 Safe-Operating Verification (PASS)

Despite the explicit Vercel env pins missing, runtime safeguards remain enforced in code and verified against live production:
- **Mock Provider Mode Confirmed:** `src/app/api/health/route.ts` L45 defaults `PROVIDER_MODE || 'mock'`, confirmed live by `GET https://avani-ai-crm.vercel.app/api/health` returning `environment.providerMode: "mock"`.
- **Single-Recipient Live Clamp:** `src/lib/chatmitra.ts` L215–224 hardcodes `AUTHORIZED_TEST_PHONE_CANONICAL = '919175635165'` and blocks any `providerMode === 'live'` dispatch to any other phone (`BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT`).
- **Inbound Auto-Reply Guard:** `src/app/api/whatsapp-webhook-worker/route.ts` L294–312 skips AI auto-replies unless `CHATMITRA_INBOUND_AUTO_REPLY_ENABLED === 'true'` (or test event prefix).
- **Zero Accidental Live Customer Sends:** Confirmed `0` real live outbound messages in `avani_ai_crm_prod` (`45` mock `CM-MOCK-*` only).
- **Temp Secret Hygiene:** Temporary `scratch/prod_check.env.tmp` used during read-only inspection has been permanently deleted (`Test-Path` verified `False`).
