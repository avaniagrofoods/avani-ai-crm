# AVANI AI CRM — CP-26.4 Public Enquiry & Webhook Regression Report

**Scope:** Gate 5 — Public Lead Intake Policy (`POST /api/public/enquiry`) & Meta / ChatMitra Webhook Security  
**Suites Executed:** `tests/test_cp26_4_security_closure.test.cjs`, `tests/test_cp26_3_security_rbac_webhook.test.cjs`, and full 22-suite legacy regression runner (`node scratch/reconcile_tests.cjs`)

---

## 1. Public Enquiry Intake Results (`src/app/api/public/enquiry/route.ts`)

| Requirement Verified | Outcome | Status |
| :--- | :--- | :---: |
| Accepts valid consented enquiry (`consentStatus: "GRANTED"`) | `HTTP 201` creates `NEW_ENQUIRY` lead | **PASS** |
| Invalid Indian phone numbers rejected (`"123"`) | `HTTP 400` validation rejection; zero DB insert | **PASS** |
| Explicit consent denial rejected (`consentStatus: "DENIED"`) | `HTTP 403` DPDP consent rejection; zero DB insert | **PASS** |
| **Missing consent rejected per policy** (omitted `consentStatus` & `consent`) | Tightened in CP-26.4 -> **`HTTP 400`** DPDP explicit consent required; zero DB insert | **PASS** |
| Privileged fields (`role`, `stage: "DISBURSED"`, `revenueTracking`, `assignedAdvisor`) stripped | Ignored server-side; DB record remains `NEW_ENQUIRY` with zero injected revenue/advisor | **PASS** |
| Public response omits complete lead record | Returns `{ success: true, leadId, message }` only (`lead === undefined`) | **PASS** |

---

## 2. Meta & ChatMitra Webhook Security & Idempotency Results

| Check | Endpoint | Observed Result |
| :--- | :--- | :--- |
| Meta GET verification challenge with configured `META_WEBHOOK_VERIFY_TOKEN` | `GET /api/meta-webhook` | **HTTP 200** echoes challenge (`CHK_264`) |
| Meta GET with wrong / removed `'avani_secure_token'` fallback | `GET /api/meta-webhook` | **HTTP 403 Forbidden** |
| Meta POST missing `X-Hub-Signature-256` | `POST /api/meta-webhook` | **HTTP 401** |
| Meta POST invalid `X-Hub-Signature-256` | `POST /api/meta-webhook` | **HTTP 401** |
| Meta POST valid raw-body HMAC-SHA256 signature | `POST /api/meta-webhook` | **HTTP 200** processed cleanly into `avani_ai_crm_test` |
| Duplicate Meta POST event replay | `POST /api/meta-webhook` | **HTTP 200** `{ duplicate: true }`, single `WebhookInbox` entry |
| ChatMitra inbound POST signature enforcement & isolation | `POST /api/chatmitra-webhook` | **HTTP 401** without valid `x-webhook-signature`; **HTTP 200** with valid HMAC-SHA256 |
| Safeguards preserved | All endpoints | `PROVIDER_MODE=mock`; **0** live WhatsApp dispatches sent |
