import mongoose, { Schema, Document } from 'mongoose';

export interface ITemplate extends Document {
  templateId: string;
  providerTemplateId: string;
  templateName: string;
  displayName: string;
  language: string;
  category: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'RETIRED';
  providerStatus: string;
  providerSource: 'AiSensy' | 'MetaCloud';
  components?: any[];
  variables?: string[];
  productMapping?: string[];
  campaignName?: string;
  campaignStatus?: 'LIVE' | 'PAUSED';
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSchema: Schema = new Schema(
  {
    templateId: { type: String, required: true, unique: true, index: true },
    providerTemplateId: { type: String, required: true, index: true },
    templateName: { type: String, required: true, index: true },
    displayName: { type: String, default: '' },
    language: { type: String, default: 'en' },
    category: { type: String, default: 'UTILITY' },
    status: {
      type: String,
      enum: ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'RETIRED'],
      default: 'APPROVED'
    },
    providerStatus: { type: String, default: 'APPROVED' },
    providerSource: { type: String, default: 'AiSensy' },
    components: { type: Array, default: [] },
    variables: { type: Array, default: [] },
    productMapping: { type: Array, default: [] },
    campaignName: { type: String },
    campaignStatus: { type: String, default: 'LIVE' },
    lastSyncedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const Template = mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);
