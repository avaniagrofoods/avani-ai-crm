# TASK 5H.4 — GOOGLE SHEETS SECURITY REVIEW
**Scope:** Application Security, Spreadsheet Injection, Secret Hygiene, & DPDP Act Compliance

---

## 1. Security Controls Implemented & Verified

1. **Spreadsheet Formula Injection Protection (`sheet-validation.ts`):**
   - `sanitizeCellForSheets()` rejects cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r`, as well as dangerous spreadsheet functions (`IMPORTXML`, `IMPORTHTML`, `IMPORTRANGE`, `IMPORTFEED`, `IMPORTDATA`, `QUERY`, `WEBSERVICE`, `cmd|`) with HTTP `400 GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED`.
   - Valid E.164 Indian mobile numbers (`+91[6-9]\d{9}`) are permitted exclusively on explicitly flagged phone columns.
2. **KYC PII Pattern Redaction (`redactSensitiveKycPatterns()`):**
   - Automatically redacts 12-digit Indian Aadhaar patterns (`[REDACTED_AADHAAR]`) and 10-character PAN patterns (`[REDACTED_PAN]`) if accidentally entered into free-text fields (`short_notes`, `notes_summary`).
3. **Zero-Secret Persistence (`ADVISORS`, `SYSTEM_CONFIG`, `auth-store.ts`):**
   - Passwords, password hashes, JWT secrets, and session tokens are never stored in Google Sheets.
   - `SystemConfigRepository` rejects keys matching `/secret|password|token|private_key|api_key|credential|uri/i`.
   - `src/lib/auth-store.ts` maintains session revocation and login rate-limiting in server memory without touching MongoDB or Google Sheets.
4. **Gateway Authentication & Replay Protection (`google-auth.ts`):**
   - `signAppsScriptGatewayRequest()` signs requests with HMAC-SHA256 over `timestamp.nonce.body`, paired with a 300-second replay window and nonce tracking (`verifyAndRecordRequestNonce()`).
5. **Fail-Closed Availability & Zero MongoDB Fallback:**
   - Offline Sheets -> HTTP `503 GOOGLE_SHEETS_UNAVAILABLE`
   - Quota Exceeded -> HTTP `429 GOOGLE_SHEETS_QUOTA_EXCEEDED`
   - Schema Drift -> HTTP `500 GOOGLE_SHEETS_SCHEMA_INVALID`
   - Document Upload -> HTTP `410 DOCUMENT_UPLOAD_DISABLED`
6. **DPDP Act Opt-Out Enforcement (`optout-engine.ts`):**
   - English (`STOP`, `UNSUBSCRIBE`, etc.), Marathi (`थांबवा`, `नको`), and Hindi (`रोकें`, `रोको`) opt-outs propagate across `CUSTOMERS`, `LEADS`, `CONSENTS`, and cancel pending `FOLLOWUPS`.
