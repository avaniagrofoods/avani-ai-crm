import mongoose from 'mongoose';

/**
 * TASK 5H.4 — MINIMAL CALL METADATA MODEL
 * Prohibited fields removed: recordingUrl, transcript, providerResponse, webhookPayloads[].
 */
const CallSchema = new mongoose.Schema({
  leadId: { type: String, required: true, index: true },
  correlationId: { type: String, index: true },
  providerCallId: { type: String, index: true },

  provider: { type: String, default: 'OmniDM' },
  agentId: { type: String },
  recipientPhone: { type: String },

  status: {
    type: String,
    enum: [
      'QUEUED', 'DISPATCHED', 'PROVIDER_ACCEPTED', 'CALL_ID_CREATED',
      'RINGING', 'ANSWERED', 'AGENT_STARTED', 'CONVERSATION_COMPLETED',
      'WEBHOOK_RECEIVED', 'CRM_UPDATED', 'FAILED', 'BUSY', 'NO_ANSWER'
    ],
    default: 'QUEUED'
  },

  duration: { type: Number },
  summary: { type: String, maxlength: 240 },

  languageDetected: { type: String },
  professionIdentified: { type: String },
  loanProductIdentified: { type: String },
  monthlyIncomeIdentified: { type: String },
  cityIdentified: { type: String },

  failureReason: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  answeredAt: { type: Date },
  completedAt: { type: Date }
});

export const Call = mongoose.models.Call || mongoose.model('Call', CallSchema);
