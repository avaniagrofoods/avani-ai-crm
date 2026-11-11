# AVANI AI CRM — CP-26.3 Webhook Dead-Letter Audit & Worker Remediation

**Audit Mode:** Strictly Read-Only against `avani_ai_crm_prod` (Zero production dead-letters replayed, modified, or deleted)  
**Source Evidence:** `WebhookInbox` + `Message` collections in `avani_ai_crm_prod`  

---

## 1. Summary Breakdown (24 Historical `FAILED` Dead-Letters)

Out of **117** total `WebhookInbox` events in `avani_ai_crm_prod`:
- **93** `COMPLETED` (`71` Meta `STATUS_UPDATE`, `22` Meta `INBOUND_MESSAGE`)
- **24** `FAILED` (`24` Meta `INBOUND_MESSAGE`, `attemptCount: 1` each, timestamps `2026-11-01T16:41:09.866Z` through `2026-11-09T07:13:44.819Z`)

### Breakdown by Failure Class
| Failure Class | Count | Indices | Exact Audited Root Cause |
| :--- | :---: | :---: | :--- |
| `OBJECTID_CAST_ERROR` | **6** | 1–6 | Legacy Meta ID lookup attempted to match string `"META-..."` against Mongoose `_id` (`Cast to ObjectId failed for value "META-..." (type string) at path "_id" for model "Message"`). |
| `IDEMPOTENCY_DUPLICATE_KEY` | **18** | 7–24 | `E11000 duplicate key error collection: avani_ai_crm_prod.messages index: idempotencyKey_1 dup key` thrown when `Message.create` collided on `idempotencyKey` without pre-check or `11000` idempotent catch. |

### Breakdown by Payload Type & Safe Action Classification
| Payload Type | Count | Has Text? | Already in `messages` | Proposed CP-26.4 Handling (Pending Explicit Owner Sign-Off) |
| :--- | :---: | :---: | :---: | :--- |
| `unsupported` | **17** | No (`hasUnsupportedErrors: true`) | 0 | **Ignore / Archive Safely** (`ARCHIVED_UNSUPPORTED`) — Meta unsupported message types (e.g., polls/reactions/system notices with no actionable loan enquiry text). Do not replay to AI auto-reply. |
| `text` | **6** | Yes (Indices 9, 10, 13, 20, 22, 24) | 0 | **Safe Inbound Log Replay Candidates (Text Only)** — Persist inbound message text into CRM Inbox history ONLY (`PROVIDER_MODE=mock`, zero outbound WhatsApp reply trigger). |
| `image` | **1** | No (Index 23) | 0 | **Manual Inspection / Safe Media Stub** — Record media placeholder in CRM Inbox without triggering outbound WhatsApp. |

---

## 2. Permanent Worker Defect Fixes Applied (CP-26.3 Code)

Fixed in `src/app/api/whatsapp-webhook-worker/route.ts` and `src/app/api/meta-webhook/route.ts`:
1. **`ObjectId` Cast Guard:** Before querying `Message` by `_id`, validate candidate IDs with `mongoose.Types.ObjectId.isValid(...)` so string Meta/ChatMitra IDs query `messageId` / `providerMessageId` / `idempotencyKey` safely without crashing BSON casting.
2. **Pre-Insert Idempotency Lookup:** Query `Message.findOne({ $or: [{ messageId: msgId }, { idempotencyKey: msgId }] })` before inserting.
3. **`E11000` Duplicate Key Handling:** Catch `err?.code === 11000` inside inbound message persistence as an idempotent success rather than failing into `WebhookInbox.status = 'FAILED'`.
4. **Raw Signature & Secret Isolation:** Meta webhook ingestion in `src/app/api/meta-webhook/route.ts` now enforces `X-Hub-Signature-256` HMAC-SHA256 verification before any event enters `WebhookInbox`.

---

## 3. Production Data Safety Statement

- **Zero live WhatsApp messages** were triggered.
- **Zero `WebhookInbox` documents** in `avani_ai_crm_prod` were mutated, replayed, or deleted during CP-26.3.
- Replay / archival of these 24 records remains gated behind explicit written owner approval and must run under `PROVIDER_MODE=mock` & `CHATMITRA_INBOUND_AUTO_REPLY_ENABLED=false`.
