# AVANI AI CRM — CP-23 BASELINE AND GAP AUDIT

**Business Entity:** AVANI LOAN SERVICES  
**Advisory Website:** `https://www.avanifinserv.com`  
**Founder & Business Owner:** Sachin Shinde  
**Workspace:** `3-AVANI AI CRM`  
**Production URL:** `https://avani-ai-crm.vercel.app`  
**Official WABA Sender Number:** `+91 72491 08474` (WABA ID: `1062614709598311`)  
**Authorized Synthetic & Test Recipient:** Sachin Shinde — `+91 91756 35165`  
**Date:** November 05, 2026 (21:40 IST)  
**Auditor:** Antigravity Autonomous Lead Architect  

---

## 1. Executive Baseline Summary

This audit establishes the definitive technical baseline for Checkpoint **CP-23 (End-to-End Automation Production Readiness)**. It independently evaluates the actual repository state, Mongoose database schemas, webhook ingress pipelines, background queue workers, and production deployment configuration.

- **Baseline Commit:** `09155d1b702ec406a4ee11054b73b5a932d849f1`
- **Baseline Deployment:** `dpl_4FVCZeyZUGj9o5m5i8Z2hkrUBPFG` (Vercel Production)
- **Active Git Remote:** `origin -> https://github.com/avaniagrofoods/avani-ai-crm.git`
- **Active Branches:** `main` and `release/stage1-hardening` (Synced at baseline)
- **Current Test Coverage:** 209 passing automated tests across 16 test suites (100% pass rate)

---

## 2. Forensic Baseline Audit Table (12 Mission-Critical Areas)

| Area | Existing Implementation | Verified Behaviour | Defect / Gap Identified | Required Action |
| :--- | :--- | :--- | :--- | :--- |
| **1. ChatMitra Webhook** | `/api/chatmitra-webhook` route using `verifyChatMitraSignature()` with HMAC-SHA256 & raw request body. | Accepts valid HMAC signatures; rejects forged or unsigned requests with HTTP 401. Fail-closed on DB failure (HTTP 503). | Status callbacks pass varying casing (`sent`, `Delivered`, `Read`, `failed`). | Normalize all status updates at integration boundary via `normalizeMessageStatus()`. |
| **2. Meta Webhook** | `/api/whatsapp-webhook` and `/api/meta-webhook`. Supports `X-Hub-Signature-256`. | Verified in strict mode (`STRICT_META_WEBHOOK_VERIFICATION=true`). GET verification challenge returns 200. | Inbound status string casing mismatch previously crashed worker with Mongoose enum error. | Enforce canonical `RECEIVED` mapping for inbound messages. |
| **3. Webhook Worker** | `/api/whatsapp-webhook-worker` executing in background via Vercel `waitUntil()`. | Enforces `x-worker-auth` header against `INTERNAL_WORKER_SECRET`. Atomic lease claim on `WebhookInbox`. | Previously lease claim did not include `FAILED` status, blocking safe automated retries. | Add `{ status: 'FAILED' }` to lease claim `$or` condition. |
| **4. MongoDB Persistence** | Models: `Message`, `Conversation`, `Lead`, `Contact`, `WebhookInbox`, `WorkflowTrigger`. | Dual upsert of `Contact` and `Lead` on inbound; deduplication via indexed `providerMessageId`. | `WebhookInbox` enum lacked `PROCESSED` and `VERIFIED` states. | Expand `WebhookInbox.status` enum to include all pipeline states. |
| **5. CRM Inbox** | `/inbox`, `/api/contacts`, `/api/contacts/[id]`. | Displays contacts with latest message preview snippet and chronological message history. | Contacts who opted out previously could trigger AI auto-replies if they sent another inbound message. | Add explicit opt-out guard in worker suppressing automated replies for opted-out contacts. |
| **6. AI Response Engine** | `src/lib/ai-agent.ts` with `AgentEngine` covering all 10 canonical products. | Generates tailored document checklists, qualification prompts, advisory disclaimers, and handoff. | Feature flag was named `AISENSY_INBOUND_WEBHOOK_ENABLED`, misleading for ChatMitra. | Introduce provider-agnostic `CHATMITRA_INBOUND_AUTO_REPLY_ENABLED` & `WHATSAPP_INBOUND_AI_REPLY_ENABLED`. |
| **7. Outbound API** | `src/lib/chatmitra.ts` (`sendChatMitraMessage`) and `src/lib/provider-router.ts`. | Dispatches via `${CHATMITRA_BACKEND_URL}/developer/api/send_message`. Single-recipient clamp active. | Needs validation in mock mode until live Pro subscription is purchased. | Maintain `PROVIDER_MODE=mock` and single-recipient clamp to `+91 91756 35165`. |
| **8. Follow-Up Scheduler** | `src/lib/followup-engine.ts` with D0, D1, D3, D7, D10, D15 drip sequence. | Strict stop conditions: opt-out, customer reply, human handoff, terminal lead status. | Live scheduling must remain guarded against bulk dispatch. | Ensure scheduler runs in mock mode with TRAI window validation (9 AM - 9 PM IST). |
| **9. Opt-Out Suppression** | `src/lib/optout-engine.ts` supporting English, Marathi, Hindi keywords. | Keyword match immediately withdraws consent, sets `isOptedOut=true`, cancels pending follow-ups. | Inbound after opt-out must not reactivate marketing consent automatically. | Verify inbound message from opted-out contact is saved to Inbox without altering opt-out status. |
| **10. Campaign Engine** | `/api/campaigns/schedule`, `/api/contacts/bulk-message`. | Draft campaign creation with loan category audience filtering. | Bulk broadcast must remain strictly disabled. | Enforce `BULK_BROADCAST_ENABLED=false` and draft-only campaign states. |
| **11. Voice Calling** | `src/lib/omnidim.ts` (Agent IDs: Marathi `229425`, English `228450`). | Integration ready, calls disabled pending wallet recharge. Webhook callback configured. | Provider recharge required before live telephony activation. | Keep `OMNIDM_LIVE_ENABLED=false` until owner funds wallet. |
| **12. Delivery Tracking** | WebhookInbox `STATUS_UPDATE` handling via worker. | Maps delivery callbacks to `SENT`, `DELIVERED`, `READ`, `FAILED`. Logs timestamps and failure reasons. | Unrecognized statuses must not corrupt database records. | Safely map unknown status strings to canonical `UNKNOWN`. |

