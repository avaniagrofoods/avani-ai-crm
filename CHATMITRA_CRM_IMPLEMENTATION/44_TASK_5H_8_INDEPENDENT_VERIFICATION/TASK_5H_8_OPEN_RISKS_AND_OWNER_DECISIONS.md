# TASK 5H.8 — OPEN RISKS & OWNER DECISIONS
**Date:** 18 November 2026

1. **A-04 Durable Cross-Instance Revocation & Rate Limiting (Open for Production Scaling):**
   - Process-local `Map`s in `src/lib/auth-store.ts` reset on server restart and are not shared across serverless instances. Mitigated to 30m (`1800s`) token expiry for isolated testing; durable revocation requires a future free-tier KV store (e.g., Upstash Redis) if approved by Owner.
2. **A-01 / A-05 Live Apps Script Runtime Verification (Pending Isolated Test):**
   - `CacheService` best-effort nonce eviction and `doPost(e)` `LockService` behavior can only be verified against a real isolated `AVANI_LOAN_SERVICES_CRM_TEST` spreadsheet.
3. **A-03 Unused Legacy Routes:**
   - Legacy cron/broadcast/voice routes remain flag-gated/disabled; Owner may optionally retire them in a future cleanup task.
