# AVANI AI CRM — CP-26.4 Session Management, Brute-Force & CSRF Security Audit

**Scope:** Gate 3 — Session Signing, Rotation, Revocation, Distributed Rate Limiting & CSRF Protection  
**Files Hardened:** `src/lib/auth.ts`, `src/lib/auth-store.ts`, `src/models/AuthSession.ts`, `src/models/AuthRateLimit.ts`, `src/proxy.ts`, `src/app/api/auth/{login,logout,session}/route.ts`, `src/app/page.tsx`

---

## 1. Session & Cookie Security Controls Verified

| Control | Implementation | Verification Outcome |
| :--- | :--- | :--- |
| Signing Secret Strength | `SESSION_SECRET` must be `>= 32` chars (`256-bit+`); zero hardcoded fallback secret | **PASS** (fails closed if missing or `< 32` chars) |
| Cookie Security Flags | `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 28800` (8h), `secure: isHttps || VERCEL === '1'` | **PASS** (`HttpOnly`, `SameSite=Lax`, `Max-Age=28800` asserted in integration tests; `Secure` forced on Vercel HTTPS) |
| Session Rotation & Anti-Fixation | Every `POST /api/auth/login` mints a fresh CSPRNG `jti` (`crypto.randomUUID()`), inserts active record into MongoDB `authsessions`, and immediately revokes any prior `avani_crm_session` `jti` supplied on the request | **PASS (G3.1)** — replaying prior token immediately fails `401` |
| Server-Side Logout Invalidation | `POST /api/auth/logout` marks current `jti` `{ revoked: true }` in MongoDB `authsessions` and expires browser cookie (`Max-Age=0`) | **PASS (G4.10)** — replaying logged-out cookie fails `401` on `/api/*` and redirects to `/login` on `/crm` and `/` |
| Distributed Validation | Next.js 16 `src/proxy.ts` (Node runtime), `getSessionFromRequest()`, and SSR `src/app/page.tsx` call `verifyActiveSession()`, validating HMAC signature, `exp > now`, AND non-revoked active state in MongoDB `authsessions` (TTL auto-expiry index) | **PASS** across stateless/multi-instance Vercel functions |

---

## 2. Distributed Brute-Force Login Protection

- **Storage (`src/models/AuthRateLimit.ts`, `src/lib/auth-store.ts`):** MongoDB `authratelimits` collection with TTL `expireAt` index (15-minute window, works across all serverless instances rather than process memory).
- **Thresholds:** Locks `(clientIp + emailHash)` after **5** failed attempts for 15 minutes (`HTTP 429 Too Many Requests` + `Retry-After` header) and IP-wide floods after **20** failures. Cleared upon valid login.
- **Test Verification (G3.2):** 5 invalid attempts -> `401`, 6th attempt -> `429` with `Retry-After > 0` and persisted MongoDB rate-limit counter.

---

## 3. CSRF Protection for Authenticated State Changes

- **Cookie Layer:** `SameSite=Lax` prevents cross-site automatic cookie attachment on cross-origin `fetch`/`XHR` and POST submissions.
- **Server-Side Enforcement (`verifyCsrfRequest()` in `src/lib/auth.ts`):**
  - Executed by `src/proxy.ts` on all protected `/api/*` state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`), by `requireAuth()`, and explicitly by `/api/auth/login` and `/api/auth/logout`.
  - Rejects `Sec-Fetch-Site: cross-site` with **`HTTP 403 CSRF_FORBIDDEN`**.
  - Rejects mismatched `Origin` (or `Referer` if `Origin` absent) against request `Host` / `x-forwarded-host` / `NEXT_PUBLIC_APP_URL` host with **`HTTP 403 CSRF_ORIGIN_MISMATCH`**.
- **Test Verification (G3.4):** Cross-site `POST /api/leads/[id]/assign` (`Origin: https://evil-attacker.test`, `Sec-Fetch-Site: cross-site`) and `POST /api/auth/logout` rejected **`403`** with zero database mutation.
