import { NextResponse } from 'next/server';
import {
  requireAuth,
  requireRole,
  canAccessLead
} from '@/lib/auth';
import {
  CrmSheetsService,
  leadRepository,
  applicationRepository,
  SheetsCrmError
} from '@/lib/google-sheets';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const body = await req.json();
    const { action } = body;

    if (action === 'SUBMIT_APPLICATION') {
      const { lenderName, productName, applicationNumber, appliedAmount } = body;
      if (!lenderName) {
        return NextResponse.json({ success: false, error: 'lenderName is required' }, { status: 400 });
      }
      if (['SANCTIONED', 'DISBURSEMENT_PENDING', 'DISBURSED'].includes(lead.stage || '')) {
        return NextResponse.json(
          { success: false, error: `Cannot submit new application when lead is already in stage ${lead.stage}.` },
          { status: 400 }
        );
      }

      const appId = applicationNumber || `APP-${lead.leadId}`;
      const { record: appRow } = await applicationRepository.upsertApplication({
        application_id: appId,
        lead_id: lead.leadId,
        customer_id: lead.customerId,
        loan_category: productName || lead.loanType,
        requested_amount: appliedAmount ?? lead.requiredLoanAmount ?? '0',
        application_status: 'SUBMITTED',
        lender_status: `${lenderName}: SUBMITTED`,
        assigned_advisor_id: lead.assignedAdvisor.id
      });

      await leadRepository.upsertLead({
        lead_id: lead.leadId,
        customer_id: lead.customerId,
        loan_category: productName || lead.loanType,
        requested_amount: appRow.requested_amount,
        lead_status: 'APPLICATION_SUBMITTED',
        lead_source: lead.leadSource,
        assigned_advisor_id: lead.assignedAdvisor.id,
        priority: lead.priority
      });

      return NextResponse.json({
        success: true,
        leadId: lead.leadId,
        stage: 'APPLICATION_SUBMITTED',
        application: {
          applicationId: appRow.application_id,
          applicationNumber: appRow.application_id,
          lenderName,
          appliedAmount: Number(appRow.requested_amount) || 0,
          status: appRow.application_status,
          lenderStatus: appRow.lender_status
        }
      });
    } else if (action === 'RECORD_SANCTION') {
      const adminCheck = await requireRole(req, ['ADMIN']);
      if (!adminCheck.ok) return adminCheck.response;

      const numericSanction = Number(body.sanctionedAmount);
      if (!Number.isFinite(numericSanction) || numericSanction <= 0) {
        return NextResponse.json({ success: false, error: 'sanctionedAmount must be greater than 0' }, { status: 400 });
      }

      const { record: appRow } = await applicationRepository.upsertApplication({
        application_id: lead.application?.applicationId || `APP-${lead.leadId}`,
        lead_id: lead.leadId,
        customer_id: lead.customerId,
        loan_category: lead.loanType,
        requested_amount: numericSanction,
        application_status: 'SANCTIONED',
        lender_status: `${lead.application?.lenderName || 'Partner Lender'}: SANCTIONED`,
        assigned_advisor_id: lead.assignedAdvisor.id
      });

      await leadRepository.upsertLead({
        lead_id: lead.leadId,
        customer_id: lead.customerId,
        loan_category: lead.loanType,
        requested_amount: numericSanction,
        lead_status: 'SANCTIONED',
        lead_source: lead.leadSource,
        assigned_advisor_id: lead.assignedAdvisor.id,
        priority: lead.priority
      });

      return NextResponse.json({
        success: true,
        leadId: lead.leadId,
        stage: 'SANCTIONED',
        application: appRow
      });
    } else if (action === 'RECORD_DISBURSEMENT') {
      const adminCheck = await requireRole(req, ['ADMIN']);
      if (!adminCheck.ok) return adminCheck.response;

      const numericDisbursed = Number(body.disbursedAmount);
      if (!Number.isFinite(numericDisbursed) || numericDisbursed <= 0) {
        return NextResponse.json({ success: false, error: 'disbursedAmount must be greater than 0' }, { status: 400 });
      }

      const { record: appRow } = await applicationRepository.upsertApplication({
        application_id: lead.application?.applicationId || `APP-${lead.leadId}`,
        lead_id: lead.leadId,
        customer_id: lead.customerId,
        loan_category: lead.loanType,
        requested_amount: numericDisbursed,
        application_status: 'DISBURSED',
        lender_status: `${lead.application?.lenderName || 'Partner Lender'}: DISBURSED`,
        assigned_advisor_id: lead.assignedAdvisor.id
      });

      await leadRepository.upsertLead({
        lead_id: lead.leadId,
        customer_id: lead.customerId,
        loan_category: lead.loanType,
        requested_amount: numericDisbursed,
        lead_status: 'DISBURSED',
        lead_source: lead.leadSource,
        assigned_advisor_id: lead.assignedAdvisor.id,
        priority: lead.priority
      });

      return NextResponse.json({
        success: true,
        leadId: lead.leadId,
        stage: 'DISBURSED',
        application: appRow
      });
    }

    return NextResponse.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    const message = error instanceof SheetsCrmError ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: code, message }, { status });
  }
}
