import mongoose, { Schema, Document } from 'mongoose';

export interface ITemplate extends Document {
  templateId: string;
  templateName: string;
  language: string;
  category: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  components?: any[];
  variables?: string[];
  productMapping?: string[];
  provider: 'AiSensy' | 'MetaCloud';
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSchema: Schema = new Schema(
  {
    templateId: { type: String, required: true, unique: true, index: true },
    templateName: { type: String, required: true, index: true },
    language: { type: String, default: 'en' },
    category: { type: String, default: 'UTILITY' },
    status: {
      type: String,
      enum: ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED'],
      default: 'APPROVED'
    },
    components: { type: Array, default: [] },
    variables: { type: Array, default: [] },
    productMapping: { type: Array, default: [] },
    provider: { type: String, default: 'AiSensy' },
    lastSyncedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const Template = mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);
