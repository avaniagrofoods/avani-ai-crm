import mongoose from 'mongoose';

const ProviderLedgerSchema = new mongoose.Schema({
  correlationId: { type: String, index: true },
  idempotencyKey: { type: String, index: true },
  provider: { type: String },
  operation: { type: String },
  attempt: { type: Number, default: 1 },
  requestHash: { type: String },
  providerMessageId: { type: String },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  httpStatus: { type: Number },
  result: { type: String },
  errorCode: { type: String }
});

export const ProviderLedger = mongoose.models.ProviderLedger || mongoose.model('ProviderLedger', ProviderLedgerSchema);
