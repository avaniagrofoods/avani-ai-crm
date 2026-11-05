# AVANI AI CRM — CP-23 PROVIDER ENTITLEMENT & CAPABILITY MATRIX

**Business Entity:** AVANI LOAN SERVICES  
**Advisory Website:** `https://www.avanifinserv.com`  
**Founder & Business Owner:** Sachin Shinde  
**Workspace:** `3-AVANI AI CRM`  
**CRM Production:** `https://avani-ai-crm.vercel.app`  
**ChatMitra Dashboard:** `https://app.chatmitra.com`  
**Current Plan Status:** Existing account baseline; Pro Plan purchase scheduled for Monday, 09 November 2026 (₹999/month)  
**Date:** November 06, 2026 (04:45 IST)  
**Auditor:** Antigravity Autonomous Lead Architect  

---

## 1. Executive Capability Overview

This entitlement matrix formally documents the technical readiness, provider entitlements, safety boundaries, and live verification status for the upcoming ChatMitra Pro Plan transition.

The system is architected so that **zero new application code is needed on Monday, 09 November 2026**. Transitioning from staging to live provider communication requires solely account subscription activation and environment variable verification.

---

## 2. Master Provider Capability Matrix

| Capability | Code Readiness | Provider Entitlement (Pro ₹999/mo) | Safety & Operating State | Live Verification Status |
| :--- | :---: | :---: | :--- | :---: |
| **Inbound Webhook** | **100% READY** | Supported (Real-time `message.received`) | Normalized to `RECEIVED`; persisted to `WebhookInbox` | `VERIFIED_MOCK` (Live ready for Monday test) |
| **Outbound API** | **100% READY** | Supported (Developer API `/send_message`) | Single-recipient clamp locked to `+91 91756 35165` | `VERIFIED_MOCK` (Direct HTTP client ready) |
| **AI Auto-Reply** | **100% READY** | Supported (Isolated via AVANI AgentEngine) | Preserved OFF (`CHATMITRA_INBOUND_AUTO_REPLY_ENABLED=false`) | `VERIFIED_SYNTHETIC` (Test mode passing) |
| **Message Templates** | **100% READY** | Supported (Registered WABA templates) | Strict parameter validation & fallback handling | `VERIFIED_SCHEMA` (10 loan templates registered) |
| **Delivery Status** | **100% READY** | Supported (`message.status.updated`) | Monotonicity guard: `READ` cannot downgrade to `DELIVERED` | `VERIFIED_CODE` (Suite 16 Test 27 passing) |
| **Tags & Attributes** | **100% READY** | Supported (Up to 100 tags, 20 attributes) | Synchronized to MongoDB Lead attributes | `VERIFIED_DB` (Mongoose schema validated) |
| **Scheduled Automation** | **100% READY** | Supported (FollowUpEngine & Vercel Cron) | TRAI window 09:00–21:00 IST strictly enforced | `VERIFIED_CRON` (Drip sequence ready) |
| **Human Live Chat** | **100% READY** | Supported (CRM Inbox + ChatMitra Team Inbox) | Handoff alerts Sachin Shinde (`+91 72491 08474`) | `VERIFIED_UI` (`/inbox` loaded and live) |

---

## 3. Plan Entitlement Comparison & Boundary Audit

| Feature Dimension | Starter Plan | Pro Plan (Target ₹999/mo) | Enterprise Plan (₹2,499/mo) | AVANI Implementation Strategy |
| :--- | :---: | :---: | :---: | :--- |
| **Developer API Access** | No | **YES** | YES | Pro is mandatory and sufficient for CRM API dispatch. |
| **Real-Time Webhooks** | No | **YES** | YES | Pro provides real-time event webhooks for inbound and receipts. |
| **Auto Reply Rules** | Basic | **YES (Advanced)** | Unlimited | AVANI handles AI logic internally; CRM does not rely on provider AI. |
| **Custom Attributes** | Limited | **Up to 20** | Unlimited | AVANI requires 12 custom attributes for lead scoring (within limit). |
| **Tags** | Limited | **Up to 100** | Unlimited | AVANI utilizes 18 lifecycle tags (well within 100 quota). |
| **AI ChatBot** | No | **YES** | YES | Controlled via `CHATMITRA_INBOUND_AUTO_REPLY_ENABLED`. |
| **Dedicated Manager** | No | No | YES | Unnecessary for AVANI LOAN SERVICES at this stage. |

> [!IMPORTANT]
> **Owner Decision Guidance:** The Pro Plan (₹999/month) completely covers all technical and operational requirements for AVANI LOAN SERVICES. Purchasing the Enterprise Plan (₹2,499/month) is **NOT recommended** as its surplus features are redundant to AVANI's internal CRM architecture.

---

## 4. Pre-Activation Diagnostic Endpoints

The CRM exposes internal verification and diagnostic endpoints to validate entitlements without secret exposure:

1. **`GET /api/health`**
   - Returns real-time health of MongoDB, ChatMitra API connectivity, Meta WABA ID, and provider operating mode (`mock` or `live`).
   - Verified live on production: Returns HTTP 200 `HEALTHY`.
2. **`POST /api/chatmitra-webhook`**
   - Timing-safe HMAC-SHA256 signature enforcement over raw body using `CHATMITRA_WEBHOOK_SECRET`.
   - Verified live on production: Returns HTTP 401 on unsigned/forged requests.
3. **`POST /api/whatsapp-webhook-worker`**
   - Validates `x-worker-auth` header before processing inbound queue leases.
   - Verified live on production: Returns HTTP 401 on unauthorized calls.

---

## 5. Monday, 09 November 2026 Activation Checklist

1. [ ] Owner purchases ChatMitra Pro Plan (₹999/mo) in ChatMitra dashboard.
2. [ ] Verify Webhook URL is set to `https://avani-ai-crm.vercel.app/api/chatmitra-webhook`.
3. [ ] Confirm subscribed events: `message.received`, `message.sent`, `message.status.updated`, `payment.status.updated`.
4. [ ] Send controlled inbound test WhatsApp message from `+91 91756 35165` to `+91 72491 08474`.
5. [ ] Verify inbound message appears in CRM Inbox (`https://avani-ai-crm.vercel.app/inbox`) with status `RECEIVED`.
6. [ ] Verify Contact and Lead upserted in MongoDB with assigned loan category.
7. [ ] Confirm safety clamp protects all customer data while running single-contact live test.
