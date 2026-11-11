# AVANI AI CRM — CP-26.3 Authentication & RBAC Architecture Audit

**Session Mechanism:** Signed HttpOnly Cookie (`avani_crm_session`)  
**Enforcement Layer:** Edge & Node Next.js 16 Proxy (`src/proxy.ts`) + Server Route Authorization (`src/lib/auth.ts`) + UI Session Gating  

---

## 1. Session & Credential Design (`src/lib/auth.ts`, `src/proxy.ts`)

| Control | Implementation |
| :--- | :--- |
| Token Format & Signature | Base64URL payload + HMAC-SHA256 (`SESSION_SECRET`), verified via `crypto.subtle.verify` on both Edge Proxy and Node handlers |
| Cookie Attributes | `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 28800` (8h), dynamic `secure: isHttps` (`x-forwarded-proto === 'https'` on Vercel Production, `false` on HTTP loopback acceptance) |
| Credential Store | Environment-backed accounts (`CRM_AUTH_ACCOUNTS_JSON` / `CRM_ADMIN_EMAIL` + `CRM_ADMIN_PASSWORD[_HASH]` / `CRM_ADVISOR_EMAIL` + `CRM_ADVISOR_PASSWORD[_HASH]`) verified via constant-time comparison (`constantTimeEqualStrings`) |
| Unauthenticated Requests | `src/proxy.ts` redirects unauthenticated page routes to `/login?next=<path>` and rejects protected `/api/*` with `HTTP 401 { error: 'UNAUTHORIZED' }` |
| Session Auth Endpoints | `/api/auth/login` (`POST`), `/api/auth/logout` (`POST`), `/api/auth/session` (`GET`) |

---

## 2. Role & Route Permission Matrix

| Resource / Action | Public / Unauthenticated | `ADVISOR` (`LOAN_ADVISOR`) | `ADMIN` |
| :--- | :--- | :--- | :--- |
| `/login`, `/api/health`, `/api/auth/*` | Allowed | Allowed | Allowed |
| `/api/public/enquiry` (`POST`) | Allowed (mass-assignment stripped; validates phone & DPDP consent; returns minimal `{ success, leadId, message }`) | Allowed | Allowed |
| `/`, `/crm`, `/leads`, `/inbox`, `/contacts`, `/settings`, etc. | Redirects to `/login` | Allowed | Allowed |
| `GET /api/leads` | `401` | Scoped to leads assigned to own `email` / `userId` / `name` (`buildLeadVisibilityFilter`); `revenue` masked | Full visibility across all leads + full financial fields |
| `POST /api/leads` | `401` | Allowed for new lead intake assigned to self; `403` on cross-advisor overwrite or mass-assigned `revenue`/`sanction`/`disbursement`/`role` | Full access |
| `GET / PATCH /api/leads/[id]` | `401` | Scoped via `canAccessLead` (`403` on other advisors' leads, `400` on invalid ObjectId); financial & admin stages restricted (`validateStageTransition`) | Full access (`validateStageTransition` still enforces chronological prerequisites) |
| `POST /api/leads/[id]/assign` | `401` | `403 FORBIDDEN` | Allowed |
| `POST /api/leads/[id]/application` (`SUBMIT_APPLICATION`) | `401` | Allowed on assigned lead | Allowed |
| `POST /api/leads/[id]/application` (`RECORD_SANCTION`, `RECORD_DISBURSEMENT`, `RECORD_REVENUE`) | `401` | `403 FORBIDDEN` | Allowed (requires prior submission for sanction, prior sanction for disbursement) |
| `GET /api/dashboard/metrics` | `401` | Scoped metrics; `revenue.restricted = true` (`null` figures) | Full funnel + full revenue aggregation |
| `GET /api/documents/secure-upload?leadId=...` | `401` (`?token=...` customer HMAC portal token preserved) | Allowed only when `canAccessLead` passes | Allowed |
| `/api/cron/process-scheduled`, `/api/cron/follow-ups` | `401` without Bearer `CRON_SECRET` | `403` | Requires valid `Authorization: Bearer <CRON_SECRET>` or `ADMIN` session |
| Admin / Operational endpoints (`/api/settings`, `/api/webhooks`, `/api/advisors` `POST`, `/api/contacts/bulk-message`, `/api/broadcasts/*`, `/api/forensic-test`, `/api/golden-test-state`, `/api/test-omnidim`) | `401` | Restricted (`403`) on administrative mutations/system endpoints | Full `ADMIN` access |

---

## 3. Security Remediation Summary

- Removed hardcoded UI identity `'Sachin Shinde'` and `'x-advisor-role'` trusted client header spoofing.
- Eliminated mass assignment of `role`, `assignedAdvisor`, `revenue`, `revenueTracking`, `sanction`, and `disbursement` via public intake (`POST /api/public/enquiry`) and advisor `POST /api/leads`.
- Updated `/crm` and `/leads` UI to respect `ADVISOR` financial masking (`ADMIN ONLY`), hide advisor reassignment (`ADMIN`-only panel), allow interactive document checklist updates (`DOCS` tab), and replace native browser `alert()` popups with non-blocking inline banners.
