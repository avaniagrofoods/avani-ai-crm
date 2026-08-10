import mongoose from 'mongoose';

const CallSchema = new mongoose.Schema({
  leadId: { type: String, required: true, index: true },
  correlationId: { type: String, index: true },
  providerCallId: { type: String, index: true },
  
  provider: { type: String, default: 'OmniDM' },
  agentId: { type: String },
  recipientPhone: { type: String },
  
  // Voice State Machine
  status: { 
    type: String, 
    enum: [
      'QUEUED', 'DISPATCHED', 'PROVIDER_ACCEPTED', 'CALL_ID_CREATED', 
      'RINGING', 'ANSWERED', 'AGENT_STARTED', 'CONVERSATION_COMPLETED', 
      'WEBHOOK_RECEIVED', 'CRM_UPDATED', 'FAILED', 'BUSY', 'NO_ANSWER'
    ],
    default: 'QUEUED'
  },
  
  // Conversation Data
  duration: { type: Number },
  recordingUrl: { type: String },
  summary: { type: String },
  transcript: { type: mongoose.Schema.Types.Mixed },
  
  // AI extraction
  languageDetected: { type: String },
  professionIdentified: { type: String },
  loanProductIdentified: { type: String },
  monthlyIncomeIdentified: { type: String },
  cityIdentified: { type: String },
  
  // Forensic/Audit
  failureReason: { type: String },
  providerResponse: { type: mongoose.Schema.Types.Mixed },
  webhookPayloads: [{ type: mongoose.Schema.Types.Mixed }], // Array to track multiple webhooks for this call
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  answeredAt: { type: Date },
  completedAt: { type: Date }
});

export const Call = mongoose.models.Call || mongoose.model('Call', CallSchema);
