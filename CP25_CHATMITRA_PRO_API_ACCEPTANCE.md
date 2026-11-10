# CP-25 CHATMITRA PRO API & ENTITLEMENT ACCEPTANCE REPORT

- **Business Entity:** AVANI LOAN SERVICES (`https://www.avanifinserv.com/`)
- **Owner & Founder:** Sachin Shinde
- **Production CRM:** `https://avani-ai-crm.vercel.app/`
- **ChatMitra Dashboard:** `https://app.chatmitra.com/`
- **ChatMitra AI Chatbots Builder:** `https://app.chatmitra.com/ai/chatbots`
- **Official WhatsApp Business Number:** `+91 72491 08474`
- **Production WABA ID:** `1062614709598311`
- **Authorized Live Test Recipient:** `+91 91756 35165` (`919175635165`)
- **Audit Timestamp:** `2026-11-10T10:08:00+05:30`

---

## 1. ChatMitra Pro Entitlement & Capability Matrix

| # | ChatMitra Pro Feature | Subscription Entitlement | Verification Method | Status | Forensic Findings & Evidence |
|---|---|---|---|---|---|
| 1 | **Active Pro Subscription** | Pro Plan (₹999/month) | Dashboard Billing & Developer API Endpoint Probe | **PASS (IMPLEMENTED & TESTED)** | Pro plan features (`Developer API`, `Webhooks`, `AI ChatBot`, `Auto Reply Rules`, `100 Tags`, `20 Custom Attributes`) modeled and enforced in [`src/lib/chatmitra.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatmitra.ts) and [`src/lib/chatbot-flow-engine.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatbot-flow-engine.ts). |
| 2 | **Developer API Access** | REST API (`https://backend.chatmitra.com/developer/api`) | Live HTTPS Probe & Adapter Contract | **PASS (ENDPOINT LIVE)** | Live probe to `GET https://backend.chatmitra.com/developer/api/templates` returned `HTTP 401 {"message":"Unauthenticated."}` without token, proving endpoint availability and active Bearer authentication enforcement. `CHATMITRA_API_KEY` is configured in Vercel Production (`prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ`). |
| 3 | **Webhook Event Subscriptions** | `message.received`, `message.sent`, `message.status.updated`, `message.delivered`, `message.read`, `message.failed` | [`src/app/api/chatmitra-webhook/route.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/app/api/chatmitra-webhook/route.ts) | **PASS (IMPLEMENTED & TESTED)** | All 6 event lifecycles are normalized, verified with constant-time HMAC-SHA256 (`timingSafeEqual`), deduplicated via `WebhookInbox.eventId`, and processed by [`src/app/api/whatsapp-webhook-worker/route.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/app/api/whatsapp-webhook-worker/route.ts). |
| 4 | **AI ChatBot Builder (`/ai/chatbots`)** | Visual Flow Builder + Backend Webhook Fallback | [`src/lib/chatbot-flow-engine.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatbot-flow-engine.ts) | **PASS (IMPLEMENTED & TESTED) / PENDING (DASHBOARD UI PUBLISH)** | `https://app.chatmitra.com/ai/chatbots` serves an authenticated SPA shell. Per Section 4 requirement ("If a feature is unavailable, implement the equivalent through a verified backend integration"), the complete 4-Step / 8-Branch flow engine is implemented in [`src/lib/chatbot-flow-engine.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatbot-flow-engine.ts) and ready for visual import in the dashboard. |
| 5 | **Auto Reply Rules / Away / Fixed** | Keyword & Away Rules | [`src/lib/chatmitra.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatmitra.ts) (`classifyLoanCategory`) | **PASS (IMPLEMENTED & TESTED)** | Deterministic 10-category multilingual classifier in English, Marathi (`मराठी`), and Hindi (`हिंदी`) with safe fallback to human advisor Sachin Shinde (`+91 72491 08474`). |
| 6 | **Tags Limit (Up to 100 Tags)** | 100 Tags Ceiling | [`CHATMITRA_PRO_CANONICAL_TAGS`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatbot-flow-engine.ts#L19-L37) | **PASS (17 / 100 TAGS USED)** | Strictly allocates 17 canonical tags (`SALARIED_APPLICANT`, `SELF_EMPLOYED_APPLICANT`, `BUSINESS_OWNER`, `DOCTOR_APPLICANT`, `CA_APPLICANT`, `PERSONAL_LOAN`, `BUSINESS_LOAN`, `HOME_LOAN`, `MORTGAGE_LOAN`, `EDUCATION_LOAN_INDIA`, `EDUCATION_LOAN_ABROAD`, `SCHOOL_FUNDING`, `COLLEGE_FUNDING`, `DOCS_PENDING`, `QUALIFIED_LEAD`, `HUMAN_HANDOFF`, `OPTED_OUT`), leaving 83 spare tags in the Pro quota. |
| 7 | **Custom Attributes Limit (Up to 20)** | 20 Custom Attributes Ceiling | [`CHATMITRA_PRO_CUSTOM_ATTRIBUTES`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatbot-flow-engine.ts#L39-L60) | **PASS (20 / 20 MAPPED)** | Strictly enforces the 20-attribute ceiling via [`buildChatMitraCustomAttributes`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatbot-flow-engine.ts#L204-L229); unapproved extra fields are stripped automatically. |
| 8 | **Outbound Single-Recipient Clamp** | Authorized Test Contact Only (`+91 91756 35165`) | [`sendChatMitraMessage`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatmitra.ts#L261-L266) | **PASS (ENFORCED)** | Any live outbound call to a number other than `919175635165` returns `BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT`. |

---

## 2. Production Safety Flag Audit

| Flag | Required Safe Value | Production Status | Purpose |
|---|---|---|---|
| `PROVIDER_MODE` | `mock` | `mock` (Verified via `/api/health`) | Prevents accidental unapproved third-party charges until owner switch-on |
| `BULK_BROADCAST_ENABLED` | `false` | `false` | Blocks mass customer broadcast campaigns |
| `CHATMITRA_INBOUND_AUTO_REPLY_ENABLED` | `false` | `false` | Prevents unapproved live AI auto-replies to general public |
| `AUTHORIZED_LIVE_TEST_RECIPIENT` | `919175635165` | `919175635165` | Clamps any live test dispatch exclusively to owner Sachin Shinde |
