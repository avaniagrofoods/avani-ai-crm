import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Conversation } from '@/models/Conversation';

export interface StructuredFact {
  field: string;
  value: any;
  confidence: number; // e.g. 0.95
}

export interface QualificationResult {
  leadId: string;
  product: string;
  qualificationStatus: 'QUALIFIED' | 'DISQUALIFIED' | 'PENDING';
  leadScore: number;
  extractedFacts: StructuredFact[];
  missingFields: string[];
  documentChecklist: string[];
  nextAction: string;
  nextQuestion?: string;
}

export class StructuredQualificationEngine {
  static getDocumentChecklistForProduct(product: string, profession?: string): string[] {
    switch (product) {
      case 'DOCTOR_LOAN':
        return [
          'Medical Degree / Registration Certificate',
          'PAN Card',
          'Aadhaar Card',
          'Last 2 Years Income Tax Returns (ITR)',
          'Last 12 Months Bank Statements'
        ];
      case 'CA_LOAN':
        return [
          'ICAI COP / Membership Certificate',
          'PAN Card',
          'Aadhaar Card',
          'Last 2 Years Audited Financials & ITR',
          'Last 12 Months Bank Statements'
        ];
      case 'BUSINESS_LOAN':
        return [
          'GST Registration & Returns (12 Months)',
          'Business PAN & Aadhaar of Promoter',
          'Last 2 Years Audited Financials & ITR',
          'Last 12 Months Bank Statements',
          'Shop Act / Udhyam Certificate'
        ];
      case 'HOME_LOAN':
      case 'MORTGAGE_LOAN':
        return [
          'Property Sale Agreement / Title Deeds',
          'PAN & Aadhaar Card',
          'Salary Slips (3 Mth) or ITR (2 Yrs)',
          'Last 12 Months Bank Statements',
          'Approved Construction Plan / NOC'
        ];
      case 'EDUCATION_LOAN_GLOBAL':
      case 'EDUCATION_LOAN_INDIA':
        return [
          'Admission Offer Letter / I-20 Form',
          'Student & Co-Applicant Academic Records',
          'Co-Applicant PAN & Aadhaar Card',
          'Co-Applicant Income Proof (ITR / Bank Stmt)',
          'GRE / TOEFL / IELTS Scorecard'
        ];
      case 'SCHOOL_FUNDING':
      case 'COLLEGE_FUNDING':
        return [
          'Trust / Society Registration Certificate',
          'Affiliation & Recognition License',
          '3 Years Audited Financials & Balance Sheet',
          'Bank Statements (12 Months)',
          'Property Title Deeds / Land License'
        ];
      case 'PERSONAL_LOAN':
      default:
        return [
          'PAN Card',
          'Aadhaar Card',
          'Last 3 Months Salary Slips',
          'Last 6 Months Bank Statements'
        ];
    }
  }

  static calculateLeadScore(data: any): number {
    let score = 50; // Base score

    if (data.profession === 'Doctor' || data.profession === 'CA') score += 20;
    if (data.monthlyIncomeRange?.includes('1,00,000') || data.monthlyIncomeRange?.includes('75,000')) score += 15;
    if (data.creditScoreRange?.includes('750')) score += 15;
    if (data.propertyOwned) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  static async evaluateQualification(leadId: string, textInput: string, existingContext: any = {}): Promise<QualificationResult> {
    await connectToDatabase();

    const lower = textInput.toLowerCase();
    const extractedFacts: StructuredFact[] = [];
    const updatedContext = { ...existingContext };

    // Extract Product
    let product = updatedContext.product || 'PERSONAL_LOAN';
    if (lower.includes('doctor') || lower.includes('mbbs') || lower.includes('clinic')) {
      product = 'DOCTOR_LOAN';
      extractedFacts.push({ field: 'product', value: 'DOCTOR_LOAN', confidence: 0.98 });
      extractedFacts.push({ field: 'profession', value: 'Doctor', confidence: 0.98 });
      updatedContext.product = 'DOCTOR_LOAN';
      updatedContext.profession = 'Doctor';
    } else if (lower.includes('ca') || lower.includes('chartered') || lower.includes('audit')) {
      product = 'CA_LOAN';
      extractedFacts.push({ field: 'product', value: 'CA_LOAN', confidence: 0.96 });
      extractedFacts.push({ field: 'profession', value: 'Chartered Accountant', confidence: 0.96 });
      updatedContext.product = 'CA_LOAN';
      updatedContext.profession = 'Chartered Accountant';
    } else if (lower.includes('business') || lower.includes('gst') || lower.includes('firm')) {
      product = 'BUSINESS_LOAN';
      extractedFacts.push({ field: 'product', value: 'BUSINESS_LOAN', confidence: 0.95 });
      updatedContext.product = 'BUSINESS_LOAN';
    } else if (lower.includes('abroad') || lower.includes('usa') || lower.includes('uk') || lower.includes('masters')) {
      product = 'EDUCATION_LOAN_GLOBAL';
      extractedFacts.push({ field: 'product', value: 'EDUCATION_LOAN_GLOBAL', confidence: 0.95 });
      updatedContext.product = 'EDUCATION_LOAN_GLOBAL';
    }

    // Extract City
    if (lower.includes('pune')) {
      extractedFacts.push({ field: 'city', value: 'Pune', confidence: 0.95 });
      updatedContext.city = 'Pune';
    } else if (lower.includes('mumbai')) {
      extractedFacts.push({ field: 'city', value: 'Mumbai', confidence: 0.95 });
      updatedContext.city = 'Mumbai';
    }

    // Extract Income
    if (lower.includes('lakh') || lower.includes('50k') || lower.includes('1k') || lower.includes('100000')) {
      extractedFacts.push({ field: 'monthlyIncomeRange', value: '₹75,000–₹1,50,000', confidence: 0.92 });
      updatedContext.monthlyIncomeRange = '₹75,000–₹1,50,000';
    }

    const leadScore = this.calculateLeadScore(updatedContext);
    const documentChecklist = this.getDocumentChecklistForProduct(product, updatedContext.profession);

    const isQualified = leadScore >= 60;
    const qualificationStatus = isQualified ? 'QUALIFIED' : 'PENDING';
    const nextAction = isQualified ? 'COLLECT_DOCUMENTS' : 'COLLECT_MORE_INFO';

    // Persist to Database
    await Lead.updateOne(
      { leadId },
      {
        $set: {
          loanType: product,
          profession: updatedContext.profession,
          city: updatedContext.city,
          leadScore,
          updatedAt: new Date()
        }
      }
    );

    const convId = `CONV_${leadId}`;
    await Conversation.updateOne(
      { conversationId: convId },
      {
        $set: {
          product,
          qualificationStatus,
          leadScore,
          context: updatedContext,
          updatedAt: new Date()
        }
      }
    );

    return {
      leadId,
      product,
      qualificationStatus,
      leadScore,
      extractedFacts,
      missingFields: updatedContext.city ? [] : ['city'],
      documentChecklist,
      nextAction
    };
  }
}
