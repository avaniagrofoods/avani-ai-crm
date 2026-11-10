# AVANI LOAN SERVICES — CP-26 DATABASE SCHEMA CHANGELOG

**Project:** AVANI LOAN SERVICES — AVANI AI CRM  
**Date:** 2026-11-10T21:30:00+05:30  
**Target Environment:** MongoDB Atlas (`avani_ai_crm_prod`)  

---

## 1. PRINCIPLES & DATA PRESERVATION RULES

1. **Non-Destructive Evolution:** All schema updates are additive. No existing fields are removed or renamed.
2. **Backward Compatibility:** Legacy status values (`New`, `Contacted`, `Qualified`, etc.) and interaction records are preserved. A getter/setter ensures backward compatibility between legacy `status` and canonical `stage`.
3. **No Migration Script Required for Existing Documents:** All new fields are optional with standard defaults.

---

## 2. MODIFIED MODELS

### 2.1 `src/models/Lead.ts`
- **Added Canonical Stages (20 Stages Enum):**
  `NEW_ENQUIRY`, `CONTACT_PENDING`, `CONTACTED`, `QUALIFICATION_IN_PROGRESS`, `QUALIFIED`, `DOCUMENTS_PENDING`, `DOCUMENTS_RECEIVED`, `DOCUMENT_VERIFICATION`, `LENDER_MATCHING`, `APPLICATION_PREPARATION`, `APPLICATION_SUBMITTED`, `LENDER_PROCESSING`, `ADDITIONAL_DOCUMENTS_REQUIRED`, `SANCTIONED`, `DISBURSEMENT_PENDING`, `DISBURSED`, `NOT_ELIGIBLE`, `CUSTOMER_NOT_INTERESTED`, `FOLLOW_UP_LATER`, `CLOSED_LOST`.
- **Added `stageHistory` Array:**
  `[{ stage: String, changedBy: String, changedAt: Date, reason: String, notes: String }]`
- **Added `qualificationScore` (Number, 0–100) & `qualificationBreakdown`:**
  `{ contactability: Number, clarity: Number, amountPurpose: Number, incomeFinancials: Number, docReadiness: Number, responsiveness: Number, followUpEngagement: Number, notes: String, calculatedAt: Date }`
- **Added `assignedAdvisor` & `assignmentHistory`:**
  `assignedAdvisor: { id: String, name: String, email: String, role: String, assignedAt: Date }`
  `assignmentHistory: [{ advisorName: String, advisorEmail: String, assignedBy: String, assignedAt: Date, notes: String }]`
- **Added `followUpTasks` Array:**
  `[{ taskId: String, title: String, dueDate: Date, priority: String, status: String, notes: String, completedAt: Date, completedBy: String }]`
- **Added `productDetails` (Conditional Subschemas):**
  - Doctor Loan specifics (specialization, clinic ownership, experience, equipment type).
  - Business Loan specifics (business name, vintage, turnover, GST number).
  - Home Loan specifics (property location, value, construction estimate).
  - LAP specifics (property type, valuation, ownership).
  - Education Loan specifics (country, university, course, admission status).
  - School/College Funding specifics (institution name, type, established year, security).
- **Added `application` Object:**
  `{ lenderId: String, lenderName: String, applicationNumber: String, appliedAmount: Number, submissionDate: Date, status: String, notes: String }`
- **Added `sanction` Object:**
  `{ sanctionedAmount: Number, sanctionDate: Date, sanctionLetterRef: String, conditions: String, status: String }`
- **Added `disbursement` Object:**
  `{ disbursedAmount: Number, disbursementDate: Date, proofRef: String, utrNumber: String, status: String }`
- **Added `revenue` Object:**
  `{ agreedCommissionPct: Number, agreedConsultancyFee: Number, expectedRevenue: Number, actualRevenueReceived: Number, paymentDate: Date, paymentStatus: String, invoiceNumber: String, outstandingAmount: Number }`

---

## 3. NEW MODELS

### 3.1 `src/models/Lender.ts`
Schema for partner banks and NBFCs:
- `lenderId`: Unique string (e.g. `LEN-HDFC-01`).
- `name`: String (e.g. `HDFC Bank`, `Bajaj Finserv`, `SBI`, `ICICI Bank`, `Tata Capital`, `Poonawalla Fincorp`).
- `categories`: Array of loan categories supported.
- `minAmount`: Number.
- `maxAmount`: Number.
- `indicativeRoi`: String.
- `maxTenureMonths`: Number.
- `contactPerson`: `{ name: String, phone: String, email: String }`.
- `isActive`: Boolean (default true).

### 3.2 `src/models/Advisor.ts`
Schema for advisor team management:
- `advisorId`: Unique string (e.g. `ADV-SACHIN-01`).
- `name`: String (`Sachin Shinde`).
- `email`: String (`enquiry@avanifinserv.com`).
- `phone`: String (`+91 72491 08474`).
- `role`: String (`CHIEF_LOAN_ADVISOR`, `LOAN_ADVISOR`, `OPERATIONS_EXECUTIVE`, `READ_ONLY`).
- `activeLeadsCount`: Number.
- `isActive`: Boolean (default true).
