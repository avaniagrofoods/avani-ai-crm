import { NextResponse } from 'next/server';
import { CANONICAL_LEAD_STAGES, CanonicalLeadStage } from '@/config/pipeline';
import {
  requireAuth,
  requireRole,
  canAccessLead,
  validateStageTransition,
  sanitizeLeadPayloadForClient
} from '@/lib/auth';
import {
  CrmSheetsService,
  leadRepository,
  customerRepository,
  SheetsCrmError
} from '@/lib/google-sheets';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    await CrmSheetsService.assertHealthy();
    const resolvedParams = await params;
    const lead = await CrmSheetsService.findHydratedLeadByIdOrPhone(resolvedParams.id);
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    if (!canAccessLead(auth.session, lead)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'You are not assigned to this lead.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, lead: sanitizeLeadPayloadForClient(lead, auth.session) });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    const message = error instanceof SheetsCrmError ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: code, message }, { status });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN', 'ADVISOR']);
    if (!auth.ok) return auth.response;

    await CrmSheetsService.assertHealthy();
    const resolvedParams = await params;
    const currentLead = await CrmSheetsService.findHydratedLeadByIdOrPhone(resolvedParams.id);
    if (!currentLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    if (!canAccessLead(auth.session, currentLead)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'You are not authorized to modify this lead.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    let targetStage = currentLead.stage;

    if (body.stage) {
      if (!CANONICAL_LEAD_STAGES.includes(body.stage as CanonicalLeadStage)) {
        return NextResponse.json(
          { success: false, error: `Invalid canonical stage: ${body.stage}` },
          { status: 400 }
        );
      }
      const transitionCheck = validateStageTransition(auth.session, currentLead.stage, body.stage);
      if (!transitionCheck.ok) {
        return NextResponse.json(
          { success: false, error: transitionCheck.error },
          { status: transitionCheck.status }
        );
      }
      targetStage = body.stage;
    }

    if (body.name || body.city) {
      await customerRepository.upsertCustomer({
        customer_id: currentLead.customerId,
        customer_name: body.name || currentLead.name,
        mobile_number: currentLead.phone,
        city: body.city || currentLead.city,
        enquiry_source: currentLead.leadSource
      });
    }

    const assignedAdvisorId =
      auth.session.role === 'ADMIN' && (body.assignedAdvisorId || body.assignedAdvisor?.id)
        ? body.assignedAdvisorId || body.assignedAdvisor?.id
        : currentLead.assignedAdvisor.id;

    const { record: updatedRow } = await leadRepository.upsertLead({
      lead_id: currentLead.leadId,
      customer_id: currentLead.customerId,
      loan_category: body.loanType || currentLead.loanType,
      requested_amount: body.requestedAmount ?? body.requiredLoanAmount ?? currentLead.requestedAmount,
      lead_status: targetStage,
      lead_source: body.leadSource || currentLead.leadSource,
      assigned_advisor_id: assignedAdvisorId,
      priority: body.priority || currentLead.priority
    });

    const hydrated = await CrmSheetsService.hydrateLeadView(updatedRow);
    return NextResponse.json({ success: true, lead: sanitizeLeadPayloadForClient(hydrated, auth.session) });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    const message = error instanceof SheetsCrmError ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: code, message }, { status });
  }
}
