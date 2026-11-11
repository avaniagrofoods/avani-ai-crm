import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Message } from '@/models/Message';
import { DocumentModel } from '@/models/Document';
import { WebhookInbox } from '@/models/WebhookInbox';
import { CANONICAL_LEAD_STAGES, mapLegacyStatusToStage } from '@/config/pipeline';
import mongoose from 'mongoose';

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

export function buildLeadFilterQuery(params: DashboardFilterParams): Record<string, any> {
  const query: Record<string, any> = {};

  if (params.dateFrom || params.dateTo) {
    query.createdAt = {};
    if (params.dateFrom) query.createdAt.$gte = new Date(params.dateFrom);
    if (params.dateTo) query.createdAt.$lte = new Date(params.dateTo);
  }

  if (params.loanCategory && params.loanCategory !== 'ALL') {
    query.loanType = params.loanCategory;
  }

  if (params.city && params.city !== 'ALL') {
    query.city = new RegExp(`^${params.city}$`, 'i');
  }

  if (params.applicantCategory && params.applicantCategory !== 'ALL') {
    query.employmentType = params.applicantCategory;
  }

  if (params.leadStatus && params.leadStatus !== 'ALL') {
    query.status = params.leadStatus;
  }

  if (params.stage && params.stage !== 'ALL') {
    query.stage = params.stage;
  }

  if (params.assignedAdvisor && params.assignedAdvisor !== 'ALL') {
    query['assignedAgent.name'] = new RegExp(params.assignedAdvisor, 'i');
  }

  if (params.source && params.source !== 'ALL') {
    query.$or = [
      { leadSource: new RegExp(params.source, 'i') },
      { source: new RegExp(params.source, 'i') }
    ];
  }

  return query;
}

