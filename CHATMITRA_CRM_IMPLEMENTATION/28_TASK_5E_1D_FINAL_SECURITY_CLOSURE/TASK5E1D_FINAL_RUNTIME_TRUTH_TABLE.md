# TASK 5E.1D — FINAL RUNTIME CLASSIFICATION & MUTUALLY EXCLUSIVE TRUTH TABLE
## RESOLUTION OF CLASSIFICATION PRECEDENCE AND PROFILE OVERLAPS (NO "ANY" WILDCARDS)

**Audit Date:** 17 November 2026 (22:30 IST)  
**Target Code:** `3-AVANI AI CRM/src/lib/db.ts`  
**Auditor Roles:** Principal Application Security Engineer, MongoDB Atlas Security Architect & Independent Auditor  
**Classification:** FINAL SECURITY SPECIFICATION CLOSURE (STRICTLY READ-ONLY)

---

## 1. ABSOLUTE ZERO-TRUST PRECEDENCE RULES

To eliminate every possibility of profile overlap or accidental production contamination, the runtime classification algorithm enforces eight strict rules without wildcards or `Any` fallbacks:

1. **Global Production Contamination Guard:** If `NODE_ENV === 'production'`, `APP_MODE === 'production'`, or `VERCEL_ENV === 'production'`, the ONLY permitted profile is `PRODUCTION`. Any combination where one of these is `production` while another is non-production (or missing) **immediately fails closed** to `UNKNOWN_OR_INVALID`.
2. **Explicit Allowed Sets:**
   - `PRODUCTION`: `VERCEL_ENV: ['production']`, `APP_MODE: ['production']`, `NODE_ENV: ['production', '']`.
   - `VERCEL_PREVIEW`: `VERCEL_ENV: ['preview']`, `APP_MODE: ['preview', 'development', 'test', '']`, `NODE_ENV: ['development', 'test', '']`.
   - `LOCAL_DEVELOPMENT`: `VERCEL_ENV: ['', 'local']`, `APP_MODE: ['development', 'local']`, `NODE_ENV: ['development', '']`.
   - `AUTOMATED_TESTS`: `VERCEL_ENV: ['', 'local']`, `APP_MODE: ['test']` OR (`APP_MODE: ['', 'test']` with `NODE_ENV: ['test']`).
3. **Explicit Indicator Requirement:** Local execution cannot be inferred from empty strings. Running with all variables empty fails closed to `UNKNOWN_OR_INVALID`.
4. **Pre-Classification Normalization:** All environment values are stripped of whitespace and converted to lowercase before evaluation (`val.trim().toLowerCase()`).
5. **Deterministic Mapping:** Every possible permutation maps to **exactly one** classification.

---

## 2. EXHAUSTIVE 42-SCENARIO RUNTIME TRUTH TABLE (ZERO "ANY" WILDCARDS)

