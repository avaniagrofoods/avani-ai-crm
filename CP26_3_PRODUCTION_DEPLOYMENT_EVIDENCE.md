# AVANI AI CRM — CP-26.3 Production Deployment & Live Security Verification Evidence

**Production URL:** https://avani-ai-crm.vercel.app  
**Vercel Project:** `avani-ai-crm` (`avaniagrofoods1356-4705s-projects/avani-ai-crm`)  
**Verified Production Deployment ID:** `dpl_DzEdcJbz3vdAJDaThrnLgxhvjnHG`  
**Verified Deployment URL:** `https://avani-ai-cohfbu0sr-avaniagrofoods1356-4705s-projects.vercel.app`  
**Verified Source Commit SHA (`main` & `release/stage1-hardening`):** `68cb48c81d3085b17a3ba763f57bac17d793aedf` (`68cb48c`)

---

## 1. Deployment Identity & Aliases

| Metadata Field | Verified Value |
| :--- | :--- |
| Ready State | `READY` (`target: production`) |
| Git Branch / Repo | `main` (`github.com/avaniagrofoods/avani-ai-crm.git`) |
| Aliases | `avani-ai-crm.vercel.app`, `avani-ai-crm-avaniagrofoods1356-4705s-projects.vercel.app`, `avani-ai-crm-git-main-avaniagrofoods1356-4705s-projects.vercel.app` |
| Node Runtime | `v24.22.2` |
| Configured Crons | `2` (`/api/cron/follow-ups`, `/api/cron/process-scheduled`) |
| Next.js Edge Proxy | Active (`src/proxy.ts` protecting UI and `/api/*` routes) |

---

## 2. Live Non-Mutating Production Verification Results (`https://avani-ai-crm.vercel.app`)

| Check / Endpoint | Expected | Observed Live Outcome |
| :--- | :--- | :--- |
| `GET /api/health` | `200`, `READY`, `databaseReady: true`, `providerMode: mock` | **PASS (`200`)** — `status: "HEALTHY"`, `appMode: "production"`, `providerMode: "mock"`, `databaseReady: true`, `metaWaba.resolvedSenderNumber: "+91 72491 08474"`, `omniDM.liveEnabled: false` |
| `GET /login` | `200` public sign-in portal | **PASS (`200`)** |
| `GET /crm`, `/leads`, `/inbox` (unauthenticated) | Redirect (`307`/`302`) to `/login` | **PASS (`307`)** -> `/login?next=%2Fcrm`, `/login?next=%2Fleads`, `/login?next=%2Finbox` |
| `GET /api/leads`, `/api/dashboard/metrics`, `/api/settings`, `/api/cron/process-scheduled` (unauthenticated) | `401 UNAUTHORIZED` | **PASS (`401`)** across all four endpoints |
| `GET /api/meta-webhook?hub.mode=subscribe&hub.verify_token=avani_secure_token&hub.challenge=123` | `403` (legacy hardcoded fallback removed) | **PASS (`403`)** |
| `POST /api/meta-webhook` (missing `X-Hub-Signature-256`) | `401` signature required | **PASS (`401`)** |
| `POST /api/public/enquiry` with invalid phone `"123"` | `400` validation rejection (no DB write) | **PASS (`400`)** — `{"success":false,"error":"Invalid phone number. Must be a valid 10-digit Indian mobile number."}` |

---

## 3. Preserved Non-Negotiable Production Safeguards

All safety environment flags remain pinned in Vercel `Production` (`Encrypted`) and verified via live health/telemetry behavior:
- `PROVIDER_MODE=mock`
- `CHATMITRA_INBOUND_AUTO_REPLY_ENABLED=false`
- `BULK_BROADCAST_ENABLED=false`
- `AUTHORIZED_TEST_PHONE_CANONICAL=919175635165`
- `OMNIDM_LIVE_ENABLED=false`

Zero live WhatsApp messages or voice calls were sent during CP-26.3 verification.

---

## 4. Operator Credential Rotation Reminder

`SESSION_SECRET`, `CRON_SECRET`, `CRM_ADMIN_PASSWORD_HASH` (`enquiry@avanifinserv.com`), and `CRM_ADVISOR_PASSWORD_HASH` (`operations@avanifinserv.com`) were provisioned directly in Vercel Production (`Encrypted`) using CSPRNG values so zero secrets were ever printed or stored in Git. Before first operator sign-in at `https://avani-ai-crm.vercel.app/login`, set or rotate your chosen `CRM_ADMIN_PASSWORD` / `CRM_ADVISOR_PASSWORD` (or updated hashes) in **Vercel Project Settings -> Environment Variables (Production)**.
