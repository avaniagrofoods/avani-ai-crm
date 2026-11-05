# AVANI AI CRM — CP-22 AUTOMATION READINESS MATRIX

**Business:** AVANI LOAN SERVICES  
**Founder & Business Owner:** Sachin Shinde  
**Official WhatsApp Business (WABA):** `+91 72491 08474` (WABA ID: `1062614709598311`)  
**Official Advisory Website:** `https://www.avanifinserv.com`  
**Production CRM:** `https://avani-ai-crm.vercel.app`  
**Version:** 2.0.0 (Pre-Pro Hardened)  
**Date:** November 05, 2026  

---

## 1. Overview

This readiness matrix establishes the full, subscription-independent automation architecture of AVANI AI CRM, prepared and verified prior to the planned ChatMitra Pro subscription purchase on **Monday, 09 November 2026**.

---

## 2. Subsystem A — Inbound Lead Capture Pipeline

### Pipeline Flow:
$$\text{WhatsApp Inbound} \longrightarrow \text{Provider Webhook} \longrightarrow \text{Webhook Worker} \longrightarrow \text{Contact} \longrightarrow \text{Lead} \longrightarrow \text{Conversation} \longrightarrow \text{Message} \longrightarrow \text{CRM Inbox}$$

### 11 Mandatory Lead Capture Fields:

| # | Field Name | Schema Path | Source / Logic | Validation / State |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Customer Name** | `Lead.name`, `Contact.name` | Extracted from WhatsApp profile or `"Valued Client"` | Sanitized string |
| **2** | **Phone Number** | `Lead.phone`, `Contact.phone` | Normalized E.164 (`91XXXXXXXXXX`) | Indexed & unique |
| **3** | **Lead Source** | `Lead.leadSource`, `Lead.source` | Set to `'WhatsApp Inbound'` / UTM tracking | Attribution tag |
| **4** | **Loan Category** | `Lead.loanType` | Classified via `classifyLoanCategory(text)` | One of 10 Canonical Products |
| **5** | **City / Location** | `Lead.city` | Extracted from inquiry text (e.g. Pune, Mumbai) | Geographic routing |
| **6** | **Employment Type** | `Lead.employmentType` | Salaried / Self-Employed / Business / Doctor / CA | Credit policy alignment |
| **7** | **Funding Requirement** | `Lead.requiredLoanAmount` | Numeric loan amount in INR | Qualification benchmark |
| **8** | **Customer Consent** | `Lead.consentStatus` | Default `'GRANTED'`, Purpose `'LOAN_ELIGIBILITY_PROCESSING'` | DPDP Act compliant |
| **9** | **Preferred Language** | `Lead.preferredLanguage` | Detected from Devanagari script (`Marathi`, `Hindi`, `English`) | Script recognition |
| **10** | **Follow-Up Status** | `Lead.followUpStatus`, `Lead.status` | Set to `'NEW'` or `'CUSTOMER_REPLIED_HUMAN_FOLLOWUP'` | State machine guard |
| **11** | **Assigned Advisor** | `Lead.assignedAgent` | Assigned to **Sachin Shinde** (`+91 72491 08474`) | Escalation target |

---

## 3. Subsystem B — AI Chatbot Preparation (10 Canonical Products)

### Product Flow Specifications (English, Marathi, Hindi):

