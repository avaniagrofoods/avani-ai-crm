# AVANI LOAN SERVICES — WABA WEBHOOK OWNERSHIP FORENSIC AUDIT

```text
============================================================
AVANI LOAN SERVICES — WABA WEBHOOK OWNERSHIP FORENSIC AUDIT
============================================================
DATE & TIMESTAMP            : 2026-08-15 22:54:00 IST
PRIMARY CRM SOURCE OF TRUTH : AVANI AI CRM (3-AVANI AI CRM)
AGENTS SERVICE               : AVANI LOAN AGENTS (4-AVANI LOAN AGENTS)
PRODUCTION CRM DEPLOYMENT   : https://avani-ai-crm.vercel.app
PRODUCTION AGENT DEPLOYMENT : https://avani-loan-agents.onrender.com
HARDENING GIT COMMIT        : 696414c (release/stage1-hardening)

CONTROLLED TEST CONTACT     : Dr. Sachin Shinde (AVL-20260811-000001 | +919175635165)
APPROVED SENDER             : +91 72491 08474
============================================================
```

---

## A. WABA Ownership
- **Owner Business Portfolio**: `Avani Loan Services` (Business Portfolio ID: `130700309306240`)
- **Authoritative WABA ID**: `1062614709598311` ("Sachin Shinde Avani Loan Services")
- **WABA Status**: Verified & Active in Meta Business Suite

---

## B. Phone Ownership
- **Phone Number**: `+91 72491 08474`
- **Phone Number ID**: `1147494668457940`
- **Display Name**: `Sachin Shinde Avani Loan Services`
- **Connection Status**: `Connected` | **Quality Rating**: `High`
- **Hosting / Management**: Onboarded via WhatsApp Business Solution Provider (BSP) Embedded Signup

---

## C. BSP Ownership
- **Assigned Tech Provider / BSP**: **`AiSensy`**
- **Partner Role**: **`Partner with Full Control`** (Confirmed via Meta Business Suite screenshot `media_1786806355789.png`)
- **API Routing**: Meta Cloud API automatically routes all incoming WhatsApp traffic for `+91 72491 08474` to AiSensy's platform infrastructure.

---

## D. Meta App Subscription
- **Meta Developer App**: `AVANI AI CRM` (App ID: `2049842548930849`)
- **App Webhook State**: `messages` (v25.0) is marked `Subscribed` at the Developer App Level.
- **Why App Webhook Receives Only Test Events**: In Meta Cloud API, subscribing an app's webhook fields only receives live traffic for WABAs that have authorized/installed the app via `POST /{WABA_ID}/subscribed_apps` or Meta On-Behalf-Of (OBO) flow. Because WABA `1062614709598311` is owned under AiSensy's BSP App, Meta routes live customer traffic exclusively to AiSensy.

---

## E. AiSensy Relationship
- **AiSensy Project**: `AVANI LOAN` / `AVANI LOAN SERVICES` (`6a670f94d0c39f57eaa6799a`)
- **AiSensy Plan**: **`BASIC (quarterly)`** (Confirmed via AiSensy screenshot `media_1786808630827.png`)
- **AiSensy Outbound Messaging**: Fully operational (`HTTP 200 OK` via Campaign API `/campaign/t1/api/v2`).
- **AiSensy Inbound Webhooks**: **`LOCKED`** (`Webhook Usage: 0 / 0`, *"You need a minimum of PRO plan to use this feature"*, confirmed via screenshot `media_1786808601435.png`).

---

## F. Current Inbound Webhook Owner
- **Authoritative Inbound Receiver**: **`AiSensy BSP Gateway`**
- When a customer sends a WhatsApp message, Meta delivers it directly to AiSensy.
- Proof: When the test phone sent `"I want doctor loan"` at `10:40 PM`, AiSensy immediately replied with its Live Chat Out-of-Office auto-responder (`"Hi! Thanks for connecting. Our team is unavailable right now. We'll be back at 9am tomorrow."`).

---

