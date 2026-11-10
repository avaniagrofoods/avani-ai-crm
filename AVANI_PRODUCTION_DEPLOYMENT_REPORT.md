# AVANI LOAN SERVICES — CP-25 PRODUCTION DEPLOYMENT REPORT (SECTION 26)

- **Business Entity:** AVANI LOAN SERVICES (`https://www.avanifinserv.com/`)
- **Owner & Founder:** Sachin Shinde
- **Production Alias:** `https://avani-ai-crm.vercel.app`
- **CRM Inbox URL:** `https://avani-ai-crm.vercel.app/inbox`
- **Vercel Project ID:** `prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ` (`avani-ai-crm`)
- **CP-25 Production Deployment ID:** `dpl_DF6Py8wJ14Acg89ySF26NYy2wcv7`
- **Unique Deployment URL:** `https://avani-ai-hiajpepcl-avaniagrofoods1356-4705s-projects.vercel.app`
- **Deployment Ready State:** `READY` (Target: `production`, Region: `iad1`)
- **Deployment Timestamp:** `2026-11-10T10:19:34+05:30` (`2026-11-10T04:49:34Z`)

---

## 1. Build & Compilation Telemetry

| Check | Result | Details |
|---|---|---|
| **Next.js Version** | `16.2.10` (Turbopack) | Compiled in `9.1s` on Vercel Production builder |
| **TypeScript Validation** | **PASS (0 Errors)** | Completed in `7.4s` |
| **Static & Dynamic Routes** | **50 Routes Built** | Includes new `/api/dashboard/metrics` and `/api/documents/secure-upload` routes |
| **Automated Regression Suite** | **251 / 251 PASS (100%)** | 17 test suites executed via [`scratch/reconcile_tests.cjs`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/scratch/reconcile_tests.cjs) |
| **Secret Exposure Scan** | **0 Exposures** | Verified via [`scratch/scan_secret_exposure.cjs`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/scratch/scan_secret_exposure.cjs) |

---

## 2. Live Production Smoke Probe Verification

| Endpoint | Method | Expected HTTP Status | Live HTTP Status | Live Response Evidence |
|---|---|---|---|---|
| `https://avani-ai-crm.vercel.app/api/health` | `GET` | `200 OK` | `200 OK` | `{"status":"HEALTHY","database":{"ready":true,"state":"CONNECTED"},"safetyFlags":{"providerMode":"mock","bulkBroadcastEnabled":false}}` |
| `https://avani-ai-crm.vercel.app/api/dashboard/metrics` | `GET` | `200 OK` | `200 OK` | `{"success":true,"databaseOnline":true,"kpis":{...15 KPIs...}}` |
| `https://avani-ai-crm.vercel.app/api/documents/secure-upload` | `GET` (no token) | `401 Unauthorized` | `401 Unauthorized` | `{"success":false,"error":"Malformed upload token"}` |
| `https://avani-ai-crm.vercel.app/api/chatmitra-webhook` | `GET` (no challenge) | `403 Forbidden` | `403 Forbidden` | `Forbidden` |
| `https://avani-ai-crm.vercel.app/inbox` | `GET` | `200 OK` | `200 OK` | Live CRM Inbox UI rendered |
