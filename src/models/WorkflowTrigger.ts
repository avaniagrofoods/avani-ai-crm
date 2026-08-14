import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkflowTrigger extends Document {
  eventId: string;
  leadId: string;
  stage: string;
  triggerType: 'CUSTOMER_INBOUND' | 'BUTTON_REPLY' | 'LEAD_AD_EVENT' | 'EXPLICIT_WORKFLOW_TRIGGER';
  templateName?: string;
  provider: string;
  correlationId: string;
  idempotencyKey: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'SKIPPED_DUPLICATE';
  metadata?: any;
  createdAt: Date;
  processedAt?: Date;
}

const WorkflowTriggerSchema: Schema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    leadId: { type: String, required: true, index: true },
    stage: { type: String, required: true, index: true },
    triggerType: {
      type: String,
      enum: ['CUSTOMER_INBOUND', 'BUTTON_REPLY', 'LEAD_AD_EVENT', 'EXPLICIT_WORKFLOW_TRIGGER'],
      required: true
    },
    templateName: { type: String },
    provider: { type: String, default: 'AiSensy' },
    correlationId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSED', 'FAILED', 'SKIPPED_DUPLICATE'],
      default: 'PENDING'
    },
    metadata: { type: Object, default: {} },
    processedAt: { type: Date }
  },
  { timestamps: true }
);

export const WorkflowTrigger =
  mongoose.models.WorkflowTrigger || mongoose.model<IWorkflowTrigger>('WorkflowTrigger', WorkflowTriggerSchema);
