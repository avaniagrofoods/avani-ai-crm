import { NextResponse } from 'next/server';
import {
  CrmSheetsService,
  SheetsCrmError,
  normalizeMobileNumber,
  validateLoanCategory
} from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/enquiry
 * Public loan enquiry intake endpoint backed exclusively by Google Sheets (CUSTOMERS, LEADS, CONSENTS, FOLLOWUPS).
 */
export async function POST(req: Request) {
  try {
    await CrmSheetsService.assertHealthy();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
    }

    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const loanTypeInput = String(body.loanType || '').trim();
    const city = body.city ? String(body.city).trim() : undefined;
    const requestedAmount = body.requestedAmount ?? body.requiredLoanAmount ?? '0';

    if (!name || !phone || !loanTypeInput) {
      return NextResponse.json(
        { success: false, error: 'Missing mandatory fields: name, phone, and loanType are required.' },
        { status: 400 }
      );
    }

    try {
      normalizeMobileNumber(phone);
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
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

    const { hydrated } = await CrmSheetsService.registerOrUpdateCustomerLead({
      name,
      phone,
      city,
      loanCategory: validateLoanCategory(loanTypeInput),
      requestedAmount,
      leadStatus: 'NEW_ENQUIRY',
      leadSource: body.leadSource ? String(body.leadSource).slice(0, 60) : 'WEBSITE_PUBLIC_FORM',
      consentStatus: 'GRANTED',
      consentSource: 'WEBSITE_PUBLIC_FORM',
      isOptedOut: false
    });

    return NextResponse.json(
      {
        success: true,
        leadId: hydrated.leadId,
        customerId: hydrated.customerId,
        message: 'Thank you. Your loan enquiry has been registered safely.'
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}
