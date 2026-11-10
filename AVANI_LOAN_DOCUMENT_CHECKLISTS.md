# AVANI LOAN SERVICES — LOAN DOCUMENT CHECKLISTS SPECIFICATION (SECTIONS 5–12)

- **Business Entity:** AVANI LOAN SERVICES (`https://www.avanifinserv.com/`)
- **Implementation Module:** [`src/lib/loan-checklists.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/loan-checklists.ts)
- **Automated Test Verification:** [`tests/test_cp25_master_chatbot_and_integrations.test.cjs`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/tests/test_cp25_master_chatbot_and_integrations.test.cjs) (Tests 8 & 9 — PASS)

---

## 1. Multi-Branch Composition Architecture

[`composeMultiBranchChecklist`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/loan-checklists.ts#L254-L407) dynamically combines applicant income/profession checklists with product-specific collateral/institutional checklists and deduplicates overlapping KYC items:

| Combination Scenario | Section 1 (Applicant / Income / Academic) | Section 2 (Property / Co-Applicant / Collateral) | Section 3+ (Auxiliary / References) |
|---|---|---|---|
| **Salaried + Personal Loan** | Section 5: Salaried Personal Loan Checklist (8 items) | — | — |
| **Business Owner + Business Loan** | Section 6: Business / Self-Employed Checklist (12 items) | — | — |
| **Doctor + Doctor Loan** | Section 7: Doctor Checklist (12 items incl. Degree + Medical Council Registration) | — | — |
| **CA + CA Loan** | Section 8: Chartered Accountant Checklist (12 items incl. COP + ICAI Certificate) | — | — |
| **Doctor + Home Loan** | Section 7: Doctor Income & Qualification Documents | Section 10: Home Loan Property Documents | Deduplicated 21-item combined checklist |
| **Salaried + Home Loan** | Section 5: Salaried Income & KYC Documents | Section 10: Home Loan Property Documents | Deduplicated 17-item combined checklist |
| **Business Owner + Mortgage / LAP** | Section 6: Business Income & Tax Documents | Section 11: Mortgage / LAP Property & Chain Documents | Deduplicated 20-item combined checklist |
| **Student + Education Loan (India / Abroad)** | Section 9.1: Student KYC, Academic, Entrance Exam (`GRE/TOEFL/IELTS/GMAT` for Abroad) & Admission Letter | Section 9.2: Co-Applicant Branch (`Salaried`, `Self-Employed`, `Farmer`, `Pensioner`, `Rental`) | Section 9.3: Family Tree & Property Docs + Section 9.4: Consented References |
| **Trust / Society + School Funding** | Section 12.1: School Funding Institutional Checklist (12 items) | — | — |
| **Trust / Society + College Funding** | Section 12.2: College Funding Institutional Checklist (12 items) | — | — |

---

## 2. Complete Checklist Catalog

### Section 5 — Salaried Personal Loan (`SALARIED_PERSONAL_LOAN_CHECKLIST`)
1. PAN Card
2. Aadhaar Card
3. Passport-size Photograph
4. Current Residence Proof (Light Bill / Rent Agreement / Passport / Gas Bill)
5. Latest 3 Months Salary Slips
6. Last 6 Months Bank Statement (Salary Account)
7. Form 16 / Latest 2 Years ITR
8. Company ID Card / Appointment Letter / Official Email ID

### Section 6 — Business Owner / Self-Employed (`BUSINESS_SELF_EMPLOYED_CHECKLIST`)
1. PAN Card (Applicant & Business Entity if applicable)
2. Aadhaar Card
3. Passport-size Photograph
4. Current Residence Proof (Light Bill / Rent Agreement / Ownership Proof)
5. Office / Shop Address Proof
6. Udyam Registration / Shop Act License / GST Registration Certificate
7. Partnership Deed / Incorporation Certificate / MOA & AOA (if applicable)
8. Last 3 Years ITR with Computation of Income
9. Last 3 Years Profit & Loss Account and Balance Sheet (CA Certified / Audited)
10. Last 12 Months Current Account & Savings Account Bank Statements
11. Last 12 Months GST Returns (GSTR-3B / GSTR-1, if applicable)
12. Existing Loan Sanction Letters / Repayment Track Record (if any)

### Section 7 — Doctor Loan (`DOCTOR_LOAN_CHECKLIST`)
1. PAN Card
2. Aadhaar Card
3. Passport-size Photograph
4. Current Residence Proof
5. Degree Certificate (MBBS / BDS / MD / MS / BHMS / BAMS / Other Qualification)
6. Medical Council Registration Certificate
7. Clinic / Hospital Registration Proof / Shop Act / Biomedical Registration (if applicable)
8. Last 3 Months Salary Slips (if salaried / consulting with fixed payout)
9. Last 2–3 Years ITR with Computation of Income, P&L and Balance Sheet (if practicing / clinic owner)
10. Last 6–12 Months Bank Statements (Savings + Current Account)
11. Form 16 / TDS Certificates (if applicable)
12. Existing Loan Sanction Letters / Obligation Details (if any)

### Section 8 — Chartered Accountant Loan (`CA_LOAN_CHECKLIST`)
1. PAN Card
2. Aadhaar Card
3. Passport-size Photograph
4. Current Residence Proof
5. ICAI Membership Certificate
6. Certificate of Practice (COP)
7. Firm Registration Certificate / Partnership Deed (if applicable)
8. Office Address Proof
9. Last 2–3 Years ITR with Computation of Income
10. Last 2–3 Years Profit & Loss Account and Balance Sheet
11. Last 6–12 Months Bank Statements (Current & Savings Accounts)
12. Existing Loan Sanction Letters / Repayment Track Record (if any)

### Section 9 — Education Loan (India & Abroad)
- **Student Documents (`EDUCATION_STUDENT_COMMON_DOCS` + Abroad Extension):**
  - PAN Card, Aadhaar Card, Passport (`Mandatory for Abroad, optional if available for India`), 2 Passport-size Photographs
  - Previous Academic Marksheets & Passing Certificates (10th, 12th, Graduation / Diploma)
  - Entrance Exam Scorecard:
    - India: `CET / JEE / NEET / CAT / GATE`
    - Abroad: `GRE / TOEFL / IELTS / GMAT / Duolingo`
  - Admission / Offer Letter / I-20 / CAS from College / University
  - Course Fee Structure (Tuition Fees + Hostel / Living Expenses Breakdown)
  - Gap Certificate (if there is an academic/employment gap)
  - Student Bank Passbook / Statement (if available)
- **Co-Applicant Income Branches (`co_applicant_type`):**
  - **Branch A — Salaried:** PAN, Aadhaar, 2 Photos, Residence Proof, Latest 6 Months Salary Slips, Last 6 Months Bank Statement, Last 2 Years Form 16 / ITR, Employer ID Card.
  - **Branch B — Self-Employed / Business:** PAN, Aadhaar, 2 Photos, Residence & Business Proof, Shop Act / Udyam / GST / Business Registration, Last 3 Years ITR with Computation, P&L & Balance Sheet, Last 12 Months Bank Statement.
  - **Branch C — Farmer / Agriculture:** PAN, Aadhaar, 2 Photos, 7/12 Extract / 8A / Patta Passbook / Land Holding Proof, Tehsildar Income Certificate, Crop / Mandi Sale Receipts, Last 6–12 Months Bank Statement.
  - **Branch D — Pensioner:** PAN, Aadhaar, 2 Photos, Pension Payment Order (PPO), Pension Certificate / Retirement Proof, Last 6 Months Pension Bank Account Statement.
  - **Branch E — Rental Income (Additional):** Registered Rental Agreements, Property Ownership Proof + Municipal Tax Receipt, Last 6–12 Months Bank Statement Showing Rental Credits.
- **Collateral & Family Details (`EDUCATION_FAMILY_AND_PROPERTY_DOCS`):**
  - Family Tree Certificate / Relationship Proof, Registered Sale Deed / Index II, 7/12 Extract / Property Card, Latest Property Tax Receipt, Approved Building Plan / NA Order, 13–30 Years Chain Documents.
- **Consented References (`EDUCATION_CONSENTED_REFERENCES`):**
  - Two references (Full Name, Address, Mobile Number, Email ID) collected strictly with prior notice and consent.
- **Progressive Guidance Notice:**
  > *"Note: You do not need to upload every document immediately. You may submit one section at a time via our secure portal or connect with our loan advisor Sachin Shinde."*

### Section 10 — Home Loan (`HOME_LOAN_PROPERTY_DOCS` + Applicant Income Section)
- Combines the Applicant's Income Section (Salaried / Business / Doctor / CA) with:
  1. Copy of Agreement to Sale / Draft Sale Deed / Allotment Letter
  2. Index II / Chain of Title Documents
  3. 7/12 Extract / Property Card / Mutation Entry
  4. NA Order & Approved Building Plan / Commencement Certificate / Occupancy Certificate
  5. Latest Property Tax Receipt & Electricity Bill
  6. Builder NOC / Society NOC & Builder Bank Account Details (if builder purchase)
  7. Own Contribution / Margin Money Payment Receipts & Bank Reflection
  8. Construction Cost Estimate by Civil Engineer / Architect (for self-construction)

### Section 11 — Mortgage Loan / LAP (`MORTGAGE_LAP_PROPERTY_DOCS` + Applicant Income Section)
- Combines the Applicant's Income Section with:
  1. Registered Ownership Deed / Sale Deed / Gift Deed / Partition Deed
  2. Complete Chain of Title Documents (Last 13 to 30 Years)
  3. Latest 7/12 Extract / Property Card / City Survey Extract / Index II
  4. Approved Building Plan, NA Order & Occupancy / Completion Certificate
  5. Latest Property Tax Paid Receipt & Latest Electricity Bill
  6. Society NOC / Lease Permission (if applicable)
  7. Details of Existing Charge / Foreclosure Letter & LOD (if balance transfer / top-up)
  8. Property Photographs (Exterior & Interior)

### Section 12 — Institutional Funding (`SCHOOL_FUNDING_CHECKLIST` & `COLLEGE_FUNDING_CHECKLIST`)
- **School Funding (12 Items):** Trust / Society / Section 8 Registration Certificate, Trust Deed / MOA & AOA / By-Laws, PAN Card of Trust/Society/Company, KYC of Trustees/Directors/Authorized Signatories, School Recognition / Affiliation Certificate (State Board / CBSE / ICSE / IB), Land Ownership / Lease Documents & Approved Building Plan, Student Strength & Fee Structure Statement (Class-wise), Last 3 Years Audited Financials & ITR, Last 12 Months Bank Statements (All Trust / School Accounts), Existing Loan Sanction Letters & Repayment Track, Project Report / Quotation for Construction, Bus Purchase, Lab, Solar or Expansion, Trustee / Board Resolution for Borrowing.
- **College Funding (12 Items):** Trust / Society / Section 8 Company Registration Certificate, Trust Deed / By-Laws / MOA & AOA, Entity PAN Card & KYC of Trustees / Directors / Office Bearers, University Affiliation & Statutory Approvals (AICTE / UGC / PCI / INC / NMC / Bar Council / NCTE as applicable), Campus Land Title Documents, NA Order, Approved Layout & Building Plans, Course-wise Intake Capacity, Admission Data & Fee Structure (Last 3 Years), Fee Regulatory / Scholarship Receivable Details (if applicable), Last 3 Years Audited Financial Statements, Audit Reports & ITR, Last 12 Months Bank Statements of All Institutional Accounts, Existing Debt Schedule, Sanction Letters & Repayment Track Record, Detailed DPR / Capex Estimate (New Building / Hostel / Equipment / Working Capital), Governing Body / Trustee Resolution Authorizing Loan Application.
