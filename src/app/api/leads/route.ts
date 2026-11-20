import { NextResponse } from 'next/server';
import {
  requireAuth,
  sanitizeLeadPayloadForClient,
  validateStageTransition,
  canAccessLead
} from '@/lib/auth';
import {
  CrmSheetsService,
  SheetsCrmError,
  normalizeMobileNumber,
  validateLoanCategory
} from '@/lib/google-sheets';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    await CrmSheetsService.assertHealthy();
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const stage = searchParams.get('stage');
    const product = searchParams.get('product');
    const advisor = searchParams.get('advisor');
    const city = searchParams.get('city');
    const q = searchParams.get('q');
    const followUpDue = searchParams.get('followUpDue');

    let allLeads = await CrmSheetsService.listHydratedLeads();

    if (phone) {
      const digits = phone.replace(/\D/g, '').slice(-10);
      allLeads = allLeads.filter(
        (l) => l.phone === phone || (digits && l.normalizedMobile === digits)
      );
    }
    if (stage) {
      allLeads = allLeads.filter((l) => l.stage === stage || l.status === stage);
    }
    if (product) {
      const pLower = product.toLowerCase();
      allLeads = allLeads.filter((l) => l.loanType.toLowerCase().includes(pLower));
    }
    if (advisor) {
      const aLower = advisor.toLowerCase();
      allLeads = allLeads.filter(
        (l) =>
          l.assignedAdvisor.name.toLowerCase().includes(aLower) ||
          l.assignedAdvisor.id.toLowerCase().includes(aLower)
      );
    }
    if (city) {
      const cLower = city.toLowerCase();
      allLeads = allLeads.filter((l) => l.city.toLowerCase().includes(cLower));
    }
    if (q) {
      const qLower = q.trim().toLowerCase();
      allLeads = allLeads.filter(
        (l) =>
          l.name.toLowerCase().includes(qLower) ||
          l.phone.includes(qLower) ||
          l.leadId.toLowerCase().includes(qLower)
      );
    }
    if (followUpDue === 'true' || followUpDue === 'today') {
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      allLeads = allLeads.filter((l) =>
        l.followUpTasks.some(
          (t) =>
            (t.status === 'PENDING' || t.status === 'OVERDUE') &&
            new Date(t.dueDate) <= todayEnd
        )
      );
    }

    const visibleLeads = allLeads
      .filter((l) => canAccessLead(auth.session, l))
      .slice(0, 300)
      .map((l) => sanitizeLeadPayloadForClient(l, auth.session));

    return NextResponse.json({ success: true, count: visibleLeads.length, leads: visibleLeads });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}

export async function POST(req: Request) {
  try {
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

    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    await CrmSheetsService.assertHealthy();
    const body = await req.json();

    if (
      auth.session.role !== 'ADMIN' &&
      (body.revenue || body.revenueTracking || body.actualRevenueReceived !== undefined || body.sanction || body.disbursement || body.role)
    ) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'Only ADMIN may set privileged fields.' },
        { status: 403 }
      );
    }

    const { name, phone, loanType, city, leadSource, source, requestedAmount, requiredLoanAmount, consentStatus, isOptedOut, stage, priority } = body;

    if (!name || !phone || !loanType) {
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

    const isConsentDenied = consentStatus === 'DENIED' || body.consent === false;
    if (isConsentDenied) {
      return NextResponse.json(
        { success: false, error: 'DPDP Act Consent required: processing cannot proceed without applicant consent.' },
        { status: 403 }
      );
    }

    const existing = await CrmSheetsService.findHydratedLeadByIdOrPhone(phone);
    if (stage) {
      const stageCheck = validateStageTransition(auth.session, existing?.stage || 'NEW_ENQUIRY', stage);
      if (!stageCheck.ok) {
        return NextResponse.json({ success: false, error: stageCheck.error }, { status: stageCheck.status });
      }
    }
    if (existing && !canAccessLead(auth.session, existing)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'Lead is assigned to another advisor.' },
        { status: 403 }
      );
    }

    const { hydrated } = await CrmSheetsService.registerOrUpdateCustomerLead({
      leadId: existing?.leadId || body.leadId,
      name,
      phone,
      city,
      loanCategory: validateLoanCategory(loanType),
      requestedAmount: requestedAmount ?? requiredLoanAmount ?? '0',
      leadStatus: stage || existing?.stage || 'NEW_ENQUIRY',
      leadSource: leadSource || source || 'WEBSITE',
      assignedAdvisorId: body.assignedAdvisorId || existing?.assignedAdvisor?.id || 'ADV-SACHIN-01',
      priority: priority || 'MEDIUM',
      consentStatus: consentStatus || 'GRANTED',
      consentSource: leadSource || source || 'WEBSITE',
      isOptedOut: Boolean(isOptedOut)
    });

    return NextResponse.json({
      success: true,
      leadId: hydrated.leadId,
      stage: hydrated.stage,
      lead: hydrated
    });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}
