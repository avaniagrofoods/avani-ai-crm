# TASK 5H.13 — REPORT 8
## Project 2 CRM Test Connection Configuration Report

- **Task:** 5H.13 — Section 8 Project 2 Configuration
- **Application Target:** AVANI AI CRM (`Project 2`)

---

### 1. Test Environment Variables Blueprint

To connect Project 2 to the newly deployed test gateway in isolated test mode:

```bash
# .env.local (Test Configuration — NEVER COMMITTED TO GIT)
GOOGLE_SHEETS_TRANSPORT_MODE=APPS_SCRIPT_GATEWAY
GOOGLE_SHEETS_GATEWAY_URL=[CONFIGURED_BY_OWNER_AFTER_DEPLOYMENT]
GOOGLE_SHEETS_GATEWAY_SECRET=[CONFIGURED_BY_OWNER_MATCHING_SCRIPT_PROPERTIES]
GOOGLE_SHEETS_FORCE_OFFLINE=false
GOOGLE_SHEETS_ENABLE_MOCK=false
```

---

### 2. Guardrails Against Production Pollution

1. **Zero MongoDB Fallback:**
   The CRM codebase in `src/lib/google-sheets/` has zero MongoDB fallback logic. All CRM operations (`customer-repository.ts`, `lead-repository.ts`, `application-repository.ts`) interface directly through `GoogleSheetsClient`.
2. **Strict Production Environment Isolation:**
   - Production environment variables (`.env.production`) remain untouched.
   - Vercel production deployment remains untouched.
   - No production webhooks (Meta, ChatMitra, Omnidim) are activated.
3. **Synthetic Data Policy:**
   - All tests use synthetic records prefixed with `TEST_` (`TEST_CUST_...`, `TEST_LEAD_...`).
   - Real borrower records are never transmitted.
