# AVANI AI CRM — CP-26.5 Security Hardening & Regression Evidence

**Baseline Reviewed:** `ba4488a97ffceef330c0aa561f0a720fcc5eeb89` (`dpl_DkcLYvkGMBCeb9KdPL5L717aU8XG`)  
**Hardened Commit Deployed:** `680c270d255c486b83e7b4fc4879430f7e088f5e`  
**Live Deployment:** `dpl_9uAABu1fVn3Rr6vFJGgkS8AVyjWU` (`https://avani-ai-crm.vercel.app`)  

---

## 1. Security Defects Identified & Fixed in CP-26.5

Audit of `3-AVANI AI CRM` source code after CP-26.4 uncovered five concrete fail-closed / secret-hygiene defects:

1. **Unauthenticated Voice/Call Webhook POST Routes (`PUBLIC_API_EXACT` bypass in `src/proxy.ts`):**
   - `POST /api/callkaro-webhook`, `POST /api/omnidim-webhook`, and `POST /api/vapi-webhook` previously accepted unauthenticated JSON bodies and upserted/updated `Lead` / `Call` records without verifying caller credentials.
   - **Fix (`src/lib/auth.ts`, `src/app/api/callkaro-webhook/route.ts`, `src/app/api/omnidim-webhook/route.ts`, `src/app/api/vapi-webhook/route.ts`):** Implemented `verifySharedWebhookSecret(req, envSecretKeys, headerNames)` using constant-time `constantTimeEqualStrings` over `Authorization: Bearer ...` and provider secret headers (`x-callkaro-secret`, `x-omnidim-secret`, `x-vapi-secret`, `x-webhook-secret`), failing closed with `HTTP 401` and `Cache-Control: no-store`.

2. **Predictable `'dev_secret_only'` Internal Worker Fallback:**
   - `src/app/api/whatsapp-webhook-worker/route.ts`, `src/app/api/whatsapp-webhook/route.ts`, `src/app/api/chatmitra-webhook/route.ts`, and `src/app/api/chatmantra-webhook/route.ts` previously fell back to `'dev_secret_only'` if `INTERNAL_WORKER_SECRET` was unset.
   - **Fix:** Removed `'dev_secret_only'` completely across all four routes. Worker now enforces `constantTimeEqualStrings(authHeader, workerSecret)` (failing closed with `401` + `Cache-Control: no-store` whenever `INTERNAL_WORKER_SECRET` is unset or mismatched).

3. **Unsigned Meta/Generic Webhook Fail-Open Branch & Missing `no-store` on 401s:**
   - `src/app/api/whatsapp-webhook/route.ts` previously contained a fallback branch allowing unverified payloads when `META_APP_SECRET` was absent without strict mode and returned `401` without `no-store`.
   - **Fix:** Enforced fail-closed `unauthorizedWebhook()` returning `HTTP 401` with `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` and `Pragma: no-cache` on all missing/invalid signature paths.

4. **Static Hardcoded Signing/Encryption Fallbacks in `src/lib/consent-privacy.ts`:**
   - Previously used literal fallbacks `'avani_doc_portal_signing_key'` and `'avani_default_encryption_key_32b'` if env vars were missing.
   - **Fix:** Added `resolvePrivacySecret('portal' | 'encryption')`, throwing explicitly in `NODE_ENV === 'production' || VERCEL === '1'` if required secrets (`DOCUMENT_PORTAL_SECRET` / `DOCUMENT_ENCRYPTION_KEY` / `INTERNAL_WORKER_SECRET` / `SESSION_SECRET`) are missing, and using per-process CSPRNG bytes in non-production development/test runs.

5. **Nullable `idempotencyKey` on Worker Inbound `Message.create()`:**
   - `src/app/api/whatsapp-webhook-worker/route.ts` now guarantees non-null `idempotencyKey: msgId || eventId || correlationId || ...` on `Message.create()`, preventing `E11000` collisions against Atlas `idempotencyKey_1` for new webhook traffic.

---

## 2. Post-Edit Verification Results (`374/374` Passing)

All builds and test runs below were executed **after the final CP-26.5 code edit**:

### 2.1 Typecheck & Production Build — **Verified directly**
- `npx tsc --noEmit`: `Exit Code 0`
- `npm run build` (Next.js `16.2.10` Turbopack): `Exit Code 0` (`52` static pages + `ƒ Proxy (Middleware)`)

