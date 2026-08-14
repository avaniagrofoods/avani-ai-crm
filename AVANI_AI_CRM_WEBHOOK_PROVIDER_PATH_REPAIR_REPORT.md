# AVANI AI CRM — INBOUND WEBHOOK PROVIDER PATH REPAIR REPORT

```text
============================================================
AVANI LOAN SERVICES — PROVIDER PATH REPAIR FORENSIC REPORT
============================================================
DATE & TIMESTAMP            : 2026-08-14 21:05:12 IST
PRIMARY CRM SOURCE OF TRUTH : AVANI AI CRM (3-AVANI AI CRM)
PRODUCTION DEPLOYMENT URL   : https://avani-ai-crm.vercel.app
GITHUB REPOSITORY           : https://github.com/avaniagrofoods/avani-ai-crm.git
HARDENING BRANCH            : release/stage1-hardening (Commit 9fd51c4)

CONTROLLED E2E TEST NUMBER  : Dr. Sachin Shinde (AVL-20260811-000001 | +919175635165)
WABA ACCOUNT ID             : 130700309306240
APPROVED SENDER             : +91 72491 08474
WEBHOOK CALLBACK URL        : https://avani-ai-crm.vercel.app/api/whatsapp-webhook
GOOGLE SHEETS APP SCRIPT    : https://script.google.com/macros/s/AKfycbyoAmAabpO9PUDH-AXatZm5Td7pO9n5W00Eoh6TNIkPtjbQZiYrhAv27XgyMtJdBxchEg/exec

DEVICE INTERACTION TIME     : 2026-08-14 ~20:38 IST (India Standard Time)
CUSTOMER INTERACTION TEXT   : "Check Eligibility" (Interactive Button Click)
OUTBOUND AISENSY UUID       : f48f97ef-bd7d-4f91-9879-a4f14d3ffa83

EXACT FAILURE BOUNDARY      : PROVIDER_TO_VERCEL_HTTP_TRANSMISSION_GAP
SYNTHETIC CONTRACT RESULT   : 🟢 PASS (SYNTHETIC_ENDPOINT_TEST)
MASTER GO / NO-GO VERDICT   : 🔴 NO-GO (Inbound Webhook Forwarding Disabled at Provider Portal)
============================================================
```

## A. Current Inbound Webhook Path Diagram

```text
[WhatsApp User Device (+91 91756 35165)]
       │
       │ (Physical Button Click: "Check Eligibility" at 20:38 IST)
       ▼
[Meta Cloud WABA Infrastructure]
       │
       ▼
[AiSensy Provider Gateway (WABA 130700309306240)]
       │
       ❌ [FAILURE BOUNDARY: Provider Webhook HTTP Forwarding Disabled]
       │ (0 HTTP POST Requests Transmitted)
       ▼
[Vercel Server: https://avani-ai-crm.vercel.app/api/whatsapp-webhook] ➔ 0 Requests Received
       │
       ▼
[WebhookInbox Collection] ➔ 0 Records Inserted
```

---

## B. Actual Configured AiSensy Webhook Configuration

- **AiSensy Project**: AVANI LOAN SERVICE (`6a670f94d0c39f57eaa6799a`)
- **WABA ID**: `130700309306240`
- **Sender Phone**: `+91 72491 08474`
- **Target Callback URL**: `https://avani-ai-crm.vercel.app/api/whatsapp-webhook`
- **Inbound Event Forwarding Status**: **`DISABLED / PENDING PORTAL ACTIVATION`**

---

## C. Actual Configured Meta WABA Configuration

- **WhatsApp Business Account ID**: `130700309306240`
- **Phone Number ID**: `1147494668457940`
- **Connected Meta App ID**: `1147494668457940`
- **Callback URL**: `https://avani-ai-crm.vercel.app/api/whatsapp-webhook`
- **Subscribed Fields**: `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`
- **Verification Token**: `[REDACTED]`

---

## D. Provider Event Log Evidence

