# TASK 5H.5 — AUTHENTICATION AND SESSION SECURITY AUDIT
**Files Audited:** `src/lib/auth-store.ts`, `src/lib/auth.ts`, `src/lib/google-sheets/google-auth.ts`, and API route `requireAuth`/`requireRole` guards.

---

## 1. Positive Controls Verified
- **Zero-Secret Sheet Hygiene:** Neither `ADVISORS` nor `SYSTEM_CONFIG` stores passwords, password hashes, or session tokens. `SystemConfigRepository` explicitly blocks keys matching `/secret|password|token|private_key|api_key|credential|uri/i`.
- **Stateless HMAC-SHA256 Session Signing (`src/lib/auth.ts`):** Uses Web Crypto HMAC-SHA256 with `SESSION_SECRET` (>=32 chars), `httpOnly`, `SameSite=Lax` cookie (`avani_crm_session`), and `role` (`ADMIN`/`ADVISOR`) checks via `requireAuth` / `requireRole`.
- **Server-Only Google Auth (`src/lib/google-sheets/google-auth.ts`):** `GOOGLE_SHEETS_GATEWAY_SECRET` and Service Account PEM keys are strictly server-side (`node:crypto`), never exposed to client components.

## 2. HIGH FINDING A-04: Process-Local In-Memory Revocation & Rate Limiting
- **Evidence (`src/lib/auth-store.ts` lines 35–36, 76–84):**
  - `sessionRegistry` and `rateLimitRegistry` are in-memory `Map` objects.
  - `isSessionActiveInDb(jti)` returns `true` when `!doc` (line 80).
- **Restart & Multi-Instance Bypass Risk:**
  1. **Server Restart:** On restart, `sessionRegistry` and `rateLimitRegistry` are empty. Any previously revoked `jti` passes `isSessionActiveInDb()` and remains accepted until its 24h `exp`.
  2. **Multi-Instance Serverless (Vercel):** Instance B does not share Instance A's memory; a user logged out on Instance A remains authenticated on Instance B, and brute-force login attempts distributed across instances bypass `ACCOUNT_MAX_FAILED_ATTEMPTS` (5) and `IP_MAX_FAILED_ATTEMPTS` (20).
- **Architectural Limitation & Remediation:**
  - Google Sheets (60 req/min/user quota) is **not** suitable for durable per-request session or rate-limit lookups.
  - **Recommended Remediation (₹0):** Reduce `SESSION_MAX_AGE_SECONDS` from 24h to 15–30 minutes (minimizing revocation window without external state), or connect a free-tier durable KV store (e.g., Upstash Redis free tier) if Owner approves an external auth store in a future task.