## G. Why Real Messages Do Not Reach Vercel
1. **AiSensy Inbound Gate**: AiSensy receives the message, but because the account is on the `BASIC` plan, AiSensy does **not forward** the HTTP POST webhook to `https://avani-ai-crm.vercel.app/api/whatsapp-webhook`.
2. **Meta Direct Gate**: Meta App `2049842548930849` is not the installed BSP on WABA `1062614709598311`, so Meta does not bypass AiSensy to duplicate live events to the developer app.

---

## H. Supported Architecture
- **`ARCHITECTURE B: META ➔ AISENSY ➔ AVANI CRM WEBHOOK`**
  - This is the standard, native architectural pattern for numbers registered under AiSensy BSP.
  - Outbound messaging travels via AiSensy Campaign API.
  - Inbound messages travel from WhatsApp ➔ Meta ➔ AiSensy ➔ Vercel Webhook.

---

## I. Unsupported Architecture(s)
- **`ARCHITECTURE A: META DIRECT ➔ VERCEL`**: Unsupported while the phone number is tied to AiSensy as a Partner with Full Control without migrating the WABA to a direct Meta Cloud API System User.
- **`ARCHITECTURE C: HYBRID DUAL DELIVERY`**: Unsupported because Meta delivers inbound webhook traffic to the registered Tech Partner App (AiSensy), not both simultaneously.

---

## J. Whether AiSensy BASIC is Blocking Inbound
- **YES**. The AiSensy `BASIC` plan restricts Webhook Usage to `0 / 0` and explicitly locks the `+ Add Webhook` feature behind the `PRO` plan.

---

## K. Exact Next Configuration Action
There are two mutually exclusive resolution paths:

### PATH 1: AiSensy Webhook Activation (Recommended — Zero Downtime)
- Upgrade AiSensy project `6a670f94d0c39f57eaa6799a` to the **PRO** plan (or add the Webhook Add-on in AiSensy).
- In AiSensy Developer Hub ➔ Project Webhooks ➔ Add Webhook:
  - URL: `https://avani-ai-crm.vercel.app/api/whatsapp-webhook`
  - Events: `Incoming Messages`, `Button Replies`, `Status Updates`.

### PATH 2: Meta Direct WABA System User Migration (Direct Meta Path)
- In Meta Business Suite (`130700309306240`) ➔ System Users:
  - Generate a Permanent System User Token with `whatsapp_business_management` and `whatsapp_business_messaging`.
  - Subscribe App `2049842548930849` directly to WABA `1062614709598311` via `POST /1062614709598311/subscribed_apps`.
  - Disconnect AiSensy as the exclusive message handler.

---

## L. Whether Meta Migration is Required
- **No**, provided Path 1 (AiSensy Webhook enablement) is chosen.
- **Yes**, only if you want to eliminate AiSensy entirely and run direct Meta Cloud API with no monthly BSP subscription.

---

## M. Whether AiSensy PRO Upgrade is Required
- **Yes**, if maintaining AiSensy as the BSP and using AiSensy's inbound webhook forwarding.

---

## N. Production Risk
- **Path 1 (AiSensy Webhook)**: **`ZERO RISK`** — No change to Meta WABA, no phone downtime, preserves existing AiSensy templates and sender status.
- **Path 2 (Meta Direct Migration)**: **`MEDIUM RISK`** — Requires removing AiSensy's Full Control partner role on Meta, re-registering phone certificates on Meta Cloud API, and updating outbound API code from AiSensy to Meta Graph API.

---

## O. Rollback Plan
- Application code in `3-AVANI AI CRM` already supports both Meta Direct payloads and AiSensy webhook payloads with atomic deduplication.

---

## P. FINAL RECOMMENDATION

```text
FINAL MASTER VERDICT:
🔴 RED — ARCHITECTURE LIMITATION REQUIRES EXTERNAL ACTION

RECOMMENDED RESOLUTION:
Enable Webhook Forwarding in AiSensy (GREEN PATH — AISENSY WEBHOOK via Plan/Addon Enablement).
This instantly unblocks the final 1-minute step with ZERO infrastructure downtime.
```
