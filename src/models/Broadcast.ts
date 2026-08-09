import mongoose from 'mongoose';

const BroadcastSchema = new mongoose.Schema({
  name: { type: String, required: true },
  templateName: { type: String, required: true },
  broadcastType: { type: String, enum: ['whatsapp', 'voice'], default: 'whatsapp' },
  testMode: { type: Boolean, default: false },
  mode: { type: String, enum: ['production', 'test', 'degraded'], default: 'production' },
  environment: { type: String, default: 'production' },
  status: { 
    type: String, 
    enum: ['Draft', 'Processing', 'Completed', 'Failed'],
    default: 'Draft'
  },
  totalContacts: { type: Number, default: 0 },
  validContacts: { type: Number, default: 0 },
  invalidContacts: { type: Number, default: 0 },
  queuedCount: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  readCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Broadcast = mongoose.models.Broadcast || mongoose.model('Broadcast', BroadcastSchema);
