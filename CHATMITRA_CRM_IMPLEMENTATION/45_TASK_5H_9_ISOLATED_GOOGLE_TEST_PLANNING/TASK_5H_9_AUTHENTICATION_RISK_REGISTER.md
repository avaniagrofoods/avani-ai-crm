# TASK 5H.9 — AUTHENTICATION RISK REGISTER (A-04)
**Finding:** `SESSION_MAX_AGE_SECONDS = 1800` (30m) + process-local `Map` revocation & rate limiting (`src/lib/auth-store.ts`).

| Risk Area | Current Behavior | Isolated Google Test Impact | Multi-Instance Production Impact |
|-----------|------------------|-----------------------------|----------------------------------|
| **30m Session Expiry** | Tokens expire after 1,800s (`auth.ts:14`). | Acceptable for single-user local test. | Limits worst-case stolen-token window to 30m. |
| **Process-Local Revocation** | `sessionRegistry` `Map` in Node memory; `!doc` defaults to `true`. | **Does NOT block isolated single-instance Google testing.** | **BLOCKS multi-instance production** if durable immediate logout is required. |
| **Process-Local Rate Limiting** | `rateLimitRegistry` `Map` resets on restart/instance switch. | **Does NOT block isolated testing.** | **HIGH risk in multi-instance production** (brute-force bypass across instances). |

**Zero-Cost Comparison:** (1) Current in-memory + 30m expiry = ₹0, zero external deps, non-durable across restarts. (2) Short-lived stateless only = same non-durable logout. (3) Free-tier external KV (e.g., Upstash Redis) = ₹0 free tier, provides durable `jti` blocklist & rate limiting, requires future Owner approval.
