import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema({
  // Core Profile
  leadId: { type: String, unique: true }, // ALS-YYYY-XXXXXX
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
  profession: { type: String }, // For dynamic capture
  monthlyIncomeRange: { 
    type: String,
    enum: ['₹25K–₹50K', '₹50K–₹1L', '₹1L–₹2L', 'Above ₹2L']
  },
  income: { type: String }, // Legacy
  monthlyIncome: { type: Number },
  annualIncome: { type: Number },
  requestedAmount: { type: String },
  requiredLoanAmount: { type: Number }, // Standardized field
  
  // Lead State & Status
  status: { 
    type: String, 
    enum: [
      'New', 'Contacted', 'Qualified', 'Documents Pending', 'Documents Partially Received', 
      'Documents Complete', 'Application Submitted', 'Under Review', 'Processing', 'Approved', 'Disbursed', 'Closed',
      'Not Interested', 'Invalid Lead', 'No Response', 'Call Back', 'Rejected',
      'NEW', 'WHATSAPP_SENT', 'WHATSAPP_DELIVERED', 'WHATSAPP_READ', 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP',
      'QUALIFIED_HUMAN', 'DOCUMENTS_RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED'
    ],
    default: 'NEW'
  },
  aiAgentStatus: { 
    type: String,
    enum: [
      'NEW_LEAD',
      'OUTBOUND_SENT',
      'DELIVERED',
      'READ',
      'WAITING_FOR_REPLY',
      'QUALIFICATION_STARTED',
      'COLLECT_FULL_NAME',
      'COLLECT_MOBILE',
      'COLLECT_EMAIL',
      'COLLECT_CITY',
      'COLLECT_EMPLOYMENT',
      'COLLECT_MONTHLY_INCOME',
      'COLLECT_LOAN_PRODUCT',
      'COLLECT_LOAN_AMOUNT',
      'DOCUMENT_GUIDANCE',
      'LEAD_QUALIFIED',
      'DOCUMENTS_PENDING',
      'HUMAN_HANDOFF',
      'COMPLETED',
      'NO_RESPONSE',
      'INVALID_INPUT',
      'CUSTOMER_DECLINED',
      'CALLBACK_REQUESTED'
    ]
  },
  questionProgress: { type: Number, default: 0 },
  documentStatus: { type: String },
  callStatus: { type: String },
  followUpStatus: { type: String },
  currentWorkflowState: { type: String },

  // Attribution & Zero-Duplicate Tracking
  leadSource: { type: String }, // General source category (e.g. Meta Ads, CSV, Website)
  source: { type: String },     // Deterministic exact source name
  channel: { type: String },    // Deterministic channel (e.g. WhatsApp, Voice)
  correlationId: { type: String, index: true }, // AVL-WA-YYYYMMDD-XXXX
  provider: { type: String },   // AiSensy, OmniDM, etc.
  providerMessageId: { type: String, index: true }, // The latest/canonical external message ID
  providerCallId: { type: String, index: true },    // The latest/canonical external call ID
  
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
  whatsappMessageId: { type: String }, // Latest message ID
  aiSensyMessageId: { type: String },
  conversationId: { type: String },
  callId: { type: String }, // For OmniDim/VAPI
  callSummary: { type: String },
  callDuration: { type: String },

  // Assignment
  assignedAgent: {
    name: { type: String },
    email: { type: String },
    status: { type: String }
  },
  
  // Financial specifics (Legacy + Current)
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
  
  // Legacy Interactions (Moving towards Message model for robust tracking, keeping this for backward compatibility)
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
