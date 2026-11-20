# TASK 5H.8 — A-06 CONCURRENCY & IDEMPOTENCY VERIFICATION
**Status:** VERIFIED (Offline & Source-Level; Cross-Tab Transactions Explicitly Not Claimed)

## 1. 8-Point Concurrency & Quota Verification
1. **Batched Snapshot Read:** `CrmSheetsService.listHydratedLeads()` calls `defaultSheetsClient.getSnapshot([...])` once (`readCount` delta = `1`, verified in `test_task5h7_remediations.test.cjs`), replacing 6 separate `GET_ALL` calls.
2. **Snapshot Field Preservation:** `getSnapshot()` validates each tab's headers and maps rows via `rowValuesToObject()`, preserving all fields.
3. **Duplicate Webhook Prevention:** `INSERT_IF_ABSENT` + deterministic `CM_INBOUND_<msgId>` / `META_INBOUND_<msgId>` blocks duplicate leads/events.
4. **Locking Strategy:** Process-local `sheetsWriteMutex` (`15000ms`) + global Apps Script `LockService.getScriptLock().waitLock(10000)` released in `finally`.
5. **Retry Safety:** `executeWithControlledBackoff()` retries only `isIdempotent: true` calls (`maxRetries = 2`, exponential backoff + jitter).
6. **Partial Multi-Tab Failures:** Sequential writes (`CUSTOMERS` -> `CONSENTS` -> `LEADS` -> `FOLLOWUPS`) are **not** cross-tab atomic; failure mid-sequence throws immediately without silent swallowing.
7. **Recovery Without Corruption:** Deterministic keys / mobile lookup allow safe retry convergence without duplicate customers or leads (verified in `A-06` test).
8. **Quota Handling:** `429` maps to `GOOGLE_SHEETS_QUOTA_EXCEEDED` cleanly.
