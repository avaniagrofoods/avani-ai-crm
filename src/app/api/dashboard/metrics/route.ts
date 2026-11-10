import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Message } from '@/models/Message';
import { DocumentModel } from '@/models/Document';
import { WebhookInbox } from '@/models/WebhookInbox';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export interface DashboardFilterParams {
  dateFrom?: string | null;
  dateTo?: string | null;
  loanCategory?: string | null;
  city?: string | null;
  applicantCategory?: string | null;
  leadStatus?: string | null;
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
    assignedAdvisor: searchParams.get('assignedAdvisor'),
    source: searchParams.get('source')
  };

  const baseFilter = buildLeadFilterQuery(filterParams);

  const emptyMetrics = {
    success: true,
    databaseOnline: false,
    appliedFilters: filterParams,
    kpis: {
      totalLeads: 0,
      newLeadsToday: 0,
      leadsByLoanCategory: {} as Record<string, number>,
      leadsByApplicantCategory: {} as Record<string, number>,
      leadsByCity: {} as Record<string, number>,
      qualifiedLeads: 0,
      unqualifiedLeads: 0,
      documentsPending: 0,
      humanHandoffs: 0,
      followUpsDue: 0,
      callsCompleted: 0,
      whatsappMessagesSent: 0,
      deliveryFailures: 0,
      optOuts: 0,
      integrationFailures: 0
    }
  };

  try {
    const conn = await connectToDatabase();
    if (!conn || mongoose.connection.readyState !== 1) {
      return NextResponse.json(emptyMetrics, { status: 200 });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const leads = await Lead.find(baseFilter)
      .select(
        'loanType employmentType city status aiAgentStatus isOptedOut callId followUpStatus createdAt assignedAgent leadSource'
      )
      .lean();

    const leadsByLoanCategory: Record<string, number> = {};
    const leadsByApplicantCategory: Record<string, number> = {};
    const leadsByCity: Record<string, number> = {};

    let newLeadsToday = 0;
    let qualifiedLeads = 0;
    let unqualifiedLeads = 0;
    let documentsPending = 0;
    let humanHandoffs = 0;
    let followUpsDue = 0;
    let callsCompleted = 0;
    let optOuts = 0;

    for (const l of leads as any[]) {
      const cat = l.loanType || 'Personal Loan';
      leadsByLoanCategory[cat] = (leadsByLoanCategory[cat] || 0) + 1;

      const appCat = l.employmentType || 'Salaried';
      leadsByApplicantCategory[appCat] = (leadsByApplicantCategory[appCat] || 0) + 1;

      const city = l.city || 'Unspecified';
      leadsByCity[city] = (leadsByCity[city] || 0) + 1;

      if (l.createdAt && new Date(l.createdAt) >= startOfToday) {
        newLeadsToday++;
      }

      if (
        ['Qualified', 'QUALIFIED_HUMAN', 'Documents Pending', 'Documents Complete', 'Approved', 'Disbursed'].includes(l.status) ||
        l.aiAgentStatus === 'LEAD_QUALIFIED' ||
        l.aiAgentStatus === 'DOCUMENTS_PENDING'
      ) {
        qualifiedLeads++;
      } else if (['Not Interested', 'Invalid Lead', 'Rejected', 'REJECTED'].includes(l.status) || l.aiAgentStatus === 'CUSTOMER_DECLINED') {
        unqualifiedLeads++;
      }

      if (l.status === 'Documents Pending' || l.aiAgentStatus === 'DOCUMENTS_PENDING' || l.documentStatus === 'PENDING') {
        documentsPending++;
      }

      if (
        l.aiAgentStatus === 'HUMAN_HANDOFF' ||
        l.status === 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP' ||
        l.status === 'QUALIFIED_HUMAN'
      ) {
        humanHandoffs++;
      }

      if (l.followUpStatus === 'PENDING' || l.status === 'Call Back') {
        followUpsDue++;
      }

      if (l.callId) {
        callsCompleted++;
      }

      if (l.isOptedOut || l.status === 'OPTED_OUT') {
        optOuts++;
      }
    }

    const [whatsappMessagesSent, deliveryFailures, integrationFailures, docPendingCount] = await Promise.all([
      Message.countDocuments({ direction: { $in: ['OUTBOUND', 'outbound'] } }),
      Message.countDocuments({ status: { $in: ['FAILED', 'API_FAILED'] } }),
      WebhookInbox.countDocuments({ status: 'FAILED' }),
      DocumentModel.countDocuments({ status: { $in: ['CHECKLIST_GENERATED', 'DOCUMENTS_PENDING', 'PARTIAL'] } })
    ]);

    return NextResponse.json({
      success: true,
      databaseOnline: true,
      appliedFilters: filterParams,
      kpis: {
        totalLeads: leads.length,
        newLeadsToday,
        leadsByLoanCategory,
        leadsByApplicantCategory,
        leadsByCity,
        qualifiedLeads,
        unqualifiedLeads,
        documentsPending: Math.max(documentsPending, docPendingCount),
        humanHandoffs,
        followUpsDue,
        callsCompleted,
        whatsappMessagesSent,
        deliveryFailures,
        optOuts,
        integrationFailures
      }
    });
  } catch {
    return NextResponse.json(emptyMetrics, { status: 200 });
  }
}
