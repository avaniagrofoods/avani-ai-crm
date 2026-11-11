import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';
import { parseIndianPhone } from '@/lib/phone';
import { normalizeLoanCategory, generateCanonicalLeadId } from '@/config/pipeline';
import { CATEGORY_DOCUMENT_CHECKLISTS } from '@/lib/document-checklist';
import { FollowUpTaskEngine } from '@/lib/followup-task-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/enquiry
 * Dedicated public intake endpoint for Avani Financial website / Meta landing forms.
 * Strips all privileged CRM workflow, financial, and role fields so external callers
 * cannot escalate privileges, assign advisors, or mutate pipeline revenue.
 */
export async function POST(req: Request) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Service temporarily unavailable.' },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
    }

    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const loanTypeInput = String(body.loanType || '').trim();
    const email = body.email ? String(body.email).trim() : undefined;
    const city = body.city ? String(body.city).trim() : undefined;
    const state = body.state ? String(body.state).trim() : undefined;
    const monthlyIncome = body.monthlyIncome !== undefined ? Number(body.monthlyIncome) : undefined;
    const requestedAmount = body.requestedAmount ? String(body.requestedAmount).trim() : undefined;
    const employmentType = body.employmentType ? String(body.employmentType).trim() : undefined;
    const preferredLanguage = body.preferredLanguage ? String(body.preferredLanguage).trim() : undefined;

    if (!name || !phone || !loanTypeInput) {
      return NextResponse.json(
        { success: false, error: 'Missing mandatory fields: name, phone, and loanType are required.' },
        { status: 400 }
      );
    }

    const phoneData = parseIndianPhone(phone);
    if (!phoneData) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number. Must be a valid 10-digit Indian mobile number.' },
        { status: 400 }
      );
    }

    const isConsentDenied = body.consentStatus === 'DENIED' || body.consent === false;
    if (isConsentDenied) {
      return NextResponse.json(
        { success: false, error: 'DPDP Act Consent required: processing cannot proceed without applicant consent.' },
        { status: 403 }
      );
    }

    const isConsentExplicitlyGranted = body.consentStatus === 'GRANTED' || body.consent === true;
    if (!isConsentExplicitlyGranted) {
      return NextResponse.json(
        {
          success: false,
          error: 'DPDP Act Consent required: missing consent. Provide explicit consentStatus="GRANTED" or consent=true.'
        },
        { status: 400 }
      );
    }

    const canonicalLoanCategory = normalizeLoanCategory(loanTypeInput);
    const normalizedPhoneFormatted = phoneData.formatted;
    const normalizedMobileDigits = phoneData.raw10;

    const existingLead = await Lead.findOne({
      $or: [
        { phone: normalizedPhoneFormatted },
        { phone: normalizedMobileDigits },
        { normalizedMobile: normalizedMobileDigits }
      ]
    });

    const leadId = existingLead?.leadId || generateCanonicalLeadId();
    const checklistDefs = CATEGORY_DOCUMENT_CHECKLISTS[canonicalLoanCategory] || CATEGORY_DOCUMENT_CHECKLISTS['Personal Loan'];

    const sanitizedSet: Record<string, any> = {
      name,
      phone: normalizedPhoneFormatted,
      normalizedMobile: normalizedMobileDigits,
      loanType: canonicalLoanCategory,
      leadSource: body.leadSource ? String(body.leadSource).slice(0, 60) : 'WEBSITE_PUBLIC_FORM',
      consentStatus: 'GRANTED',
      consentPurpose: 'LOAN_ELIGIBILITY_PROCESSING',
      consentTimestamp: new Date(),
      isOptedOut: false,
      updatedAt: new Date()
    };

    if (email) sanitizedSet.email = email;
    if (city) sanitizedSet.city = city;
    if (state) sanitizedSet.state = state;
    if (employmentType) sanitizedSet.employmentType = employmentType;
    if (preferredLanguage) sanitizedSet.preferredLanguage = preferredLanguage;
    if (monthlyIncome !== undefined && Number.isFinite(monthlyIncome) && monthlyIncome >= 0) {
      sanitizedSet.monthlyIncome = monthlyIncome;
    }
    if (requestedAmount) {
      sanitizedSet.requestedAmount = requestedAmount;
      const numericAmount = Number(requestedAmount.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(numericAmount) && numericAmount > 0) {
        sanitizedSet.requiredLoanAmount = numericAmount;
      }
    }

    const setOnInsertFields: Record<string, any> = {
      leadId,
      stage: 'NEW_ENQUIRY',
      status: 'New',
      assignedAdvisor: {
        name: 'Sachin Shinde',
        email: 'enquiry@avanifinserv.com',
        phone: '+91 72491 08474',
        role: 'CHIEF_LOAN_ADVISOR',
        assignedAt: new Date()
      },
      stageHistory: [
        {
          stage: 'NEW_ENQUIRY',
          changedBy: 'PUBLIC_WEBSITE_ENQUIRY',
          changedAt: new Date(),
          reason: 'Public website enquiry submitted',
          notes: `Source: ${sanitizedSet.leadSource}`
        }
      ],
      followUpTasks: FollowUpTaskEngine.generateInitialTasks(leadId, 'Sachin Shinde'),
      documentChecklist: checklistDefs.map((def) => ({ ...def, status: 'PENDING', updatedAt: new Date() })),
      createdAt: new Date()
    };

    const lead = await Lead.findOneAndUpdate(
      {
        $or: [
          { phone: normalizedPhoneFormatted },
          { phone: normalizedMobileDigits },
          { normalizedMobile: normalizedMobileDigits }
        ]
      },
      {
        $set: sanitizedSet,
        $setOnInsert: setOnInsertFields
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Contact.findOneAndUpdate(
      { $or: [{ phone: normalizedPhoneFormatted }, { phone: normalizedMobileDigits }] },
      {
        $set: { name, phone: normalizedPhoneFormatted, updatedAt: new Date() },
        $setOnInsert: { leadId: lead._id, optedIn: true, createdAt: new Date() }
      },
      { upsert: true, new: true }
    ).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        leadId: lead.leadId,
        message: 'Thank you. Your loan enquiry has been registered safely.'
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Unable to submit enquiry.' }, { status: 500 });
  }
}
