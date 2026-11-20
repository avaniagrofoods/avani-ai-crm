# 02 — CHATMITRA & META WHATSAPP IMPLEMENTATION REPORT
## FULL-STACK ARCHITECTURE, WEBHOOK HANDLERS & CRM WORKER PIPELINE

**Document Version:** 1.0.0  
**Date:** 2026-11-19T21:20:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Lead Technical Architect & Senior Systems Integration Engineer  

---

### 1. PROVIDER INTEGRATION TOPOLOGY

The integration architecture implements an asynchronous, decoupled pipeline ensuring zero message loss and complete deduplication:

```
[Inbound Webhook HTTP POST]
   │── ChatMitra (x-webhook-signature / x-signature)
   └── Meta Cloud API (x-hub-signature-256)
             │
             ▼
[Webhook Handler: src/app/api/whatsapp-webhook/route.ts]
   │── 1. Cryptographic HMAC-SHA256 Timing-Safe Verification
   │── 2. Payload Parsing & Format Normalization
   │── 3. Google Sheets Health Check Guard (CrmSheetsService.assertHealthy())
   │── 4. Atomic Idempotency Registration (WEBHOOK_EVENTS)
   │── 5. Duplicate Check -> HTTP 200 { duplicate: true } (Swallowed)
   └── 6. Dispatches to Internal Worker via Vercel waitUntil
             │
             ▼
[Worker Processor: src/app/api/whatsapp-webhook-worker/route.ts]
   │── 1. Worker Secret Authentication (x-worker-auth)
   │── 2. Lease Acquisition & Processing State Transition
   │── 3. Zero-Document Guard: Media attachments rejected safely
   │── 4. Natural Language Loan Classification (classifyLoanCategory)
   │── 5. Customer & Lead Resolution in Google Sheets (CUSTOMERS & LEADS)
   │── 6. Inbound Message Persistence in MESSAGE_EVENTS
   │── 7. DPDP Act Opt-Out Keyword Inspection (English, Hindi, Marathi)
   └── 8. State Monotonicity & Processing Completion
```

---

### 2. PRIORITY 1 — CHATMITRA IMPLEMENTATION SPECIFICATION

1. **Inbound Webhook Verification (`src/lib/chatmitra.ts`):**
   - Validates `x-webhook-signature`, `x-signature`, or `x-hub-signature-256`.
   - Uses `crypto.timingSafeEqual` with secret from `CHATMITRA_WEBHOOK_SECRET` or `CHATMANTRA_WEBHOOK_SECRET`.
   - Raw request body preserved verbatim to guarantee cryptographic signature parity.
2. **Inbound Event Normalization:**
   - Supports `message.received`, `message.sent`, `message.status.updated`, `message.delivered`, `message.read`, `message.failed`.
   - Validates phone format via `formatChatMitraPhone` and `normalizeIndianPhone`.
3. **Outbound Messaging Engine (`sendChatMitraMessage`):**
   - Target URL: `https://backend.chatmitra.com/developer/api/send_message`.
   - Headers: `Authorization: Bearer <API_KEY>`, `Idempotency-Key: <IDEMPOTENCY_KEY>`.
   - Supports both `raw` text messages and official approved `template` messages with parameters.
   - Live safety clamp: Restricts live messages strictly to authorized test recipients during testing.
4. **Status Callbacks & Idempotency:**
   - Event IDs structured as `CM_STATUS_<MSG_ID>_<STATUS>`.
   - Webhook inbox registers SHA256 payload hash to defeat duplicate network retries.

---

### 3. PRIORITY 2 — META WHATSAPP CLOUD API SPECIFICATION

1. **Webhook Subscription Handshake (`GET /api/whatsapp-webhook`):**
   - Responds to `hub.mode = 'subscribe'`.
   - Validates `hub.verify_token` against `META_WEBHOOK_VERIFY_TOKEN` or `OMNIDIM_VERIFY_TOKEN`.
   - Returns `hub.challenge` string with HTTP 200. Rejects invalid tokens with HTTP 403 Forbidden.
2. **Signature Verification (`x-hub-signature-256`):**
   - Computes HMAC-SHA256 over raw body using `META_APP_SECRET`.
   - Strips `sha256=` prefix and validates using constant-time buffer comparison.
3. **Payload Parsing & Multi-Entry Batching:**
   - Iterates over `entry[].changes[].value` arrays.
   - Dispatches status callbacks and inbound messages independently.
4. **Monotonic Status Progression:**
   - Transitions follow strict hierarchy: `sent` (1) $\rightarrow$ `delivered` (2) $\rightarrow$ `read` (3).
   - Late callbacks cannot overwrite advanced states (enforced by `canTransitionStatus`).

---

### 4. PRIORITY 3 — UNIFIED CRM INTEGRATION

| CRM Tab | ChatMitra Field Mapping | Meta WhatsApp Field Mapping | Unified Rule |
|---|---|---|---|
| **`CUSTOMERS`** | `from` / `phoneNumber` normalized to E.164 | `entry[].value.messages[].from` normalized | Unique primary key `customer_id` derived from mobile hash. |
| **`LEADS`** | Classified via `classifyLoanCategory` | Classified via `classifyLoanCategory` | 1 of 9 canonical loan categories assigned. |
| **`MESSAGE_EVENTS`** | `provider = 'ChatMitra'` | `provider = 'Meta'` | Standardized direction, message ID, and delivery status. |
| **`WEBHOOK_EVENTS`** | `event_id = 'CM_INBOUND_...'` | `event_id = 'META_INBOUND_...'` | Full raw body SHA256 hash stored for auditability. |
| **`CONSENTS`** | `channel = 'WHATSAPP'` | `channel = 'WHATSAPP'` | Opt-outs synchronized across all outbound channels. |
| **`ADVISORS`** | Assigned `ADV_SACHIN_01` | Assigned `ADV_SACHIN_01` | Assigned to Chief Loan Advisor. |
