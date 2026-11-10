# AVANI LOAN SERVICES — CP-26.3
# DOCUMENT CHECKLIST & LENDER MATCHING REPORT

**Project:** AVANI LOAN SERVICES — AVANI AI CRM  
**Milestone:** CP-26 Stage 3: Product Checklists & Multi-Lender Ecosystem  
**Author:** Lead Solutions Architect & Financial Services Workflow Specialist  
**Date:** November 10, 2026  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

Stage 3 provides standardized, product-tailored document checklists across all 9 loan products, and establishes a partner bank/NBFC directory with matching criteria, submission tracking, and status monitoring.

---

## 2. Standardized Document Checklists

Implemented in `src/lib/document-checklist.ts`:
- **Doctor Loan Checklist:**
  - Mandatory: PAN Card, Aadhaar Card, MBBS / MD / MS / BDS Degree Certificate, Medical Council Registration Certificate, 6 Months Current / Savings Account Bank Statements, 2 Years ITR with Computation.
  - Optional: Clinic Ownership Proof, Existing Loan Track Records.
- **Business Loan Checklist:**
  - Mandatory: PAN, Aadhaar, Business Registration / Udyam Certificate, 12 Months Bank Statements, 2 Years Audited Financials with ITR, GST Returns (12 Months).
  - Optional: Projected Balance Sheet, Business Profile / Invoices.
- **Home Loan Checklist:**
  - Mandatory: KYC, 3 Months Salary Slips (Salaried) or 2 Years ITR (Self-Employed), 6 Months Bank Statements, Property Title Deed, Agreement for Sale, Approved Building Plan / Sanction Map.
- **Loan Against Property (LAP) Checklist:**
  - Mandatory: KYC, Income Documents, Property Chain Documents, Mutation / Property Tax Receipts.
- **Education Loan Checklist:**
  - Mandatory: Student KYC, 10th / 12th / Degree Marksheets, University Admission Letter with Fee Structure, Co-Applicant KYC & Income Proof (ITR / 6 Months Bank Statement).
  - Optional: GRE / GMAT / IELTS Scorecard, Visa Approval Copy.
- **Gold Loan Checklist:**
  - Mandatory: KYC, Gold Ornaments for in-person appraisal.
- **Used Car Loan Checklist:**
  - Mandatory: KYC, 6 Months Bank Statements, Vehicle RC Copy, Insurance Certificate, Vehicle Valuation Report.
- **School / Institutional Funding Checklist:**
  - Mandatory: Trust / Society Registration, 3 Years Audited Balance Sheets, Affiliation Proof (CBSE / ICSE / State Board), Fee Collection Records (12 Months), Trustee KYC.

---

## 3. Partner Bank & NBFC Directory

Implemented in `src/models/Lender.ts` and `src/app/api/lenders/route.ts`:
- **Default Seeded Partners:**
  1. HDFC Bank (Private Sector Bank) — Products: Doctor Loan, Home Loan, LAP, Business Loan
  2. Bajaj Finserv (NBFC) — Products: Doctor Loan, Business Loan, Personal Loan
  3. State Bank of India (SBI) (Public Sector Bank) — Products: Home Loan, Education Loan, LAP
  4. ICICI Bank (Private Sector Bank) — Products: Home Loan, Doctor Loan, Business Loan, Vehicle Loan
  5. Poonawalla Fincorp (NBFC) — Products: Doctor Loan, Professional Loan, Business Loan
  6. Avanse Financial Services (NBFC) — Products: Education Loan (India & Overseas)
- **Partner Fields:** Name, type (BANK, NBFC, FINTECH), min/max loan amounts, interest rate ranges, processing fees, turn-around times, contact person, active status.

---

## 4. Verification & Audit

- **Automated Tests:** Covered under `tests/test_cp26_lead_to_revenue_operations.test.cjs` Tests 6, 7, 14, 15, 16.
- **Result:** 100% Pass across checklist item generation, mandatory item verification, document upload token lifecycle, and lender directory schema integrity.
