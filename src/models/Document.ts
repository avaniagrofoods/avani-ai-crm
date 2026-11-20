import mongoose, { Schema, Document as MongooseDoc } from 'mongoose';

/**
 * TASK 5H.4 — DOCUMENT STORAGE ELIMINATION
 * Customer document and file uploads are disabled. This legacy model is retained solely
 * as a read-only type stub so legacy imports compile without persisting any file/document data.
 */
export interface IDocumentRequest extends MongooseDoc {
  leadId: string;
  product: string;
  customerType: string;
  status: 'DISABLED_BY_POLICY';
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema: Schema = new Schema(
  {
    leadId: { type: String, required: true, index: true },
    product: { type: String, required: true },
    customerType: { type: String, default: 'INDIVIDUAL' },
    status: {
      type: String,
      enum: ['DISABLED_BY_POLICY'],
      default: 'DISABLED_BY_POLICY'
    }
  },
  { timestamps: true }
);

export const DocumentModel =
  mongoose.models.DocumentModel || mongoose.model<IDocumentRequest>('DocumentModel', DocumentSchema);

export const Document = DocumentModel;
