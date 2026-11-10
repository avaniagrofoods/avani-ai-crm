/**
 * AVANI LOAN SERVICES — Document Checklist & Verification Engine (CP-26.3)
 * 
 * Provides category-specific document checklists, verification statuses,
 * and secure verification tracking.
 */

export interface DocumentItemDef {
  code: string;
  name: string;
  mandatory: boolean;
  category: 'KYC' | 'INCOME' | 'BUSINESS' | 'PROPERTY' | 'ACADEMIC' | 'INSTITUTIONAL';
}

export const CATEGORY_DOCUMENT_CHECKLISTS: Record<string, DocumentItemDef[]> = {
  'Doctor Loan': [
    { code: 'DOC_KYC_PAN', name: 'PAN Card', mandatory: true, category: 'KYC' },
    { code: 'DOC_KYC_AADHAAR', name: 'Aadhaar Card', mandatory: true, category: 'KYC' },
    { code: 'DOC_MED_DEGREE', name: 'Medical Degree & Registration Certificate (MCI/State Council)', mandatory: true, category: 'BUSINESS' },
    { code: 'DOC_CLINIC_PROOF', name: 'Clinic / Hospital Ownership Proof or Rent Agreement', mandatory: true, category: 'BUSINESS' },
    { code: 'DOC_BANK_STMT', name: 'Latest 6 Months Bank Account Statement', mandatory: true, category: 'INCOME' },
    { code: 'DOC_ITR_2YR', name: 'Latest 2 Years ITR with Computation of Income', mandatory: true, category: 'INCOME' },
  ],
  'Business Loan': [
    { code: 'DOC_KYC_PAN', name: 'Applicant & Business PAN Card', mandatory: true, category: 'KYC' },
    { code: 'DOC_KYC_AADHAAR', name: 'Aadhaar Card of Promoters', mandatory: true, category: 'KYC' },
    { code: 'DOC_BIZ_REG', name: 'Udyam Registration / Shop Act / Certificate of Incorporation', mandatory: true, category: 'BUSINESS' },
    { code: 'DOC_GST_12M', name: 'Latest 12 Months GST Returns (GSTR-3B)', mandatory: true, category: 'BUSINESS' },
    { code: 'DOC_BANK_12M', name: 'Latest 12 Months Current Bank Account Statements', mandatory: true, category: 'INCOME' },
    { code: 'DOC_ITR_CA_2YR', name: 'Latest 2–3 Years Audited Financials with CA Audit Report', mandatory: true, category: 'INCOME' },
  ],
  'Home Loan': [
    { code: 'DOC_KYC_PAN', name: 'PAN Card', mandatory: true, category: 'KYC' },
    { code: 'DOC_KYC_AADHAAR', name: 'Aadhaar Card', mandatory: true, category: 'KYC' },
    { code: 'DOC_INCOME_SALARY', name: 'Latest 3 Months Salary Slips & Form 16 / 2 Years ITR', mandatory: true, category: 'INCOME' },
    { code: 'DOC_BANK_STMT', name: 'Latest 6 Months Salary / Primary Bank Statement', mandatory: true, category: 'INCOME' },
    { code: 'DOC_PROP_AGREEMENT', name: 'Registered Agreement to Sale / Allotment Letter', mandatory: true, category: 'PROPERTY' },
    { code: 'DOC_PROP_SANCTION', name: 'Approved Building Plan & Commencement Certificate', mandatory: true, category: 'PROPERTY' },
  ],
  'Mortgage Loan / LAP': [
    { code: 'DOC_KYC_PAN', name: 'PAN Card of Owners & Co-applicants', mandatory: true, category: 'KYC' },
    { code: 'DOC_KYC_AADHAAR', name: 'Aadhaar Card', mandatory: true, category: 'KYC' },
    { code: 'DOC_PROP_TITLE', name: 'Complete Chain of Property Title Deeds (13–30 Years)', mandatory: true, category: 'PROPERTY' },
    { code: 'DOC_PROP_TAX', name: 'Latest Property Tax Receipt & 7/12 Extract or Municipal Sanction', mandatory: true, category: 'PROPERTY' },
    { code: 'DOC_INCOME_PROOF', name: 'Latest 2 Years ITR / Financials & 6 Months Bank Statement', mandatory: true, category: 'INCOME' },
  ],
  'Personal Loan': [
    { code: 'DOC_KYC_PAN', name: 'PAN Card', mandatory: true, category: 'KYC' },
    { code: 'DOC_KYC_AADHAAR', name: 'Aadhaar Card', mandatory: true, category: 'KYC' },
    { code: 'DOC_INCOME_SALARY', name: 'Latest 3 Months Salary Slips', mandatory: true, category: 'INCOME' },
    { code: 'DOC_BANK_STMT', name: 'Latest 6 Months Bank Statement showing salary credits', mandatory: true, category: 'INCOME' },
  ],
  'CA Professional Loan': [
    { code: 'DOC_KYC_PAN', name: 'PAN Card', mandatory: true, category: 'KYC' },
    { code: 'DOC_KYC_AADHAAR', name: 'Aadhaar Card', mandatory: true, category: 'KYC' },
    { code: 'DOC_ICAI_COP', name: 'ICAI Membership Certificate & Certificate of Practice (COP)', mandatory: true, category: 'BUSINESS' },
    { code: 'DOC_BANK_STMT', name: 'Latest 6 Months Bank Statement', mandatory: true, category: 'INCOME' },
    { code: 'DOC_ITR_2YR', name: 'Latest 2 Years ITR with Balance Sheet', mandatory: true, category: 'INCOME' },
  ],
  'Education Loan — India': [
    { code: 'DOC_KYC_PAN', name: 'Student & Co-borrower PAN Cards', mandatory: true, category: 'KYC' },
    { code: 'DOC_KYC_AADHAAR', name: 'Student & Co-borrower Aadhaar Cards', mandatory: true, category: 'KYC' },
    { code: 'DOC_ADMISSION_LETTER', name: 'College Admission Letter / Entrance Score Card', mandatory: true, category: 'ACADEMIC' },
    { code: 'DOC_FEE_SCHEDULE', name: 'Official Institutional Fee Schedule', mandatory: true, category: 'ACADEMIC' },
    { code: 'DOC_COBORROWER_INCOME', name: 'Co-borrower Salary Slips / ITR & 6 Months Bank Statement', mandatory: true, category: 'INCOME' },
  ],
  'Education Loan — Global Studies': [
    { code: 'DOC_KYC_PAN', name: 'Student & Co-borrower PAN Cards', mandatory: true, category: 'KYC' },
    { code: 'DOC_PASSPORT', name: 'Valid Passport of Student', mandatory: true, category: 'KYC' },
    { code: 'DOC_ADMISSION_OVERSEAS', name: 'Unconditional Admission Offer (I-20 / CAS / Offer Letter)', mandatory: true, category: 'ACADEMIC' },
    { code: 'DOC_TEST_SCORES', name: 'GRE / GMAT / IELTS / TOEFL Official Score Card', mandatory: true, category: 'ACADEMIC' },
    { code: 'DOC_COBORROWER_FINANCIALS', name: 'Co-borrower 3 Years ITR, 12 Months Bank Statement & Asset Proofs', mandatory: true, category: 'INCOME' },
  ],
  'School Funding': [
    { code: 'DOC_TRUST_REG', name: 'Trust / Society Registration Certificate & Bylaws', mandatory: true, category: 'INSTITUTIONAL' },
    { code: 'DOC_TRUST_PAN', name: 'Trust PAN Card & Trustee KYCs', mandatory: true, category: 'KYC' },
    { code: 'DOC_CAMPUS_TITLE', name: 'School Campus Land Title / NA Sanction / 30-Year Lease Deed', mandatory: true, category: 'PROPERTY' },
    { code: 'DOC_AFFILIATION', name: 'CBSE / ICSE / State Board Affiliation & Recognition Order', mandatory: true, category: 'INSTITUTIONAL' },
    { code: 'DOC_AUDITED_3YR', name: 'Latest 3 Years Audited Balance Sheet & Income-Expenditure Accounts', mandatory: true, category: 'INCOME' },
    { code: 'DOC_STUDENT_STRENGTH', name: 'Student Strength & Fee Collection Summary (Last 3 Years)', mandatory: true, category: 'INSTITUTIONAL' },
  ],
  'College Funding': [
    { code: 'DOC_TRUST_REG', name: 'Society / University Act / Trust Deed & Approval Documents', mandatory: true, category: 'INSTITUTIONAL' },
    { code: 'DOC_CAMPUS_TITLE', name: 'College Campus Land Ownership & Approved Master Plan', mandatory: true, category: 'PROPERTY' },
    { code: 'DOC_AICTE_UGC', name: 'AICTE / UGC / NMC / BCI Regulatory Approvals & Accreditation', mandatory: true, category: 'INSTITUTIONAL' },
    { code: 'DOC_AUDITED_3YR', name: 'Latest 3 Years Audited Financial Accounts with Audit Report', mandatory: true, category: 'INCOME' },
    { code: 'DOC_BANK_12M', name: 'Latest 12 Months Institutional Bank Statements', mandatory: true, category: 'INCOME' },
  ]
};

export function getChecklistForProduct(loanType: string): DocumentItemDef[] {
  return CATEGORY_DOCUMENT_CHECKLISTS[loanType] || CATEGORY_DOCUMENT_CHECKLISTS['Personal Loan'];
}
