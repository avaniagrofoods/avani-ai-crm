import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';
import { mapLegacyStatusToStage } from '@/config/pipeline';
import { FollowUpTaskEngine } from '@/lib/followup-task-engine';
import { CATEGORY_DOCUMENT_CHECKLISTS } from '@/lib/document-checklist';

function normalizeIndianPhone(input: string): { formatted: string; raw10: string } | null {
  if (!input) return null;
  const digits = String(input).replace(/[^0-9]/g, '');
  const raw10 = digits.length > 10 ? digits.slice(-10) : digits;
  if (raw10.length !== 10) return null;
  // Validate Indian mobile starting digit
  if (!/^[6-9]/.test(raw10)) return null;
  return {
    formatted: `+91${raw10}`,
    raw10
  };
}

function normalizeLoanCategory(loanType: string): string {
  const norm = String(loanType || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (norm.includes('DOCTOR') || norm.includes('MEDIC')) return 'Doctor Loan';
  if (norm.includes('BUSIN') || norm.includes('COMMERC') || norm.includes('MSME')) return 'Business Loan';
  if (norm.includes('MORTG') || norm.includes('LAP') || norm.includes('AGAINSTPROP')) return 'Mortgage Loan / LAP';
  if (norm.includes('HOME') || norm.includes('HOUS')) return 'Home Loan';
  if (norm.includes('GLOBAL') || norm.includes('ABROAD') || norm.includes('OVERSEA')) return 'Education Loan — Global Studies';
  if (norm.includes('EDU') || norm.includes('STUD')) return 'Education Loan — India';
  if (norm.includes('SCHOOL')) return 'School Funding';
  if (norm.includes('COLLEGE')) return 'College Funding';
  if (norm.includes('CA') || norm.includes('CHARTERED')) return 'CA Professional Loan';
  return 'Personal Loan';
}

function generateCanonicalLeadId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `AVL-${dateStr}-${randomNum}`;
}

