import mongoose from 'mongoose';

/**
 * TASK 5H.4 — MINIMAL WEBHOOK EVENT MODEL (ZERO RAW PAYLOAD STORAGE)
 * Active webhook deduplication is persisted in Google Sheets (WEBHOOK_EVENTS tab).
 * Prohibited raw payload field removed; only deterministic eventId and SHA-256 payloadHash are used.
 */
const WebhookInboxSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  provider: { type: String, required: true },
  eventType: { type: String, required: true },
  payloadHash: { type: String },
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
