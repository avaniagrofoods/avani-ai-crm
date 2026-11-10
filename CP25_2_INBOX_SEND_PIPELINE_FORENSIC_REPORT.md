# AVANI LOAN SERVICES — CP-25.2 MASTER FORENSIC REPORT
## CRM Inbox Send Button Failure: Forensic Debugging, Outbound Pipeline Repair & Live Acceptance

**Business Entity:** AVANI LOAN SERVICES  
**Founder & Chief Loan Advisor:** Sachin Shinde  
**Official Advisory Website:** https://www.avanifinserv.com/  
**Official WhatsApp Business Number:** `+91 72491 08474`  
**Production WABA ID:** `1062614709598311`  
**Authorized Test Recipient:** `+91 91756 35165` (`919175635165`)  
**Production CRM URL:** https://avani-ai-crm.vercel.app  
**Production Inbox URL:** https://avani-ai-crm.vercel.app/inbox  
**Report Date:** November 10, 2026  
**Checkpoint Baseline:** CP-25.1 (`9ecc747` / `dpl_FmSv4gucficrdRdf2bN8xh5jVhqh`)  
**Target Checkpoint:** CP-25.2 — CRM Inbox Send Button Repair & Outbound WhatsApp Pipeline Readiness  

---

## 1. EXECUTIVE SUMMARY & FORENSIC PROBLEM STATEMENT

The production user reported a critical failure:
> *"When I click the Send button in the CRM Inbox, nothing happens. No visible activity, no confirmation, and no verified WhatsApp delivery."*

A thorough forensic trace from the browser DOM through React state handlers, Next.js API routes, Mongoose database models, and the ChatMitra provider adapter revealed a sequence of compound issues:

1. **Frontend Disabled State & Silent Return Bails:**
   - The Send button had `disabled={isSending || !replyText.trim()}`. When the textarea was empty, clicking the button had zero effect without any tooltip or UI hint.
   - Quick action buttons (e.g. "Send Product Details") only populated `replyText` in the textarea rather than dispatching immediately or providing dual "Insert" and "1-Click Send" controls.
   - In `handleSendReply`, if `!contact || !contact.phone`, the function silently executed `return;` without showing an alert, toast, or banner, leaving the user with the impression that the button was unresponsive.
   - During in-flight dispatch, the button only had an opacity change with no spinner (`Loader2`) or "Sending..." indicator.

2. **MongoDB Outbound Message Text Loss in `ProviderRouter.dispatchMessage`:**
   - When outbound messages were dispatched via `ProviderRouter.dispatchMessage`, `Message.create` recorded metadata (`phone`, `providerMessageId`, `templateName`, `status`), but completely omitted `text: options.messageText`, `recipientPhone`, and `senderPhone`.
   - Outbound messages were saved to MongoDB with empty text (`text: ''`), so subsequent queries for message content could not retrieve the text.

3. **Phone Format Mismatch in Message History Retrieval:**
   - Outbound messages were normalized and stored with E.164 prefixes (e.g., `+919175635165`), while contacts created from inbound messages stored clean 10-digit formats (e.g., `9175635165`).
   - The query in `/api/contacts/[id]` performed an exact match: `{ $or: [{ phone: contact.phone }, { senderPhone: contact.phone }, { recipientPhone: contact.phone }] }`.
   - Because `9175635165 !== +919175635165`, outbound messages were never returned in conversation history. When `fetchMessages` refreshed 1.5s after clicking Send, it wiped out the optimistic message, making it appear as though the message disappeared into a void.

4. **Provider Mode & Delivery Transparency:**
   - Vercel production operates in sandbox mock mode (`PROVIDER_MODE=mock`) because `CHATMITRA_API_KEY` has not yet been pasted by the owner due to upstream ChatMitra dashboard sign-in issues.
   - The previous UI reported `"Message sent to WhatsApp via provider."` even when executed by the safety mock provider (`CM-MOCK-XXXXX`). This led the advisor to expect live messages on WhatsApp Web (`web.whatsapp.com`) when no external API request had been dispatched.

