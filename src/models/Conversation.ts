import mongoose from 'mongoose';

const HistoryItemSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'model'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const ConversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true },
  leadId: { type: String, required: true, index: true },
  customerPhone: { type: String, required: true, index: true },
  provider: { type: String, default: 'AiSensy' },
  channel: { type: String, default: 'WhatsApp' },
  
  language: { type: String, default: 'en' },
  currentState: { 
    type: String, 
    enum: [
      'NEW_LEAD',
      'OUTBOUND_SENT',
      'DELIVERED',
      'READ',
      'WAITING_FOR_REPLY',
      'QUALIFICATION_STARTED',
      'COLLECT_FULL_NAME',
      'COLLECT_MOBILE',
      'COLLECT_EMAIL',
      'COLLECT_CITY',
      'COLLECT_EMPLOYMENT',
      'COLLECT_MONTHLY_INCOME',
      'COLLECT_LOAN_PRODUCT',
      'COLLECT_LOAN_AMOUNT',
      'DOCUMENT_GUIDANCE',
      'LEAD_QUALIFIED',
      'DOCUMENTS_PENDING',
      'HUMAN_HANDOFF',
      'COMPLETED',
      'NO_RESPONSE',
      'INVALID_INPUT',
      'CUSTOMER_DECLINED',
      'CALLBACK_REQUESTED'
    ],
    default: 'NEW_LEAD'
  },
  
  context: {
    fullName: { type: String },
    mobile: { type: String },
    email: { type: String },
    city: { type: String },
    employmentType: { type: String },
    profession: { type: String },
    monthlyIncome: { type: String },
    loanProduct: { type: String },
    loanAmount: { type: String },
    documentsRequired: [{ type: String }]
  },
  
  history: [HistoryItemSchema],
  
  lastInboundMessageId: { type: String },
  lastOutboundMessageId: { type: String },
  
  lastActivityAt: { type: Date, default: Date.now }
}, { timestamps: true });

if (mongoose.models.Conversation) {
  delete mongoose.models.Conversation;
}
export const Conversation = mongoose.model('Conversation', ConversationSchema);
