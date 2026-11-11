# AVANI AI CRM — CP-26.3 WhatsApp Telemetry Reconciliation Report

**Purpose:** Separate sandbox/mock outbound message records from verified live WhatsApp provider deliveries so dashboard counters never conflate synthetic test runs with real customer deliveries.

---

## 1. Audited Production Telemetry Baseline (`avani_ai_crm_prod`)

Prior to CP-26.3, `src/app/page.tsx` summed raw `Message.countDocuments({ status: ... })` without filtering `providerResponse.mock === true` or `CM-MOCK-` identifiers, causing **45** mock sandbox API-accepted outbound messages to inflate live outbound KPIs.

Exact read-only breakdown from `avani_ai_crm_prod`:
- **`messages` (53 total):**
  - `OUTBOUND | API_ACCEPTED | ChatMitra | mock=true`: **45**
  - `INBOUND | RECEIVED | WhatsApp | mock=false`: **8**
  - Real `providerAccepted` (`mock !== true`): **0**
  - Real `delivered` (`mock !== true`): **0**
  - Real `failed` (`mock !== true`): **0**
  - Real `pendingDeliveryConfirmations` (`mock !== true`): **0**
- **`messagestatusledgers` (45 total):**
  - `CHATMITRA | N/A | mock=true`: **45**
- **`webhookinboxes` (117 total):**
  - `COMPLETED`: **93** (`Meta | STATUS_UPDATE`: **71**, `Meta | INBOUND_MESSAGE`: **22**)
  - `FAILED`: **24** (`Meta | INBOUND_MESSAGE`: **24**)

---

## 2. Canonical Separation Implemented (`src/lib/telemetry.ts`)

`computeWhatsappTelemetry()` defines `MOCK_MESSAGE_CRITERIA`:
- `providerResponse.mock: true`
- `provider: /mock/i`
- `messageId: /^CM-MOCK-/i`
- `providerMessageId: /^CM-MOCK-/i`
- `idempotencyKey: /mock/i`

And computes **8 exact metrics** (`WhatsappTelemetrySummary`) consumed by both `GET /api/dashboard/metrics` and SSR `src/app/page.tsx`:

1. `mockAttempts`: Outbound messages matching `MOCK_MESSAGE_CRITERIA` (**45** in prod).
2. `providerAccepted`: Outbound messages in accepted/sent/delivered/read states excluding `MOCK_MESSAGE_CRITERIA` (**0** in prod).
3. `delivered`: Outbound messages in `DELIVERED`/`Delivered`/`READ`/`Read` excluding `MOCK_MESSAGE_CRITERIA` (**0** in prod).
4. `failed`: Outbound messages in failure states (`FAILED`, `API_FAILED`, `PROVIDER_FAILED`, `BALANCE_BLOCKED`, `INVALID_DESTINATION`, `TEMPLATE_REJECTED`, `WEBHOOK_TIMEOUT`) excluding `MOCK_MESSAGE_CRITERIA` (**0** in prod).
5. `inboundReceived`: Inbound messages across live WhatsApp channels (**8** in prod).
6. `webhookProcessingErrors`: `WebhookInbox` events with `status: 'FAILED'` (**24** historical dead-letters in prod).
7. `duplicateWebhookEvents`: `WebhookInbox` events with `status: 'DUPLICATE'` or `attemptCount > 1`.
8. `pendingDeliveryConfirmations`: Outbound non-mock messages awaiting final delivery confirmation (**0** in prod).

---

## 3. UI Surfaces Updated

- **`src/app/page.tsx`:** Displays **WhatsApp Delivered / Failed** using real non-mock counters (`delivered / failed`), with trend line explicitly showing `Real accepted`, `Mock sandbox`, and `Pending`; displays **Inbound / Webhook Errors** using `inboundReceived / webhookProcessingErrors` and `Opt-outs | Duplicates`.
- **`src/app/crm/page.tsx`:** Renders the dedicated 8-card `data-testid="crm-whatsapp-telemetry"` panel separating `Mock Attempts` from `Real Accepted`, `Confirmed Delivered`, `Failed Deliveries`, `Inbound Received`, `Webhook Errors`, `Duplicate Events`, and `Pending Confirm`.