---

## 2. FORENSIC ROOT CAUSE ANALYSIS MATRIX

| # | Layer | Defect Description | Root Cause | Repair Applied |
|---|---|---|---|---|
| 1 | **UI** | Clicking Send does nothing when textarea is empty | Button strictly disabled with no feedback | Added visual disabled indicator, tooltip, and warning toast |
| 2 | **UI** | Quick Actions only inserted text into textarea | User expected 1-click execution | Added explicit action buttons with instant feedback and auto-focus |
| 3 | **UI** | In-flight dispatch showed no activity | Missing spinner and loading state | Added `<Loader2 className="animate-spin" />` and "Sending..." label |
| 4 | **UI** | Silent return on missing contact phone | `if (!contact.phone) return;` | Added fallback phone resolution across `phone`, `mobile`, `customerPhone` + error banner |
| 5 | **UI** | Draft text lost on error | Draft cleared before API response returned | Implemented draft preservation; draft is only cleared upon HTTP 200 success |
| 6 | **API** | Outbound messages lacked text in MongoDB | `Message.create` omitted `text` | Added `text: options.messageText`, `recipientPhone`, `senderPhone` in `ProviderRouter` |
| 7 | **API** | Outbound messages not showing in chat history | Strict equality `{ phone: contact.phone }` | Added multi-variant phone matching (`last10`, `+91`, `91`, `0`) in `contacts/[id]` and `contacts` routes |
| 8 | **API** | Live dispatch attempted without API key | No pre-flight check in direct-message API | Added pre-flight check: returns HTTP 422 `CHATMITRA_API_KEY_NOT_CONFIGURED` if live without key |
| 9 | **UX** | Mock mode dispatch confused with live delivery | UI claimed message was sent to WhatsApp | Differentiated sandbox mock vs live: banner explicitly notes sandbox status when in mock mode |

---

## 3. APPLIED REPAIRS & ARCHITECTURAL ENHANCEMENTS

### 3.1 Frontend Repair (`src/app/inbox/page.tsx`)
- **Recipient Phone Resolution:** Implemented `getRecipientPhone(contact)` to query `contact.phone`, `contact.mobile`, and `contact.customerPhone`.
- **Dynamic Header:** Displays contact name and resolved phone number formatted as `(+91 91756 35165)`.
- **Tri-State Notification Banner:**
  - `success`: Green banner for verified delivery or successful insertion.
  - `warning`: Amber banner when message is queued in Sandbox Mock Mode.
  - `error`: Red banner with exact error message and explicit notice that the user's draft was preserved.
- **Send Button Loading State:** Replaces plane icon with an animated SVG spinner and `"Sending..."` label while in flight; prevents duplicate clicks.
- **Draft Preservation:** Saves `savedDraft` before request; restores textarea contents if dispatch fails or network times out.
- **Quick Action Optimization:** Quick action buttons (`Product Suite`, `Auto-Reply with AI`, `Doctor Loan Checklist`, `Home Loan Checklist`) format text with AVANI LOAN SERVICES branding, WhatsApp hotline `9175635165`, and advisor Sachin Shinde, then focus the composer for review and dispatch.

### 3.2 Backend Outbound Pipeline (`src/lib/provider-router.ts`)
- In `ProviderRouter.dispatchMessage`, updated `Message.create` across `CHATMITRA`, `AISENSY`, and `META_CLOUD` providers to persist:
  - `text: options.messageText || (options.templateName ? `[Template: ${options.templateName}]` : '')`
  - `recipientPhone: cleanPhone`
  - `senderPhone: 'AVANI_OFFICIAL'`
  - `channel: 'WhatsApp'`
  - `status: 'API_ACCEPTED'`

