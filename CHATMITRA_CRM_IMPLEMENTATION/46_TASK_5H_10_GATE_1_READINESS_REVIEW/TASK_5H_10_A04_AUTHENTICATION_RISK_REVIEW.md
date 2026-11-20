# TASK 5H.10 — A-04 AUTHENTICATION RISK REVIEW
**Files:** `src/lib/auth.ts` (`SESSION_MAX_AGE_SECONDS = 1800`), `src/lib/auth-store.ts` (`sessionRegistry`, `rateLimitRegistry`)

| Scope | Blocked by A-04? | Rationale |
|-------|------------------|-----------|
| **Gate 1–5 Planning** | **NO** | Planning requires no live auth runtime. |
| **Isolated Single-Owner Google Testing** | **NO** | Single local Next.js instance enforces 30m expiry, same-process logout revocation, and same-process login rate limiting. |
| **Multi-Instance Testing** | **YES (Partial)** | Revoked `jti` and failed-login counters are not shared across instances. |
| **Production Activation** | **YES** | Multi-instance serverless production (Vercel) cannot guarantee durable logout revocation or global brute-force rate limiting with in-memory `Map`s. |
