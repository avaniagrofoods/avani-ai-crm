# TASK 5H.10 — APPROVED TEST ARCHITECTURE
**Approval Reference:** Gate 1 Approved (19 November 2026) | **Execution Status:** Planning Only (Zero Resources Created)

---

## 1. Approved Isolated Test Architecture
- **Test Spreadsheet (Planned):** `AVANI_AI_CRM_ISOLATED_TEST` — private ("Restricted") sharing, 20M-cell workbook limit (`https://support.google.com/drive/answer/37603`), 9 canonical tabs matching `SHEET_COLUMNS` in `src/lib/google-sheets/sheet-schema.ts` (`CUSTOMERS` 8, `LEADS` 10, `APPLICATIONS` 10, `FOLLOWUPS` 10, `CONSENTS` 8, `MESSAGE_EVENTS` 8, `WEBHOOK_EVENTS` 8, `ADVISORS` 6, `SYSTEM_CONFIG` 3).
- **Test Gateway (Planned):** Container-bound Google Apps Script `AVANI_AI_CRM_TEST_GATEWAY` using `SpreadsheetApp`, `USER_DEPLOYING` ("Execute as: Me"), `ANYONE_ANONYMOUS` ("Anyone"), `LockService.waitLock(10000)`, `CacheService` nonce tracking (600s TTL), `ALLOWED_SPREADSHEET_ID`, 64 KB cap, and constant-time HMAC-SHA256 over `${timestampMs}.${requestId}.${payloadJson}`.
- **Local Test Client (Planned):** Single-instance local Next.js CRM configured with `GOOGLE_SHEETS_TRANSPORT_MODE=APPS_SCRIPT_GATEWAY`, `SAFE_MODE_FORCE_SUPPRESS=true`, synthetic `TEST_*` / `TEST_EVENT_*` records only, zero MongoDB fallback, and zero outbound WhatsApp/voice calls.

## 2. Documented Architecture Limitations
- `SpreadsheetApp` quotas apply (6 min/exec, 30 simultaneous executions/user, 50,000 `PropertiesService` calls/day on consumer `@gmail.com`).
- Multi-tab writes are non-atomic across worksheets; retries converge idempotently.
- `CacheService` replay protection is best-effort (1,000-item cap, evicts 900 oldest if exceeded).
- `ANYONE_ANONYMOUS` is approved for isolated testing only and must be replaced with Service Account + Sheets API v4 REST before production.
