# TASK 5H.6 — OWNER DECISION REGISTER
**Date:** 18 November 2026

| Decision ID | Topic | Options | Recommended Default |
|-------------|-------|---------|---------------------|
| **OD-01** | **A-02 `APPLICATIONS` `sanctioned_amount` Column** | (A) Keep `sheet-schema.ts` exact 10 cols (no `sanctioned_amount`), OR (B) Add `sanctioned_amount` as col 11 in `sheet-schema.ts` + Apps Script. | **(A)** Keep `sheet-schema.ts` exact 10 cols for 5H.7 stability. |
| **OD-02** | **A-03 Legacy Bulk CSV Upload (`contacts/upload`, `leads/upload`, `FileUpload.tsx`)** | (A) Disable all CSV/file upload routes with HTTP `410`, OR (B) Migrate CSV lead import to `CrmSheetsService` without file persistence. | **(A)** Disable with HTTP `410` to enforce strict zero-upload policy. |
| **OD-03** | **A-03 Legacy Voice Webhooks (`callkaro-webhook`, `omnidim-webhook`, `vapi-webhook`)** | (A) Strip `recordingUrl`/`transcript` and migrate call status to `MESSAGE_EVENTS`, OR (B) Disable unused voice webhooks with `410`. | **(A)** for active OmniDim/CallKaro (`recordingUrl` stripped), **(B)** for unused aliases (`chatmantra-webhook`). |
| **OD-04** | **A-04 Session Expiry & Durable Revocation** | (A) Shorten `SESSION_MAX_AGE_SECONDS` to 30 min (`1800s`) with ₹0 in-memory revocation, OR (B) Approve a future free-tier external KV store (e.g., Upstash Redis). | **(A)** for Task 5H.7 (₹0, zero new dependencies). |
