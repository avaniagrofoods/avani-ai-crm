/**
 * AVANI LOAN SERVICES — Canonical Lead Pipeline & Qualification Configuration
 * 
 * Defines the 20 canonical stages for the complete Lead-to-Revenue lifecycle (CP-26).
 */

export const CANONICAL_LEAD_STAGES = [
  'NEW_ENQUIRY',
  'CONTACT_PENDING',
  'CONTACTED',
  'QUALIFICATION_IN_PROGRESS',
  'QUALIFIED',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_RECEIVED',
  'DOCUMENT_VERIFICATION',
  'LENDER_MATCHING',
  'APPLICATION_PREPARATION',
  'APPLICATION_SUBMITTED',
  'LENDER_PROCESSING',
  'ADDITIONAL_DOCUMENTS_REQUIRED',
  'SANCTIONED',
  'DISBURSEMENT_PENDING',
  'DISBURSED',
  'NOT_ELIGIBLE',
  'CUSTOMER_NOT_INTERESTED',
  'FOLLOW_UP_LATER',
  'CLOSED_LOST'
] as const;

export type CanonicalLeadStage = typeof CANONICAL_LEAD_STAGES[number];

export interface StageMetadata {
  id: CanonicalLeadStage;
  label: string;
  category: 'INBOX' | 'QUALIFICATION' | 'DOCUMENTS' | 'LENDER' | 'OUTCOME' | 'ARCHIVED';
  color: string;
  order: number;
}

export const STAGE_CONFIG: Record<CanonicalLeadStage, StageMetadata> = {
  NEW_ENQUIRY: { id: 'NEW_ENQUIRY', label: 'New Enquiry', category: 'INBOX', color: '#3B82F6', order: 1 },
  CONTACT_PENDING: { id: 'CONTACT_PENDING', label: 'Contact Pending', category: 'INBOX', color: '#60A5FA', order: 2 },
  CONTACTED: { id: 'CONTACTED', label: 'Contacted', category: 'INBOX', color: '#0284C7', order: 3 },
  QUALIFICATION_IN_PROGRESS: { id: 'QUALIFICATION_IN_PROGRESS', label: 'Qualification in Progress', category: 'QUALIFICATION', color: '#F59E0B', order: 4 },
  QUALIFIED: { id: 'QUALIFIED', label: 'Qualified Lead', category: 'QUALIFICATION', color: '#10B981', order: 5 },
  DOCUMENTS_PENDING: { id: 'DOCUMENTS_PENDING', label: 'Documents Pending', category: 'DOCUMENTS', color: '#F97316', order: 6 },
  DOCUMENTS_RECEIVED: { id: 'DOCUMENTS_RECEIVED', label: 'Documents Received', category: 'DOCUMENTS', color: '#8B5CF6', order: 7 },
  DOCUMENT_VERIFICATION: { id: 'DOCUMENT_VERIFICATION', label: 'Document Verification', category: 'DOCUMENTS', color: '#6366F1', order: 8 },
  LENDER_MATCHING: { id: 'LENDER_MATCHING', label: 'Lender Matching', category: 'LENDER', color: '#EC4899', order: 9 },
  APPLICATION_PREPARATION: { id: 'APPLICATION_PREPARATION', label: 'Application Preparation', category: 'LENDER', color: '#D946EF', order: 10 },
  APPLICATION_SUBMITTED: { id: 'APPLICATION_SUBMITTED', label: 'Application Submitted', category: 'LENDER', color: '#A855F7', order: 11 },
  LENDER_PROCESSING: { id: 'LENDER_PROCESSING', label: 'Lender Processing', category: 'LENDER', color: '#8B5CF6', order: 12 },
  ADDITIONAL_DOCUMENTS_REQUIRED: { id: 'ADDITIONAL_DOCUMENTS_REQUIRED', label: 'Additional Docs Required', category: 'LENDER', color: '#EF4444', order: 13 },
  SANCTIONED: { id: 'SANCTIONED', label: 'Sanctioned', category: 'OUTCOME', color: '#059669', order: 14 },
  DISBURSEMENT_PENDING: { id: 'DISBURSEMENT_PENDING', label: 'Disbursement Pending', category: 'OUTCOME', color: '#10B981', order: 15 },
  DISBURSED: { id: 'DISBURSED', label: 'Disbursed (Revenue Ready)', category: 'OUTCOME', color: '#047857', order: 16 },
  NOT_ELIGIBLE: { id: 'NOT_ELIGIBLE', label: 'Not Eligible', category: 'ARCHIVED', color: '#6B7280', order: 17 },
  CUSTOMER_NOT_INTERESTED: { id: 'CUSTOMER_NOT_INTERESTED', label: 'Customer Not Interested', category: 'ARCHIVED', color: '#9CA3AF', order: 18 },
  FOLLOW_UP_LATER: { id: 'FOLLOW_UP_LATER', label: 'Follow-up Later', category: 'ARCHIVED', color: '#EAB308', order: 19 },
  CLOSED_LOST: { id: 'CLOSED_LOST', label: 'Closed / Lost', category: 'ARCHIVED', color: '#DC2626', order: 20 },
};

