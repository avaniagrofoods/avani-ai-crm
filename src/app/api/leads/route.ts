import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';

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
  if (norm.includes('DOCTOR') || norm.includes('MEDIC')) return 'DOCTOR_LOAN';
  if (norm.includes('BUSIN') || norm.includes('COMMERC') || norm.includes('MSME')) return 'BUSINESS_LOAN';
  if (norm.includes('MORTG') || norm.includes('LAP') || norm.includes('AGAINSTPROP')) return 'MORTGAGE_LOAN';
  if (norm.includes('HOME') || norm.includes('HOUS')) return 'HOME_LOAN';
  if (norm.includes('GLOBAL') || norm.includes('ABROAD') || norm.includes('OVERSEA')) return 'EDUCATION_LOAN_GLOBAL';
  if (norm.includes('EDU') || norm.includes('STUD')) return 'EDUCATION_LOAN_INDIA';
  if (norm.includes('SCHOOL') || norm.includes('COLLEGE') || norm.includes('INSTITUT')) return 'SCHOOL_COLLEGE_FUNDING';
  return 'PERSONAL_LOAN';
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
    
    let query: any = {};
    if (phone) {
      const parsed = normalizeIndianPhone(phone);
      if (parsed) {
        query = {
          $or: [
            { phone: parsed.formatted },
            { phone: parsed.raw10 },
            { normalizedMobile: parsed.raw10 }
          ]
        };
      } else {
        query = { phone };
      }
    }

    const leads = await Lead.find(query).sort({ createdAt: -1 }).limit(200);
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
          message: 'Database persistence unavailable: connection failed or MONGODB_URI is unconfigured. Lead intake cannot guarantee durable persistence.'
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
      idempotencyKey
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

    const updatePayload: any = {
      name,
      phone: normalizedPhoneFormatted,
      normalizedMobile: normalizedMobileDigits,
      loanType: canonicalLoanCategory,
      updatedAt: new Date(),
      assignedAgent: {
        name: 'Sachin Shinde',
        email: 'enquiry@avanifinserv.com',
        status: 'ACTIVE'
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
    if (requestedAmount !== undefined) updatePayload.requestedAmount = String(requestedAmount);
    if (employmentType) updatePayload.employmentType = employmentType;
    if (preferredLanguage) updatePayload.preferredLanguage = preferredLanguage;
    if (idempotencyKey) updatePayload.idempotencyKey = idempotencyKey;

    // Consent fields
    updatePayload.consentStatus = consentStatus || 'GRANTED';
    updatePayload.consentPurpose = consentPurpose || 'LOAN_ELIGIBILITY_PROCESSING';
    updatePayload.consentTimestamp = consentTimestamp ? new Date(consentTimestamp) : new Date();

    // Opt-out handling
    if (isOptedOut || body.optOutRequested) {
      updatePayload.isOptedOut = true;
      updatePayload.optedOutAt = new Date();
      updatePayload.status = 'OPTED_OUT';
    } else if (!existingLead) {
      updatePayload.status = 'NEW';
      updatePayload.leadId = leadId;
      updatePayload.createdAt = new Date();
    }

    // Upsert Lead
    const lead = await Lead.findOneAndUpdate(
      {
        $or: [
          { phone: normalizedPhoneFormatted },
          { normalizedMobile: normalizedMobileDigits }
        ]
      },
      { $set: updatePayload },
      { new: true, upsert: true }
    );

    // Synchronize to Contact book
    await Contact.findOneAndUpdate(
      { phone: normalizedPhoneFormatted },
      {
        $set: {
          name,
          phone: normalizedPhoneFormatted,
          email: email || '',
          city: city || '',
          leadId: lead._id,
          updatedAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    return NextResponse.json({
      success: true,
      leadId: lead.leadId || leadId,
      status: lead.status,
      assignedAdvisor: lead.assignedAgent?.name || 'Sachin Shinde',
      idempotencyHit: !!existingLead,
      productCategory: canonicalLoanCategory,
      acknowledged: true
    });
  } catch (error: any) {
    console.error('[CRM Leads API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
