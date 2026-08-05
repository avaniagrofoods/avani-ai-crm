import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  loanType: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['New', 'Contacted', 'Documents Requested', 'Processing', 'Approved', 'Not Interested'],
    default: 'New'
  },
  callId: { type: String }, // To track VAPI call
  callSummary: { type: String },
  callDuration: { type: String },
  requestedAmount: { type: String },
  assignedAgent: {
    name: { type: String },
    email: { type: String },
    status: { type: String }
  },
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
  interactions: [{
    interactionId: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    type: { type: String },
    direction: { type: String },
    buttonId: { type: String },
    text: { type: String },
    timestamp: { type: Date, default: Date.now },
    status: { type: String }
  }],
  currentWorkflowState: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Lead = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
