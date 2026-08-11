import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  leadId: { type: String, index: true },
  correlationId: { type: String, index: true },
  idempotencyKey: { type: String, index: true, sparse: true },
  providerMessageId: { type: String, index: true },
  
  direction: { type: String, required: true },
  channel: { type: String, default: 'WhatsApp' },
  provider: { type: String, default: 'AiSensy' },
  
  recipientPhone: { type: String },
  senderPhone: { type: String },
  phone: { type: String },
  
  // Granular State Machine
  status: { 
    type: String, 
    enum: [
      'QUEUED', 'PROCESSING', 'Processing', 'DISPATCHED', 'PROVIDER_REQUESTED', 'PROVIDER_ACCEPTED', 
      'API_ACCEPTED', 'WAITING_FOR_STATUS', 'PROVIDER_MESSAGE_ID_CREATED', 
      'SENT', 'DELIVERED', 'READ', 'CUSTOMER_REPLIED', 'FAILED', 'BALANCE_BLOCKED', 'UNKNOWN'
    ],
    default: 'QUEUED'
  },
  
  // Content details
  templateName: { type: String },
  templateParams: { type: mongoose.Schema.Types.Mixed },
  text: { type: String },
  media: { type: mongoose.Schema.Types.Mixed },
  
  // Forensic/Audit
  failureReason: { type: String },
  providerResponse: { type: mongoose.Schema.Types.Mixed },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deliveredAt: { type: Date },
  readAt: { type: Date }
});

export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);
