import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  documentType: { type: String, required: true },
  required: { type: Boolean, default: true },
  status: { 
    type: String, 
    enum: ['REQUESTED', 'UPLOADED', 'PROCESSING', 'VALID', 'INVALID', 'REJECTED', 'RE-UPLOAD REQUIRED', 'VERIFIED'],
    default: 'REQUESTED'
  },
  uploadDate: { type: Date },
  validationStatus: { type: String },
  rejectionReason: { type: String },
  verifiedBy: { type: String },
  verifiedDate: { type: Date },
  fileUrl: { type: String }, // Assuming files will eventually be stored in S3/Supabase and accessed via URL
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Document = mongoose.models.Document || mongoose.model('Document', DocumentSchema);
