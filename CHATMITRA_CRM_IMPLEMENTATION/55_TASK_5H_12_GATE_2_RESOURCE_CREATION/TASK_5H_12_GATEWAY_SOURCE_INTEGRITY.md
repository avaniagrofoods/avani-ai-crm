# TASK 5H.12 — REPORT 6
## Apps Script Gateway Source Code Integrity Verification

- **Task:** 5H.12 — Section 6 Source Code Audit
- **Canonical Source Path:** `CHATMITRA_CRM_IMPLEMENTATION/40_TASK_5H_4_GOOGLE_SHEETS_IMPLEMENTATION/TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`
- **Target File inside Script:** `Code.gs` / `gateway.gs`
- **Integrity Status:** **VERIFIED READY FOR INSERTION (100% OFFLINE PASS)**

---

### 1. Source Code Verification Baseline

The approved JavaScript source in `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md` was inspected and verified against all Task 5H.11C security remediations:

1. **HMAC-SHA256 Signature Verification:**
   - Computes expected signature using `Utilities.computeHmacSha256Signature(timestamp + "." + body, secret)`.
   - Validates in constant-time via `compareSignatures_()`.
2. **Replay Attack Defense:**
   - Evaluates `Math.abs(Date.now() - timestampMs) <= 300000` (5 minutes). Rejects expired or future-dated calls.
3. **Fail-Closed Spreadsheet Allowlisting:**
   - Reads `ALLOWED_SPREADSHEET_ID` from `PropertiesService.getScriptProperties()`.
   - Enforces `SpreadsheetApp.getActiveSpreadsheet().getId() === allowedId`.
   - Strictly ignores and rejects any caller-supplied spreadsheet ID in request payloads.
4. **Formula Sanitization:**
   - Enforces `sanitizeFormula_()` escaping on all inbound string data (`=`, `+`, `-`, `@`, `\t`, `\r` prepended with `'`).
5. **Request Concurrency & Quota Protection:**
   - Wraps spreadsheet mutations in `LockService.getScriptLock().waitLock(30000)`.
   - Enforces 1 MB payload ceiling and 500 max rows per batch.

---

### 2. Automated Sandbox Verification

The source code was executed in an offline Node.js VM sandbox harness (`tests/test_task5h11c_gateway_security.test.cjs`):
- **Test Scenarios Executed:** 6 core security scenarios (valid HMAC, invalid HMAC, replay expiration, wrong spreadsheet ID, formula sanitization, payload limits).
- **Result:** **6/6 passed (0 failures)**.
- **Ready for Draft Insertion:** The code is 100% verified to be pasted directly into `AVANI_AI_CRM_TEST_GATEWAY` as an undeployed draft once Gate 2 authentication is established.
