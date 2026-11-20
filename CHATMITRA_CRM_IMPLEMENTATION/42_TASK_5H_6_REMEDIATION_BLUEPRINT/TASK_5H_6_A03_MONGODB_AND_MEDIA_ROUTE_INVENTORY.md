# TASK 5H.6 — A-03 REMEDIATION BLUEPRINT: RESIDUAL MONGODB, UPLOAD & RECORDING INVENTORY
**Severity:** HIGH | **Audit Method:** Full source inspection of all `src/app/api/`, `src/components/`, and `src/lib/` references.

---

## 1. Classification & Route-by-Route Action Plan

| File / Route | Classification | Evidence Verified | Recommended Action |
|--------------|----------------|-------------------|--------------------|
| `src/app/api/contacts/upload/route.ts` | 7. File/Document/Media + 1. Customer Data | `formData.get('file')` CSV upload writing to MongoDB `Contact`. | **Disable with HTTP 410** (`CSV_UPLOAD_DISABLED_USE_SHEETS`) or migrate to `CrmSheetsService` only if Owner explicitly wants CSV import. |
| `src/app/api/leads/upload/route.ts` | 7. File/Document/Media + 1. Customer Data | Bulk JSON upload writing to MongoDB `Lead` + triggering voice calls. | **Disable with HTTP 410** (`BULK_LEAD_UPLOAD_DISABLED`). |
| `src/components/FileUpload.tsx` | 7. File/Document/Media UI | `<input type="file" accept=".csv">` posting to `/api/leads/upload`. | **Disable/replace UI** with Zero-Upload notice (matching `gallery/page.tsx`). |
| `src/app/api/omnidim-webhook/route.ts` | 4. Webhook Integration + 7. Media | Line 146–147 sets `updateData.recordingUrl = body.recording_url` & `transcript`, writes to MongoDB `Call`/`Lead`. | **Strip `recordingUrl`/`transcript`** + migrate call outcome status to `CrmSheetsService` / `MESSAGE_EVENTS` (or disable `410` if OmniDim is retired). |
| `src/app/api/chatmantra-webhook/route.ts` | 4. Webhook Integration (Legacy Alias) | Legacy typo alias of `chatmitra-webhook` using `connectToDatabase()` + `WebhookInbox`. | **Disable with HTTP 410** (or delegate directly to `chatmitra-webhook` Google Sheets handler). |
| `src/app/api/callkaro-webhook/route.ts`, `vapi-webhook/route.ts`, `meta-webhook/route.ts`, `webhooks/route.ts` | 4. Webhook Integration | Legacy voice/webhook routes still calling `connectToDatabase()` / `Lead` / `Contact`. | **Disable with HTTP 410** if unused, or migrate to `webhookEventRepository` + `CrmSheetsService`. |
| `src/app/api/cron/follow-ups/route.ts`, `cron/process-scheduled/route.ts` | 5. Background Job / Cron | Drip follow-up & scheduled campaign crons querying MongoDB `Schedule`/`Lead`. | **Migrate `cron/follow-ups`** to `followupRepository`; **disable `cron/process-scheduled`** (`410`) while bulk broadcast is off. |
| `src/app/api/broadcasts/create/route.ts`, `broadcasts/send/route.ts`, `campaigns/schedule/route.ts`, `contacts/bulk-message/route.ts`, `contacts/direct-message/route.ts` | 1. Customer Data / Messaging | Legacy bulk/direct messaging routes gated by `BULK_BROADCAST_ENABLED` / `SAFE_MODE` but still importing MongoDB. | **Migrate `contacts/direct-message`** to `messageEventRepository`; **disable bulk routes (`410`)** or migrate to Sheets. |
| `src/app/api/lenders/route.ts`, `whatsapp/templates/route.ts`, `leads/trigger/route.ts` | 2. Legacy / Reference | Import MongoDB `Lender`, `Template`, `Lead`. | **Return static/Sheets config** or **disable (`410`)**. |
| `src/app/api/diagnostics/route.ts`, `forensic-test/route.ts`, `golden-test-state/route.ts` | 3. Auth/Security / Test Diagnostics | Legacy DB diagnostics & test-state endpoints. | **Disable (`410`)** or restrict to `ADMIN` + report Google Sheets health only. |
| `src/lib/db.ts` | 3. Security Baseline | Task 5F/5F.2 isolation-hardened MongoDB guard. | **Retain untouched** as inert security baseline (not imported by any active CRM route). |
| `src/models/*.ts` (18 models) | 2. Legacy Schema | Mongoose model definitions. | **Retain inert** until Owner approves full Mongoose package removal. |
