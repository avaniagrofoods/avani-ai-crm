import mongoose from 'mongoose';

export interface ILender {
  lenderId: string;
  name: string;
  shortCode: string;
  categories: string[];
  minAmount: number;
  maxAmount: number;
  indicativeRoi: string;
  maxTenureMonths: number;
  processingFee: string;
  contactPerson?: {
    name: string;
    phone: string;
    email: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LenderSchema = new mongoose.Schema({
  lenderId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  shortCode: { type: String, required: true },
  categories: [{ type: String, required: true }],
  minAmount: { type: Number, default: 50000 },
  maxAmount: { type: Number, default: 50000000 },
  indicativeRoi: { type: String, default: '8.5%–14.5% p.a.' },
  maxTenureMonths: { type: Number, default: 240 },
  processingFee: { type: String, default: '0.5%–2% + GST' },
  contactPerson: {
    name: { type: String },
    phone: { type: String },
    email: { type: String }
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Lender = mongoose.models.Lender || mongoose.model<ILender>('Lender', LenderSchema);

/**
 * Standard Partner Lenders for AVANI LOAN SERVICES
 */
export const DEFAULT_AVANI_LENDERS: Partial<ILender>[] = [
  {
    lenderId: 'LEN-HDFC-01',
    name: 'HDFC Bank',
    shortCode: 'HDFC',
    categories: ['Doctor Loan', 'Home Loan', 'Personal Loan', 'Business Loan', 'Mortgage Loan / LAP'],
    minAmount: 100000,
    maxAmount: 100000000,
    indicativeRoi: '8.75%–12.5% p.a.',
    maxTenureMonths: 360,
    processingFee: '0.5%–1% + GST',
    isActive: true
  },
  {
    lenderId: 'LEN-BAJAJ-02',
    name: 'Bajaj Finserv',
    shortCode: 'BAJAJ',
    categories: ['Doctor Loan', 'Personal Loan', 'Business Loan', 'CA Professional Loan'],
    minAmount: 50000,
    maxAmount: 5000000,
    indicativeRoi: '11.0%–16.0% p.a.',
    maxTenureMonths: 96,
    processingFee: '1.5%–2.5% + GST',
    isActive: true
  },
  {
    lenderId: 'LEN-SBI-03',
    name: 'State Bank of India',
    shortCode: 'SBI',
    categories: ['Home Loan', 'Education Loan — India', 'Education Loan — Global Studies', 'School Funding', 'College Funding'],
    minAmount: 100000,
    maxAmount: 200000000,
    indicativeRoi: '8.50%–10.5% p.a.',
    maxTenureMonths: 360,
    processingFee: '0.35% + GST',
    isActive: true
  },
  {
    lenderId: 'LEN-ICICI-04',
    name: 'ICICI Bank',
    shortCode: 'ICICI',
    categories: ['Doctor Loan', 'Home Loan', 'Business Loan', 'Mortgage Loan / LAP', 'Personal Loan'],
    minAmount: 100000,
    maxAmount: 75000000,
    indicativeRoi: '8.90%–13.5% p.a.',
    maxTenureMonths: 300,
    processingFee: '0.5%–1.5% + GST',
    isActive: true
  },
  {
    lenderId: 'LEN-POONA-05',
    name: 'Poonawalla Fincorp',
    shortCode: 'POONAWALLA',
    categories: ['Doctor Loan', 'Business Loan', 'Personal Loan', 'CA Professional Loan'],
    minAmount: 100000,
    maxAmount: 5000000,
    indicativeRoi: '9.99%–14.5% p.a.',
    maxTenureMonths: 84,
    processingFee: '1%–2% + GST',
    isActive: true
  },
  {
    lenderId: 'LEN-AVANSE-06',
    name: 'Avanse Financial Services',
    shortCode: 'AVANSE',
    categories: ['Education Loan — India', 'Education Loan — Global Studies', 'School Funding', 'College Funding'],
    minAmount: 200000,
    maxAmount: 150000000,
    indicativeRoi: '10.5%–14.0% p.a.',
    maxTenureMonths: 180,
    processingFee: '1%–1.5% + GST',
    isActive: true
  }
];
