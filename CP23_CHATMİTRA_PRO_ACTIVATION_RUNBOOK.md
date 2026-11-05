# AVANI AI CRM — CP-23 CHATMİTRA PRO ACTIVATION RUNBOOK
## Monday, 09 November 2026 Live Provider Activation & Verification Guide

**Business Entity:** AVANI LOAN SERVICES  
**Advisory Website:** `https://www.avanifinserv.com`  
**Founder & Business Owner:** Sachin Shinde  
**Workspace:** `3-AVANI AI CRM`  
**Production URL:** `https://avani-ai-crm.vercel.app`  
**Official WABA Sender Number:** `+91 72491 08474` (WABA ID: `1062614709598311`)  
**Authorized Synthetic & Test Recipient:** Sachin Shinde — `+91 91756 35165`  
**Date:** November 05, 2026 (21:50 IST)  
**Auditor:** Antigravity Autonomous Lead Architect  

---

## 1. Overview & Objective

This runbook guides Sachin Shinde (Owner) through the safe, controlled activation of the **ChatMitra Pro Plan (₹999/month)** on Monday morning.

All CRM code, Mongoose schemas, message status normalization, opt-out protections, and Vercel production deployments are **100% prepared**. No code changes are required on Monday.

---

## 2. Step-by-Step Activation Procedure

### Step 1: Complete ChatMitra Pro Plan Purchase
1. Log in to the ChatMitra dashboard: `https://app.chatmitra.com`.
2. Navigate to **Billing & Subscriptions**.
3. Select the **Pro Plan (₹999/month)**.
4. Complete payment via UPI, Debit/Credit Card, or NetBanking.
5. *Note: Do NOT choose the Enterprise Plan (₹2,499/month). The Pro Plan provides 100% of required functionality and saves ₹1,100/month (44%).*

### Step 2: Confirm Active Developer API & Webhook Settings
1. Go to **Settings > API & Webhooks**.
2. Confirm your Developer API Key is active. (Should match `aa61...9900` currently configured in Vercel).
3. Under **Webhook URL**, verify:
   - URL: `https://avani-ai-crm.vercel.app/api/chatmitra-webhook`
   - Status: **Active**
   - Signature Header: `X-Webhook-Signature`
   - Subscribed Events:
     - [x] `message.received` (Inbound messages)
     - [x] `message.sent` (Outbound dispatches)
     - [x] `message.status.updated` (Delivery receipts)
     - [x] `payment.status.updated`

### Step 3: Trigger Provider Webhook Test
1. In ChatMitra Webhook Settings, click the **Test Webhook** button for `message.received`.
2. Verify that ChatMitra displays a green checkmark (`HTTP 200 OK`).
3. Open the CRM Webhook Ingestion Log: `https://avani-ai-crm.vercel.app/webhooks`.
4. Confirm the test event appears in MongoDB `WebhookInbox` with `status: RECEIVED` or `status: PROCESSED`.

### Step 4: Execute Controlled Inbound Message Test
1. From authorized test phone `+91 91756 35165`, send a WhatsApp message to official WABA `+91 72491 08474`:
   > *"Namaste Sachin ji, I need an Education Loan for my daughter's MS in the USA."*
2. Open the CRM Inbox: `https://avani-ai-crm.vercel.app/inbox`.
3. Verify:
   - Contact appears in the sidebar with name `Sachin Shinde` or `Customer`.
   - Message text appears in the conversation history in real time.
   - Lead category is classified as **Education Loan — Global Studies**.
   - Contact consent status is `GRANTED` under DPDP Act rules.

### Step 5: Test Trilingual DPDP Opt-Out Protection
1. From the test phone `+91 91756 35165`, send:
   > *"थांबवा"* (Marathi for STOP) or *"STOP"*.
2. Verify in CRM:
   - Conversation state updates to `OPTED_OUT`.
   - Contact status updates to `OPTED_OUT`.
   - Automated acknowledgement is received:
     > *"You have been successfully unsubscribed from AVANI LOAN SERVICES updates..."*
3. Send a follow-up test message:
   > *"Can you still hear me?"*
4. Verify:
   - Message appears in CRM Inbox history for human advisor visibility.
   - Zero automated promotional messages or AI replies are dispatched.
   - Opt-out state remains intact.

### Step 6: Enable Live Outbound AI Auto-Replies (Controlled Rollout)
1. In Vercel Project Settings for `avani-ai-crm`:
   - Set environment variable: `CHATMITRA_INBOUND_AUTO_REPLY_ENABLED = true`.
   - Set environment variable: `PROVIDER_MODE = live`.
2. Redeploy or promote to production.
3. Send a test inquiry from `+91 91756 35165` to test live qualification flow.
4. Verify response includes:
   - Qualification questions.
   - Tailored document checklist.
   - Standard advisory disclaimer (AVANI LOAN SERVICES is a loan advisory firm).
   - Direct escalation contact to Sachin Shinde (`+91 72491 08474`).

### Step 7: Final Production Sign-Off
1. Once Steps 1–6 are complete, Sachin Shinde confirms live acceptance.
2. Production classification is updated to: **`PRODUCTION SIGN-OFF APPROVED`**.
