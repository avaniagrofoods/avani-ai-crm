# TASK 5H.7 — A-06 CONCURRENCY & QUOTA IMPLEMENTATION
**Original Risk (MEDIUM):** `listHydratedLeads()` issued 6 separate `GET_ALL` calls; sequential multi-tab writes had no transaction atomicity.

## Changes Made
1. `src/lib/google-sheets/google-sheets-client.ts`: Added `getSnapshot(tabs: SheetTabName[])` calling `GET_SNAPSHOT` in a single HTTP request (and 1 batched read in `MOCK_IN_MEMORY`).
2. `src/lib/google-sheets/index.ts`: Updated `CrmSheetsService.listHydratedLeads()` to use `defaultSheetsClient.getSnapshot(['LEADS', 'CUSTOMERS', 'CONSENTS', 'APPLICATIONS', 'FOLLOWUPS', 'ADVISORS'])`.
3. `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`: Added `GET_SNAPSHOT` handler returning validated tab headers + rows in 1 invocation, plus `LockService.getScriptLock().waitLock(10000)` on all writes.

## Remaining Limitations
- Multi-tab writes (`CUSTOMERS` -> `CONSENTS` -> `LEADS` -> `FOLLOWUPS`) remain non-atomic across tabs (Google Sheets does not support cross-tab ACID transactions); idempotent retries converge cleanly without duplicate customers or leads.
