# TASK 5H.9 — OWNER APPROVAL GATES
**Governance Rule:** No gate automatically authorizes the next gate.

| Gate | Title | Scope & Authorization Required |
|------|-------|--------------------------------|
| **Gate 1** | **Planning Approval** | Owner reviews Task 5H.9 architecture, test account choice, and `AVANI_AI_CRM_ISOLATED_TEST` naming. Zero resources created. |
| **Gate 2** | **Test Resource Creation Approval** | Explicit Owner authorization to create `AVANI_AI_CRM_ISOLATED_TEST` (9 tabs, synthetic headers only, private sharing). |
| **Gate 3** | **Apps Script Deployment Approval** | Separate explicit Owner authorization to deploy `AVANI_AI_CRM_TEST_GATEWAY` (`Execute as: Me`, `Who has access: Anyone`) with test-only `GATEWAY_HMAC_SECRET` & `ALLOWED_SPREADSHEET_ID`. |
| **Gate 4** | **Application Test Connection Approval** | Separate explicit Owner authorization to configure local `GOOGLE_SHEETS_TEST` env vars (`SAFE_MODE_FORCE_SUPPRESS=true`) and run `IT-A01`–`IT-E06` with `TEST_*` synthetic data only. |
| **Gate 5** | **Independent Live Test Audit** | Separate read-only verification of data isolation, security, error handling, and test-data cleanup before any production planning. |
