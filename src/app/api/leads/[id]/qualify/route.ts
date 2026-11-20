import { NextResponse } from 'next/server';
import { QualificationEngine } from '@/lib/qualification-engine';
import { requireAuth, canAccessLead } from '@/lib/auth';
import { CrmSheetsService, leadRepository, SheetsCrmError } from '@/lib/google-sheets';

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

    const result = QualificationEngine.calculateScore(lead, null, null);
    let nextStage = lead.stage;
    if (result.score >= 60 && (lead.stage === 'NEW_ENQUIRY' || lead.stage === 'CONTACT_PENDING')) {
      nextStage = 'QUALIFIED';
      await leadRepository.upsertLead({
        lead_id: lead.leadId,
        customer_id: lead.customerId,
        loan_category: lead.loanType,
        requested_amount: lead.requestedAmount,
        lead_status: nextStage,
        lead_source: lead.leadSource,
        assigned_advisor_id: lead.assignedAdvisor.id,
        priority: result.score >= 80 ? 'HIGH' : lead.priority
      });
    }

    return NextResponse.json({
      success: true,
      leadId: lead.leadId,
      stage: nextStage,
      score: result.score,
      tier: result.tier,
      tierLabel: result.tierLabel,
      breakdown: result.breakdown,
      reasoning: result.reasoning
    });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}