/**
 * Maps legacy lead statuses to canonical CP-26 pipeline stages
 */
export function mapLegacyStatusToStage(status?: string): CanonicalLeadStage {
  if (!status) return 'NEW_ENQUIRY';
  const clean = String(status).toUpperCase().replace(/[\s-]/g, '_');
  
  if (CANONICAL_LEAD_STAGES.includes(clean as CanonicalLeadStage)) {
    return clean as CanonicalLeadStage;
  }
  
  if (clean.includes('CUSTOMER_REPLIED') || clean.includes('REPLIED')) return 'CONTACTED';
  if (clean.includes('QUALIFIED')) return 'QUALIFIED';
  if (clean.includes('DOCUMENTS_RECEIVED') || clean.includes('DOCUMENTS_COMPLETE')) return 'DOCUMENTS_RECEIVED';
  if (clean.includes('DOCUMENTS_PENDING') || clean.includes('PARTIAL')) return 'DOCUMENTS_PENDING';
  if (clean.includes('APPLICATION_SUBMITTED')) return 'APPLICATION_SUBMITTED';
  if (clean.includes('UNDER_REVIEW') || clean.includes('PROCESSING')) return 'LENDER_PROCESSING';
  if (clean.includes('DISBURSED')) return 'DISBURSED';
  if (clean.includes('APPROVED') || clean.includes('SANCTION')) return 'SANCTIONED';
  if (clean.includes('NOT_INTERESTED')) return 'CUSTOMER_NOT_INTERESTED';
  if (clean.includes('REJECTED') || clean.includes('INVALID')) return 'NOT_ELIGIBLE';
  if (clean.includes('CALL_BACK') || clean.includes('FOLLOW_UP')) return 'FOLLOW_UP_LATER';
  if (clean.includes('CLOSED') || clean.includes('OPTED_OUT')) return 'CLOSED_LOST';
  if (clean.includes('SENT') || clean.includes('DELIVERED') || clean.includes('READ')) return 'CONTACT_PENDING';

  return 'NEW_ENQUIRY';
}

/**
 * Supported Loan Product Categories (Section 5)
 */
export const AVANI_LOAN_PRODUCTS = [
  { id: 'DOCTOR_LOAN', name: 'Doctor Loan', template: 'doctor_loan_offer' },
  { id: 'PERSONAL_LOAN', name: 'Personal Loan', template: 'Avani_Loan_Welcome' },
  { id: 'BUSINESS_LOAN', name: 'Business Loan', template: 'business_loan_welcome' },
  { id: 'HOME_LOAN', name: 'Home Loan', template: 'home_loan_welcome' },
  { id: 'MORTGAGE_LOAN', name: 'Mortgage Loan / LAP', template: 'lap_loan_welcome' },
  { id: 'CA_PROFESSIONAL_LOAN', name: 'CA Professional Loan', template: 'ca_professional_loan_welcome' },
  { id: 'EDUCATION_LOAN_INDIA', name: 'Education Loan — India', template: 'education_loan_india_welcome' },
  { id: 'EDUCATION_LOAN_GLOBAL', name: 'Education Loan — Global Studies', template: 'education_loan_abroad_welcome' },
  { id: 'SCHOOL_FUNDING', name: 'School Funding', template: 'school_owner_funding_welcome' },
  { id: 'COLLEGE_FUNDING', name: 'College Funding', template: 'college_funding_welcome' }
] as const;

export type LoanProductId = typeof AVANI_LOAN_PRODUCTS[number]['id'];

export function normalizeLoanCategory(loanType: string): string {
  const norm = String(loanType || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (norm.includes('DOCTOR') || norm.includes('MEDIC')) return 'Doctor Loan';
  if (norm.includes('BUSIN') || norm.includes('COMMERC') || norm.includes('MSME')) return 'Business Loan';
  if (norm.includes('MORTG') || norm.includes('LAP') || norm.includes('AGAINSTPROP')) return 'Mortgage Loan / LAP';
  if (norm.includes('HOME') || norm.includes('HOUS')) return 'Home Loan';
  if (norm.includes('GLOBAL') || norm.includes('ABROAD') || norm.includes('OVERSEA')) return 'Education Loan — Global Studies';
  if (norm.includes('EDU') || norm.includes('STUD')) return 'Education Loan — India';
  if (norm.includes('SCHOOL')) return 'School Funding';
  if (norm.includes('COLLEGE')) return 'College Funding';
  if (norm.includes('CA') || norm.includes('CHARTERED')) return 'CA Professional Loan';
  return 'Personal Loan';
}

export function generateCanonicalLeadId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `AVL-${dateStr}-${randomNum}`;
}