export async function GET(req: Request) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Production persistence unavailable.' },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const stage = searchParams.get('stage');
    const product = searchParams.get('product');
    const advisor = searchParams.get('advisor');
    const city = searchParams.get('city');
    const q = searchParams.get('q');
    const followUpDue = searchParams.get('followUpDue');
    
    let query: any = {};
    const andConditions: any[] = [];

    if (phone) {
      const parsed = normalizeIndianPhone(phone);
      if (parsed) {
        andConditions.push({
          $or: [
            { phone: parsed.formatted },
            { phone: parsed.raw10 },
            { normalizedMobile: parsed.raw10 }
          ]
        });
      } else {
        query.phone = phone;
      }
    }

    if (stage) {
      andConditions.push({
        $or: [
          { stage: stage },
          { status: stage }
        ]
      });
    }

    if (product) {
      query.loanType = { $regex: product, $options: 'i' };
    }

    if (advisor) {
      andConditions.push({
        $or: [
          { 'assignedAdvisor.name': { $regex: advisor, $options: 'i' } },
          { 'assignedAgent.name': { $regex: advisor, $options: 'i' } }
        ]
      });
    }

    if (city) {
      query.city = { $regex: city, $options: 'i' };
    }

    if (q) {
      const cleanQ = q.trim();
      andConditions.push({
        $or: [
          { name: { $regex: cleanQ, $options: 'i' } },
          { phone: { $regex: cleanQ } },
          { leadId: { $regex: cleanQ, $options: 'i' } },
          { email: { $regex: cleanQ, $options: 'i' } }
        ]
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    if (followUpDue === 'true' || followUpDue === 'today') {
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      query['followUpTasks'] = {
        $elemMatch: {
          status: { $in: ['PENDING', 'OVERDUE'] },
          dueDate: { $lte: todayEnd }
        }
      };
    }

    const rawLeads = await Lead.find(query).sort({ createdAt: -1 }).limit(300);

    // Map and guarantee canonical stage on output
    const leads = rawLeads.map((l: any) => {
      const obj = l.toObject ? l.toObject() : l;
      if (!obj.stage) {
        obj.stage = mapLegacyStatusToStage(obj.status);
      }
      return obj;
    });

    return NextResponse.json({ success: true, count: leads.length, leads });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // API Key authentication if configured
    const expectedApiKey = process.env.CRM_API_KEY;
    if (expectedApiKey) {
      const authHeader = req.headers.get('x-api-key') || req.headers.get('authorization');
      const providedKey = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
      if (providedKey !== expectedApiKey) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Invalid or missing API key' },
          { status: 401 }
        );
      }
    }

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'DATABASE_UNAVAILABLE',
          message: 'Database persistence unavailable: connection failed or MONGODB_URI is unconfigured.'
        },
        { status: 503 }
      );
    }
    const body = await req.json();

    const {
      name,
      phone,
      loanType,
      email,
      city,
      state,
      leadSource,
      source,
      campaign,
      campaignId,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      monthlyIncome,
      requestedAmount,
      employmentType,
      preferredLanguage,
      consentStatus,
      consentPurpose,
      consentTimestamp,
      isOptedOut,
      idempotencyKey,
      stage,
      doctorLoanDetails,
      businessLoanDetails,
      homeLoanDetails,
      lapDetails,
      educationLoanDetails,
      institutionalFundingDetails
    } = body;

    // Validate mandatory fields
    if (!name || !phone || !loanType) {
      return NextResponse.json(
        { success: false, error: 'Missing mandatory fields: name, phone, and loanType are required.' },
        { status: 400 }
      );
    }

    // Phone normalization
    const phoneData = normalizeIndianPhone(phone);
    if (!phoneData) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number. Must be a valid 10-digit Indian mobile number.' },
        { status: 400 }
      );
    }

    // DPDP Act Consent Check
    const isConsentDenied = consentStatus === 'DENIED' || body.consent === false;
    if (isConsentDenied) {
      return NextResponse.json(
        { success: false, error: 'DPDP Act Consent required: processing cannot proceed without applicant consent.' },
        { status: 403 }
      );
    }

    const canonicalLoanCategory = normalizeLoanCategory(loanType);
    const normalizedPhoneFormatted = phoneData.formatted;
    const normalizedMobileDigits = phoneData.raw10;

    // Deduplication / Idempotency Check
    const existingLead = await Lead.findOne({
      $or: [
        { phone: normalizedPhoneFormatted },
        { phone: normalizedMobileDigits },
        { normalizedMobile: normalizedMobileDigits },
        ...(idempotencyKey ? [{ idempotencyKey }] : [])
      ]
    });

    const leadId = existingLead?.leadId || body.leadId || generateCanonicalLeadId();
    const initialStage = stage || (existingLead ? (existingLead.stage || mapLegacyStatusToStage(existingLead.status)) : 'NEW_ENQUIRY');

    const updatePayload: any = {
      name,
      phone: normalizedPhoneFormatted,
      normalizedMobile: normalizedMobileDigits,
      loanType: canonicalLoanCategory,
      stage: initialStage,
      updatedAt: new Date(),
      assignedAdvisor: {
        name: 'Sachin Shinde',
        email: 'enquiry@avanifinserv.com',
        phone: '+91 72491 08474',
        role: 'CHIEF_LOAN_ADVISOR',
        assignedAt: new Date()
      }
    };

    if (email) updatePayload.email = email;
    if (city) updatePayload.city = city;
    if (state) updatePayload.state = state;
    if (leadSource || source) updatePayload.leadSource = leadSource || source || 'WEBSITE';
    if (campaign) updatePayload.campaign = campaign;
    if (campaignId) updatePayload.campaignId = campaignId;
    if (utmSource) updatePayload.utmSource = utmSource;
    if (utmMedium) updatePayload.utmMedium = utmMedium;
    if (utmCampaign) updatePayload.utmCampaign = utmCampaign;
    if (utmContent) updatePayload.utmContent = utmContent;
    if (utmTerm) updatePayload.utmTerm = utmTerm;
    if (monthlyIncome !== undefined) updatePayload.monthlyIncome = Number(monthlyIncome) || 0;
    if (requestedAmount !== undefined) {
      updatePayload.requestedAmount = String(requestedAmount);
      const numAmt = Number(String(requestedAmount).replace(/[^0-9.]/g, ''));
      if (Number.isFinite(numAmt) && numAmt > 0) updatePayload.requiredLoanAmount = numAmt;
    }
    if (body.requiredLoanAmount !== undefined) updatePayload.requiredLoanAmount = Number(body.requiredLoanAmount) || 0;
    if (employmentType) updatePayload.employmentType = employmentType;
    if (preferredLanguage) updatePayload.preferredLanguage = preferredLanguage;
    if (idempotencyKey) updatePayload.idempotencyKey = idempotencyKey;

    // Sub-details if provided
    if (doctorLoanDetails) updatePayload.doctorLoanDetails = doctorLoanDetails;
    if (businessLoanDetails) updatePayload.businessLoanDetails = businessLoanDetails;
    if (homeLoanDetails) updatePayload.homeLoanDetails = homeLoanDetails;
    if (lapDetails) updatePayload.lapDetails = lapDetails;
    if (educationLoanDetails) updatePayload.educationLoanDetails = educationLoanDetails;
    if (institutionalFundingDetails) updatePayload.institutionalFundingDetails = institutionalFundingDetails;

    // Consent fields
    updatePayload.consentStatus = consentStatus || 'GRANTED';
    updatePayload.consentPurpose = consentPurpose || 'LOAN_ELIGIBILITY_PROCESSING';
    updatePayload.consentTimestamp = consentTimestamp ? new Date(consentTimestamp) : new Date();
    updatePayload.isOptedOut = !!isOptedOut;

    // Stage history initialization
    if (!existingLead) {
      updatePayload.stageHistory = [{
        stage: initialStage,
        changedBy: 'SYSTEM_INTAKE',
        changedAt: new Date(),
        reason: 'New enquiry registered',
        notes: `Source: ${updatePayload.leadSource}`
      }];
      // Initialize default follow-up tasks & product document checklist
      updatePayload.followUpTasks = FollowUpTaskEngine.generateInitialTasks(leadId, 'Sachin Shinde');
      const checklistDefs = CATEGORY_DOCUMENT_CHECKLISTS[canonicalLoanCategory] || CATEGORY_DOCUMENT_CHECKLISTS['Personal Loan'];
      updatePayload.documentChecklist = checklistDefs.map((def) => ({ ...def, status: 'PENDING', updatedAt: new Date() }));
    }

    const lead = await Lead.findOneAndUpdate(
      {
        $or: [
          { phone: normalizedPhoneFormatted },
          { phone: normalizedMobileDigits },
          { normalizedMobile: normalizedMobileDigits },
          ...(idempotencyKey ? [{ idempotencyKey }] : [])
        ]
      },
      {
        $set: updatePayload,
        $setOnInsert: {
          leadId,
          createdAt: new Date(),
          status: 'NEW'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Synchronize Contact entry
    await Contact.findOneAndUpdate(
      {
        $or: [
          { phone: normalizedPhoneFormatted },
          { phone: normalizedMobileDigits }
        ]
      },
      {
        $set: {
          name,
          phone: normalizedPhoneFormatted,
          updatedAt: new Date()
        },
        $setOnInsert: {
          leadId: lead._id,
          optedIn: !isOptedOut,
          createdAt: new Date()
        }
      },
      { upsert: true, new: true }
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      leadId: lead.leadId,
      stage: lead.stage,
      lead
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
