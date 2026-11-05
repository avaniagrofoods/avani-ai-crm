# AVANI AI CRM — CP-21 AUTOMATION WORKFLOW MATRIX

**Business:** AVANI LOAN SERVICES  
**Founder & Business Owner:** Sachin Shinde  
**Official WhatsApp Business (WABA):** `+91 72491 08474` (WABA ID: `1062614709598311`)  
**Advisory Website:** `https://www.avanifinserv.com`  
**Production CRM:** `https://avani-ai-crm.vercel.app`  
**Version:** 1.0.0 (CP-21 Hardened)  
**Date:** November 05, 2026  

---

## 1. Overview

This document specifies the end-to-end operational and technical architecture for the **5 core automation workflows** of AVANI LOAN SERVICES, fully operationalized under the **ChatMitra Pro Plan** with zero reliance on manual intervention for data capture, classification, qualification, and follow-up.

---

## 2. Workflow 1: Inbound Lead Capture

### A. Trigger & Ingestion
- **Event:** Inbound customer WhatsApp message to official WABA number `+91 72491 08474`.
- **Webhook Endpoint:** `POST /api/chatmitra-webhook`
- **Worker Execution:** Async invocation of `POST /api/whatsapp-webhook-worker`

### B. Inbound Payload Parsing & Field Normalization
1. **Phone Number:** Normalized to E.164 without prefix (`91XXXXXXXXXX`).
2. **Contact Upsert:** If contact does not exist in `Contact` collection:
   - `phone`: Normalized phone
   - `name`: Extracted from WhatsApp profile name or fallback `"Valued Client"`
   - `optedIn`: `true` (implicit consent through inbound initiation)
   - `tags`: `['WhatsApp Inbound', 'ChatMitra Lead']`
3. **Lead Upsert:**
   - `phone`: Contact phone
   - `fullName`: Contact name
   - `loanType`: Automatically classified via multilingual regex (`classifyLoanCategory(text)`)
   - `status`: `'NEW'` or `'IN_CONVERSATION'`
   - `consentStatus`: `'GRANTED'`
   - `consentPurpose`: `'LOAN_ADVISORY_AND_ASSISTANCE'`
   - `preferredLanguage`: Detected (`mr` for Marathi, `hi` for Hindi, `en` for English)
   - `city`: Extracted if mentioned (e.g., Pune, Mumbai, Nashik, Kolhapur)
4. **CRM Inbox Visibility:** Message saved to `Message` collection with status `'RECEIVED'` and linked to contact conversation history.

### C. Human Advisor Notification
- When a new lead is captured or customer asks for human assistance, an alert record is created with priority `HIGH` referencing advisor **Sachin Shinde** (`+91 72491 08474`).

---

## 3. Workflow 2: AI ChatBot Qualification (10 Canonical Loan Categories)

Every inbound chat is classified into one of AVANI LOAN SERVICES' **10 Canonical Loan Categories**. Each product flow contains:
1. **Qualification Questions** (Amount, purpose, tenure, city, income/turnover)
2. **Tailored Banking Document Checklist**
3. **Official Advisory Website Reference:** `https://www.avanifinserv.com`
4. **Mandatory Advisory Disclaimer:**
   > *"AVANI LOAN SERVICES is a registered loan advisory and consulting firm. We do not charge upfront sanction fees. Loan sanction and interest rates are determined by partner banks/NBFCs subject to credit policy and documentation."*
5. **Human Escalation:** Sachin Shinde (`+91 72491 08474`).

---

### Product Qualification Matrix

