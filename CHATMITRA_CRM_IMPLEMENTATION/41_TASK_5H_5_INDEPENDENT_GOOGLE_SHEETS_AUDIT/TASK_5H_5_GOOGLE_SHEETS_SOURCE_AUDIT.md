# TASK 5H.5 — GOOGLE SHEETS SOURCE CODE AUDIT
**Scope:** `src/lib/google-sheets/` (15 modules), migrated routes, and all remaining MongoDB references across `src/`.

---

## 1. Verification of 15 Google Sheets Modules & Migrated Routes
- **Migrated & Verified Active Google Sheets Paths:**
  - `src/lib/google-sheets/*`: `sheet-schema.ts`, `sheet-error-handler.ts`, `sheet-validation.ts`, `sheet-idempotency.ts`, `google-auth.ts`, `google-sheets-client.ts`, `sheets-repository.ts`, `customer-repository.ts`, `lead-repository.ts`, `application-repository.ts`, `followup-repository.ts`, `consent-repository.ts`, `message-event-repository.ts`, `webhook-event-repository.ts`, `index.ts`.
  - Migrated routes: `/api/health`, `/api/advisors`, `/api/contacts`, `/api/leads`, `/api/leads/[id]`, `/api/leads/[id]/application`, `/api/leads/[id]/qualify`, `/api/opts`, `/api/public/enquiry`, `/api/schedule`, `/api/dashboard/metrics`, `/api/chatmitra-webhook`, `/api/whatsapp-webhook`, `/api/whatsapp-webhook-worker`, `/api/documents/secure-upload` (`410`), and `src/app/page.tsx`.
  - **Zero Automatic MongoDB Fallback:** Confirmed in `google-sheets-client.ts` and all 14 migrated routes; offline Sheets returns HTTP `503 GOOGLE_SHEETS_UNAVAILABLE`.
  - **Safe ID Generation & Isolation:** Deterministic IDs (`CM_INBOUND_<msgId>`, `META_INBOUND_<msgId>`, `FUP-<leadId>-D0`, `APP-<leadId>`) and timestamp+random `AVL-YYYYMMDD-XXXXXX` / `CUST-...` IDs prevent cross-customer overwrites.

## 2. CRITICAL FINDING A-02: Schema Mismatch (`sheet-schema.ts` vs Apps Script)
- `CUSTOMERS`: `sheet-schema.ts` defines **8 columns** (`customer_id, customer_name, mobile_number, city, enquiry_source, created_at, updated_at, record_status`); `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md` defines **9 columns** (adds `notes_summary`, reorders `record_status`).
- `APPLICATIONS`: `sheet-schema.ts` defines **10 columns** (`application_id, lead_id, customer_id, loan_category, requested_amount, application_status, lender_status, assigned_advisor_id, created_at, updated_at`); Apps Script defines **8 columns** (includes `sanctioned_amount`, omits `loan_category`, `assigned_advisor_id`, `created_at`).
- `CONSENTS`: `sheet-schema.ts` defines **8 columns** (includes `updated_at`); Apps Script defines **7 columns**.
- **Remediation:** Reconcile `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md` and `TASK_5H_4_GOOGLE_SHEETS_SCHEMA.xlsx` to match `SHEET_COLUMNS` in `src/lib/google-sheets/sheet-schema.ts` 1:1.

## 3. Complete Inventory of Remaining MongoDB References in `src/`
- **Legacy/Security-Preserved Baseline (Untouched intentionally):**
  - `src/lib/db.ts` (Task 5F/5F.2 isolation-hardened connection guard; no longer called by migrated CRM routes).
  - `src/models/*.ts` (18 Mongoose model definitions; `Call.ts`, `Document.ts`, `Message.ts`, `WebhookInbox.ts` had prohibited media/payload fields stripped).
- **HIGH FINDING A-03 — Unmigrated Legacy API Routes & Helpers Still Referencing MongoDB:**
  - `src/app/api/broadcasts/create/route.ts`, `src/app/api/broadcasts/send/route.ts`
  - `src/app/api/callkaro-webhook/route.ts`, `src/app/api/omnidim-webhook/route.ts`, `src/app/api/vapi-webhook/route.ts`, `src/app/api/chatmantra-webhook/route.ts`, `src/app/api/meta-webhook/route.ts`, `src/app/api/webhooks/route.ts`, `src/app/api/whatsapp-webhook/workflow-handler.ts`
  - `src/app/api/campaigns/schedule/route.ts`, `src/app/api/contacts/bulk-message/route.ts`, `src/app/api/contacts/direct-message/route.ts`, `src/app/api/contacts/upload/route.ts`, `src/app/api/leads/trigger/route.ts`, `src/app/api/leads/upload/route.ts`, `src/app/api/lenders/route.ts`, `src/app/api/whatsapp/templates/route.ts`
  - `src/app/api/cron/follow-ups/route.ts`, `src/app/api/cron/process-scheduled/route.ts`
  - `src/app/api/diagnostics/route.ts`, `src/app/api/forensic-test/route.ts`, `src/app/api/golden-test-state/route.ts`
  - Legacy libs: `src/lib/advisor-handoff.ts`, `aisensy.ts`, `chatbot-router.ts`, `controlled-rollout.ts`, `document-rules.ts`, `downstream-orchestrator.ts`, `followup-engine.ts`, `meta-lead-ads.ts`, `orchestrator/*`, `provider-router.ts`, `referral-cross-sell.ts`, `s2s-ecosystem.ts`, `stage1-release.ts`, `telemetry.ts`, `template-sync/aisensy.ts`.
  - **Remediation:** Disable or migrate `chatmantra-webhook`, `omnidim-webhook` (`recordingUrl`), `contacts/upload`, `leads/upload`, and `cron/*` before live testing.
