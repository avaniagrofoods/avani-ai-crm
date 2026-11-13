import mongoose from 'mongoose';

const WebhookInboxSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true }, // Uniquely indexed for deduplication
  provider: { type: String, required: true },
  eventType: { type: String, required: true },
  payloadHash: { type: String },
  payload: { type: mongoose.Schema.Types.Mixed },
  status: {
    type: String,
    enum: ['RECEIVED', 'VERIFIED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PROCESSED', 'FAILED', 'ARCHIVED_HISTORICAL'],
    default: 'RECEIVED'
  },
  receivedAt: { type: Date, default: Date.now },
  processingStartedAt: { type: Date },
  processedAt: { type: Date },
  attemptCount: { type: Number, default: 0 },
  lastError: { type: String },
  leaseExpiresAt: { type: Date },
  correlationId: { type: String },
  archiveOnly: { type: Boolean, default: false },
  suppressAutoReply: { type: Boolean, default: false }
});

export const WebhookInbox = mongoose.models.WebhookInbox || mongoose.model('WebhookInbox', WebhookInboxSchema);