| # | Loan Product | Target Customer / Profile | Key Qualification Questions | Tailored Document Checklist | ChatMitra Template |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Personal Loan** | Salaried employees & individual professionals | 1. Monthly net take-home salary?<br>2. Current employer name?<br>3. Desired loan amount & tenure?<br>4. Any ongoing EMIs? | • PAN & Aadhaar Card<br>• Last 3 months payslips<br>• Last 6 months bank statement (salary)<br>• Form 16 / Appointment letter | `Avani_Loan_Welcome` |
| **2** | **Business Loan** | MSME owners, proprietors, private limited firms | 1. Annual business turnover?<br>2. Years in continuous business operations?<br>3. GST registered? Average monthly GST?<br>4. Funding requirement purpose? | • PAN & Aadhaar of all promoters<br>• Business registration (Udyam / GST / COI)<br>• 2 years ITR with computation & CA balance sheet<br>• Last 12 months current bank account statements | `business_loan_welcome` |
| **3** | **Doctor Loan** | MBBS, MD, BDS, BAMS, BHMS certified doctors | 1. Medical degree specialization & IMA/Council reg?<br>2. Clinic / hospital ownership or rental?<br>3. Purpose: clinic setup, equipment, working capital?<br>4. Desired funding amount? | • Medical Degree Certificates & State Council Reg<br>• KYC documents (PAN & Aadhaar)<br>• 2 years ITR with financial computations<br>• Last 12 months clinic/hospital bank statements | `doctor_loan_offer` |
| **4** | **CA Professional Loan** | ICAI member Chartered Accountants with COP | 1. ICAI COP vintage (years of practice)?<br>2. Audit firm structure (Proprietorship/Partnership)?<br>3. Gross receipts from practice?<br>4. Working capital or office purchase requirement? | • ICAI Certificate of Practice (COP)<br>• Membership certificate<br>• KYC of CA & firm registration<br>• Last 2 years ITR with profit & loss statement<br>• 12 months bank statement of CA practice | `ca_professional_loan_welcome` |
| **5** | **Home Loan** | Home buyers (flats, bungalows, resale, under-construction) | 1. Property location & estimated purchase value?<br>2. Resale or new builder flat?<br>3. Employment status: Salaried or Self-employed?<br>4. Down-payment contribution ready? | • KYC (PAN, Aadhaar)<br>• Income: 3 months payslips or 3 years ITR<br>• 6-12 months bank statements<br>• Property documents: Allotment letter, draft agreement, chain deeds | `home_loan_welcome` |
| **6** | **Mortgage Loan / LAP** | Residential / Commercial property owners | 1. Property type (residential flat, commercial shop, industrial)?<br>2. Clear title & OC available?<br>3. Market value vs required loan amount?<br>4. Purpose of loan against property? | • Title deeds & registered sale deed of property<br>• Sanction plan, OC/CC, property tax receipts<br>• KYC of all property co-owners<br>• 3 years financials / ITR & 12 months bank statements | `lap_loan_welcome` |
| **7** | **Education Loan — India** | Students pursuing higher education in India | 1. Course admitted to (Engineering, MBA, Medical, etc.)?<br>2. College name & NIRF / AICTE ranking?<br>3. Total fee structure & required funding?<br>4. Co-applicant (parent) monthly income? | • Student & Parent KYC (PAN & Aadhaar)<br>• College admission offer letter & fee structure<br>• 10th, 12th, graduation marksheets<br>• Co-borrower last 2 years ITR / payslips & 6 months bank statement | `education_loan_india_welcome` |
| **8** | **Education Loan — Global Studies** | Students admitted to overseas universities | 1. Destination country (USA, UK, Canada, Germany, Australia)?<br>2. University name, program & I-20 / CAS letter?<br>3. Total cost including tuition & living expenses?<br>4. Collateral or non-collateral preference? | • University admit letter & I-20 / CAS form<br>• GRE / IELTS / TOEFL scorecard<br>• Student & Co-borrower KYC<br>• Co-applicant 3 years ITR & 12 months bank statement<br>• Property documents (if applying for collateral loan) | `education_loan_abroad_welcome` |
| **9** | **School Funding** | Trust-run K-12, CBSE, ICSE, and State board schools | 1. Trust / Society registration vintage?<br>2. Total student enrollment & annual fee collection?<br>3. Purpose: new building, lab setup, bus fleet, refinancing?<br>4. Land ownership: owned by trust or leased? | • Trust deed / Society registration & 12A/80G certificates<br>• School affiliation certificate (CBSE / ICSE / State)<br>• Last 3 years audited balance sheets & income expenditure<br>• Student fee collection registers & 12 months bank statements<br>• Campus land documents | `school_owner_funding_welcome` |
| **10** | **College Funding** | Engineering, Medical, Polytechnic, Management colleges | 1. AICTE / UGC / NMC approval status?<br>2. Number of colleges/institutes under society?<br>3. Annual revenue from tuition & government grants?<br>4. Capital expenditure requirement & project report? | • Society / University trust deed & bylaws<br>• AICTE / UGC / State government approval letters<br>• Last 3 years audited financials with audit reports<br>• Detailed project report (DPR) for proposed expansion<br>• Title documents of institutional campus land | `college_funding_welcome` |

