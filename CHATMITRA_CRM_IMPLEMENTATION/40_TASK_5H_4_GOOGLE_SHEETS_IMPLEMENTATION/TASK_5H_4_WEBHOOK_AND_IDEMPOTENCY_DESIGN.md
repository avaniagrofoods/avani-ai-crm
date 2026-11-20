# TASK 5H.4 — WEBHOOK & IDEMPOTENCY DESIGN
**Routes:** `src/app/api/chatmitra-webhook/route.ts`, `src/app/api/whatsapp-webhook/route.ts`, `src/app/api/whatsapp-webhook-worker/route.ts`

---

## 1. Signature Verification & Fail-Closed Guards

- **ChatMitra (`chatmitra-webhook` & `whatsapp-webhook`):** Constant-time HMAC-SHA256 verification (`verifyChatMitraSignature`) against `rawBody` using `CHATMITRA_WEBHOOK_SECRET`. Missing secret or invalid/missing signature returns HTTP `401`.
- **Meta WABA (`whatsapp-webhook`):** `x-hub-signature-256` verified against `META_APP_SECRET` (or `CHATMITRA_WEBHOOK_SECRET`).
- **Internal Worker (`whatsapp-webhook-worker`):** Constant-time `x-worker-auth` verification against `INTERNAL_WORKER_SECRET`.
- **Fail-Closed Availability:** `CrmSheetsService.assertHealthy()` runs before event registration. If Google Sheets is unreachable (`forceUnavailable`), routes return HTTP `503 GOOGLE_SHEETS_UNAVAILABLE` so providers retry without message loss. Zero MongoDB fallback.

## 2. Deterministic Event IDs & Concurrency Control

- **Deterministic IDs:** `CM_INBOUND_<msgId>`, `CM_STATUS_<msgId>_<STATUS>`, `META_INBOUND_<msgId>`, `META_STATUS_<msgId>_<STATUS>`.
- **Zero Raw Payload Persistence:** `webhookEventRepository.registerWebhookEventIdempotent()` computes `computePayloadSha256(body)` and writes only `event_id`, `provider`, `event_type`, `processing_status`, `payload_hash`, and `received_at` to `WEBHOOK_EVENTS`.
- **Serialized Concurrency:** In-process `sheetsWriteMutex` serializes `insertIfAbsent` checks in Node.js, paired with `LockService.getScriptLock().waitLock(10000)` in the Google Apps Script Gateway. Duplicate requests return `{ success: true, duplicate: true, eventId }` with exactly 1 row stored.
