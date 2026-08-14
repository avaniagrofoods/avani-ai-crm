# AVANI AI CRM — WEBHOOK EVENT CLASSIFICATION REPORT

```text
============================================================
AVANI LOAN SERVICES — WEBHOOK EVENT CLASSIFICATION AUDIT
============================================================
DATE & TIMESTAMP            : 2026-08-14 20:29:45 IST
PRIMARY CRM SOURCE OF TRUTH : AVANI AI CRM (3-AVANI AI CRM)
PRODUCTION DEPLOYMENT URL   : https://avani-ai-crm.vercel.app
GITHUB REPOSITORY           : https://github.com/avaniagrofoods/avani-ai-crm.git
ACTIVE BRANCH               : release/stage1-hardening

TOTAL WEBHOOKINBOX RECORDS  : 199 Events Audited
PROVIDER GATEWAY            : AiSensy WABA Gateway / Meta Graph Cloud API
SECURITY / SECRET MASKING   : ENFORCED ([REDACTED])

FINAL AUDIT STATUS          : CLASSIFIED_AND_RECONCILED
============================================================
```

## 1. Webhook Event Classification Breakdown

All 199 persisted `WebhookInbox` records in production MongoDB were retrieved and classified into the 10 standard event categories:

| Event Category | Total Count | Percentage | Event Description & Pattern |
| :--- | :---: | :---: | :--- |
| **INBOUND_MESSAGE** | `28` | 14.07% | Customer inbound text messages (`META_INBOUND_*` / `type: text`) |
| **BUTTON_REPLY** | `6` | 3.02% | Customer interactive button replies (`type: button` / `interactive`) |
| **STATUS_SENT** | `61` | 30.65% | Provider status callback: Sent (`META_STATUS_*_SENT` / `status: sent`) |
| **STATUS_DELIVERED** | `48` | 24.12% | Provider status callback: Delivered (`META_STATUS_*_DELIVERED`) |
| **STATUS_READ** | `32` | 16.08% | Provider status callback: Read (`META_STATUS_*_READ`) |
| **STATUS_FAILED** | `24` | 12.06% | Provider status callback: Failed (`META_STATUS_*_FAILED`) |
| **DUPLICATE** | `0` | 0.00% | Swallowed duplicate events (Handled at database index level) |
| **IGNORED** | `0` | 0.00% | Ignored non-WhatsApp event payloads |
| **MALFORMED** | `0` | 0.00% | Invalid JSON or missing required fields |
| **OTHER** | `0` | 0.00% | Uncategorized fallback events |
| **TOTAL** | **`199`** | **100.00%** | **Complete Production Webhook Inbox History** |

---

## 2. Outbound Message & WAMID Reconciliation Matrix

| Msg # | Internal Message ID | Target Phone | Provider | Provider ID / WAMID | Identifier Type | Persisted API Status | Reconciled Callback Status |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **1** | `MSG_CTRL_1786719156834_9175635165` | `+919175635165` | AiSensy_WABA | `8c10027e-3547-4b01-b900-f309550f859c` | **AISENSY_UUID** | API_ACCEPTED | WAITING_FOR_CALLBACK |
| **2** | `MSG_SINGLE_1786718355035_919970044345` | `+919970044345` | AiSensy_WABA | `3e73f528-75c5-47d8-94cf-26a33730b967` | **AISENSY_UUID** | API_ACCEPTED | WAITING_FOR_CALLBACK |
| **3** | `wa_out_1786466724298_294` | `+919175635165` | Meta_Cloud | `meta_err_1786466726698` | UNKNOWN_ID | Failed | Failed |
| **4** | `wa_out_1786465829706_5146` | `+919175635165` | Meta_Cloud | `meta_err_1786465831776` | UNKNOWN_ID | Failed | Failed |
| **5** | `20000142-1034-4f18-86a3-2da88d0b1acc` | `+919999999999` | AiSensy | `20000142-1034-4f18-86a3-2da88d0b1acc` | **AISENSY_UUID** | Delivered | Delivered |
| **6** | `73d0bcc6-8230-4290-88a6-48bc8512aab9` | `+919999999999` | AiSensy | `73d0bcc6-8230-4290-88a6-48bc8512aab9` | **AISENSY_UUID** | Delivered | Delivered |
| **7** | `4648ba38-e763-4c21-b42d-de123ddde96d` | `+919999999999` | AiSensy | `4648ba38-e763-4c21-b42d-de123ddde96d` | **AISENSY_UUID** | Delivered | Delivered |

---

## 3. Webhook Delivery Path Classification Rationale

- **Path Classification**: **`APPLICATION_WEBHOOK_PROCESSING_PATH`**
- **Empirical Evidence**:
  - `199` Total `WebhookInbox` records persisted over HTTP POST.
  - Delivery callbacks (`STATUS_SENT`, `STATUS_DELIVERED`, `STATUS_READ`, `STATUS_FAILED`) are received and processed when transmitted by the AiSensy / Meta provider gateway.
  - Messages sent via AiSensy store the `submitted_message_id` (AiSensy UUID) as `providerMessageId`. Webhook status updates with `msgId = UUID` match and update MongoDB `Message` records monotonically.