---

## 4. Workflow 3: Automated Drip Follow-Up (D0 to D15 Engine)

The Drip Automation Engine operates via a scheduled Vercel Cron invoking `POST /api/cron/process-drip`.

### Cadence & Rules
- **Day 0 (Immediate / within 1 hr):** Welcome message + Loan Category Identification + Overview of Advisory Services.
- **Day 1 (24 hours):** Eligibility check & basic inquiry (salary/turnover range).
- **Day 3 (72 hours):** Tailored document checklist delivery with secure submission guidelines.
- **Day 7 (168 hours):** Mid-stage follow-up; offering bank rate comparison and lender guidance.
- **Day 10 (240 hours):** Assistance for pending documents or lender queries.
- **Day 15 (360 hours):** Final advisory check-in before archiving; direct connection to Sachin Shinde.

### Mandatory Pre-Send Safety Gates
1. **Consent Gate:** Customer `consentStatus` must equal `'GRANTED'`.
2. **Opt-Out Check:** `optedIn` must be `true` and phone not in `SuppressionList`.
3. **Reply Stop Gate:** If customer has replied (`status === 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP'`), automated drip is **permanently halted** to prevent robotic collisions.
4. **TRAI Sending Window:** Dispatches only allowed between **09:00 AM and 09:00 PM IST**.
5. **Deduplication:** Message hash check ensures no identical template sent within 24 hours.
6. **Recipient Safety Clamp:** When `PROVIDER_MODE !== 'live'`, dispatch is clamped to authorized test contact `+91 91756 35165`.

---

## 5. Workflow 4: AI Voice Calling Readiness (OmniDM / CallKaro)

### A. Provider Clarification
- **ChatMitra Pro Plan:** WhatsApp Business API only (does **not** provide voice calling).
- **Voice Calling Engine:** Integrated via **OmniDM** (`src/lib/omnidim.ts` and `/api/omnidim-webhook`).

### B. Calling Architecture
- **Inbound Calling:** Customer calls AVANI helpline -> IVR greets in Marathi/English -> routes to AI agent for initial qualification -> live transfer to Sachin Shinde (`+91 72491 08474`).
- **Outbound Calling:** Triggered only after explicit customer opt-in for loan consultation.
  - Marathi Agent: Agent ID `229425`
  - English Agent: Agent ID `228450`
- **Call Disclosures:** Automatic opening statement informing the caller: *"This call may be recorded for quality and advisory verification purposes."*
- **CRM Sync:** Post-call webhook receives transcript, audio recording URL, sentiment, and summary, upserting them into `Lead` activity log.
- **Activation Prerequisite:** OmniDM wallet recharge (minimum ₹500 balance). Kept `liveEnabled: false` until explicit owner authorization.

---

## 6. Workflow 5: Campaigns & Analytics

