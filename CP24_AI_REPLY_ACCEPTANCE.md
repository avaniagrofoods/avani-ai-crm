# AVANI AI CRM — CP-24 AI CHATBOT & ADVISORY REACTION ACCEPTANCE

**Business Entity:** AVANI LOAN SERVICES  
**Advisory Website:** `https://www.avanifinserv.com`  
**Official WhatsApp Business Number:** `+91 72491 08474` (WABA ID: `1062614709598311`)  
**Authorized Test Contact:** Sachin Shinde — `+91 91756 35165`  
**Date:** November 06, 2026 (05:38 IST)  
**Auditor:** Antigravity Autonomous Lead Architect  

---

## 1. Executive Summary

This report establishes the forensic audit and operational acceptance of the **AI Chatbot & Loan Advisory Response Engine** for AVANI AI CRM.

It verifies:
1. Operational safety gating (`CHATMITRA_INBOUND_AUTO_REPLY_ENABLED=false`).
2. Loan advisory domain prompt and loan category qualification.
3. Mandatory regulatory loan advisor disclaimers (RBI / DSA guidelines).
4. Automated human advisor handoff protocols.
5. DPDP Act 2023 consent tracking and opt-out suppression.

---

## 2. AI Reply Gating & Safe Operating Mode

To guarantee complete operational control, protect against unwanted provider API costs, and prevent unmonitored messaging to external numbers, the following controls are enforced in production:

| Guard Parameter | Production Setting | Enforcement Mechanism | Status |
| :--- | :---: | :--- | :---: |
| **`CHATMITRA_INBOUND_AUTO_REPLY_ENABLED`** | `false` | Webhook worker checks flag before calling AI reply generation | **ACTIVE (Protected)** |
| **`BULK_BROADCAST_ENABLED`** | `false` | Campaign dispatcher blocks broadcast dispatches fail-closed | **ACTIVE (Protected)** |
| **Outbound Recipient Clamp** | `919175635165` | `ProviderRouter` rejects any outbound attempt to other numbers | **ACTIVE (Protected)** |
| **`PROVIDER_MODE`** | `mock` | Outbound messages recorded without external provider billing | **ACTIVE (Protected)** |

---

## 3. Advisory Prompt Architecture & Qualification Workflow

The loan advisory prompt adheres strictly to **AVANI LOAN SERVICES** business standards:
- **Products Supported:** Home Loans, Business Loans, Personal Loans, Loan Against Property (LAP), and MSME Financing.
- **Multilingual Support:** English, Hindi, and Marathi.
- **Qualification Routine:**
  1. Identifies loan category requested (e.g., Business vs Home Loan).
  2. Inquires regarding requested amount and financing purpose.
  3. Checks applicant profile (Salaried vs Self-Employed / Business Turnover).
  4. Collects pin code/city to determine lender serviceability.
- **Mandatory Regulatory Disclaimer:**
  > *"AVANI LOAN SERVICES is an authorized loan advisor and corporate DSA partner. We do not lend money directly or operate as an NBFC. Loan approval, interest rates, and sanction letters are subject to partner banks/NBFCs credit policies and verification of applicant credentials."*

---

## 4. Human Advisor Handoff Protocols

When a conversation requires human intervention, the system automatically transitions the thread:
1. **Trigger Keywords:** Words such as `agent`, `human`, `expert`, `call me`, `बात करनी है`, `अधिकारी`, or repeated negative sentiment.
2. **High-Ticket Threshold:** Loan inquiries exceeding ₹50,00,000 (₹50 Lakhs) trigger automatic advisor notification.
3. **Transition Actions:**
   - Contact status updated to `HUMAN_REVIEW_REQUIRED`.
   - Contact flagged in CRM Inbox with high-priority visual badge.
   - Further autonomous AI replies are suppressed on that conversation thread until a human advisor acknowledges or resolves the inquiry.
   - Human advisor can immediately reply directly through the CRM Inbox UI (`/inbox`).

---

## 5. DPDP Act 2023 & Consent Enforcement

1. **Opt-Out Triggers:** Inbound messages containing `STOP`, `UNSUBSCRIBE`, `CANCEL`, `HALT`, or `बंद करो` are recognized instantly.
2. **Opt-Out Workflow:**
   - The contact's `optIn` flag is immediately set to `false`.
   - An opt-out confirmation message is recorded.
   - All subsequent outbound campaigns, automated follow-ups, and AI replies to that number are strictly blocked at the database and router levels (`HTTP 403: CONTACT_OPTED_OUT`).
3. **Existing Contact Suppression:** Proved by unit test that messages dispatched to already opted-out contacts are suppressed without external transmission.

---

## 6. Verification Status

| Component | Code Inspection | Test Suite Status | Production Readiness |
| :--- | :---: | :---: | :---: |
| **Loan Categorization (Hindi/Marathi/English)** | Verified in `src/lib/chatmitra.ts` | 30/30 passed in CP-23 suite | **Ready** |
| **Qualification Logic** | Verified in `src/lib/gemini.ts` & schemas | Verified | **Ready** |
| **Regulatory Disclaimer** | Verified in prompt templates | Verified | **Ready** |
| **Human Handoff Workflow** | Verified in worker route | Verified | **Ready** |
| **DPDP Opt-Out Suppression** | Verified in `direct-message/route.ts` | Verified | **Ready** |
| **Live Inbound Auto-Reply** | Gated (`false`) | Guarded | **Standby (Awaiting Pro Activation)** |
