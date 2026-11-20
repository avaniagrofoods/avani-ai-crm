import { NextResponse } from 'next/server';
import { CANONICAL_LEAD_STAGES, mapLegacyStatusToStage } from '@/config/pipeline';
import { requireAuth, canAccessLead } from '@/lib/auth';
import {
  CrmSheetsService,
  messageEventRepository,
  webhookEventRepository,
  SheetsCrmError
} from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export interface DashboardFilterParams {
  dateFrom?: string | null;
  dateTo?: string | null;
  loanCategory?: string | null;
  city?: string | null;
  applicantCategory?: string | null;
  leadStatus?: string | null;
  stage?: string | null;
  assignedAdvisor?: string | null;
  source?: string | null;
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url || 'http://localhost/api/dashboard/metrics');
  const filterParams: DashboardFilterParams = {
    dateFrom: searchParams.get('dateFrom') || searchParams.get('date'),
    dateTo: searchParams.get('dateTo'),
    loanCategory: searchParams.get('loanCategory'),
    city: searchParams.get('city'),
    applicantCategory: searchParams.get('applicantCategory'),
    leadStatus: searchParams.get('leadStatus'),
    stage: searchParams.get('stage'),
    assignedAdvisor: searchParams.get('assignedAdvisor'),
    source: searchParams.get('source')
  };

  try {
    await CrmSheetsService.assertHealthy();

    const [allLeads, msgEvents, webhookEvents] = await Promise.all([
      CrmSheetsService.listHydratedLeads(),
      messageEventRepository.findAll(),
      webhookEventRepository.findAll()
    ]);

    let leads = allLeads.filter((l) => canAccessLead(auth.session, l));

    if (filterParams.loanCategory && filterParams.loanCategory !== 'ALL') {
      leads = leads.filter((l) => l.loanType === filterParams.loanCategory);
    }
    if (filterParams.city && filterParams.city !== 'ALL') {
      const cLower = filterParams.city.toLowerCase();
      leads = leads.filter((l) => l.city.toLowerCase() === cLower);
    }
    if (filterParams.stage && filterParams.stage !== 'ALL') {
      leads = leads.filter((l) => l.stage === filterParams.stage);
    }
    if (filterParams.source && filterParams.source !== 'ALL') {
      const sLower = filterParams.source.toLowerCase();
      leads = leads.filter((l) => l.leadSource.toLowerCase().includes(sLower));
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const now = new Date();

    const stageCounts: Record<string, number> = {};
    for (const s of CANONICAL_LEAD_STAGES) {
      stageCounts[s] = 0;
    }

    const leadsByLoanCategory: Record<string, number> = {};
    const leadsByCity: Record<string, number> = {};

    let newLeadsToday = 0;
    let pendingFollowUpsCount = 0;
    let overdueFollowUpsCount = 0;
    let followUpTasksDueCount = 0;
    let unqualifiedLeadsCount = 0;

    let funnelEnquiries = 0;
    let funnelContacted = 0;
    let funnelQualified = 0;
    let funnelDocsReceived = 0;
    let funnelAppSubmitted = 0;
    let funnelSanctioned = 0;
    let funnelDisbursed = 0;
    let funnelClosedLost = 0;

    for (const l of leads) {
      const resolvedStage = l.stage || mapLegacyStatusToStage(l.status);
      stageCounts[resolvedStage] = (stageCounts[resolvedStage] || 0) + 1;

      const cat = l.loanType || 'Personal Loan';
      leadsByLoanCategory[cat] = (leadsByLoanCategory[cat] || 0) + 1;

      const city = l.city || 'Latur';
      leadsByCity[city] = (leadsByCity[city] || 0) + 1;

      if (l.createdAt && new Date(l.createdAt) >= startOfToday) {
        newLeadsToday++;
      }

      funnelEnquiries++;
      if (!['NEW_ENQUIRY', 'CONTACT_PENDING'].includes(resolvedStage)) funnelContacted++;
      if (
        [
          'QUALIFIED',
          'DOCUMENTS_PENDING',
          'DOCUMENTS_RECEIVED',
          'DOCUMENT_VERIFICATION',
          'LENDER_MATCHING',
          'APPLICATION_PREPARATION',
          'APPLICATION_SUBMITTED',
          'LENDER_PROCESSING',
          'ADDITIONAL_DOCUMENTS_REQUIRED',
          'SANCTIONED',
          'DISBURSEMENT_PENDING',
          'DISBURSED'
        ].includes(resolvedStage)
      ) {
        funnelQualified++;
      } else if (['NOT_ELIGIBLE', 'CUSTOMER_NOT_INTERESTED', 'CLOSED_LOST'].includes(resolvedStage)) {
        unqualifiedLeadsCount++;
      }
      if (
        [
          'APPLICATION_SUBMITTED',
          'LENDER_PROCESSING',
          'ADDITIONAL_DOCUMENTS_REQUIRED',
          'SANCTIONED',
          'DISBURSEMENT_PENDING',
          'DISBURSED'
        ].includes(resolvedStage) ||
        l.application?.status === 'SUBMITTED'
      ) {
        funnelAppSubmitted++;
      }
      if (['SANCTIONED', 'DISBURSEMENT_PENDING', 'DISBURSED'].includes(resolvedStage) || l.application?.status === 'SANCTIONED') {
        funnelSanctioned++;
      }
      if (resolvedStage === 'DISBURSED' || l.application?.status === 'DISBURSED') {
        funnelDisbursed++;
      }
      if (['NOT_ELIGIBLE', 'CUSTOMER_NOT_INTERESTED', 'CLOSED_LOST'].includes(resolvedStage)) {
        funnelClosedLost++;
      }

      const tasks = l.followUpTasks || [];
      let leadHasPendingOrDue = false;
      for (const t of tasks) {
        if (t.status === 'COMPLETED' || t.status === 'CANCELLED') continue;
        const isOverdue = t.status === 'OVERDUE' || (t.dueDate && new Date(t.dueDate) < now);
        if (isOverdue) {
          overdueFollowUpsCount++;
          followUpTasksDueCount++;
          leadHasPendingOrDue = true;
        } else if (t.status === 'PENDING') {
          followUpTasksDueCount++;
          leadHasPendingOrDue = true;
        }
      }
      if (leadHasPendingOrDue) {
        pendingFollowUpsCount++;
      }
    }

    const whatsappTelemetry = {
      mockAttempts: msgEvents.filter((m) => m.provider.toLowerCase().includes('mock')).length,
      providerAccepted: msgEvents.filter((m) => m.direction === 'outbound' && ['SENT', 'DELIVERED', 'READ'].includes(m.delivery_status.toUpperCase())).length,
      delivered: msgEvents.filter((m) => m.direction === 'outbound' && ['DELIVERED', 'READ'].includes(m.delivery_status.toUpperCase())).length,
      failed: msgEvents.filter((m) => m.delivery_status.toUpperCase().includes('FAIL')).length,
      inboundReceived: msgEvents.filter((m) => m.direction === 'inbound').length,
      webhookProcessingErrors: webhookEvents.filter((w) => w.processing_status === 'FAILED').length,
      duplicateWebhookEvents: webhookEvents.filter((w) => w.processing_status === 'DUPLICATE').length,
      pendingDeliveryConfirmations: msgEvents.filter((m) => m.direction === 'outbound' && m.delivery_status.toUpperCase() === 'QUEUED').length
    };

    const leadToAppConversionPct = funnelEnquiries > 0 ? Math.round((funnelAppSubmitted / funnelEnquiries) * 100) : 0;
    const appToSanctionConversionPct = funnelAppSubmitted > 0 ? Math.round((funnelSanctioned / funnelAppSubmitted) * 100) : 0;
    const sanctionToDisbursedConversionPct = funnelSanctioned > 0 ? Math.round((funnelDisbursed / funnelSanctioned) * 100) : 0;

    return NextResponse.json({
      success: true,
      databaseOnline: true,
      dataStore: 'GOOGLE_SHEETS',
      userRole: auth.session.role,
      appliedFilters: filterParams,
      kpis: {
        totalLeads: leads.length,
        newLeadsToday,
        qualifiedLeads: funnelQualified,
        unqualifiedLeads: unqualifiedLeadsCount,
        pendingFollowUpsCount,
        followUpTasksDueCount,
        overdueFollowUpsCount,
        leadsByLoanCategory,
        leadsByCity,
        stageCounts
      },
      funnel: {
        enquiries: funnelEnquiries,
        contacted: funnelContacted,
        qualified: funnelQualified,
        documentsReceived: funnelDocsReceived,
        applicationsSubmitted: funnelAppSubmitted,
        sanctioned: funnelSanctioned,
        disbursed: funnelDisbursed,
        closedLost: funnelClosedLost
      },
      conversions: {
        leadToAppPct: leadToAppConversionPct,
        appToSanctionPct: appToSanctionConversionPct,
        sanctionToDisbursedPct: sanctionToDisbursedConversionPct
      },
      whatsappTelemetry
    });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 503;
    const code = error instanceof SheetsCrmError ? error.code : 'GOOGLE_SHEETS_UNAVAILABLE';
    return NextResponse.json(
      { success: false, databaseOnline: false, error: code, message: error.message },
      { status }
    );
  }
}