1. **Broadcast API:** Controlled dispatch for pre-approved utility/marketing templates to segmented opt-in lists.
2. **UTM & Lead Source Attribution:** Tracks lead acquisition source (`Website`, `WhatsApp QR`, `Direct`, `Partner Referral`).
3. **Delivery & Read Tracking:** Real-time webhooks (`message.status.updated`) track `SENT` -> `DELIVERED` -> `READ` statuses in CRM analytics dashboard.
4. **Suppression Tracking:** Automatic tracking of opt-out rate. If opt-out exceeds 2%, campaign is automatically paused to protect WABA quality rating.

---

## 7. Granular Implementation Evidence Matrix (Workstream B Features 1–10)

| # | Feature Name | Source File & Function | Configuration Dependency | Test Case & Result | Production Endpoint / Screen | Actual Production Verification Evidence | Remaining Limitations |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Inbound WhatsApp Webhook Processing** | `src/app/api/chatmitra-webhook/route.ts` (`POST`), `src/app/api/whatsapp-webhook-worker/route.ts` (`POST`) | `CHATMITRA_WEBHOOK_SECRET`, `CHATMITRA_API_KEY`, `MONGODB_URI` | `test_cp21_automation_and_entitlements.test.cjs` (Test 1 & 10) — **PASS** | `POST /api/chatmitra-webhook`, `/webhooks` | Live unsigned request returns HTTP 401; 52+ ingested events logged in `WebhookInbox` with zero loops | Awaiting live user WhatsApp dispatch from test phone to verify provider-generated event delivery |
| **2** | **Contact & Lead Creation** | `src/app/api/whatsapp-webhook-worker/route.ts` (lines 122–160: `Lead.findOneAndUpdate`, `Contact.findOneAndUpdate`) | `MONGODB_URI`, `MessageSchema`, `LeadSchema`, `ContactSchema` | `test_cp21_automation_and_entitlements.test.cjs` (Test 2 & 3) — **PASS** | `/contacts`, `/leads`, `GET /api/contacts`, `GET /api/leads` | MongoDB Atlas `contacts` and `leads` collections upserted with phone normalization, default consent `GRANTED`, and valid enums | Lead creation relies on inbound phone number; email populated only upon explicit user submission |
| **3** | **Message Persistence & CRM Inbox Display** | `src/models/Message.ts` (enum `'RECEIVED'`), `src/app/api/contacts/[id]/route.ts` (`GET`), `src/app/api/contacts/route.ts` (`GET`) | `MONGODB_URI` | `test_cp21_automation_and_entitlements.test.cjs` (Test 14 & 15) — **PASS** | `/inbox`, `GET /api/contacts/[id]`, `GET /api/contacts` | Verified `GET /api/contacts` returns contacts with attached `lastMessage` preview; `/api/contacts/[id]` returns formatted `messages` array | Audio and document media render as descriptive placeholders (`[User uploaded document]`) pending media proxying |
| **4** | **Loan-Category Classification (10 Products)** | `src/lib/chatmitra.ts` (`classifyLoanCategory`), `src/lib/ai-agent.ts` (`extractEntities`) | None (Pure deterministic regex engine with multilingual dictionary) | `test_cp21_automation_and_entitlements.test.cjs` (Test 6 & 9) — **PASS** | Inbound worker `/api/whatsapp-webhook-worker`, Lead modal in `/leads` | Correctly maps 10 categories (Personal, Business, Doctor, CA Professional, Home, LAP, Education India, Education Abroad, School Funding, College Funding) with 0.88–0.95 confidence | Obscure slang falls back safely to Personal Loan with general welcome |
| **5** | **AI Chatbot in Isolated / Test Mode** | `src/lib/ai-agent.ts` (`generateLoanAgentResponse`, `extractEntities`, `getDocumentsForProfile`) | `GEMINI_API_KEY` / `AVANI_AI_AGENT_API_KEY` (Fallback: Deterministic Rule Engine) | `test_cp21_automation_and_entitlements.test.cjs` (Test 4) — **PASS** | `/assistant`, `/inbox`, `/api/whatsapp-webhook-worker` | Production `/api/health` reports `avaniAiAgent: HEALTHY` (`AIza...WMlU`). Safe test harness returns qualification prompt and checklist without hallucinations | Kept in isolated/mock mode (`AISENSY_INBOUND_WEBHOOK_ENABLED=false` and `PROVIDER_MODE=mock`) until explicit owner sign-off |
| **6** | **Human Advisor Handoff** | `src/app/api/whatsapp-webhook-worker/route.ts` (lines 268–278), `src/lib/ai-agent.ts` (`ADVISORY_DISCLAIMER`) | Environment variables `HUMAN_ESCALATION_PHONE: '+91 72491 08474'` | `test_cp21_automation_and_entitlements.test.cjs` (Test 5) — **PASS** | Lead status tag in `/leads` and notification badge in `/inbox` | Inbound reply immediately halts automated drip and sets `Lead.status: 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP'`, generating escalation alert to Sachin Shinde | SMS fallback notification to advisor requires external SMS gateway; currently notifications render in CRM dashboard |
| **7** | **Automated Follow-Up Workflow (D0–D15)** | `src/lib/follow-up.ts` (`FollowUpEngine`), `src/app/api/cron/process-drip/route.ts` (`POST`), `src/app/api/cron/follow-ups/route.ts` (`GET`) | `CRON_SECRET`, `PROVIDER_MODE=mock`, Vercel Cron jobs in `vercel.json` | `test_cp21_automation_and_entitlements.test.cjs` (Test 12) — **PASS** | `/schedule`, `/api/cron/follow-ups`, `/api/cron/process-scheduled` | Cadence D0, D1, D3, D7, D10, D15 verified with pre-send checks (consent granted, opt-in active, TRAI window 9 AM – 9 PM IST) | Blocked outside 9:00 AM – 9:00 PM IST by TRAI compliance guard |
| **8** | **Consent & Opt-Out Enforcement** | `src/lib/opt-out.ts` (`OptOutEngine.isOptOutMessage`, `processOptOut`), `src/models/Opt.ts`, `src/app/api/opts/route.ts` | `MONGODB_URI` | `test_cp21_automation_and_entitlements.test.cjs` (Test 8) — **PASS** (English, Marathi "थांबवा/नको", Hindi "रोको/बंद करो") | `/opts`, `GET /api/opts`, `POST /api/contacts/direct-message` (returns 403 Forbidden on opted-out contacts) | Production `/api/opts` returns HTTP 200 with suppression lists; test dispatches to opted-out numbers return HTTP 403 Forbidden live | Re-opt-in requires explicit inbound keyword `"START"` or manual reactivation by admin |
| **9** | **Campaign Scheduling & Delivery Tracking** | `src/models/Schedule.ts`, `src/app/api/schedule/route.ts`, `src/app/api/campaigns/schedule/route.ts`, `src/lib/chatmitra.ts` (`sendChatMitraMessage`) | `MONGODB_URI`, `CRON_SECRET` | `test_cp21_automation_and_entitlements.test.cjs` (Test 12 & 15) — **PASS** | `/schedule`, `/campaigns`, `GET/POST/PUT/DELETE /api/schedule` | Full persistent CRUD verified live on production MongoDB Atlas; status updates (`SENT`, `DELIVERED`, `READ`) mapped to canonical enums | Bulk broadcasts disabled by safety policy (`BULK_BROADCAST_ENABLED=false`); scheduled dispatches execute in controlled batches |
| **10** | **Reporting & Conversion Analytics** | `src/app/api/broadcasts/[id]/stats/route.ts`, `src/app/api/leads/route.ts`, `src/app/api/contacts/route.ts` | `MONGODB_URI` | `tests/test_drip_workflow_and_api_endpoints.test.cjs` & `tests/test_stage4_mongodb_application_integration.test.cjs` — **PASS** | `/crm`, `/broadcasts`, `/leads`, `/dashboard` | Endpoints return aggregate counts, lead distribution across 10 categories, delivery rates, and opt-out percentages | Complex cohort lifetime value analytics calculate dynamically on page load; historical snapshots saved weekly |

