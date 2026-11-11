# AVANI AI CRM — CP-26.3 BASELINE VERIFICATION

**Generated:** 2026-11-11T04:42:05Z  
**Production URL:** https://avani-ai-crm.vercel.app  
**Workspace:** `3-AVANI AI CRM`

---

## 1. Git Baseline

| Item | Verified Value |
| :--- | :--- |
| Repository | `https://github.com/avaniagrofoods/avani-ai-crm.git` (credentials redacted) |
| Active Branch | `main` |
| `main` HEAD | `d50164a` (`fix(cp26.2): repair lead/revenue/task persistence bugs and add CP-26.2 forensic acceptance reports`) |
| `release/stage1-hardening` HEAD | `d50164a` (`fix(cp26.2): repair lead/revenue/task persistence bugs and add CP-26.2 forensic acceptance reports`) |
| Parity Status | `main` and `release/stage1-hardening` are identical and synchronized with `origin/main` and `origin/release/stage1-hardening` |

---

## 2. Active Vercel Production Deployment

| Metadata Field | Verified Value |
| :--- | :--- |
| Vercel Project | `avani-ai-crm` |
| Deployment ID | `dpl_HrGctCsiWdUerxMJ2cdxHZ2KWMrb` |
| Ready State | `READY` |
| Target | `production` |
| Production Aliases | `avani-ai-crm.vercel.app`, `avani-ai-crm-avaniagrofoods1356-4705s-projects.vercel.app`, `avani-ai-crm-git-main-avaniagrofoods1356-4705s-projects.vercel.app` |
| Node Runtime | `24.x` (`v24.22.2`) |
| Middleware / Proxy at Baseline | `[]` (none deployed at `d50164a`) |
| Configured Crons | `/api/cron/follow-ups` (`0 5 * * *`), `/api/cron/process-scheduled` (`0 6 * * *`) |

---

## 3. Live `/api/health` Snapshot

- **HTTP Status:** `200 OK`
- **Service:** `AVANI LOAN SERVICES — AVANI AI CRM`
- **Readiness:** `READY` (`databaseReady: true`, `appMode: production`, `providerMode: mock`)
- **Meta WABA:** `HEALTHY` (`phoneNumberId: 1147494668457940`, `resolvedSenderNumber: +91 72491 08474`)
- **OmniDM:** `READY_DISABLED` (`liveEnabled: false`)
- **Database:** `MongoDB Atlas` (`uriConfigured: true`, `HEALTHY`)

---

## 4. Baseline Security & Telemetry Gaps Confirmed Before Hardening

1. **Authentication & RBAC:** Zero session cookie verification, zero `src/proxy.ts` route protection, and zero server-side RBAC on CRM routes (`/crm`, `/leads`, `/inbox`, `/api/leads*`, `/api/dashboard/metrics`, `/api/contacts*`, `/api/settings`, `/api/webhooks`, `/api/opts`, `/api/schedule`, `/api/broadcasts*`, etc.).
2. **Meta Webhook Signature:** `POST /api/meta-webhook` does not enforce `X-Hub-Signature-256` verification against `META_APP_SECRET` (`GET` also falls back to hardcoded `'avani_secure_token'`).
3. **Telemetry Mixing:** Home dashboard SSR (`src/app/page.tsx`) counts all `OUTBOUND` `Message` records (`45` `CM-MOCK-*` records with `mock: true`) as `"WhatsApp Messages Sent"`.
4. **Dead-Letter Failures:** Production `WebhookInbox` contains `24` `FAILED` `Meta|INBOUND_MESSAGE` records (`18` `E11000` on `idempotencyKey_1`, `6` Nov 1 ObjectId cast errors) caused by missing `idempotencyKey` pre-checks and unvalidated ObjectIds in `whatsapp-webhook-worker`.
5. **Production Env Safeguards:** Explicit `PROVIDER_MODE`, `CHATMITRA_INBOUND_AUTO_REPLY_ENABLED`, `BULK_BROADCAST_ENABLED`, `AUTHORIZED_TEST_PHONE_CANONICAL`, `OMNIDM_LIVE_ENABLED`, `SESSION_SECRET`, and CRM account credentials must be pinned in Vercel Production.
