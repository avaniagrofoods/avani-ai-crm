import mongoose from 'mongoose';

const InteractionSchema = new mongoose.Schema({
  interactionId: { type: String, required: true, unique: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  
  type: { 
    type: String, 
    enum: [
      'WHATSAPP_SENT', 'WHATSAPP_DELIVERED', 'WHATSAPP_READ', 'WHATSAPP_REPLY', 
      'AI_CALL_INITIATED', 'AI_CALL_COMPLETED', 'LEAD_CREATED', 'DOCUMENT_UPLOADED', 
      'ELIGIBILITY_CHECKED'
    ],
    required: true 
  },
  channel: { type: String, enum: ['whatsapp', 'voice', 'system', 'web'] },
  
  provider: { type: String },
  providerEventId: { type: String },
  
  direction: { type: String, enum: ['inbound', 'outbound', 'internal'] },
  
  status: { type: String },
  
  message: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  
  createdAt: { type: Date, default: Date.now }
});

export const Interaction = mongoose.models.Interaction || mongoose.model('Interaction', InteractionSchema);
