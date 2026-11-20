# TASK 5H.7 — A-03 LEGACY ROUTE & MEDIA REMEDIATION
**Original Risk (HIGH):** Residual CSV/bulk upload routes, legacy `chatmantra-webhook` alias, and `recordingUrl`/`transcript` persistence in `omnidim-webhook`.

## Route & Component Remediation Status
| File | Action Taken |
|------|--------------|
| `src/app/api/contacts/upload/route.ts` | Disabled safely with HTTP `410 CSV_UPLOAD_DISABLED` (requires `ADMIN`). |
| `src/app/api/leads/upload/route.ts` | Disabled safely with HTTP `410 BULK_LEAD_UPLOAD_DISABLED` (requires `ADMIN`). |
| `src/components/FileUpload.tsx` | Removed `<input type="file" accept=".csv">` and upload submission; replaced with Zero-Document-Storage notice. |
| `src/app/api/chatmantra-webhook/route.ts` | Disabled legacy typo alias with HTTP `410 LEGACY_ALIAS_DISABLED`. |
| `src/app/api/omnidim-webhook/route.ts` | Stripped `recordingUrl` and `transcript` persistence while preserving call status & opt-out suppression. |
| `src/lib/db.ts` | Retained untouched as inert Task 5F/5F.2 security baseline. |
| `src/app/api/cron/*`, `broadcasts/*`, `callkaro-webhook`, `vapi-webhook` | Retained per Task 5H.7 rule against indiscriminate disabling; flagged for future cleanup/migration if activated. |
