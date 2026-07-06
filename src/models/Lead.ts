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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Lead = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
