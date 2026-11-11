# AVANI AI CRM — CP-26.4 Role-Based Access Control Acceptance Report

**Test Suite:** `tests/test_cp26_4_security_closure.test.cjs` + `tests/test_cp26_3_security_rbac_webhook.test.cjs` + `tests/test_cp26_3_browser_acceptance.test.cjs`  
**Isolated Database:** `avani_ai_crm_test` (with synthetic `ADMIN` and `ADVISOR` accounts + `scrypt$` hashes; **0** touches to `avani_ai_crm_prod`)

---

## 1. Mandatory 12-Scenario RBAC & Session Verification Matrix

| # | Scenario | HTTP / UI Outcome | Database Integrity Verification | Result |
| :-: | :--- | :--- | :--- | :---: |
| 1 | Unauthenticated CRM page access (`GET /crm`) | `307` redirect -> `/login?next=%2Fcrm` (Browser hides CRM shell) | No DB writes | **PASS** |
| 2 | Unauthenticated lead API access (`GET /api/leads`) | `401 UNAUTHORIZED` | No DB reads leaked | **PASS** |
| 3 | Unauthenticated dashboard access (`GET /api/dashboard/metrics`) | `401 UNAUTHORIZED` | No DB metrics leaked | **PASS** |
| 4 | Admin lead visibility (`GET /api/leads`) | `200`, sees both owned and other-advisor synthetic leads + numeric revenue | Read-only scoped list | **PASS** |
| 5 | Advisor assigned-lead visibility (`GET /api/leads`) | `200`, returns assigned lead only; excludes other advisor's lead; revenue masked | Read-only (`revenueTracking` stripped) | **PASS** |
| 6 | Advisor access to another advisor's restricted lead (`GET` / `PATCH /api/leads/[otherId]`) | `403 FORBIDDEN` on both `GET` and `PATCH` | Verified `otherLead.stage` remained `'NEW_ENQUIRY'` unchanged in MongoDB | **PASS** |
| 7 | Advisor financial mutation attempt (`POST /api/leads/[ownedId]/application` `RECORD_SANCTION`) | `403 FORBIDDEN` | Verified `ownedLead.stage` remained `'APPLICATION_SUBMITTED'` unchanged in MongoDB | **PASS** |
| 8 | Advisor assignment attempt (`POST /api/leads/[ownedId]/assign`) | `403 FORBIDDEN` | Verified `assignedAdvisor.email` unchanged in MongoDB | **PASS** |
| 9 | Admin authorized financial operation (`POST /api/leads/[ownedId]/application` `RECORD_SANCTION`) | `200` `{ success: true }` | Verified `ownedLead.stage === 'SANCTIONED'` persisted in MongoDB | **PASS** |
| 10 | Logout and reuse of previous session (`POST /api/auth/logout` then replay old cookie) | `200` on logout -> `401` on `GET /api/leads`, `307 -> /login` on `GET /crm` | Verified `authsessions.revoked === true` in MongoDB | **PASS** |
| 11 | Expired session (valid HMAC signed token with past `exp`) | `401 UNAUTHORIZED` | Rejected prior to DB mutation | **PASS** |
| 12 | Forged or invalid session cookie (wrong signing key / malformed cookie) | `401 UNAUTHORIZED` | Rejected prior to DB mutation | **PASS** |

---

## 2. Cleanup Confirmation

Verified `[CP-26.4 Cleanup] Verified 0 synthetic test records remain in avani_ai_crm_test.` across `leads`, `contacts`, `conversations`, `webhookinboxes`, `authsessions`, and `authratelimits`.