### 2.2 Isolated Next.js (`next start`) & `avani_ai_crm_test` Suites — **Verified in isolated testing**

| Suite Command | Scope & Port | Result | Residue Check |
|---|---|---|---|
| `node tests/test_cp26_5_operational_readiness.test.cjs` | Port `3095` — CallKaro, OmniDim, Vapi webhook `401` & secret auth; worker `dev_secret_only` rejection & non-null `idempotencyKey`; unsigned `/api/whatsapp-webhook` `401 no-store` | **5 / 5 PASSED** | `0` test residue |
| `node tests/test_cp26_4_security_closure.test.cjs` | Port `3097` — `/api/health` vs `/api/diagnostics`, scrypt login, session rotation, Mongo brute-force throttling (`429`), CSRF (`403`), ADMIN/ADVISOR RBAC, logout revocation, Meta/ChatMitra webhooks | **13 / 13 PASSED** | `0` test residue |
| `node tests/test_cp26_3_security_rbac_webhook.test.cjs` | Port `3099` — API fail-closed auth, UI redirects, public enquiry mass-assignment prevention, IDOR `403`, Meta webhook HMAC + idempotency, telemetry split, dead-letter worker (`STATUS_UPDATE` & `E11000` dedup), cron Bearer auth | **12 / 12 PASSED** | `0` test residue |
| `node tests/test_cp26_3_browser_acceptance.test.cjs` | Port `3098` (Chromium) — Unauth redirects, invalid login error, ADMIN dashboard/leads/inbox/logout, ADVISOR masked revenue & scoped visibility (`0` console/page/5xx errors) | **9 / 9 PASSED** | `0` test residue |
| `node scratch/reconcile_tests.cjs` | `22` regression & unit/integration suites (audit evidence through `test_cp26_1_synthetic_workflows.test.cjs`, incl. `test_cp25_master_chatbot_and_integrations.test.cjs` `40/40`) | **335 / 335 PASSED** (`22/22` files, `0` failed) | Clean |

**Total Automated Suite Verification:** **`374 / 374 PASSED` (`0` skipped, `0` failed)**.

---

## 3. Live Production Security Regression (`dpl_9uAABu1fVn3Rr6vFJGgkS8AVyjWU`) — **Verified directly**

Executed non-mutating requests against `https://avani-ai-crm.vercel.app` after deployment `READY` (`2026-11-12T05:04Z`):

- `GET /api/health` -> `200`, `cache-control: no-store, no-cache, must-revalidate, max-age=0`, `cdn-cache-control: no-store`, strictly `['available', 'service', 'status', 'timestamp']`.
- `POST /api/callkaro-webhook` (unauth) -> `401`, `cache-control: no-store`.
- `POST /api/omnidim-webhook` (unauth) -> `401`, `cache-control: no-store`.
- `POST /api/vapi-webhook` (unauth) -> `401`, `cache-control: no-store`.
- `POST /api/whatsapp-webhook-worker` (`x-worker-auth: dev_secret_only` AND missing header) -> `401`, `cache-control: no-store`.
- `POST /api/whatsapp-webhook` (unsigned) -> `401`, `cache-control: no-store, no-cache, must-revalidate, max-age=0`.
- `POST /api/meta-webhook` (unsigned) -> `401`; `GET /api/meta-webhook` (legacy verify token) -> `403`.
- `POST /api/chatmitra-webhook` & `POST /api/chatmantra-webhook` (unsigned) -> `401`.
- `GET /api/cron/process-scheduled` & `GET /api/cron/follow-ups` (unauth) -> `401`.
- `GET /api/diagnostics`, `/api/leads`, `/api/dashboard/metrics`, `/api/settings`, `/api/contacts`, `/api/advisors`, `/api/lenders` (unauth) -> `401`, `cache-control: no-store`.
- `GET /crm`, `/leads`, `/inbox`, `/`, `/settings`, `/developers` (unauth) -> `307 -> /login`.
- `POST /api/public/enquiry` (missing consent / invalid phone) -> `400` validation rejections.
- `GET /api/diagnostics` (authenticated live ADMIN) -> **Blocked by missing access** (write-only Vercel sensitive env vars; verified `200` ADMIN / `403` ADVISOR in isolated `next start`).
