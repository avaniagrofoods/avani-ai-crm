# AVANI AI CRM — CP-26.4 Health & Diagnostics Endpoint Security Closure

**Scope:** Gate 1 — Public `/api/health` Separation, Private `/api/diagnostics`, Credential & Cache Hardening  
**Production Target:** `https://avani-ai-crm.vercel.app`

---

## 1. Defect Identified Before CP-26.4

At CP-26.3 (`68cb48c` / `fbf3eb2`), public `GET /api/health` exposed:
- Process details (`nodeVersion`, `uptimeSeconds`, `memoryUsageMB`).
- `environment` (`appMode`, `providerMode`).
- Integration inventory (`chatmitra`, `aisensy`, `metaWaba`, `avaniAiAgent`, `omniDM`, `hubspot`, `googleSheets`, `zapier`), `phoneNumberId`, `resolvedSenderNumber`, masked API key fragments (`aa61...9900`, `AIza...WMlU`), and raw database error messages on failure.

Additionally, `src/app/settings/page.tsx`, `src/app/developers/page.tsx`, `src/app/api/settings/route.ts`, and `src/app/api/callkaro-webhook/route.ts` contained client/server fallback or masked fragments.

---

## 2. Architecture Separation Implemented

### A. Public Liveness & Availability Endpoint (`src/app/api/health/route.ts`)
- Performs an internal MongoDB readiness check (`available: true | false`) without catching or returning raw driver errors, connection strings, env var names/values, API keys, phone IDs, sender numbers, or integration details.
- Returns **strictly 4 fields**:
  - `status`: `'HEALTHY' | 'DEGRADED'`
  - `service`: `'AVANI LOAN SERVICES — AVANI AI CRM'`
  - `available`: `boolean`
  - `timestamp`: ISO-8601 timestamp
- Response headers prevent Vercel Edge/CDN & browser caching:
  - `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
  - `CDN-Cache-Control: no-store`
  - `Vercel-CDN-Cache-Control: no-store`
  - `Pragma: no-cache`

### B. Private Diagnostics Endpoint (`src/app/api/diagnostics/route.ts`)
- Requires **either**:
  1. Authenticated active `ADMIN` session cookie (`requireRole(req, ['ADMIN'])`), **or**
  2. Valid constant-time `Authorization: Bearer <DIAGNOSTICS_SECRET | CRON_SECRET>` header for authorized monitoring.
- Rejects unauthenticated callers and invalid Bearer tokens with **`HTTP 401 UNAUTHORIZED`**; rejects authenticated `ADVISOR` sessions with **`HTTP 403 FORBIDDEN`**.
- Reports integration state exclusively as boolean/`'CONFIGURED' | 'MISSING'` via `flagStatus()` — **zero key substrings, prefixes, suffixes, or connection strings returned**.
- Sends strict private `no-store` cache headers (`Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0`, `CDN-Cache-Control: no-store`, `Vercel-CDN-Cache-Control: no-store`).

### C. Additional Secret Hygiene Fixes
- Cleared hardcoded token defaults in `src/app/settings/page.tsx`, key prefixes in `src/app/developers/page.tsx`, and hardcoded token fallback in `src/app/api/callkaro-webhook/route.ts` (now gated behind `PROVIDER_MODE === 'live'`).
- Updated `GET/POST /api/settings` (`src/app/api/settings/route.ts`) to return boolean configuration flags instead of last-4 character suffixes and enforce `Cache-Control: no-store`.

---

## 3. Automated Verification (`tests/test_cp26_4_security_closure.test.cjs` — G1.1, G1.2, G3.3)

- **G1.1 PASS:** `GET /api/health` returned `200`, `CDN-Cache-Control: no-store`, and strictly `['available', 'service', 'status', 'timestamp']` with zero leaked fields.
- **G1.2 PASS:** `GET /api/diagnostics` returned `401` unauthenticated and `401` on invalid Bearer token; `200` with valid Bearer monitoring token and zero masked key fragments (`...`).
- **G3.3 PASS:** `GET /api/diagnostics` returned `403` for `ADVISOR` cookie and `200` for `ADMIN` cookie.
