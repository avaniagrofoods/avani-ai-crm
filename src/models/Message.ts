import mongoose from 'mongoose';

/**
 * TASK 5H.4 — MINIMAL MESSAGE EVENT MODEL (NO MEDIA OR RAW PROVIDER PAYLOADS)
 * Active CRM message events are persisted in Google Sheets (MESSAGE_EVENTS tab).
 * Prohibited fields removed: media, providerResponse, templateParams.
 */
const MessageSchema = new mongoose.Schema({
  leadId: { type: String, index: true },
  correlationId: { type: String, index: true },
  idempotencyKey: { type: String, index: true, sparse: true },
  providerMessageId: { type: String, index: true },
  messageId: { type: String, index: true },

  direction: { type: String, required: true },
  channel: { type: String, default: 'WhatsApp' },
  provider: { type: String, default: 'ChatMitra' },

  recipientPhone: { type: String },
  senderPhone: { type: String },
  phone: { type: String },

  status: {
    type: String,
    enum: [
      'QUEUED', 'PROCESSING', 'Processing', 'DISPATCHED', 'PROVIDER_REQUESTED', 'PROVIDER_ACCEPTED',
      'API_ACCEPTED', 'WAITING_FOR_PROVIDER_STATUS', 'PROVIDER_MESSAGE_ID_CREATED',
      'RECEIVED', 'Received', 'received',
      'SENT', 'Sent', 'DELIVERED', 'Delivered', 'READ', 'Read', 'CUSTOMER_REPLIED', 'FAILED', 'Failed', 'API_FAILED', 'PROVIDER_FAILED',
      'BALANCE_BLOCKED', 'INVALID_DESTINATION', 'TEMPLATE_REJECTED', 'WEBHOOK_TIMEOUT', 'MEDIA_ATTACHMENT_IGNORED', 'UNKNOWN'
    ],
    default: 'QUEUED'
  },

  templateName: { type: String },
  text: { type: String, maxlength: 240 },
  failureReason: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deliveredAt: { type: Date },
  readAt: { type: Date }
});

export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);
