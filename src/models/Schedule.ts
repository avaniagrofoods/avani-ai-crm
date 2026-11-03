import mongoose from 'mongoose';

const ScheduleSchema = new mongoose.Schema({
  scheduleId: { type: String, unique: true, required: true }, // SCHED-YYYYMMDD-XXXXXX
  title: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['Broadcast', 'Follow-up Call', 'Task Reminder', 'Custom'], 
    default: 'Broadcast' 
  },
  scheduledAt: { type: Date, required: true, index: true },
  date: { type: String }, // YYYY-MM-DD
  time: { type: String }, // HH:MM AM/PM
  targetAudience: { type: String, default: 'ALL_LEADS' },
  templateName: { type: String, default: 'Avani_Loan_Welcome' },
  messageText: { type: String },
  status: { 
    type: String, 
    enum: ['SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'], 
    default: 'SCHEDULED',
    index: true
  },
  executedAt: { type: Date },
  executionResult: { type: mongoose.Schema.Types.Mixed },
  idempotencyKey: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Schedule = mongoose.models.Schedule || mongoose.model('Schedule', ScheduleSchema);
