# TASK 5H.5 — WEBHOOK AND OPT-OUT REGRESSION REPORT
**Files Audited:** `src/app/api/chatmitra-webhook/route.ts`, `src/app/api/whatsapp-webhook/route.ts`, `src/app/api/whatsapp-webhook-worker/route.ts`, `src/lib/optout-engine.ts`.

---

## 1. Security & Regression Findings
- **HMAC & Meta Signature Verification:** Intact. `verifyChatMitraSignature(rawBody, ...)` executes against `rawBody` before JSON parsing/persistence in `chatmitra-webhook` and `whatsapp-webhook`. Missing/invalid signatures return HTTP `401`.
- **Duplicate-Event Protection:** `webhookEventRepository.registerWebhookEventIdempotent()` uses deterministic IDs (`CM_INBOUND_<msgId>`, `META_INBOUND_<msgId>`) and stores only SHA-256 `payload_hash` (zero raw payload).
- **Outage Fail-Closed Behavior:** `CrmSheetsService.assertHealthy()` returns HTTP `503 GOOGLE_SHEETS_UNAVAILABLE` when Sheets is unreachable.
- **Opt-Out Compliance (DPDP Act):** `OptOutEngine.isOptOutMessage()` preserves English (`STOP`, `UNSUBSCRIBE`), Marathi (`थांबवा`, `नको`), and Hindi (`रोकें`, `रोको`) detection; `processOptOut()` updates `CUSTOMERS`, `LEADS`, `CONSENTS`, and cancels pending `FOLLOWUPS`.
- **Media Handling:** `whatsapp-webhook-worker` ignores `document`, `image`, `audio`, `video`, and `sticker` messages without downloading or storing `mediaId`s, logging only `MEDIA_IGNORED` / `MEDIA_ATTACHMENT_IGNORED`. Ordinary text messages continue routing through `CrmSheetsService`.
- **Legacy Alias Note (Finding A-03):** `src/app/api/chatmantra-webhook/route.ts` remains unmigrated on MongoDB and should be disabled or pointed to `chatmitra-webhook`.