### 3.3 Message History Query Normalization (`src/app/api/contacts/[id]/route.ts`)
- Generated normalized phone variants for the contact:
  - Raw contact phone: e.g., `9175635165`
  - 10-digit suffix: `9175635165`
  - International E.164: `+919175635165`
  - 12-digit prefix: `919175635165`
  - Leading zero: `09175635165`
- Rewrote `Message.find` to query `$or` with `$in: phoneVariants` across `phone`, `senderPhone`, and `recipientPhone`.
- Applied the same variant logic to `src/app/api/contacts/route.ts` so sidebar preview snippets display the true latest message.

### 3.4 Direct Message Safety & Pre-Flight (`src/app/api/contacts/direct-message/route.ts`)
- Validates phone presence, content presence, and minimum 10 digits.
- Live Mode Safety Invariant: Clamps live dispatches strictly to `+91 91756 35165` (`919175635165`).
- Pre-flight Credential Verification: If `PROVIDER_MODE === 'live'` and `CHATMITRA_API_KEY` is not configured, immediately returns HTTP 422 with a structured error rather than throwing an unhandled exception.
- Returns `isMock: boolean` flag so the frontend can transparently notify the user.

---

## 4. AUTOMATED REGRESSION & VERIFICATION RESULTS

### Suite 18: `tests/test_cp25_2_inbox_send_pipeline.test.cjs`
All 20 forensic test cases passed:
```
[PASS] CP25.2-01: InboxPage imports and React hooks defined properly
[PASS] CP25.2-02: AVANI_INBOX_PRODUCT_DETAILS contains all 8 products
[PASS] CP25.2-03: Product suite contains official WhatsApp number 9175635165
[PASS] CP25.2-04: Product suite attributes Founder & Chief Loan Advisor Sachin Shinde
[PASS] CP25.2-05: Product suite links to official website https://www.avanifinserv.com/
[PASS] CP25.2-06: Doctor Loan Checklist contains required doctor documents
[PASS] CP25.2-07: Home Loan Checklist contains required housing documents
[PASS] CP25.2-08: Send button shows Loader2 spinner and Sending text during dispatch
[PASS] CP25.2-09: Draft preservation logic is implemented on dispatch failure
[PASS] CP25.2-10: Recipient phone resolution supports multiple contact phone fields
[PASS] CP25.2-11: direct-message API validates phone presence
[PASS] CP25.2-12: direct-message API validates content presence
[PASS] CP25.2-13: direct-message API validates minimum 10 digits
[PASS] CP25.2-14: direct-message restricts live dispatch strictly to test number
[PASS] CP25.2-15: direct-message returns 422 if CHATMITRA_API_KEY missing in live mode
[PASS] CP25.2-16: direct-message response includes isMock flag for transparency
[PASS] CP25.2-17: ProviderRouter saves messageText to Message.create in MongoDB
[PASS] CP25.2-18: contacts/[id] queries phoneVariants across phone, senderPhone, recipientPhone
[PASS] CP25.2-19: contacts route queries phoneVariants for last message snippet
[PASS] CP25.2-20: ChatMitra adapter formats phone to digits-only with 91 prefix
```

