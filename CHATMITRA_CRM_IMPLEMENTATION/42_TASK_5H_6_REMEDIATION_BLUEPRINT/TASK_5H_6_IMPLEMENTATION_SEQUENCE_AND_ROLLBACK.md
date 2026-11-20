# TASK 5H.6 — IMPLEMENTATION SEQUENCE & ROLLBACK PLAN
**Mode:** Blueprint Only (Zero Files Edited in Task 5H.6)

---

## 1. Dependency Graph & Safest Phase Order
- **A-02 (Schema Drift)** & **A-01 (Gateway Protocol)** block live Google connection testing and must be implemented first.
- **A-05 (Apps Script Hardening)** & **A-06 (`GET_SNAPSHOT` Batching)** extend the same `doPost(e)` + `google-sheets-client.ts` contract, so they pair cleanly right after A-01/A-02.
- **A-03 (Residual MongoDB/Upload Routes)** and **A-04 (Session TTL)** are independent of the Apps Script wire format and execute in Phases 3–4.

## 2. Phase-Wise Remediation Plan

| Phase | Findings | Exact Files Expected to Change | Required Tests |
|-------|----------|-------------------------------|----------------|
| **Phase 1** | **A-01 + A-02** | `src/lib/google-sheets/google-auth.ts`, `google-sheets-client.ts`, `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`, `TASK_5H_4_GOOGLE_SHEETS_SCHEMA.xlsx` | `T-5H6-02`, `T-5H6-03`, `tsc --noEmit` |
| **Phase 2** | **A-05 + A-06** | `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`, `src/lib/google-sheets/google-sheets-client.ts`, `src/lib/google-sheets/index.ts` | `T-5H6-06`, `T-5H6-07` |
| **Phase 3** | **A-03** | `src/app/api/contacts/upload/route.ts`, `leads/upload/route.ts`, `chatmantra-webhook/route.ts`, `omnidim-webhook/route.ts`, `cron/follow-ups/route.ts`, `cron/process-scheduled/route.ts`, `src/components/FileUpload.tsx` (plus legacy routes per Owner decision) | `T-5H6-04`, `T-5H6-08` |
| **Phase 4** | **A-04** | `src/lib/auth.ts`, `src/lib/auth-store.ts` | `T-5H6-05`, `T-5H6-01` (full suite) |

## 3. Rollback Approach
- Keep all existing `.bak.pre_task5h4` backups intact and create `.bak.pre_task5h7` backups before Phase 1–4 edits.
- Any phase can be reverted deterministically via `Copy-Item *.bak.pre_task5h7` without touching `src/lib/db.ts` or Git history.
