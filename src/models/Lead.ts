import mongoose from 'mongoose';
import { CANONICAL_LEAD_STAGES } from '@/config/pipeline';

const LeadSchema = new mongoose.Schema({
  // Core Profile
  leadId: { type: String, unique: true }, // ALS-YYYY-XXXXXX or AVL-YYYYMMDD-XXXXXX
  name: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  phone: { type: String, required: true, unique: true },
  normalizedMobile: { type: String },
  email: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  
  // Qualification Details
  loanType: { type: String, required: true },
  employmentType: { 
    type: String,
    enum: ['Salaried', 'Self Employed', 'Business Owner', 'Doctor / Medical Professional', 'Chartered Accountant', 'Other Professional', 'Student', 'Farmer', 'Pensioner', 'Other']
  },
  profession: { type: String },
  monthlyIncomeRange: { 
    type: String,
    enum: ['₹25K–₹50K', '₹50K–₹1L', '₹1L–₹2L', 'Above ₹2L']
  },
  income: { type: String },
  monthlyIncome: { type: Number },
  annualIncome: { type: Number },
  requestedAmount: { type: String },
  requiredLoanAmount: { type: Number },
  preferredTenure: { type: Number }, // in years
  existingLoans: { type: String },
  cibilScore: { type: Number },
  
  // CP-26 Canonical 20-Stage Pipeline
  stage: {
    type: String,
    enum: CANONICAL_LEAD_STAGES,
    default: 'NEW_ENQUIRY',
    index: true
  },
  stageHistory: [{
    stage: { type: String, required: true },
    changedBy: { type: String, default: 'SYSTEM' },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String },
    notes: { type: String }
  }],

  // CP-26 Lead Qualification Engine (0–100)
  qualificationScore: { type: Number, min: 0, max: 100, default: 0 },
  qualificationBreakdown: {
    contactability: { type: Number, default: 0 },
    clarity: { type: Number, default: 0 },
    amountPurpose: { type: Number, default: 0 },
    incomeFinancials: { type: Number, default: 0 },
    docReadiness: { type: Number, default: 0 },
    responsiveness: { type: Number, default: 0 },
    followUpEngagement: { type: Number, default: 0 },
    notes: { type: String },
    calculatedAt: { type: Date }
  },

  // CP-26 Advisor Assignment & Ownership
  assignedAdvisor: {
    id: { type: String },
    name: { type: String, default: 'Sachin Shinde' },
    email: { type: String, default: 'enquiry@avanifinserv.com' },
    phone: { type: String, default: '+91 72491 08474' },
    role: { type: String, default: 'CHIEF_LOAN_ADVISOR' },
    assignedAt: { type: Date, default: Date.now }
  },
  assignmentHistory: [{
    advisorName: { type: String },
    advisorEmail: { type: String },
    assignedBy: { type: String },
    assignedAt: { type: Date, default: Date.now },
    notes: { type: String }
  }],

  // CP-26 Follow-up & Task Engine (D0-D30)
  followUpTasks: [{
    taskId: { type: String, required: true },
    title: { type: String, required: true },
    timingStage: { type: String }, // D0, D1, D3, D7, D10, D15, D30
    dueDate: { type: Date, required: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    status: { type: String, enum: ['PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED'], default: 'PENDING' },
    assignedTo: { type: String, default: 'Sachin Shinde' },
    notes: { type: String },
    completedAt: { type: Date },
    completedBy: { type: String }
  }],

  // CP-26 Product Specific Details
  doctorLoanDetails: {
    specialization: { type: String },
    clinicHospitalOwnership: { type: String },
    practiceExperienceYears: { type: Number },
    equipmentType: { type: String }
  },
  businessLoanDetails: {
    businessName: { type: String },
    businessType: { type: String },
    vintageYears: { type: Number },
    annualTurnover: { type: Number },
    gstNumber: { type: String }
  },
  homeLoanDetails: {
    propertyLocation: { type: String },
    propertyType: { type: String },
    propertyValue: { type: Number },
    constructionEstimate: { type: Number }
  },
  lapDetails: {
    propertyType: { type: String },
    valuation: { type: Number },
    existingMortgage: { type: Boolean, default: false }
  },
  educationLoanDetails: {
    targetCountry: { type: String },
    universityName: { type: String },
    courseName: { type: String },
    admissionConfirmed: { type: Boolean, default: false }
  },
  institutionalFundingDetails: {
    institutionName: { type: String },
    institutionType: { type: String },
    establishedYear: { type: Number },
    securityOffered: { type: String }
  },

  // CP-26 Lender Application Tracking
  application: {
    lenderId: { type: String },
    lenderName: { type: String },
    productName: { type: String },
    applicationNumber: { type: String },
    appliedAmount: { type: Number },
    submissionDate: { type: Date },
    status: { 
      type: String, 
      enum: ['PREPARING', 'SUBMITTED', 'IN_REVIEW', 'ADDITIONAL_DOCS_NEEDED', 'SANCTIONED', 'REJECTED', 'WITHDRAWN'],
      default: 'PREPARING'
    },
    notes: { type: String }
  },

  // CP-26 Sanction Tracking
  sanction: {
    sanctionedAmount: { type: Number },
    sanctionDate: { type: Date },
    sanctionLetterRef: { type: String },
    offeredInterestRate: { type: String },
    sanctionedTenureMonths: { type: Number },
    conditions: { type: String },
    status: { type: String, enum: ['PENDING', 'SANCTIONED', 'EXPIRED', 'CANCELLED'], default: 'PENDING' }
  },

  // CP-26 Disbursement Tracking
  disbursement: {
    disbursedAmount: { type: Number },
    disbursementDate: { type: Date },
    proofRef: { type: String },
    utrNumber: { type: String },
    status: { type: String, enum: ['PENDING', 'PARTIAL', 'DISBURSED', 'CANCELLED'], default: 'PENDING' }
  },

  // CP-26 Revenue Tracking & Payment Reconciliation
  revenue: {
    agreedCommissionPct: { type: Number, default: 0 },
    agreedConsultancyFee: { type: Number, default: 0 },
    expectedRevenue: { type: Number, default: 0 },
    actualRevenueReceived: { type: Number, default: 0 },
    paymentDate: { type: Date },
    paymentStatus: { type: String, enum: ['UNBILLED', 'INVOICED', 'PARTIAL', 'RECEIVED', 'WAIVED'], default: 'UNBILLED' },
    invoiceNumber: { type: String },
    outstandingAmount: { type: Number, default: 0 }
  },

  // Legacy Lead State & Status (Preserved 100% for backward compatibility)
  status: { 
    type: String, 
    enum: [
      'New', 'Contacted', 'Qualified', 'Documents Pending', 'Documents Partially Received', 
      'Documents Complete', 'Application Submitted', 'Under Review', 'Processing', 'Approved', 'Disbursed', 'Closed',
      'Not Interested', 'Invalid Lead', 'No Response', 'Call Back', 'Rejected', 'OPTED_OUT',
      'NEW', 'WHATSAPP_SENT', 'WHATSAPP_DELIVERED', 'WHATSAPP_READ', 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP',
      'QUALIFIED_HUMAN', 'DOCUMENTS_RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED'
    ],
    default: 'NEW'
  },
  
  // DPDP Act Consent & Opt-Out Records
  consentStatus: { type: String, enum: ['GRANTED', 'DENIED', 'PENDING'], default: 'GRANTED' },
  consentPurpose: { type: String, default: 'LOAN_ELIGIBILITY_PROCESSING' },
  consentTimestamp: { type: Date, default: Date.now },
  isOptedOut: { type: Boolean, default: false },
  optedOutAt: { type: Date },
  preferredLanguage: { type: String, default: 'English' },
  idempotencyKey: { type: String, index: true },
  aiAgentStatus: { 
    type: String,
    enum: [
      'NEW_LEAD', 'OUTBOUND_SENT', 'DELIVERED', 'READ', 'WAITING_FOR_REPLY',
      'QUALIFICATION_STARTED', 'COLLECT_FULL_NAME', 'COLLECT_MOBILE', 'COLLECT_EMAIL',
      'COLLECT_CITY', 'COLLECT_EMPLOYMENT', 'COLLECT_MONTHLY_INCOME', 'COLLECT_LOAN_PRODUCT',
      'COLLECT_LOAN_AMOUNT', 'DOCUMENT_GUIDANCE', 'LEAD_QUALIFIED', 'DOCUMENTS_PENDING',
      'HUMAN_HANDOFF', 'COMPLETED', 'NO_RESPONSE', 'INVALID_INPUT', 'CUSTOMER_DECLINED',
      'CALLBACK_REQUESTED'
    ]
  },
  questionProgress: { type: Number, default: 0 },
  documentStatus: { type: String },
  callStatus: { type: String },
  followUpStatus: { type: String },
  currentWorkflowState: { type: String },

  // Attribution & Zero-Duplicate Tracking
  leadSource: { type: String },
  source: { type: String },
  channel: { type: String },
  correlationId: { type: String, index: true },
  provider: { type: String },
  providerMessageId: { type: String, index: true },
  providerCallId: { type: String, index: true },
  
  sourcePlatform: { type: String },
  campaign: { type: String },
  campaignId: { type: String },
  adSet: { type: String },
  ad: { type: String },
  utmSource: { type: String },
  utmMedium: { type: String },
  utmCampaign: { type: String },
  utmContent: { type: String },
  utmTerm: { type: String },
  metaLeadId: { type: String },
  
  // External IDs
  hubSpotContactId: { type: String },
  hubSpotDealId: { type: String },
  whatsappMessageId: { type: String },
  aiSensyMessageId: { type: String },
  conversationId: { type: String },
  callId: { type: String },
  callSummary: { type: String },
  callDuration: { type: String },

  // Legacy Assigned Agent
  assignedAgent: {
    name: { type: String },
    email: { type: String },
    status: { type: String }
  },
  
  // Financial specifics
  financialProfile: {
    loanType: { type: String },
    requestedLoanAmount: { type: Number },
    preferredTenureYears: { type: Number },
    annualInterestRate: { type: Number }
  },
  emiCalculationLog: {
    calculatedEmi: { type: Number },
    totalInterestPayable: { type: Number },
    totalRepayment: { type: Number },
    resolvedTenureMonths: { type: Number },
    resolvedTenureYears: { type: Number },
    usingFallbackDefault: { type: Boolean },
    appliedThresholdRule: { type: String },
    calculatedAt: { type: Date }
  },
  
  // Legacy Interactions
  interactions: [{
    interactionId: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    type: { type: String },
    direction: { type: String },
    buttonId: { type: String },
    text: { type: String },
    timestamp: { type: Date, default: Date.now },
    status: { type: String }
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastInteractionAt: { type: Date, default: Date.now },
  followUpCount: { type: Number, default: 0 }
});

export const Lead = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
