import mongoose, { Schema, Document } from 'mongoose';

export interface ICrossSellOpportunity extends Document {
  leadId: string;
  referringLeadId?: string;
  sourceProduct: string;
  targetProduct: string;
  reason: string;
  score: number;
  status: 'IDENTIFIED' | 'COMMUNICATED' | 'ACCEPTED' | 'DECLINED' | 'CONVERTED';
  template: string;
  createdAt: Date;
  updatedAt: Date;
}

const CrossSellOpportunitySchema: Schema = new Schema(
  {
    leadId: { type: String, required: true, index: true },
    referringLeadId: { type: String, index: true },
    sourceProduct: { type: String, required: true },
    targetProduct: { type: String, required: true },
    reason: { type: String, required: true },
    score: { type: Number, default: 70 },
    status: {
      type: String,
      enum: ['IDENTIFIED', 'COMMUNICATED', 'ACCEPTED', 'DECLINED', 'CONVERTED'],
      default: 'IDENTIFIED'
    },
    template: { type: String, required: true }
  },
  { timestamps: true }
);

export const CrossSellOpportunity =
  mongoose.models.CrossSellOpportunity ||
  mongoose.model<ICrossSellOpportunity>('CrossSellOpportunity', CrossSellOpportunitySchema);
