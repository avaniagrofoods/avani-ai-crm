# TASK 5H.10 — UNRESOLVED SECURITY RISKS REGISTER
**Preserved Date:** 19 November 2026 (Carried Forward Unaltered from Task 5H.10 Readiness Review)

| Risk ID | Risk Area | Summary & Technical Limitation | Current Status |
|---------|-----------|--------------------------------|----------------|
| **R-01** | **Anonymous Apps Script Endpoint Abuse & Quota Exhaustion** | `ANYONE_ANONYMOUS` allows any caller who discovers `/exec` to invoke `doPost(e)`, consuming the 30-simultaneous-execution and 50,000 Properties/day quotas before HMAC rejects them. | Accepted **for isolated testing only** with confidential `/exec` URL; **must be replaced** by Service Account + Sheets API v4 REST before production. |
| **R-02** | **HMAC Verification & Replay Protection (`CacheService`)** | `CacheService` holds max 1,000 items (evicts 900 oldest if exceeded, 600s max TTL); replay protection is best-effort, not cryptographically absolute. | Preserved & documented; live verification pending Gate 4/5. |
| **R-03** | **Spreadsheet ID Allowlisting** | Enforced via `ALLOWED_SPREADSHEET_ID` in `ScriptProperties`; must be verified during Gate 3/4 against `AVANI_AI_CRM_ISOLATED_TEST` only. | Pending Gate 3/4 verification. |
| **R-04** | **Apps Script Execution Limits** | 6-minute execution limit, 30 simultaneous executions/user, 10s `LockService` timeout, non-atomic cross-tab writes. | Mitigated via `GET_SNAPSHOT` batching and <=30 req/min pacing. |
| **R-05** | **A-04 Durable Auth Revocation & Distributed Rate Limiting** | `SESSION_MAX_AGE_SECONDS = 1800` (30m), but `sessionRegistry` and `rateLimitRegistry` in `src/lib/auth-store.ts` are process-local `Map`s that reset on restart/multi-instance switch. | **Does NOT block** isolated single-instance testing; **BLOCKS multi-instance production** until durable KV/Redis store is approved. |
| **R-06** | **Production Migration Requirements** | Production requires Service Account + Sheets API v4 REST (replacing `ANYONE_ANONYMOUS`), durable auth revocation (A-04), and independent Gate 5 audit sign-off. | **PRODUCTION NOT APPROVED.** |
