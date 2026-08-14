import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  conversationId: string;
  leadId: string;
  customerPhone: string;
  currentStage: 
    | 'NEW_LEAD'
    | 'WELCOME'
    | 'PRODUCT_SELECTION'
    | 'QUALIFICATION'
    | 'SCORING'
    | 'DOCUMENT_COLLECTION'
    | 'ADVISOR_HANDOFF'
    | 'CONSULTATION'
    | 'APPLICATION'
    | 'LENDER_PROCESSING'
    | 'STATUS_UPDATE'
    | 'COMPLETED'
    | 'REVIEW'
    | 'REFERRAL'
    | 'CROSS_SELL'
    | 'REENGAGEMENT'
    | 'OPTED_OUT'
    | 'CLOSED';
  currentSubStage?: string;
  product?: string;
  language: string;
  lastInboundAt?: Date;
  lastOutboundAt?: Date;
  lastTemplate?: string;
  lastProviderMessageId?: string;
  qualificationStatus: 'PENDING' | 'QUALIFIED' | 'DISQUALIFIED';
  documentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE';
  advisorStatus: 'UNASSIGNED' | 'ASSIGNED' | 'HANDED_OFF';
  applicationStatus: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  optOutStatus: boolean;
  nextActionAt?: Date;
  assignedAdvisor?: string;
  leadScore: number;
  history?: any[];
  context?: any;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema: Schema = new Schema(
  {
    conversationId: { type: String, required: true, unique: true, index: true },
    leadId: { type: String, required: true, index: true },
    customerPhone: { type: String, required: true, index: true },
    currentStage: {
      type: String,
      enum: [
        'NEW_LEAD',
        'WELCOME',
        'PRODUCT_SELECTION',
        'QUALIFICATION',
        'SCORING',
        'DOCUMENT_COLLECTION',
        'ADVISOR_HANDOFF',
        'CONSULTATION',
        'APPLICATION',
        'LENDER_PROCESSING',
        'STATUS_UPDATE',
        'COMPLETED',
        'REVIEW',
        'REFERRAL',
        'CROSS_SELL',
        'REENGAGEMENT',
        'OPTED_OUT',
        'CLOSED'
      ],
      default: 'NEW_LEAD',
      index: true
    },
    currentSubStage: { type: String, default: 'INIT' },
    product: { type: String, default: 'PERSONAL_LOAN' },
    language: { type: String, default: 'en' },
    lastInboundAt: { type: Date },
    lastOutboundAt: { type: Date },
    lastTemplate: { type: String },
    lastProviderMessageId: { type: String },
    qualificationStatus: { type: String, enum: ['PENDING', 'QUALIFIED', 'DISQUALIFIED'], default: 'PENDING' },
    documentStatus: { type: String, enum: ['PENDING', 'PARTIAL', 'COMPLETE'], default: 'PENDING' },
    advisorStatus: { type: String, enum: ['UNASSIGNED', 'ASSIGNED', 'HANDED_OFF'], default: 'UNASSIGNED' },
    applicationStatus: { type: String, enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'], default: 'DRAFT' },
    optOutStatus: { type: Boolean, default: false },
    nextActionAt: { type: Date },
    assignedAdvisor: { type: String },
    leadScore: { type: Number, default: 50 },
    history: { type: Array, default: [] },
    context: { type: Object, default: {} }
  },
  { timestamps: true }
);

export const Conversation = mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);
