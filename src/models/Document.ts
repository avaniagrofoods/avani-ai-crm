import mongoose, { Schema, Document as MongooseDoc } from 'mongoose';

export interface IDocumentRequest extends MongooseDoc {
  leadId: string;
  product: string;
  customerType: string;
  requiredDocuments: string[];
  receivedDocuments: string[];
  missingDocuments: string[];
  status:
    | 'NOT_STARTED'
    | 'CHECKLIST_GENERATED'
    | 'DOCUMENTS_PENDING'
    | 'PARTIAL'
    | 'DOCUMENTS_SUBMITTED'
    | 'UNDER_REVIEW'
    | 'VERIFIED'
    | 'REJECTED';
  auditLog: Array<{ action: string; timestamp: Date; detail?: string }>;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema: Schema = new Schema(
  {
    leadId: { type: String, required: true, index: true },
    product: { type: String, required: true },
    customerType: { type: String, default: 'INDIVIDUAL' },
    requiredDocuments: { type: Array, default: [] },
    receivedDocuments: { type: Array, default: [] },
    missingDocuments: { type: Array, default: [] },
    status: {
      type: String,
      enum: [
        'NOT_STARTED',
        'CHECKLIST_GENERATED',
        'DOCUMENTS_PENDING',
        'PARTIAL',
        'DOCUMENTS_SUBMITTED',
        'UNDER_REVIEW',
        'VERIFIED',
        'REJECTED'
      ],
      default: 'NOT_STARTED'
    },
    auditLog: { type: Array, default: [] }
  },
  { timestamps: true }
);

export const DocumentModel =
  mongoose.models.DocumentModel || mongoose.model<IDocumentRequest>('DocumentModel', DocumentSchema);

// Export Document alias for backward compatibility across legacy routes
export const Document = DocumentModel;