| Product | Qualification Questions | Banking Document Checklist | Official Link | Approved Disclaimer & Escalation |
| :--- | :--- | :--- | :--- | :--- |
| **1. Personal Loan** | • Monthly net salary?<br>• Current employer?<br>• Required amount & tenure? | • PAN & Aadhaar Card<br>• Last 3 months payslips<br>• Last 6 months bank statement | [avanifinserv.com/personal-loan](https://www.avanifinserv.com) | Regulatory advisory disclaimer; human handoff to Sachin Shinde (+91 72491 08474) |
| **2. Business Loan** | • Annual turnover?<br>• Years in business?<br>• GST registered? Average GST? | • Udyam / GST Registration<br>• 2 years ITR with CA financials<br>• 12 months current bank statements | [avanifinserv.com/business-loan](https://www.avanifinserv.com) | No upfront fees; loan terms determined by partner banks; human review required |
| **3. Doctor Loan** | • Specialization & State Reg?<br>• Clinic ownership/rent?<br>• Equipment or expansion need? | • Degree & State Medical Council Reg<br>• KYC of doctor<br>• 2 years ITR & 12 months bank statements | [avanifinserv.com/doctor-loan](https://www.avanifinserv.com) | Professional advisory service; escalates to Sachin Shinde |
| **4. CA Professional Loan** | • ICAI COP vintage?<br>• Firm structure?<br>• Annual gross receipts? | • ICAI COP & Membership Certificate<br>• 2 years ITR with computation & P&L<br>• 12 months bank statement of CA practice | [avanifinserv.com/ca-loan](https://www.avanifinserv.com) | Professional advisory service; escalates to Sachin Shinde |
| **5. Home Loan** | • Property location & value?<br>• Builder or resale flat?<br>• Down-payment ready? | • KYC (PAN, Aadhaar)<br>• 3M payslips or 3Y ITR<br>• Draft agreement / chain deeds | [avanifinserv.com/home-loan](https://www.avanifinserv.com) | Bank sanction subject to legal/technical clearance |
| **6. Mortgage Loan / LAP** | • Property type (residential/comm)?<br>• Clear title & OC ready?<br>• Estimated market value? | • Property title deeds & sanction plan<br>• OC/CC & tax receipts<br>• 3 years audited financials & bank statements | [avanifinserv.com/lap](https://www.avanifinserv.com) | Loan against property advisory; human assessment |
| **7. Education Loan — India** | • Course name & college ranking?<br>• Total fee structure?<br>• Co-borrower (parent) income? | • College admission letter & fee structure<br>• 10th/12th/Grad marksheets<br>• Parent KYC, 2Y ITR & 6M bank statement | [avanifinserv.com/education-loan](https://www.avanifinserv.com) | Higher education financial guidance; no guarantee |
| **8. Education Loan — Global Studies** | • Destination country (US/UK/Canada)?<br>• University admit & I-20/CAS?<br>• Collateral available? | • University admit & I-20 / CAS letter<br>• GRE / IELTS scorecards<br>• Co-borrower 3Y ITR & property deeds (if collateral) | [avanifinserv.com/global-education](https://www.avanifinserv.com) | Overseas study funding; currency & visa compliance |
| **9. School Funding** | • Trust vintage & affiliation?<br>• Total student enrollment?<br>• Infrastructure requirement? | • Trust deed, 12A/80G, CBSE affiliation<br>• 3 years audited balance sheets<br>• Student fee collection registers & land papers | [avanifinserv.com/institutional](https://www.avanifinserv.com) | Institutional funding for educational trusts; human handoff |
| **10. College Funding** | • AICTE / UGC / NMC approval?<br>• Number of institutes under trust?<br>• Proposed expansion budget? | • AICTE/UGC approval letters<br>• 3 years audited financial statements<br>• Detailed Project Report (DPR) & campus deeds | [avanifinserv.com/institutional](https://www.avanifinserv.com) | Institutional capex advisory; high-ticket human review |

---

## 4. Subsystem C — Follow-Up Drip Automation (D0 to D15 Engine)

- **Schedule Cadence:** D0 (Immediate Welcome), D1 (Eligibility Check), D3 (Document Checklist), D7 (Mid-Stage Rate Guidance), D10 (Pending Docs Reminder), D15 (Final Outreach).
- **Enforced Safety Gates:**
  1. `consentStatus === 'GRANTED'`
  2. `optedIn === true` (suppresses if opted out)
  3. `status !== 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP'` (halts automatically on reply)
  4. TRAI sending window: **09:00 AM to 09:00 PM IST**.
  5. Idempotent hash check prevents duplicate template sends within 24 hours.
  6. **Mock Mode Protection:** Live scheduled sends remain disabled until explicit owner authorization.

---

## 5. Subsystem D — Campaign Management & Analytics

- **Broadcast Engine:** Template-based campaigns using pre-approved Meta utility/marketing templates.
- **UTM Tracking:** Attaches `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` to lead records.
- **Delivery Status:** Real-time webhooks map `SENT` -> `DELIVERED` -> `READ` -> `CUSTOMER_REPLIED`.
- **Conversion Tracking:** Calculates lead progression rates across all 10 loan categories.
- **Safety Pause:** Automated campaign pause if opt-out rate exceeds 2%.

---

## 6. Subsystem E — Human Advisor Operations

- **Shared Inbox:** Unified conversation threads in [`/inbox`](https://avani-ai-crm.vercel.app/inbox) showing contact profile, last message snippet, unread counter, and real-time chat bubbles.
- **Advisor Assignment:** Default routing to senior loan advisor **Sachin Shinde** (`+91 72491 08474`).
- **Audit Logging:** Every customer interaction, status transition, consent grant, and opt-out is recorded with timestamp and correlation ID.

---

## 7. Subsystem F — AI Calling Readiness (OmniDM Architecture)

- **Provider Distinction:** ChatMitra is exclusively a WhatsApp BSP. Voice calling is managed via **OmniDM** (`src/lib/omnidim.ts` and `/api/omnidim-webhook`).
- **Language Routing:** Marathi agent (`229425`), English agent (`228450`).
- **Disclosures:** Pre-recorded mandatory disclosure: *"This call may be recorded for advisory quality purposes."*
- **CRM Sync:** Post-call webhook receives audio recording URL, transcript, sentiment, and summary, updating `Lead.interactions`.
- **Activation Gate:** Kept `liveEnabled: false` pending ₹500 wallet recharge.
