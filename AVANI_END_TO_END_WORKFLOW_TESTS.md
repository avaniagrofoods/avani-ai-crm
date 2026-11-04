# AVANI LOAN SERVICES — END-TO-END AUTOMATION WORKFLOW VERIFICATION & TEST REPORT

**Audit Date:** 01 November 2026  
**Execution Timestamp:** 2026-11-01T23:35:00+05:30 (Asia/Kolkata / IST)  
**Business Entity:** AVANI LOAN SERVICES  
**Workspace:** `C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM`  
**Test Suite:** `tests/test_master_automation_workflows.test.cjs` (14/14 PASS)  
**Total Reconciled Suite:** 105 automated tests passing (100% PASS rate across 8 test suites)  

---

## 1. WORKFLOW AUDIT MATRIX

| Workflow | Focus Area | Tested Scenarios | Execution Outcome | Evidence & Test File |
| :---: | :--- | :--- | :---: | :--- |
| **Workflow A** | **Website Lead to CRM** | - 8 loan products canonicalization<br>- Indian mobile validation (`/^[6-9]\d{9}$/`)<br>- DPDP Act consent enforcement<br>- Canonical lead ID (`AVL-YYYYMMDD-XXXXXX`)<br>- Idempotent deduplication by phone/key | **PASS (VERIFIED)** | `tests/test_master_automation_workflows.test.cjs`<br>Tests A1, A2, A3, A4, A5 |
| **Workflow B** | **WhatsApp Conversation** | - Inbound HMAC-SHA256 signature verification<br>- Rejection of tampered payloads<br>- Replay protection & deduplication via WebhookInbox<br>- Opt-out keyword suppression (`STOP`, `UNSUBSCRIBE`) | **PASS (VERIFIED)** | `tests/test_master_automation_workflows.test.cjs`<br>Tests B1, B2, B3, B4 |
| **Workflow C** | **AI Agent & Human Handoff** | - Anti-hallucination compliance guards<br>- Prohibition of guaranteed approvals or fixed rate promises<br>- Prohibition of CIBIL repair claims<br>- Automatic human advisor handoff trigger | **PASS (VERIFIED)** | `tests/test_master_automation_workflows.test.cjs`<br>Tests C1, C2 |
| **Workflow D** | **Campaigns & Follow-ups** | - D0, D1, D3, D7, D10, D15 nurturing schedule<br>- Dynamic suppression of opted-out leads<br>- Rate limit send-window guards | **PASS (VERIFIED)** | `tests/test_master_automation_workflows.test.cjs`<br>Tests D1, D2 |
| **Workflow E** | **AI Voice Calling** | - Hard safety killswitch (`OMNIDM_LIVE_ENABLED=false`)<br>- Rejection of unauthorized outbound calling<br>- Status reported as `READY_DISABLED` | **PASS (VERIFIED)** | `tests/test_master_automation_workflows.test.cjs`<br>Test E1 |

---

## 2. DETAILED WORKFLOW SPECIFICATIONS & VERIFICATION

### Workflow A: Website Lead to CRM (8 Loan Products)
1. **Intake Route:** `POST /api/leads` on `https://avani-ai-crm.vercel.app`.
2. **Products Verified:**
   - Personal Loan (`PERSONAL_LOAN`)
   - Business Loan (`BUSINESS_LOAN`)
   - Doctor Loan (`DOCTOR_LOAN`)
   - Home Loan (`HOME_LOAN`)
   - Mortgage Loan / Loan Against Property (`MORTGAGE_LOAN`)
   - Education Loan — India (`EDUCATION_LOAN_INDIA`)
   - Education Loan — Global Studies (`EDUCATION_LOAN_GLOBAL`)
   - School and College Owners Funding (`SCHOOL_COLLEGE_FUNDING`)
3. **DPDP Act Compliance:**
   - Rejects lead intake with HTTP 403 if `consentStatus === 'DENIED'` or `consent === false`.
   - Records `consentTimestamp` and `consentPurpose`.
4. **Idempotency & Deduplication:**
   - Normalizes mobile to E.164 (`+91XXXXXXXXXX`).
   - Checks existing lead record; updates metadata without creating duplicate lead IDs or overwriting historical notes.
   - Lead ID format: `AVL-YYYYMMDD-XXXXXX`.

### Workflow B: WhatsApp Customer Conversation
1. **Inbound Endpoint:** `POST /api/chatmitra-webhook`.
2. **Signature Verification:**
   - Calculates `HMAC-SHA256(rawBody, CHATMITRA_WEBHOOK_SECRET)`.
   - Uses `crypto.timingSafeEqual` to eliminate timing attack vectors.
   - Rejects missing, invalid, or tampered signatures with HTTP 401.
3. **Replay Deduplication:**
   - Stores `messageId` in `WebhookInbox` collection.
   - Duplicate message deliveries are acknowledged with HTTP 200 without triggering redundant AI or downstream dispatches.
4. **Opt-Out Suppression:**
   - Detects `STOP`, `UNSUBSCRIBE`, `OPT OUT`, `DONOTDISTURB`.
   - Flags contact as `isOptedOut: true` and halts all automated nurturing.

### Workflow C: AI Agent & Human Advisor Handoff
1. **Advisory Boundaries:**
   - Anti-hallucination guard strictly forbids promising:
     * 100% approval or instant guaranteed sanction.
     * Fixed interest rates not verified by lender sanction letters.
     * CIBIL score repair or deletion of negative credit history.
2. **Human Handoff Triggers:**
   - Complex inquiries (legal disputes, complaints, bankruptcy, custom negotiations) immediately escalate to human loan advisor:
     * Assigned Advisor: **Sachin Shinde** (`enquiry@avanifinserv.com`).
   - Stops AI responses on escalated threads to prevent conflicting communications.

### Workflow D: Campaigns & Scheduled Follow-ups
1. **Lifecycle Cadence:**
   - **D0:** Instant welcome message + canonical loan brochure.
   - **D1:** Eligibility documentation checklist.
   - **D3:** Product benefits and tenure comparison.
   - **D7:** Advisor check-in and application support.
   - **D10:** Document upload reminder.
   - **D15:** Application status update & inquiry closure notice.
2. **Suppression Enforcement:**
   - Prior to dispatch, campaign engine verifies `isOptedOut === false` and `PROVIDER_MODE=mock`.

### Workflow E: Voice AI Calling (Hard Killswitch)
1. **Provider Status:** OmniDM / Vapi integration.
2. **Safety Killswitch:** `OMNIDM_LIVE_ENABLED=false` strictly enforced in code and environment.
3. **Endpoint Response:** Live `/api/health` reports:
   ```json
   "omniDM": {
     "status": "READY_DISABLED",
     "liveEnabled": false,
     "agentId": "229425",
     "notice": "OmniDM integration READY — live calling disabled pending recharge."
   }
   ```
4. **Zero Live Calls:** No calls can be placed without explicit owner recharge and authorization.
