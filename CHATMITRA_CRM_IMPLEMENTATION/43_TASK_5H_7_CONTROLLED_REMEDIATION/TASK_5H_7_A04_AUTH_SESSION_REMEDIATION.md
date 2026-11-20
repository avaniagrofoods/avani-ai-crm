# TASK 5H.7 — A-04 AUTHENTICATION & SESSION REMEDIATION
**Original Risk (HIGH):** 8-hour (`28800s`) session expiry paired with process-local in-memory `sessionRegistry` and `rateLimitRegistry` `Map`s in `src/lib/auth-store.ts`.

## Changes Made
1. `src/lib/auth.ts`: Reduced `SESSION_MAX_AGE_SECONDS` from `60 * 60 * 8` (28,800s) to `1800` (30 minutes).
2. `src/lib/auth-store.ts`: Documented explicitly that `sessionRegistry` and `rateLimitRegistry` are process-local in-memory `Map`s.

## Remaining Limitations (Finding Marked Partially Remediated)
- Token validation, role checks (`ADMIN`/`ADVISOR`), and same-instance logout revocation are preserved and tested (`A-04` test in `test_task5h7_remediations.test.cjs`).
- **Residual Risk:** Across server restarts or multiple serverless instances, logout revocation (`jti`) and login rate-limit counters are **not** durable under ₹0 in-memory storage. Shortening expiry to 30 minutes limits the exposure window but does not provide durable cross-instance revocation.
