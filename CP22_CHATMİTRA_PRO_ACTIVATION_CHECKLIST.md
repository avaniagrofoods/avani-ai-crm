# AVANI AI CRM — CP-22 CHATMITRA PRO ACTIVATION CHECKLIST (MONDAY, 09 NOVEMBER 2026)

**Business Entity:** AVANI LOAN SERVICES  
**Business Owner & Founder:** Sachin Shinde  
**Official WhatsApp Business (WABA):** `+91 72491 08474` (WABA ID: `1062614709598311`)  
**Authorized Test Contact:** `+91 91756 35165`  
**Target Plan:** ChatMitra Pro Plan (₹999 / month)  
**Execution Target Date:** Monday, 09 November 2026  

---

## 1. Pre-Activation Invariant (Current State)

All CRM source code, database models, API handlers, webhook consumers, and 181 automated tests are **already built, verified, and deployed to production**. 

No further code modifications are required for Monday activation. The owner simply completes the following 14 verification steps upon subscription purchase.

---

## 2. Monday Activation Checklist (14 Steps)

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ OWNER ACTIVATION CHECKLIST: 14 SEQUENTIAL ACTIONS FOR MONDAY, 09 NOVEMBER 2026                        │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Confirm Subscription Status in ChatMitra
- Log in to [https://app.chatmitra.com](https://app.chatmitra.com).
- Navigate to **Billing & Plans**.
- Complete purchase of the **Pro Plan (₹999/month + GST)**.
- Verify status changes to **`Active`** and invoice is generated.

### Step 2: Verify Developer API Entitlement
- Navigate to **Settings > Developer API / API Keys**.
- Confirm API key generation is active.
- Verify base endpoint: `https://api.chatmitra.com`.

### Step 3: Verify Real-Time Webhook Entitlement
- Navigate to **Settings > Webhooks**.
- Confirm webhook URL is set to:
  ```text
  https://avani-ai-crm.vercel.app/api/chatmitra-webhook
  ```
- Verify status displays **`Active` (Green toggle)**.

### Step 4: Verify Event Subscriptions
Ensure checkboxes are checked for all 4 required event triggers:
- [x] `message.received` (Inbound customer messages)
- [x] `message.sent` (Outbound message acknowledgments)
- [x] `message.status.updated` (Delivery & read receipts: Sent, Delivered, Read)
- [x] `payment.status.updated` (Fee transaction callbacks)

### Step 5: Copy Webhook Secret
- Copy the **Webhook Secret** from the ChatMitra dashboard.
- In Vercel Project Settings > Environment Variables, confirm or update `CHATMITRA_WEBHOOK_SECRET`.

### Step 6: Verify AI ChatBot Entitlement
- Navigate to **Automations > AI ChatBot** in ChatMitra.
- Confirm conversational bot access is unlocked under Pro.

### Step 7: Verify Auto Reply Rules
- Navigate to **Automations > Auto Reply Rules**.
- Verify default away message and office hours rules are active.

### Step 8: Trigger Built-In Provider Test Event
- In the ChatMitra Webhook dashboard, locate the **Test Webhook** button.
- Select event `message.received` and click **Send Test**.
- Expected response: `HTTP 200 OK`.

### Step 9: Controlled Live Inbound Message Test
- From authorized test phone **`+91 91756 35165`** (Sachin Shinde), send a real WhatsApp text to the official WABA number **`+91 72491 08474`**:
  ```text
  Hello, I need a business loan for working capital
  ```

### Step 10: Verify CRM Lead & Contact Persistence
- Open [https://avani-ai-crm.vercel.app/leads](https://avani-ai-crm.vercel.app/leads).
- Confirm new lead appears with:
  - Name: `Sachin`
  - Phone: `+91 91756 35165`
  - Loan Type: `Business Loan`
  - Consent: `GRANTED`

### Step 11: Verify CRM Inbox Message Bubble Rendering
- Open [https://avani-ai-crm.vercel.app/inbox](https://avani-ai-crm.vercel.app/inbox).
- Confirm incoming WhatsApp message bubble appears in conversation history.

### Step 12: Verify Human Advisor Handoff
- Confirm the conversation displays status:
  ```text
  CUSTOMER_REPLIED_HUMAN_FOLLOWUP
  ```
- Confirm automated drip follow-ups are halted to preserve personal advisor interaction.

### Step 13: Isolated AI Reply Verification
- If testing AI conversational replies, simulate with header `AISENSY_INBOUND_WEBHOOK_ENABLED=true` in isolated test harness.
- Confirm qualification prompt includes advisory disclaimer and link to `https://www.avanifinserv.com`.

### Step 14: Review Billing & Usage Metrics
- Verify ChatMitra dashboard displays conversation usage count.
- Confirm markup is billed at ₹0.20 per conversation.
- Retain Pro Plan (no upgrade to Enterprise needed until volume reaches 7,500 conversations/month).

---

## 3. Post-Activation Verification Sign-Off

Upon completion of Steps 1 through 14, Sachin Shinde may sign off on full live production cutover by executing:
```bash
git tag v1.2.0-chatmitra-pro-live
git push origin v1.2.0-chatmitra-pro-live
```