export async function GET(request: Request) {
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

  const baseFilter = buildLeadFilterQuery(filterParams);

  try {
    const conn = await connectToDatabase();
    if (!conn || mongoose.connection.readyState !== 1) {
      return NextResponse.json({ success: false, databaseOnline: false, error: 'Database unavailable' }, { status: 503 });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const leads = await Lead.find(baseFilter).lean();

    // 20 Canonical Stages Counts
    const stageCounts: Record<string, number> = {};
    for (const s of CANONICAL_LEAD_STAGES) {
      stageCounts[s] = 0;
    }

    const leadsByLoanCategory: Record<string, number> = {};
    const leadsByCity: Record<string, number> = {};
    const revenueByProduct: Record<string, number> = {};
    const revenueByAdvisor: Record<string, number> = {};

    let newLeadsToday = 0;
    let totalDisbursedAmount = 0;
    let totalExpectedRevenue = 0;
    let totalActualRevenueReceived = 0;
    let totalOutstandingAmount = 0;
    let pendingFollowUpsCount = 0;
    let overdueFollowUpsCount = 0;
    let followUpTasksDueCount = 0;
    let unqualifiedLeadsCount = 0;
    const now = new Date();

    // Funnel counters (Section 12)
    let funnelEnquiries = 0;
    let funnelContacted = 0;
    let funnelQualified = 0;
    let funnelDocsReceived = 0;
    let funnelAppSubmitted = 0;
    let funnelSanctioned = 0;
    let funnelDisbursed = 0;
    let funnelClosedLost = 0;

    for (const l of leads as any[]) {
      const resolvedStage = l.stage || mapLegacyStatusToStage(l.status);
      stageCounts[resolvedStage] = (stageCounts[resolvedStage] || 0) + 1;

      const cat = l.loanType || 'Personal Loan';
      leadsByLoanCategory[cat] = (leadsByLoanCategory[cat] || 0) + 1;

      const city = l.city || 'Latur';
      leadsByCity[city] = (leadsByCity[city] || 0) + 1;

      if (l.createdAt && new Date(l.createdAt) >= startOfToday) {
        newLeadsToday++;
      }

      // Funnel mapping
      funnelEnquiries++;
      if (!['NEW_ENQUIRY', 'CONTACT_PENDING'].includes(resolvedStage)) funnelContacted++;
      if (['QUALIFIED', 'DOCUMENTS_PENDING', 'DOCUMENTS_RECEIVED', 'DOCUMENT_VERIFICATION', 'LENDER_MATCHING', 'APPLICATION_PREPARATION', 'APPLICATION_SUBMITTED', 'LENDER_PROCESSING', 'ADDITIONAL_DOCUMENTS_REQUIRED', 'SANCTIONED', 'DISBURSEMENT_PENDING', 'DISBURSED'].includes(resolvedStage)) {
        funnelQualified++;
      } else if (['NOT_ELIGIBLE', 'CUSTOMER_NOT_INTERESTED', 'CLOSED_LOST'].includes(resolvedStage)) {
        unqualifiedLeadsCount++;
      }
      if (['DOCUMENTS_RECEIVED', 'DOCUMENT_VERIFICATION', 'LENDER_MATCHING', 'APPLICATION_PREPARATION', 'APPLICATION_SUBMITTED', 'LENDER_PROCESSING', 'ADDITIONAL_DOCUMENTS_REQUIRED', 'SANCTIONED', 'DISBURSEMENT_PENDING', 'DISBURSED'].includes(resolvedStage)) {
        funnelDocsReceived++;
      }
      if (['APPLICATION_SUBMITTED', 'LENDER_PROCESSING', 'ADDITIONAL_DOCUMENTS_REQUIRED', 'SANCTIONED', 'DISBURSEMENT_PENDING', 'DISBURSED'].includes(resolvedStage) || l.application?.status === 'SUBMITTED') {
        funnelAppSubmitted++;
      }
      if (['SANCTIONED', 'DISBURSEMENT_PENDING', 'DISBURSED'].includes(resolvedStage) || l.sanction?.status === 'SANCTIONED') {
        funnelSanctioned++;
      }
      if (resolvedStage === 'DISBURSED' || l.disbursement?.status === 'DISBURSED') {
        funnelDisbursed++;
      }
      if (['NOT_ELIGIBLE', 'CUSTOMER_NOT_INTERESTED', 'CLOSED_LOST'].includes(resolvedStage)) {
        funnelClosedLost++;
      }

      // Check tasks for pending and overdue followups
      const tasks = l.followUpTasks || [];
      let leadHasPendingOrDue = false;
      for (const t of tasks as any[]) {
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

      // Revenue accumulations
      const disbursed = Number(l.disbursement?.disbursedAmount) || 0;
      totalDisbursedAmount += disbursed;

      const expected = Number(l.revenue?.expectedRevenue) || 0;
      totalExpectedRevenue += expected;

      const received = Number(l.revenue?.actualRevenueReceived) || 0;
      totalActualRevenueReceived += received;

      const outstanding = l.revenue?.outstandingAmount !== undefined
        ? Math.max(0, Number(l.revenue.outstandingAmount))
        : Math.max(0, expected - received);
      totalOutstandingAmount += outstanding;

      if (received > 0) {
        revenueByProduct[cat] = (revenueByProduct[cat] || 0) + received;
        const advisorName = l.assignedAdvisor?.name || l.assignedAgent?.name || 'Sachin Shinde';
        revenueByAdvisor[advisorName] = (revenueByAdvisor[advisorName] || 0) + received;
      }
    }

    // Conversion rate calculations
    const leadToAppConversionPct = funnelEnquiries > 0 ? Math.round((funnelAppSubmitted / funnelEnquiries) * 100) : 0;
    const appToSanctionConversionPct = funnelAppSubmitted > 0 ? Math.round((funnelSanctioned / funnelAppSubmitted) * 100) : 0;
    const sanctionToDisbursedConversionPct = funnelSanctioned > 0 ? Math.round((funnelDisbursed / funnelSanctioned) * 100) : 0;

    return NextResponse.json({
      success: true,
      databaseOnline: true,
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
      revenue: {
        totalDisbursedAmount,
        totalExpectedRevenue,
        totalActualRevenueReceived,
        totalOutstandingAmount,
        revenueByProduct,
        revenueByAdvisor
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
