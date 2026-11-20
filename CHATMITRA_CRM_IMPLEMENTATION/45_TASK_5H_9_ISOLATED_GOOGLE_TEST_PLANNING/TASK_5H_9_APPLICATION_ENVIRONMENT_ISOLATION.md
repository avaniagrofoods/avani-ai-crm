# TASK 5H.9 — APPLICATION ENVIRONMENT ISOLATION
**Mode Separation:** Local Mock (`MOCK_IN_MEMORY`) | Isolated Google Test (`APPS_SCRIPT_GATEWAY` + Test URL) | Production (Blocked)

---

## 1. Environment Variable Matrix (Names Only — Zero Secret Values Printed)

| Variable Name | Purpose | Required / Optional | Scope | Secret? | Validation / Fail-Closed Behavior |
|---------------|---------|---------------------|-------|---------|-----------------------------------|
| `GOOGLE_SHEETS_TRANSPORT_MODE` | Selects `MOCK_IN_MEMORY` vs `APPS_SCRIPT_GATEWAY` | Required | Test & Prod | Non-Secret | Defaults to `APPS_SCRIPT_GATEWAY` unless `NODE_ENV=test` or `GOOGLE_SHEETS_ENABLE_MOCK=true`. |
| `GOOGLE_SHEETS_GATEWAY_URL` | Apps Script Web App `/exec` URL | Required for live test | Separate per env | Non-Secret | Missing URL fails closed with `503 GOOGLE_SHEETS_UNAVAILABLE` (zero MongoDB fallback). |
| `GOOGLE_SHEETS_GATEWAY_SECRET` | HMAC-SHA256 signing key (`>=16` chars, rec `>=32`) | Required for live test | Separate per env | **Secret** | Missing or `<16` chars fails closed with `401 GOOGLE_SHEETS_AUTH_FAILED`. |
| `GOOGLE_SHEETS_ENABLE_MOCK` | Enables `MOCK_IN_MEMORY` outside `NODE_ENV=test` | Optional | Local Mock Only | Non-Secret | Must be unset/false in `GOOGLE_SHEETS_TEST` live test runs. |
| `GOOGLE_SHEETS_FORCE_OFFLINE` | Fault injection flag | Optional | Local Test Only | Non-Secret | Forces `503 GOOGLE_SHEETS_UNAVAILABLE`. |
| `SAFE_MODE_FORCE_SUPPRESS` | Suppresses all outbound WhatsApp/voice calls | Required in test | Test Only | Non-Secret | Must be `true` during isolated Google testing. |
| `SESSION_SECRET` | Signs CRM session cookies (`>=32` chars) | Required | Separate per env | **Secret** | Rejects all sessions if unconfigured. |
