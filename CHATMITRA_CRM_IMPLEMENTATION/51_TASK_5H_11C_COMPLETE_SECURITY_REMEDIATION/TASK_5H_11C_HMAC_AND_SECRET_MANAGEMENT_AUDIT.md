# TASK 5H.11C — HMAC AND SECRET MANAGEMENT AUDIT
- **Canonical Format:** `${timestampMs}.${requestId}.${payloadJson}` (UTF-8), verified byte-for-byte between `src/lib/google-sheets/google-auth.ts` and `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md` in `test_task5h11c_gateway_security.test.cjs`.
- **Hardcoded Secrets Check:** Zero hardcoded secrets in `src/lib/google-sheets/*` or Apps Script source.
- **Storage Rules:** Apps Script reads `GATEWAY_HMAC_SECRET` and `ALLOWED_SPREADSHEET_ID` exclusively from `PropertiesService.getScriptProperties()`; Next.js reads `GOOGLE_SHEETS_GATEWAY_SECRET` exclusively from server-side `process.env`.
- **Rotation Recommendation:** Rotate `GATEWAY_HMAC_SECRET` when redeploying cleanly under future Gate 3 approval.
