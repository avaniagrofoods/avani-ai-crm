import mongoose from 'mongoose';

const CallSchema = new mongoose.Schema({
  callId: { type: String, required: true, unique: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  broadcastId: { type: mongoose.Schema.Types.ObjectId, ref: 'Broadcast' },
  phone: { type: String, required: true },
  provider: { type: String, enum: ['OmniDM'], default: 'OmniDM' },
  providerCallId: { type: String, unique: true }, // Idempotency
  webhookEventId: { type: String }, // Deduplication
  status: { 
    type: String, 
    enum: ['Requested', 'Initiated', 'Ringing', 'Answered', 'Completed', 'No Answer', 'Busy', 'Failed'],
    default: 'Requested'
  },
  duration: { type: Number },
  outcome: { type: String },
  recordingUrl: { type: String },
  transcript: { type: String },
  failureReason: { type: String },
  requestedAt: { type: Date, default: Date.now },
  initiatedAt: { type: Date },
  ringingAt: { type: Date },
  answeredAt: { type: Date },
  completedAt: { type: Date },
  failedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Call = mongoose.models.Call || mongoose.model('Call', CallSchema);
