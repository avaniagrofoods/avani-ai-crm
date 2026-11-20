# TASK 5H.5 — WRITE CONCURRENCY AND IDEMPOTENCY AUDIT
**Files Audited:** `google-sheets-client.ts`, `sheet-idempotency.ts`, `webhook-event-repository.ts`, `message-event-repository.ts`, `index.ts`, `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`.

---

## 1. Concurrency & Locking Assessment (10-Point Check)

| # | Audit Question | Verified Result |
|---|----------------|-----------------|
| 1 | Is the Node.js mutex process-local? | **YES.** `sheetsWriteMutex` (`SerializedWriteLock`) is an in-process Promise queue in Node.js memory. It serializes concurrent requests within one Node process, **not** across multiple serverless instances. |
| 2 | Does Apps Script use `LockService`? | **YES.** `LockService.getScriptLock()` + `lock.waitLock(10000)` serializes spreadsheet mutations across all callers globally. |
| 3 | Does lock acquisition have a timeout? | **YES.** `15000 ms` in `SerializedWriteLock.withLock()`; `10000 ms` in Apps Script `waitLock(10000)`. |
| 4 | Are locks released in all error paths? | **YES.** Both Node.js `withLock` (`finally { release(); }`) and Apps Script (`finally { if (lock.hasLock()) lock.releaseLock(); }`) release locks on exception. |
| 5 | Are duplicate webhook events rejected? | **YES (via `INSERT_IF_ABSENT`).** Deterministic IDs (`CM_INBOUND_<msgId>`, `META_INBOUND_<msgId>`) return `duplicate: true` without creating a second row. |
| 6 | Can concurrent requests create duplicate customers/leads? | **Low risk in single-process / `LockService` mode**, because `LockService` serializes Apps Script execution; however `upsertRow` reads-then-writes inside the lock. |
| 7 | Can a retry create duplicate rows? | **NO for `insertIfAbsent` (`WEBHOOK_EVENTS`)** and **NO for `upsertRow` with deterministic PK**, provided `executeWithControlledBackoff` only retries idempotent calls (`isIdempotent: true`). |
| 8 | Can partial failures create inconsistent CRM records? | **YES (MEDIUM FINDING A-06).** `CrmSheetsService.registerOrUpdateCustomerLead()` writes `CUSTOMERS` -> `CONSENTS` -> `LEADS` -> `FOLLOWUPS` sequentially without compensating rollback if a later tab write fails. |
| 9 | Can a write be safely retried? | **YES** for `UPSERT_ROW` and `INSERT_IF_ABSENT` when PK is deterministic; `createOrUpdateCustomerLead()` is idempotent on retry by mobile lookup. |
| 10 | Are batch operations used appropriately? | **PARTIAL (MEDIUM FINDING A-06).** `listHydratedLeads()` issues 6 separate `GET_ALL` calls instead of a single batched multi-tab read action (`GET_SNAPSHOT`). |