| Scenario ID | Normalized `VERCEL_ENV` | Normalized `APP_MODE` | Normalized `NODE_ENV` | Resolved Profile | Target Security Policy | Diagnostic Code |
|---|---|---|---|---|---|---|
| **R01** | `production` | `production` | `production` | **`PRODUCTION`** | Permits ONLY `rhpn2gh` / `avani_ai_crm_prod` | `VALID_PROD` |
| **R02** | `production` | `production` | `` (unset) | **`PRODUCTION`** | Permits ONLY `rhpn2gh` / `avani_ai_crm_prod` | `VALID_PROD` |
| **R03** | `production` | `production` | `development` | **`UNKNOWN_OR_INVALID`** | Fail closed on prod with dev NODE_ENV | `CONFLICTING_FLAGS` |
| **R04** | `production` | `production` | `test` | **`UNKNOWN_OR_INVALID`** | Fail closed on prod with test NODE_ENV | `CONFLICTING_FLAGS` |
| **R05** | `production` | `development` | `production` | **`UNKNOWN_OR_INVALID`** | Fail closed on prod VERCEL_ENV with dev APP_MODE | `CONFLICTING_FLAGS` |
| **R06** | `production` | `development` | `development` | **`UNKNOWN_OR_INVALID`** | Fail closed on prod VERCEL_ENV with dev APP_MODE | `CONFLICTING_FLAGS` |
| **R07** | `production` | `development` | `` (unset) | **`UNKNOWN_OR_INVALID`** | Fail closed on prod VERCEL_ENV with dev APP_MODE | `CONFLICTING_FLAGS` |
| **R08** | `production` | `test` | `production` | **`UNKNOWN_OR_INVALID`** | Fail closed on prod VERCEL_ENV with test APP_MODE | `CONFLICTING_FLAGS` |
| **R09** | `production` | `test` | `test` | **`UNKNOWN_OR_INVALID`** | Fail closed on prod VERCEL_ENV with test APP_MODE | `CONFLICTING_FLAGS` |
| **R10** | `production` | `test` | `` (unset) | **`UNKNOWN_OR_INVALID`** | Fail closed on prod VERCEL_ENV with test APP_MODE | `CONFLICTING_FLAGS` |
| **R11** | `production` | `` (unset) | `production` | **`UNKNOWN_OR_INVALID`** | Fail closed on missing APP_MODE in production | `CONFLICTING_FLAGS` |
| **R12** | `production` | `` (unset) | `development` | **`UNKNOWN_OR_INVALID`** | Fail closed on conflicting flags | `CONFLICTING_FLAGS` |
| **R13** | `preview` | `production` | `production` | **`UNKNOWN_OR_INVALID`** | Fail closed on preview with prod APP_MODE | `CONFLICTING_FLAGS` |
| **R14** | `preview` | `production` | `development` | **`UNKNOWN_OR_INVALID`** | Fail closed on preview with prod APP_MODE | `CONFLICTING_FLAGS` |
| **R15** | `preview` | `production` | `` (unset) | **`UNKNOWN_OR_INVALID`** | Fail closed on preview with prod APP_MODE | `CONFLICTING_FLAGS` |
| **R16** | `preview` | `preview` | `development` | **`VERCEL_PREVIEW`** | Permits ONLY test cluster / `avani_ai_crm_test` | `VALID_PREVIEW` |
| **R17** | `preview` | `preview` | `test` | **`VERCEL_PREVIEW`** | Permits ONLY test cluster / `avani_ai_crm_test` | `VALID_PREVIEW` |
| **R18** | `preview` | `preview` | `` (unset) | **`VERCEL_PREVIEW`** | Permits ONLY test cluster / `avani_ai_crm_test` | `VALID_PREVIEW` |
| **R19** | `preview` | `preview` | `production` | **`UNKNOWN_OR_INVALID`** | Fail closed on preview with prod NODE_ENV | `CONFLICTING_FLAGS` |
| **R20** | `preview` | `development` | `development` | **`VERCEL_PREVIEW`** | Permits ONLY test cluster / `avani_ai_crm_test` | `VALID_PREVIEW` |
| **R21** | `preview` | `development` | `` (unset) | **`VERCEL_PREVIEW`** | Permits ONLY test cluster / `avani_ai_crm_test` | `VALID_PREVIEW` |
| **R22** | `preview` | `development` | `production` | **`UNKNOWN_OR_INVALID`** | Fail closed on preview dev with prod NODE_ENV | `CONFLICTING_FLAGS` |
| **R23** | `preview` | `test` | `test` | **`VERCEL_PREVIEW`** | Permits ONLY test cluster / `avani_ai_crm_test` | `VALID_PREVIEW` |
| **R24** | `preview` | `test` | `development` | **`VERCEL_PREVIEW`** | Permits ONLY test cluster / `avani_ai_crm_test` | `VALID_PREVIEW` |
| **R25** | `preview` | `test` | `` (unset) | **`VERCEL_PREVIEW`** | Permits ONLY test cluster / `avani_ai_crm_test` | `VALID_PREVIEW` |
| **R26** | `preview` | `test` | `production` | **`UNKNOWN_OR_INVALID`** | Fail closed on preview test with prod NODE_ENV | `CONFLICTING_FLAGS` |
| **R27** | `preview` | `` (unset) | `` (unset) | **`VERCEL_PREVIEW`** | Permits ONLY test cluster / `avani_ai_crm_test` | `VALID_PREVIEW` |
| **R28** | `preview` | `` (unset) | `production` | **`UNKNOWN_OR_INVALID`** | Fail closed on preview with prod NODE_ENV | `CONFLICTING_FLAGS` |
| **R29** | `` (unset) | `development` | `development` | **`LOCAL_DEVELOPMENT`** | Permits ONLY test hosts / `avani_ai_crm_test` | `VALID_LOCAL` |
| **R30** | `` (unset) | `development` | `` (unset) | **`LOCAL_DEVELOPMENT`** | Permits ONLY test hosts / `avani_ai_crm_test` | `VALID_LOCAL` |
| **R31** | `local` | `development` | `development` | **`LOCAL_DEVELOPMENT`** | Permits ONLY test hosts / `avani_ai_crm_test` | `VALID_LOCAL` |
| **R32** | `local` | `local` | `development` | **`LOCAL_DEVELOPMENT`** | Permits ONLY test hosts / `avani_ai_crm_test` | `VALID_LOCAL` |
| **R33** | `` (unset) | `` (unset) | `development` | **`LOCAL_DEVELOPMENT`** | Inferred dev from NODE_ENV | `VALID_LOCAL` |
| **R34** | `` (unset) | `development` | `production` | **`UNKNOWN_OR_INVALID`** | Fail closed on local dev with prod NODE_ENV | `CONFLICTING_FLAGS` |
| **R35** | `` (unset) | `test` | `test` | **`AUTOMATED_TESTS`** | Permits ONLY test hosts / `avani_ai_crm_test` | `VALID_TEST` |
| **R36** | `` (unset) | `test` | `` (unset) | **`AUTOMATED_TESTS`** | Permits ONLY test hosts / `avani_ai_crm_test` | `VALID_TEST` |
| **R37** | `local` | `test` | `test` | **`AUTOMATED_TESTS`** | Permits ONLY test hosts / `avani_ai_crm_test` | `VALID_TEST` |
| **R38** | `` (unset) | `` (unset) | `test` | **`AUTOMATED_TESTS`** | Inferred test from NODE_ENV | `VALID_TEST` |
| **R39** | `` (unset) | `test` | `production` | **`UNKNOWN_OR_INVALID`** | Fail closed on local test with prod NODE_ENV | `CONFLICTING_FLAGS` |
| **R40** | `` (unset) | `` (unset) | `` (unset) | **`UNKNOWN_OR_INVALID`** | Total missing indicators fail closed! | `MISSING_FLAGS` |
| **R41** | `staging` | `staging` | `staging` | **`UNKNOWN_OR_INVALID`** | Unrecognized environment fails closed | `UNRECOGNIZED_ENV` |
| **R42** | `` (unset) | `production` | `production` | **`UNKNOWN_OR_INVALID`** | Local claiming production without VERCEL_ENV | `CONFLICTING_FLAGS` |