---

## 3. Configuration Inventory (Safe Redacted Audit)

| Variable Name | Purpose | Target Provider | Required / Optional | Active State | Runtime Verified |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `MONGODB_URI` | Production Database Connection | MongoDB Atlas | Required | Configured | Verified (ReplicaSet Primary) |
| `CHATMITRA_API_KEY` | Developer REST API Authorization | ChatMitra | Required for Live Pro | Configured (`aa61...9900`) | Verified in Health API |
| `CHATMITRA_WEBHOOK_SECRET` | HMAC-SHA256 Inbound Webhook Signing | ChatMitra | Required | Configured | Verified (HTTP 401 on forged) |
| `CHATMITRA_VERIFY_TOKEN` | GET Webhook Handshake Verification | ChatMitra | Required | Configured | Verified (HTTP 200 on handshake) |
| `META_APP_SECRET` | Meta WABA HMAC Webhook Signing | Meta Cloud API | Required | Configured | Verified (Strict Mode Active) |
| `META_PHONE_NUMBER_ID` | Sender Identification (`+91 72491 08474`) | Meta WABA | Required | Configured (`1147494668457940`) | Verified in Health API |
| `STRICT_META_WEBHOOK_VERIFICATION` | Enforces Cryptographic Validation | Meta Gateway | Required | Configured (`true`) | Verified |
| `PROVIDER_MODE` | Global Safety Switch (mock vs live) | System-wide | Required | Enforced (`mock`) | Verified |
| `BULK_BROADCAST_ENABLED` | Bulk Messaging Safety Switch | Campaign Engine | Required | Enforced (`false`) | Verified |
| `INTERNAL_WORKER_SECRET` | Background Worker Authorization | Internal Queue | Required | Configured | Verified (HTTP 401 on unauthorized) |
| `GEMINI_API_KEY` | Generative AI Advisory Engine | Google AI | Required | Configured (`AIza...WMlU`) | Verified |
| `CHATMITRA_INBOUND_AUTO_REPLY_ENABLED`| Inbound Autonomous AI Auto-Reply | ChatMitra | Required | Defaulted (`false`) | Verified (Human Live Chat Safe) |
| `OMNIDM_LIVE_ENABLED` | Voice Telephony Telecommunication | OmniDM | Optional | Enforced (`false`) | Verified (Pending Recharge) |

---

## 4. Conclusion & Audit Sign-Off

The baseline audit confirms that the core CRM infrastructure is sound, zero credentials are leaked, and fail-closed security guards are operating. Identified gaps in status normalization, worker retry lease claims, and opt-out inbound protection have been targeted for definitive remediation in Checkpoint CP-23.
