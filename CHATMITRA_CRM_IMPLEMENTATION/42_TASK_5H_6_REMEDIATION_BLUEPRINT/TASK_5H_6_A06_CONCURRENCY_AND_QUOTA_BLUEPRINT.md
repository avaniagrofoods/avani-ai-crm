# TASK 5H.6 — A-06 REMEDIATION BLUEPRINT: CONCURRENCY, PARTIAL FAILURE & QUOTA EFFICIENCY
**Severity:** MEDIUM | **Files Audited:** `google-sheets-client.ts`, `sheet-idempotency.ts`, `index.ts`, `sheet-error-handler.ts`

---

## 1. Concurrency & Partial-Failure Reality Check
- **Process-Local Mutex (`sheetsWriteMutex`):** Serializes concurrent writes within a single Node.js process (`15000 ms` timeout), **not** across multiple Vercel/serverless instances. Global mutual exclusion across instances is enforced exclusively by Apps Script `LockService.getScriptLock().waitLock(10000)`.
- **Multi-Tab Partial Writes (No Atomic Cross-Tab Transactions):** `CrmSheetsService.registerOrUpdateCustomerLead()` executes sequential writes to `CUSTOMERS` -> `CONSENTS` -> `LEADS` -> `FOLLOWUPS`. Google Sheets does **not** support multi-tab ACID rollback.
- **Recovery Strategy:**
  1. Write in deterministic dependency order (`CUSTOMERS` first, then `CONSENTS`, `LEADS`, `FOLLOWUPS`).
  2. All 4 operations use deterministic keys or mobile lookup (`upsertCustomer`, `upsertConsent`, `upsertLead`, `FUP-<leadId>-D0`), so retrying the request after a partial failure converges to a consistent state without creating duplicate rows.
  3. Log partial-write correlation IDs without customer PII so failed steps can be retried cleanly.

## 2. Batched `GET_SNAPSHOT` Design & Quota Management
- **Current Bottleneck:** `CrmSheetsService.listHydratedLeads()` issues 6 separate `GET_ALL` requests (`LEADS`, `CUSTOMERS`, `CONSENTS`, `APPLICATIONS`, `FOLLOWUPS`, `ADVISORS`).
- **Remediated Design:** Add `getSnapshot(tabs[])` in `GoogleSheetsClient` calling Apps Script `GET_SNAPSHOT` in **1 HTTP request** (6x reduction in gateway calls and Apps Script executions), while keeping `executeWithControlledBackoff()` capped at `maxRetries = 2` (3 attempts max, exponential backoff + jitter on `429`/`503` only, 10s `AbortController` timeout).
