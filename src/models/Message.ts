import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  broadcastId: { type: mongoose.Schema.Types.ObjectId, ref: 'Broadcast' },
  phone: { type: String, required: true },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  provider: { type: String, enum: ['AiSensy', 'Meta'], default: 'AiSensy' },
  providerMessageId: { type: String }, // For idempotency
  webhookEventId: { type: String }, // For deduplication
  channel: { type: String, default: 'whatsapp' },
  templateName: { type: String },
  text: { type: String },
  status: { 
    type: String, 
    enum: ['Queued', 'Sent', 'Delivered', 'Read', 'Failed', 'Received'],
    default: 'Queued'
  },
  failureReason: { type: String },
  queuedAt: { type: Date },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);
