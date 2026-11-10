import mongoose from 'mongoose';

export interface IAdvisor {
  advisorId: string;
  name: string;
  email: string;
  phone: string;
  role: 'CHIEF_LOAN_ADVISOR' | 'LOAN_ADVISOR' | 'OPERATIONS_EXECUTIVE' | 'READ_ONLY';
  activeLeadsCount: number;
  specializations: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AdvisorSchema = new mongoose.Schema({
  advisorId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['CHIEF_LOAN_ADVISOR', 'LOAN_ADVISOR', 'OPERATIONS_EXECUTIVE', 'READ_ONLY'],
    default: 'LOAN_ADVISOR'
  },
  activeLeadsCount: { type: Number, default: 0 },
  specializations: [{ type: String }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Advisor = mongoose.models.Advisor || mongoose.model<IAdvisor>('Advisor', AdvisorSchema);

export const DEFAULT_AVANI_ADVISORS: Partial<IAdvisor>[] = [
  {
    advisorId: 'ADV-SACHIN-01',
    name: 'Sachin Shinde',
    email: 'enquiry@avanifinserv.com',
    phone: '+91 72491 08474',
    role: 'CHIEF_LOAN_ADVISOR',
    specializations: ['Doctor Loan', 'Home Loan', 'Business Loan', 'Mortgage Loan / LAP', 'School Funding', 'College Funding'],
    isActive: true
  },
  {
    advisorId: 'ADV-OPS-02',
    name: 'Avani Operations Desk',
    email: 'operations@avanifinserv.com',
    phone: '+91 72491 08474',
    role: 'OPERATIONS_EXECUTIVE',
    specializations: ['Personal Loan', 'Education Loan — India', 'Education Loan — Global Studies'],
    isActive: true
  }
];
