# AVANI LOAN SERVICES — INTEGRATION INVENTORY & CAPABILITY REGISTER

**Audit Date:** 01 November 2026  
**Execution Timestamp:** 2026-11-01T23:35:00+05:30 (Asia/Kolkata / IST)  
**Business Entity:** AVANI LOAN SERVICES  
**Application:** AVANI AI CRM + AVANI Loan Services Website  

---

## 1. COMPREHENSIVE INTEGRATION REGISTER

| Integration Name | Source System | Destination System | Trigger Event | Auth Method | Data Transferred | Webhook / API Route | Retry Behavior | Idempotency Protection | Failure Handling | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Website-to-CRM Lead Intake** | Website (`avanifinserv.com`) | CRM (`avani-ai-crm`) | Form Submission | `x-api-key` header (`CRM_API_KEY`) | Name, Phone, Loan Type, Amount, DPDP Consent, UTM | `POST /api/leads` | Exponential backoff (client retry) | Deduplication by `phone` & `idempotencyKey` | Fail-closed HTTP 503; secondary mirror to Google Sheets | **VERIFIED** |
| **ChatMitra Inbound Webhook** | ChatMitra Cloud | CRM | Inbound WhatsApp Msg / Status | HMAC-SHA256 (`x-webhook-signature`) | Message Text, From Phone, Msg ID, Timestamp | `POST /api/chatmitra-webhook` | Provider webhook retries (up to 24h) | Deduplication via `WebhookInbox` on `messageId` | Rejects invalid sig (401); fail-closed 503 triggers retry | **VERIFIED** |
| **ChatMitra Outbound WhatsApp** | CRM | ChatMitra Cloud | Lead Event / Advisor Message | Bearer Token (`CHATMITRA_API_KEY`) | Recipient Phone, Template Params, Text | `POST /developer/api/send_message` | 3 retries with jitter | `Idempotency-Key` header with unique UUID | Fallback to Mock or AiSensy; alert via Slack | **VERIFIED (CONFIGURED)** |
| **Meta WhatsApp Cloud API** | Meta Graph API | CRM | Inbound Message / Delivery | HMAC-SHA256 (`x-hub-signature-256`) | Payload, Sender ID, Status | `POST /api/meta-webhook` | Meta automatic webhook retry | Unique check on `entry.changes.id` | HTTP 400 on malformed; fail-closed 503 | **VERIFIED (MOCK)** |
| **AiSensy Rollback Adapter** | CRM | AiSensy API | ProviderRouter Rollback Trigger | API Key (`AISENCY_WABA_API_KEY`) | Recipient, Campaign Name, Params | `POST /v1/messages/send-template` | 2 retries | Campaign idempotency hash | Purged in Prod; preserved in Staging code | **STANDBY (ROLLBACK)**|
| **Gemini AI Loan Advisor** | CRM Backend | Google Generative AI | Inbound Question / Enquiry | API Key (`GEMINI_API_KEY`) | User message + loan advisory prompt | `POST generativelanguage.googleapis.com` | 2 retries on rate limit | Cached responses for identical queries | Fallback to rule-based qualification template | **VERIFIED** |
| **OmniDM Voice AI Calling** | CRM Backend | OmniDM / Vapi Platform | High-Intent Lead Trigger | Bearer API Key (`OMNIDIM_API_KEY`) | Customer Name, Phone, Language | `POST /api/vapi-webhook`, `omnidim-webhook` | Platform retry policy | Deduplication on `callId` | **HARD KILLSWITCH: `OMNIDM_LIVE_ENABLED=false`** | **READY_DISABLED** |
| **HubSpot CRM Sync** | Website / CRM | HubSpot API | Form Submission / Lead Create | Private App Token (`HUBSPOT_API_KEY`) | Contact properties, loan interest | `POST /crm/v3/objects/contacts` | 3 retries | Primary key email/phone | Non-blocking: logs error, CRM retains record | **VERIFIED** |
| **Google Sheets Master Mirror** | Website / CRM | Google Apps Script | Lead Intake Event | Webhook URL (`GOOGLE_SHEET_APP_SCRIPT_URL`) | Row array: timestamp, name, phone, product | HTTPS POST to Apps Script Web App | Client retry | Appended to sheet ledger with UUID | Non-blocking secondary archive | **VERIFIED** |
| **Zapier / Make Automation** | Website / CRM | Zapier / Make | Lead Intake Event | Webhook URL Token | Complete Lead JSON | `POST ZAPIER_WEBHOOK_URL` / `MAKE_WEBHOOK_URL` | Webhook service retries | Event correlation ID | Non-blocking | **VERIFIED** |
| **Transactional Email Dispatch** | Website | Customer / Advisor | Application Submission | SMTP Credentials (`SMTP_USER`, `SMTP_PASS`) | HTML email confirmation + documents | `src/utils/emailService.cjs` | 1 retry | MessageID generation | Logged locally if SMTP server offline | **VERIFIED** |
| **Campaign Follow-up Cron** | Vercel Cron | CRM Cron Route | Daily Schedule (09:00 IST) | Bearer Token (`CRON_SECRET`) | D0-D15 Follow-up Queue Processing | `GET /api/cron/follow-ups` | Next cron tick | Check `lastContactedAt` and `followUpStep` | Skips opted-out leads; logs processing summary | **VERIFIED** |

---

## 2. INTEGRATION AUDIT SUMMARY

- **Total Integrations Mapped:** 12
- **Fully Verified & Active:** 8
- **Configured & Ready (Pending Deployment Cutover):** 2 (`ChatMitra Outbound`, `Meta Cloud API`)
- **Safety Standby / Fallback:** 1 (`AiSensy Rollback Adapter`)
- **Safety Disabled by Policy:** 1 (`OmniDM Voice AI Calling` — killswitch active)
- **Zero Unverified Live Sends:** All outbound messaging is locked under `PROVIDER_MODE=mock`.