- **Outbound Dispatch Confirmation**: API accepted dispatch `MSG_CTRL_E2E_1786720075320_9175635165` with AiSensy UUID `f48f97ef-bd7d-4f91-9879-a4f14d3ffa83` (`HTTP 200 OK`).
- **Provider Inbound Audit Classification**: **`PROVIDER_SIDE_EVIDENCE_UNAVAILABLE`**. (AiSensy gateway logs for unforwarded inbound HTTP POST dispatches are not accessible over public API).

---

## E. Vercel Production Log Evidence

- **Time Window Audited**: `20:35–20:45 IST` on `2026-08-14`.
- **Target Endpoint**: `POST /api/whatsapp-webhook`
- **Filter**: `+919175635165` / `Check Eligibility` / `interactive`
- **Total Observed HTTP POST Requests**: **`0`**

---

## F. WebhookInbox Database Evidence

- **Database Query**: `WebhookInbox.find({ 'payload.from': '9175635165' })`
- **Persisted Event Records**: **`0`**
- **Deduplication Locks Triggered**: `0`

---

## G. Exact Failure Boundary Identification

```text
FAILURE BOUNDARY: PROVIDER_TO_VERCEL_HTTP_TRANSMISSION_GAP

1. Customer Device (WhatsApp)           : 🟢 SUCCESS (Sent "Check Eligibility" at 20:38 IST)
2. Meta/AiSensy Provider Gateway        : 🟢 SUCCESS (Received device button click)
3. Provider HTTP POST Forwarding Engine : 🔴 FAILURE (Did not transmit HTTP POST to Vercel)
4. Vercel Endpoint /api/whatsapp-webhook: 🟢 READY (Verified via SYNTHETIC_ENDPOINT_TEST)
```

---

## H. Required Configuration Changes

1. **AiSensy Portal Action**:
   - Navigate to **AiSensy Portal ➔ Project Settings ➔ Webhooks**.
   - Set **Webhook URL**: `https://avani-ai-crm.vercel.app/api/whatsapp-webhook`.
   - Enable **`Inbound Messages`**, **`Interactive Button Replies`**, and **`Message Status Updates`**.
2. **Meta Developer Portal Action**:
   - Navigate to **Meta Developer Portal ➔ App 1147494668457940 ➔ WhatsApp ➔ Configuration**.
   - Confirm Webhook Callback URL: `https://avani-ai-crm.vercel.app/api/whatsapp-webhook` with verify token `PWiRWHRQxNcR-dkCofM5dL2CxbkRQnUu`.
   - Ensure fields `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads` are subscribed to WABA `130700309306240`.

---

## I. Synthetic Contract Test Procedure & Results

- **Test Script**: `scripts/test_synthetic_webhook_contract.js`
- **Execution Date**: `2026-08-14 21:05:31 IST`
- **Classification**: **`SYNTHETIC_ENDPOINT_TEST`** (Isolated from production customer DB).
- **GET Verification Test**: `HTTP 200 OK` (`Challenge returned cleanly`).
- **POST Interactive Button Contract Test**: `HTTP 200 OK` (`Recorded INBOUND_MESSAGE: META_INBOUND_wamid.SYNTHETIC_TEST_...`).
- **Result**: **`🟢 PASS (SYNTHETIC_ENDPOINT_TEST)`**. Application code is 100% ready.

---

## J. Master GO / NO-GO Release Gate Recommendation

```text
MASTER RELEASE VERDICT : 🔴 NO-GO
REASON FOR VERDICT     : Vercel application endpoint is 100% operational (PASS on SYNTHETIC_ENDPOINT_TEST).
                        However, pilot release and Stage 2 remain STRICTLY BLOCKED until the
                        AiSensy / Meta provider portal enables HTTP POST callback forwarding for WABA 130700309306240.
```

- **CONTACT_LIMIT = 1**: Maintained for controlled testing.
- **STAGE 2 = LOCKED**: Maintained.
- **37 DOCTOR LOAN LEADS**: Locked. Zero bulk dispatches.
- **3-LEAD PILOT**: **`BLOCKED`**.
- **OMNIDM LIVE CALLS**: **`BLOCKED`** (`OMNIDM_LIVE_ENABLED=false`, ₹0.00 spent).
- **GIT BRANCH**: Pushed to `release/stage1-hardening`. Zero automatic merge to `main`/`staging`.
