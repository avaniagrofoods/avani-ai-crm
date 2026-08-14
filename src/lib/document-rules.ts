import connectToDatabase from '@/lib/db';
import { DocumentModel } from '@/models/Document';
import { Lead } from '@/models/Lead';
import { ConversationStateManager } from '@/lib/orchestrator/state-manager';

export interface ProductDocRule {
  product: string;
  customerType: string;
  requiredDocuments: string[];
  optionalDocuments?: string[];
  conditionalDocuments?: string[];
}

export class ProductDocumentRulesEngine {
  static getRulesForProduct(product: string, customerType = 'INDIVIDUAL'): ProductDocRule {
    switch (product) {
      case 'DOCTOR_LOAN':
        return {
          product,
          customerType,
          requiredDocuments: [
            'Medical Degree / Registration Certificate',
            'PAN Card',
            'Aadhaar Card',
            'Last 2 Years Income Tax Returns (ITR)',
            'Last 12 Months Bank Statements'
          ],
          optionalDocuments: ['Clinic Ownership Proof', 'Medical Council ID Card']
        };
      case 'CA_LOAN':
        return {
          product,
          customerType,
          requiredDocuments: [
            'ICAI COP / Membership Certificate',
            'PAN Card',
            'Aadhaar Card',
            'Last 2 Years Audited Financials & ITR',
            'Last 12 Months Bank Statements'
          ],
          optionalDocuments: ['Office Lease Agreement']
        };
      case 'BUSINESS_LOAN':
        return {
          product,
          customerType,
          requiredDocuments: [
            'GST Registration & Returns (12 Months)',
            'Business PAN & Aadhaar of Promoter',
            'Last 2 Years Audited Financials & ITR',
            'Last 12 Months Bank Statements',
            'Shop Act / Udhyam Certificate'
          ]
        };
      case 'HOME_LOAN':
      case 'MORTGAGE_LOAN':
        return {
          product,
          customerType,
          requiredDocuments: [
            'Property Sale Agreement / Title Deeds',
            'PAN & Aadhaar Card',
            'Salary Slips (3 Mth) or ITR (2 Yrs)',
            'Last 12 Months Bank Statements',
            'Approved Construction Plan / NOC'
          ]
        };
      case 'EDUCATION_LOAN_GLOBAL':
      case 'EDUCATION_LOAN_INDIA':
        return {
          product,
          customerType,
          requiredDocuments: [
            'Admission Offer Letter / I-20 Form',
            'Student & Co-Applicant Academic Records',
            'Co-Applicant PAN & Aadhaar Card',
            'Co-Applicant Income Proof (ITR / Bank Stmt)',
            'GRE / TOEFL / IELTS Scorecard'
          ]
        };
      case 'SCHOOL_FUNDING':
      case 'COLLEGE_FUNDING':
        return {
          product,
          customerType,
          requiredDocuments: [
            'Trust / Society Registration Certificate',
            'Affiliation & Recognition License',
            '3 Years Audited Financials & Balance Sheet',
            'Bank Statements (12 Months)',
            'Property Title Deeds / Land License'
          ]
        };
      case 'PERSONAL_LOAN':
      default:
        return {
          product: 'PERSONAL_LOAN',
          customerType,
          requiredDocuments: [
            'PAN Card',
            'Aadhaar Card',
            'Last 3 Months Salary Slips',
            'Last 6 Months Bank Statements'
          ]
        };
    }
  }

  static async generateChecklist(leadId: string, product: string, customerType = 'INDIVIDUAL') {
    await connectToDatabase();

    const rule = this.getRulesForProduct(product, customerType);
    let docRecord = await DocumentModel.findOne({ leadId });

    if (!docRecord) {
      docRecord = await DocumentModel.create({
        leadId,
        product,
        customerType,
        requiredDocuments: rule.requiredDocuments,
        receivedDocuments: [],
        missingDocuments: rule.requiredDocuments,
        status: 'CHECKLIST_GENERATED',
        auditLog: [{ action: 'CHECKLIST_GENERATED', timestamp: new Date(), detail: `Product: ${product}` }]
      });
    }

    await ConversationStateManager.transitionStage(leadId, 'DOCUMENT_COLLECTION', 'CHECKLIST_GENERATED', {
      documentStatus: 'PENDING'
    });

    return docRecord;
  }

  static async processReceivedDocument(leadId: string, docName: string) {
    await connectToDatabase();

    let docRecord = await DocumentModel.findOne({ leadId });
    if (!docRecord) return null;

    const received = new Set([...(docRecord.receivedDocuments || []), docName]);
    const missing = docRecord.requiredDocuments.filter((d: string) => !received.has(d));

    let status = docRecord.status;
    if (missing.length === 0) status = 'DOCUMENTS_SUBMITTED';
    else if (received.size > 0) status = 'PARTIAL';

    docRecord.receivedDocuments = Array.from(received);
    docRecord.missingDocuments = missing;
    docRecord.status = status as any;
    docRecord.auditLog.push({
      action: 'DOCUMENT_RECEIVED',
      timestamp: new Date(),
      detail: `Received: ${docName}`
    });

    await docRecord.save();

    if (missing.length === 0) {
      await ConversationStateManager.transitionStage(leadId, 'ADVISOR_HANDOFF', 'DOCUMENTS_COMPLETE', {
        documentStatus: 'COMPLETE'
      });
    }

    return docRecord;
  }
}