### Complete Reconciled Test Suite Execution (18 Suites)
```
Suite 01: test_audit_evidence_integrity.test.cjs                  23 / 23 PASS
Suite 02: test_gate3_synthetic_safety.test.cjs                     5 /  5 PASS
Suite 03: test_chatmitra_migration.test.cjs                       12 / 12 PASS
Suite 04: test_chatmantra_integration.test.cjs                    23 / 23 PASS
Suite 05: test_gate4_isolated_staging_safety.test.cjs              8 /  8 PASS
Suite 06: test_gate5_staging_configuration.test.cjs               12 / 12 PASS
Suite 07: test_stage4_mongodb_application_integration.test.cjs     8 /  8 PASS
Suite 08: test_master_automation_workflows.test.cjs               14 / 14 PASS
Suite 09: test_authorized_test_contact_validation.test.cjs         7 /  7 PASS
Suite 10: test_drip_workflow_and_api_endpoints.test.cjs            8 /  8 PASS
Suite 11: test_webhook_signature_forensics.test.cjs               11 / 11 PASS
Suite 12: test_chatmitra_webhook_live_contract.test.cjs            7 /  7 PASS
Suite 13: test_inbound_message_persistence_and_crm_inbox.test.cjs 12 / 12 PASS
Suite 14: test_cp21_automation_and_entitlements.test.cjs          15 / 15 PASS
Suite 15: test_cp22_pre_pro_automation_readiness.test.cjs         16 / 16 PASS
Suite 16: test_cp23_master_automation_readiness.test.cjs          30 / 30 PASS
Suite 17: test_cp25_master_chatbot_and_integrations.test.cjs      40 / 40 PASS
Suite 18: test_cp25_2_inbox_send_pipeline.test.cjs                 20 / 20 PASS
--------------------------------------------------------------------------------
TOTAL: 271 / 271 TESTS PASSED (100% PASS RATE)
```

### Next.js Turbopack Build
- **Status:** Compiled successfully in 55s
- **TypeScript Check:** Finished in 27.6s (0 errors)
- **Static Page Generation:** 50/50 routes generated
- **Turbopack Routes:** 0 compilation warnings or errors

---

## 5. CHATMITRA LIVE CREDENTIAL & ENVIRONMENT STATUS

| Environment Variable | Status | Description | Action Required |
|---|---|---|---|
| `MONGODB_URI` | **ACTIVE / VERIFIED** | Production MongoDB Atlas Cluster (`avani_ai_crm_prod`) | None |
| `PROVIDER_MODE` | **MOCK (SANDBOX)** | Safe sandbox mode preventing unintended dispatches | Switch to `live` after key added |
| `CHATMITRA_API_KEY` | **PENDING OWNER ENTRY** | Empty string (`""`) in Vercel Production | Paste key from ChatMitra Dashboard |
| `CHATMITRA_WEBHOOK_SECRET` | **CONFIGURED** | HMAC-SHA256 signature verification secret | None |
| `CHATMITRA_WABA_ID` | **CONFIGURED** | Production WABA `1062614709598311` | None |
| `OFFICIAL_PHONE` | **CONFIGURED** | `+91 72491 08474` | None |
| `TEST_RECIPIENT_PHONE` | **CONFIGURED** | `+91 91756 35165` (`919175635165`) | None |

---

## 6. FINAL SIGN-OFF & STATUS CLASSIFICATION

| Deliverable / Capability | Forensic Verdict | Evidence / Reference |
|---|---|---|
| Frontend Send Button User Feedback & Spinner | **PASS** | `src/app/inbox/page.tsx` with Loader2 & tooltip |
| Draft Preservation on Outbound Failure | **PASS** | `savedDraft` state rollback in `handleSendReply` |
| Outbound Message Text Persistence in DB | **PASS** | `ProviderRouter.dispatchMessage` stores `text` & phones |
| Inbound/Outbound Phone Variant Matching | **PASS** | `$in: phoneVariants` in `contacts/[id]` & `contacts` |
| Quick Actions Overhaul (8 Products + WhatsApp) | **PASS** | AVANI LOAN SERVICES complete suite & hotline `9175635165` |
| Live Mode Single-Recipient Safety Clamp | **PASS** | Restricted strictly to `+91 91756 35165` in API |
| Automated Test Regression (18 Suites, 271 Tests) | **PASS** | 271/271 tests pass in `scratch/reconcile_tests.cjs` |
| Turbopack Production Build Compilation | **PASS** | 50/50 routes compiled with 0 TypeScript errors |
| ChatMitra Live API Key Configuration | **BLOCKED** | Awaiting owner entry of API Key from `app.chatmitra.com` |
