# AVANI AI CRM — CP-26.2 GATE 6: INTEGRATION & WEBHOOK TELEMETRY FORENSIC AUDIT

**Milestone:** CP-26.2 Final Data-Integrity & Revenue Acceptance  
**Target:** `avani_ai_crm_prod` (`messages`, `webhookinboxes`, `providerledgers`) + `src/app/page.tsx` + `src/app/api/*-webhook*`  
**Execution:** Read-only scripts `node scratch/run_gate3_and_gate6_readonly.cjs` & `node scratch/inspect_telemetry_details.cjs` (Exit Code 0)

---

## 1. Outbound & Inbound Message Telemetry (`avani_ai_crm_prod.messages`)

| Direction | Status | Provider | Count | Provider Message ID Pattern | Real Network Delivery? |
|---|---|---|---:|---|---|
| `OUTBOUND` | `API_ACCEPTED` | `ChatMitra` | **45** | `100% CM-MOCK-*` (`isMockId: true`) | **NO (0 real sent, 0 real delivered)** |
| `INBOUND` | `RECEIVED` | `WhatsApp` | **8** | Inbound customer messages | Persisted inbound webhooks |
| `OUTBOUND` | `FAILED` | Any | **0** | — | 0 |
| **Total `messages`** | | | **53** | | Matched by `45` rows in `providerledgers` |

- **Timestamp Window of `45` Mock Outbound Messages:**
  - Sampled records range from `createdAt: 2026-11-03T01:53:18.829Z` (`CM-MOCK-1793670798...`), with `earliestOutbound` timestamp `2026-11-06T05:48:42.183Z` and `latestOutbound` `2026-11-10T13:33:50.238Z` (`CM-MOCK-1794317630...`).
- **Telemetry Defect Confirmed:** `src/app/page.tsx` L130–132 counts all `OUTBOUND` documents regardless of `CM-MOCK-` prefix, displaying `45` under **"WhatsApp Sent / Failed: 45 / 0"** instead of separating **Mock / Simulated (`45`)** vs **Live Delivered (`0`)**.

---

## 2. Webhook Inbox Failure Breakdown (`avani_ai_crm_prod.webhookinboxes`)

Total `webhookinboxes` documents: **117** (`COMPLETED`: **93**, `FAILED`: **24**).

Forensic grouping of all **24 `FAILED`** records (`node scratch/run_gate3_and_gate6_readonly.cjs` + `node scratch/inspect_telemetry_details.cjs`):

| Failure Category | Source | Event Type | Count | Root Cause |
|---|---|---|---:|---|
| **Category A: Mongoose ObjectId Cast Failure** | `Meta` | `INBOUND_MESSAGE` | **6** | `Cast to ObjectId failed for value "META-..." (type string) at path "_id" for model "Message"` (e.g., `META-1793551269676-4k8ll9`, `META-1793552104273-s9tspk`, etc.) when legacy handler passed a string ID into an ObjectId query/field |
| **Category B: Duplicate Idempotency Key Collision** | `Meta` | `INBOUND_MESSAGE` | **18** | `E11000 duplicate key error collection: avani_ai_crm_prod.messages index: idempotencyKey_1 dup key` triggered on repeated Meta inbound retries instead of handling `11000` idempotently |
| **Total `FAILED` (`Sync Errors` on `/`)** | | | **24** | Historical Meta webhook ingestion errors surfaced indefinitely as live `"Sync Errors"` by `src/app/page.tsx` L138–140 |

---

## 3. Webhook Health & Remediation Recommendations

1. **Separate Mock vs Live Telemetry on `/` (`src/app/page.tsx`):** Filter `providerMessageId: { $not: /^CM-MOCK-/ }` (or `provider: { $ne: 'ChatMitra_Mock' }`) for live WhatsApp sent KPIs and display mock dispatches in a dedicated sandbox counter so operators never mistake mock sends for delivered customer messages.
2. **Partition Active vs Historical Sync Errors:** Filter active errors by unresolved status/recent window or triage & archive the 24 resolved historical `Meta` dead-letters cleanly in a dedicated maintenance run.
3. **Preserve Safe Production Mode:** Production correctly maintains **0 live outbound sends** outside mock/safe-testing gates (`PROVIDER_MODE` defaults to `'mock'`).
