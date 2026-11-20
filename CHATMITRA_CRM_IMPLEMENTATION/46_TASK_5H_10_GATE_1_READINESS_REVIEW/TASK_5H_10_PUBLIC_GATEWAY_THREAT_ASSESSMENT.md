# TASK 5H.10 — PUBLIC GATEWAY THREAT ASSESSMENT
**Target:** `AVANI_AI_CRM_TEST_GATEWAY` (`USER_DEPLOYING` + `ANYONE_ANONYMOUS` + HMAC)

| Threat | Mitigation in Place | Residual Risk / Limitation |
|--------|---------------------|----------------------------|
| **Public Endpoint Abuse / DoS** | Confidential `/exec` URL (server-side env var only) + 64 KB cap + fast `401` before `LockService`. | Anyone who discovers the `/exec` URL can still trigger `doPost(e)` and consume the 30-simultaneous-execution / 50,000 Properties/day quota. |
| **HMAC Secret Compromise** | Secret stored in `ScriptProperties` & server env only; constant-time XOR compare (`constantTimeEqualHex_`). | Secret rotation requires updating both `ScriptProperties` and `.env.test`. |
| **Replay & Cache Eviction** | 300s clock-skew check + `CacheService` 600s nonce tracking. | `CacheService` evicts 900 oldest items if >1,000 keys are stored within 10 minutes; replay protection is best-effort, **not** absolute. |
| **Lock Timeout & Concurrency** | `LockService.waitLock(10000)` + `finally { releaseLock(); }` + deterministic PKs. | Bursts exceeding 10s lock wait return `503`. |
| **Unauthorized Spreadsheet Access** | `ALLOWED_SPREADSHEET_ID` from `ScriptProperties` + `EXPECTED_TABS` + `isUnsafeFormulaCell_()`. | Private spreadsheet sharing ("Restricted") prevents direct Drive access. |

**Sufficiency Verdict:** Controls are **sufficient for an isolated test endpoint** using synthetic `TEST_*` data, provided the `/exec` URL remains confidential.
