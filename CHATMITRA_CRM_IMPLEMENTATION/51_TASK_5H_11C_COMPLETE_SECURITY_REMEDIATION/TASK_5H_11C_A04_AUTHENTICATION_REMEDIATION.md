# TASK 5H.11C — A-04 AUTHENTICATION REMEDIATION
- **Current Local State:** `SESSION_MAX_AGE_SECONDS = 1800` (30m) in `src/lib/auth.ts`; process-local `sessionRegistry` and `rateLimitRegistry` `Map`s in `src/lib/auth-store.ts`.
- **Honest Status:** **PARTIALLY REMEDIATED.** 30-minute expiry is **not** equivalent to durable revocation; server restarts and multi-instance serverless deployments clear/bypass in-memory revocation and rate limits.
- **Production Remediation Design:** Adopt a free-tier or low-cost external durable KV/Redis store (e.g., Upstash Redis free tier, $0 within free limits) for `jti` revocation blocklist + login rate limiting before multi-instance production activation. Not provisioned in Task 5H.11C.
