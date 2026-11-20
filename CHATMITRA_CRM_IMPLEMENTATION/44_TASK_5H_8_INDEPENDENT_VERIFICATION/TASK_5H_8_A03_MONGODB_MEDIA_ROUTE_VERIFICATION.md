# TASK 5H.8 — A-03 MONGODB & MEDIA ROUTE VERIFICATION
**Status:** VERIFIED (Core CRM & Disabled Upload Routes Clean; Residual Legacy Routes Classified)

## 1. Verified Remediations
- `src/app/api/contacts/upload/route.ts`: Returns HTTP `410 CSV_UPLOAD_DISABLED`.
- `src/app/api/leads/upload/route.ts`: Returns HTTP `410 BULK_LEAD_UPLOAD_DISABLED`.
- `src/app/api/chatmantra-webhook/route.ts`: Returns HTTP `410 LEGACY_ALIAS_DISABLED`.
- `src/components/FileUpload.tsx`: Zero `type="file"` inputs or upload submission handlers.
- `src/app/api/omnidim-webhook/route.ts`: Zero `recordingUrl` or `transcript` persistence.
- `src/lib/google-sheets/*`: Zero MongoDB imports or fallback paths.

## 2. Classification of Remaining References in `src/`
- **C. Authentication/Security Baseline:** `src/lib/db.ts` (inert; not imported by any Sheets CRM route).
- **D. Legacy Integrations (Flag/Secret Gated):** `callkaro-webhook`, `vapi-webhook`, `meta-webhook`, `webhooks`, `omnidim-webhook`, `whatsapp-webhook/workflow-handler`.
- **E. Background Crons (Admin/CRON_SECRET Gated):** `cron/follow-ups`, `cron/process-scheduled`.
- **F. Broadcast/Messaging (Disabled by `BULK_BROADCAST_ENABLED !== 'true'`):** `broadcasts/create`, `broadcasts/send`, `campaigns/schedule`, `contacts/bulk-message`, `contacts/direct-message`, `broadcasts/page.tsx`, `campaigns/page.tsx`, `contacts/page.tsx` (CSV UI).
- **H. Unused/Legacy Reference & Models:** `src/models/*.ts` (18 files), `lenders`, `whatsapp/templates`, `leads/trigger`, `diagnostics`, `forensic-test`, `golden-test-state`, legacy `src/lib/*`.
- **Note:** None of the active Google Sheets CRM routes (`/api/leads`, `/api/contacts`, `/api/schedule`, `/api/advisors`, `/api/opts`, `/api/public/enquiry`, `/api/dashboard/metrics`, `/api/chatmitra-webhook`, `/api/whatsapp-webhook`, `/api/whatsapp-webhook-worker`) write customer data to MongoDB.
