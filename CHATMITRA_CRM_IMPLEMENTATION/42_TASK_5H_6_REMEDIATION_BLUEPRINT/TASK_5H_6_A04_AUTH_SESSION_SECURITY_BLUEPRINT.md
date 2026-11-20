# TASK 5H.6 — A-04 REMEDIATION BLUEPRINT: AUTHENTICATION & SESSION SECURITY
**Severity:** HIGH | **Files Audited:** `src/lib/auth.ts`, `src/lib/auth-store.ts`

---

## 1. Current State Verified in Source
- `src/lib/auth.ts:14`: `SESSION_MAX_AGE_SECONDS = 60 * 60 * 8` (**8 hours**), signed via Web Crypto HMAC-SHA256 (`SESSION_SECRET >= 32 chars`), stored in `httpOnly`, `SameSite=Lax` cookie `avani_crm_session`.
- `src/lib/auth-store.ts:35–36, 80`: `sessionRegistry` and `rateLimitRegistry` are process-local `Map`s. `isSessionActiveInDb(jti)` returns `true` when `!doc`, so **server restarts or secondary serverless instances forget all revocations and rate-limit counters**.

## 2. Options Comparison (₹0 / Free-Tier Constraints)

| Option | Security Benefits | Limitations | Cost | Dependencies |
|--------|-------------------|-------------|------|--------------|
| **1. Short-Lived Signed Sessions (15–30 min `SESSION_MAX_AGE_SECONDS`)** | Cuts worst-case post-logout / stolen-token window from 8h to 15–30 min. | **Does NOT solve durable revocation** across restarts/instances; users must re-login every 30 min. | ₹0 | None (config/constant change in `auth.ts`). |
| **2. Short-Lived Access (15 min) + Refresh Token** | Smooth UX with 15 min access window. | Refresh token still requires durable storage to revoke; otherwise refresh token has the same 8h+ revocation gap. | ₹0 | Requires durable store for refresh revocation. |
| **3. Durable Revocation & Rate-Limit Store (e.g., Upstash Redis Free Tier)** | True cross-instance revocation (`jti` blocklist) and global brute-force rate limiting. | Introduces an external cloud service account/dependency (outside current Google-only approval). | ₹0 (Free tier) | Requires explicit Owner approval + new external service setup. |

## 3. Recommended Architecture (Phased, Honest)
- **Immediate (Zero-Dependency Phase):** Implement **Option 1** by reducing `SESSION_MAX_AGE_SECONDS` from `8 * 3600` to `1800` (30 minutes) and explicitly documenting in Admin UI/docs that logout revokes only on the current instance unless a durable KV store is added.
- **Future Owner-Approved Option:** Add **Option 3** (free-tier KV `jti` blocklist + rate-limit store) before multi-staff production scaling.
- **Never** store session tokens, passwords, or revocation lists in Google Sheets (quota & security risk).
