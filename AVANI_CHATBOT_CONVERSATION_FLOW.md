# AVANI LOAN SERVICES — CHATBOT CONVERSATION FLOW SPECIFICATION

- **Business Entity:** AVANI LOAN SERVICES (`https://www.avanifinserv.com/`)
- **Primary WhatsApp Number:** `+91 72491 08474` (WABA ID: `1062614709598311`)
- **Engine Implementation:** [`src/lib/chatbot-flow-engine.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatbot-flow-engine.ts)
- **Checklist Engine:** [`src/lib/loan-checklists.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/loan-checklists.ts)

---

## 1. Architecture Diagram (Step 1 to Step 4 + 8 Loan Branches)

```mermaid
flowchart TD
    Start["Inbound WhatsApp Message to +91 72491 08474"] --> SecCheck{"Sensitive Data / PAN / Aadhaar / OTP in Chat?"}
    SecCheck -- "Yes" --> SecIntercept["Security Intercept: Warn Customer + Issue Signed Upload Link"]
    SecCheck -- "No" --> OptOutCheck{"STOP / UNSUBSCRIBE / DND?"}
    OptOutCheck -- "Yes" --> OptOut["Set consent_status=WITHDRAWN, Suppress All 6 Channels"]
    OptOutCheck -- "No" --> HandoffCheck{"Explicit Advisor Request?"}
    HandoffCheck -- "Yes" --> AdvisorHandoff["Human Advisor Handoff -> Sachin Shinde (+91 72491 08474)"]
    HandoffCheck -- "No" --> Step1["STEP 1: Welcome Message & Language Selection (English / मराठी / हिंदी) + Privacy Notice"]
    Step1 --> Step2A["STEP 2.1: Full Name (full_name)"]
    Step2A --> Step2B["STEP 2.2: Mobile Number Validation (E.164 +91XXXXXXXXXX)"]
    Step2B --> Step2C["STEP 2.3: Email Address Validation (email)"]
    Step2C --> Step2D["STEP 2.4: City / Location (city)"]
    Step2D --> Step2E["STEP 2.5: Applicant Category (Salaried / Self Employed / Business Owner / Professional)"]
    Step2E --> Step3["STEP 3: Monthly Income Range (5 Options incl. Prefer to discuss with an advisor)"]
    Step3 --> Step4A["STEP 4.1: Loan Requirement (11 Options)"]
    Step4A --> Step4B["STEP 4.2: Required Funding Amount (amount_currency=INR)"]
    Step4B --> BranchRouter{"Multi-Branch Checklist Router"}
    BranchRouter --> B1["Branch 1: Salaried Personal Loan (Sec 5)"]
    BranchRouter --> B2["Branch 2: Business Owner / Self-Employed (Sec 6)"]
    BranchRouter --> B3["Branch 3: Doctor Loan (Sec 7)"]
    BranchRouter --> B4["Branch 4: CA Professional Loan (Sec 8)"]
    BranchRouter --> B5["Branch 5: Education Loan India/Abroad + Co-Applicant Branches (Sec 9)"]
    BranchRouter --> B6["Branch 6: Home Loan Multi-Section Income + Property Docs (Sec 10)"]
    BranchRouter --> B7["Branch 7: Mortgage Loan / LAP (Sec 11)"]
    BranchRouter --> B8["Branch 8: School & College Institutional Funding (Sec 12)"]
    B1 & B2 & B3 & B4 & B5 & B6 & B7 & B8 --> FinalPortal["Deliver Checklist + Non-Lender Disclaimer + Signed Document Upload Link + Advisor Handoff Option"]
```

---

## 2. Step-by-Step Flow Specification

### Step 1 — Welcome Message & Language Selection
- **Greeting Text:**
  ```text
  Namaste! 🙏
  Welcome to AVANI LOAN SERVICES.

  We help individuals, professionals, businesses, schools, and colleges with the right loan and funding guidance.

  Please select your preferred language to continue:
  1. English
  2. मराठी
  3. हिंदी
  ```
- **Concise Privacy Notice Displayed at Entry:**
  > *"Privacy Notice: By continuing, you consent to AVANI LOAN SERVICES processing your details for loan eligibility & advisory service (Policy vAVANI-PRIVACY-2026.2). Reply STOP anytime to opt out."*
- **Stored Variables:** `preferred_language` (`English` | `मराठी` | `हिंदी`), `consent_status = GRANTED`, `consent_timestamp`.

### Step 2 — Basic Information Collection (Strict Sequential Order)
1. **Full Name (`full_name`)**: Prompts in selected language (`What is your Full Name?` / `कृपया तुमचे पूर्ण नाव सांगा:` / `कृपया अपना पूरा नाम बताएं:`).
2. **Mobile Number (`mobile_number`)**: Validated via [`validateAndNormalizeMobile`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatbot-flow-engine.ts#L166-L176). Normalizes 10-digit Indian mobile numbers to E.164 (`+919175635165`) and ChatMitra 12-digit (`919175635165`).
3. **Email Address (`email`)**: Validated via [`validateEmailAddress`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatbot-flow-engine.ts#L178-L185).
4. **City / Location (`city`)**: Stored in `city`.
5. **Applicant Category (`applicant_type`)**:
   - `1. Salaried`
   - `2. Self Employed`
   - `3. Business Owner`
   - `4. Professional (Doctor / CA / Architect / Other)`
   - If `4. Professional` is selected, asks sub-category (`Doctor`, `Chartered Accountant (CA)`, `Architect`, `Other Professional`) and stores in `professional_subtype`.

### Step 3 — Monthly Income Range (`monthly_income_range`)
- Options presented in English, Marathi, or Hindi:
  1. `₹25,000 – ₹50,000`
  2. `₹50,000 – ₹1,00,000`
  3. `₹1,00,000 – ₹2,00,000`
  4. `Above ₹2,00,000`
  5. `Prefer to discuss with an advisor`

### Step 4 — Loan Requirement & Funding Amount
- **11 Canonical Loan Requirement Options (`loan_category`):**
  1. `Personal Loan`
  2. `Business Loan`
  3. `Home Loan`
  4. `Mortgage Loan / Loan Against Property`
  5. `Education Loan — India`
  6. `Education Loan — Abroad`
  7. `Doctor Loan`
  8. `CA Loan`
  9. `School Funding`
  10. `College Funding`
  11. `Other Loan Requirement`
- **Required Funding Amount (`required_loan_amount`):**
  - Parses numeric values, Lakhs (`L` / `लाख`), and Crores (`Cr` / `कोटी`), and enforces `amount_currency = "INR"`.

---

## 3. ChatMitra Dashboard (`/ai/chatbots`) Import Procedure
For owner Sachin Shinde when signed into `https://app.chatmitra.com/ai/chatbots`:
1. Click **Create New Chatbot** -> Name: `AVANI Loan Qualification & Checklist Bot v1`.
2. Set **Trigger**: Inbound Message on `+91 72491 08474` (when `Webhook Fallback` or `Keyword: Hi, Hello, Loan, कर्ज, लोन` is received).
3. Configure **Webhook Node** pointing to `https://avani-ai-crm.vercel.app/api/chatmitra-webhook` with header `x-webhook-signature` signed by `CHATMITRA_WEBHOOK_SECRET`.
4. Map the 20 Custom Attributes defined in [`AVANI_CHATBOT_FIELD_MAPPING.md`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/AVANI_CHATBOT_FIELD_MAPPING.md).
