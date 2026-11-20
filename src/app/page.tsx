import {
  PhoneCall,
  Users,
  FileText,
  IndianRupee,
  MessageSquare,
  UserCheck,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, verifyActiveSession, canAccessLead } from '@/lib/auth';
import { WhatsappTelemetrySummary } from '@/lib/telemetry';
import {
  CrmSheetsService,
  messageEventRepository,
  webhookEventRepository
} from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export default async function Dashboard(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const session = await verifyActiveSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    redirect('/login');
  }

  const resolvedParams = props.searchParams ? await props.searchParams : {};
  const filterParams = {
    dateFrom: typeof resolvedParams.date === 'string' ? resolvedParams.date : null,
    loanCategory: typeof resolvedParams.loanCategory === 'string' ? resolvedParams.loanCategory : null,
    city: typeof resolvedParams.city === 'string' ? resolvedParams.city : null,
    applicantCategory:
      typeof resolvedParams.applicantCategory === 'string' ? resolvedParams.applicantCategory : null,
    leadStatus: typeof resolvedParams.leadStatus === 'string' ? resolvedParams.leadStatus : null,
    assignedAdvisor:
      typeof resolvedParams.assignedAdvisor === 'string' ? resolvedParams.assignedAdvisor : null,
    source: typeof resolvedParams.source === 'string' ? resolvedParams.source : null
  };

  let totalLeads = 0;
  let newLeadsToday = 0;
  const totalCalls = 0;
  let qualifiedLeads = 0;
  let unqualifiedLeads = 0;
  const documentsPending = 0;
  const documentsCollected = 0;
  let humanHandoffs = 0;
  let followUpsDue = 0;
  let whatsappMessagesSent = 0;
  let deliveryFailures = 0;
  let optOuts = 0;
  let totalRevenue = 0;
  let telemetry: WhatsappTelemetrySummary = {
    mockAttempts: 0,
    providerAccepted: 0,
    delivered: 0,
    failed: 0,
    inboundReceived: 0,
    webhookProcessingErrors: 0,
    duplicateWebhookEvents: 0,
    pendingDeliveryConfirmations: 0
  };
  let recentLeads: any[] = [];
  const leadsByLoanCategory: Record<string, number> = {};
  const leadsByApplicantCategory: Record<string, number> = {};
  const leadsByCity: Record<string, number> = {};
  let isDbOffline = false;

  try {
    await CrmSheetsService.assertHealthy();
    const [allLeads, msgEvents, webhookEvents] = await Promise.all([
      CrmSheetsService.listHydratedLeads(),
      messageEventRepository.findAll(),
      webhookEventRepository.findAll()
    ]);

    let filteredLeads = allLeads.filter((l) => canAccessLead(session, l));
    if (filterParams.loanCategory && filterParams.loanCategory !== 'ALL') {
      filteredLeads = filteredLeads.filter((l) => l.loanType === filterParams.loanCategory);
    }
    if (filterParams.city && filterParams.city !== 'ALL') {
      const cLower = filterParams.city.toLowerCase();
      filteredLeads = filteredLeads.filter((l) => l.city.toLowerCase() === cLower);
    }
    if (filterParams.leadStatus && filterParams.leadStatus !== 'ALL') {
      filteredLeads = filteredLeads.filter((l) => l.status === filterParams.leadStatus);
    }
    if (filterParams.source && filterParams.source !== 'ALL') {
      const sLower = filterParams.source.toLowerCase();
      filteredLeads = filteredLeads.filter((l) => l.leadSource.toLowerCase().includes(sLower));
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    totalLeads = filteredLeads.length;
    for (const l of filteredLeads) {
      if (new Date(l.createdAt) >= startOfToday) newLeadsToday++;
      if (['QUALIFIED', 'APPLICATION_SUBMITTED', 'SANCTIONED', 'DISBURSED'].includes(l.stage)) {
        qualifiedLeads++;
      } else if (['CLOSED_LOST', 'REJECTED'].includes(l.stage)) {
        unqualifiedLeads++;
      }
      if (l.status === 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP' || l.stage === 'QUALIFIED') {
        humanHandoffs++;
      }
      if (l.followUpTasks.some((f) => f.status === 'PENDING' || f.status === 'OVERDUE')) {
        followUpsDue++;
      }
      if (l.isOptedOut || l.status === 'OPTED_OUT') {
        optOuts++;
      }
      if (l.requiredLoanAmount > 0) {
        totalRevenue += l.requiredLoanAmount;
      }
      const cat = l.loanType || 'Personal Loan';
      leadsByLoanCategory[cat] = (leadsByLoanCategory[cat] || 0) + 1;
      leadsByApplicantCategory['Verified'] = (leadsByApplicantCategory['Verified'] || 0) + 1;
      const city = l.city || 'Unspecified';
      leadsByCity[city] = (leadsByCity[city] || 0) + 1;
    }

    telemetry = {
      mockAttempts: msgEvents.filter((m) => m.delivery_status === 'MOCK_SENT').length,
      providerAccepted: msgEvents.filter((m) => ['SENT', 'ACCEPTED'].includes(m.delivery_status)).length,
      delivered: msgEvents.filter((m) => ['DELIVERED', 'READ'].includes(m.delivery_status)).length,
      failed: msgEvents.filter((m) => ['FAILED', 'API_FAILED'].includes(m.delivery_status)).length,
      inboundReceived: msgEvents.filter((m) => m.direction === 'inbound').length,
      webhookProcessingErrors: webhookEvents.filter((w) => w.processing_status === 'FAILED').length,
      duplicateWebhookEvents: webhookEvents.filter((w) => w.processing_status === 'DUPLICATE').length,
      pendingDeliveryConfirmations: msgEvents.filter((m) => m.delivery_status === 'SENT').length
    };
    whatsappMessagesSent = telemetry.delivered;
    deliveryFailures = telemetry.failed;

    recentLeads = filteredLeads.slice(0, 8).map((l) => ({
      _id: l.leadId,
      name: l.name,
      loanType: l.loanType,
      employmentType: 'Verified',
      city: l.city,
      status: l.status,
      assignedAgent: { name: l.assignedAdvisor?.name || 'Sachin Shinde' },
      leadSource: l.leadSource,
      lastInteractionAt: l.updatedAt
    }));
  } catch (err: any) {
    console.warn('Dashboard Google Sheets query skipped due to offline store:', err?.message);
    isDbOffline = true;
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Admin & Advisor Dashboard Overview</h1>
        <p className="text-muted-foreground mt-2">
          AVANI LOAN SERVICES — ChatMitra Pro AI Chatbot, Loan Qualification & Omnichannel CRM Telemetry (Google Sheets Edition)
        </p>
        {isDbOffline && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            <strong>System Notice:</strong> Google Sheets CRM store is currently offline or unreachable. Real-time metric counters and recent lead records are temporarily unavailable.
          </div>
        )}
      </header>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Leads (Today)"
          value={isDbOffline ? '—' : `${totalLeads.toLocaleString()} (+${newLeadsToday})`}
          icon={<Users size={22} />}
          trend={isDbOffline ? 'Offline' : 'Total CRM leads & new today'}
        />
        <MetricCard
          title="Qualified / Unqualified"
          value={isDbOffline ? '—' : `${qualifiedLeads} / ${unqualifiedLeads}`}
          icon={<UserCheck size={22} />}
          trend={isDbOffline ? 'Offline' : 'Active in qualification funnel'}
        />
        <MetricCard
          title="Documents Pending / Done"
          value={isDbOffline ? '—' : `${documentsPending} / ${documentsCollected}`}
          icon={<FileText size={22} />}
          trend="Zero-Document-Storage Policy Active"
        />
        <MetricCard
          title="Potential Loan Volume"
          value={isDbOffline ? '—' : (session.role === 'ADMIN' ? formatCurrency(totalRevenue) : 'ADMIN ONLY')}
          icon={<IndianRupee size={22} />}
          trend={isDbOffline ? 'Offline' : 'Based on requested amounts'}
        />
      </div>

      {/* Secondary Omnichannel & Compliance Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Human Handoffs"
          value={isDbOffline ? '—' : humanHandoffs.toLocaleString()}
          icon={<Users size={18} />}
          trend="Assigned to Sachin Shinde"
        />
        <MetricCard
          title="Follow-ups Due"
          value={isDbOffline ? '—' : followUpsDue.toLocaleString()}
          icon={<Clock size={18} />}
          trend="D0–D15 advisor sequence"
        />
        <MetricCard
          title="Calls Completed"
          value={isDbOffline ? '—' : totalCalls.toLocaleString()}
          icon={<PhoneCall size={18} />}
          trend="OmniDM AI Voice Agent"
        />
        <MetricCard
          title="WhatsApp Delivered / Failed"
          value={isDbOffline ? '—' : `${whatsappMessagesSent} / ${deliveryFailures}`}
          icon={<MessageSquare size={18} />}
          trend={isDbOffline ? 'Offline' : `Real accepted: ${telemetry.providerAccepted} | Mock sandbox: ${telemetry.mockAttempts} | Pending: ${telemetry.pendingDeliveryConfirmations}`}
        />
        <MetricCard
          title="Inbound / Webhook Errors"
          value={isDbOffline ? '—' : `${telemetry.inboundReceived} / ${telemetry.webhookProcessingErrors}`}
          icon={<ShieldAlert size={18} />}
          trend={isDbOffline ? 'Offline' : `Opt-outs: ${optOuts} | Duplicates: ${telemetry.duplicateWebhookEvents}`}
        />
      </div>

      {/* Breakdown by Loan Category, Applicant Category, and City */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <BreakdownCard title="Leads by Loan Category" data={leadsByLoanCategory} isOffline={isDbOffline} />
        <BreakdownCard title="Leads by Applicant Category" data={leadsByApplicantCategory} isOffline={isDbOffline} />
        <BreakdownCard title="Leads by City" data={leadsByCity} isOffline={isDbOffline} />
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Inbound Leads (Filtered View)</h2>
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Customer Name</th>
                <th className="px-6 py-4 font-medium">Loan Category</th>
                <th className="px-6 py-4 font-medium">Applicant Category</th>
                <th className="px-6 py-4 font-medium">City</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Advisor / Source</th>
                <th className="px-6 py-4 font-medium">Last Interaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {recentLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-muted-foreground">
                    {isDbOffline
                      ? 'Google Sheets CRM store offline — lead activity temporarily unavailable.'
                      : 'No recent leads found matching the selected filters.'}
                  </td>
                </tr>
              )}
              {recentLeads.map((lead: any) => (
                <tr key={lead._id.toString()} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{lead.name || 'Unknown'}</td>
                  <td className="px-6 py-4">{lead.loanType || 'Personal Loan'}</td>
                  <td className="px-6 py-4">{lead.employmentType || 'Salaried'}</td>
                  <td className="px-6 py-4">{lead.city || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                      {lead.status || 'New'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {lead.assignedAgent?.name || 'Sachin Shinde'} ({lead.leadSource || 'WhatsApp'})
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {lead.lastInteractionAt ? new Date(lead.lastInteractionAt).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  trend
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: string;
}) {
  return (
    <div className="glass p-6 rounded-xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="text-muted-foreground font-medium text-sm">{title}</h3>
        <div className="p-2 bg-primary/10 text-primary rounded-lg">{icon}</div>
      </div>
      <div className="relative z-10">
        <h2 className="text-2xl font-bold text-foreground">{value}</h2>
        <p className="text-xs text-muted-foreground mt-2">{trend}</p>
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  data,
  isOffline
}: {
  title: string;
  data: Record<string, number>;
  isOffline: boolean;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <div className="glass p-5 rounded-xl">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {isOffline || entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {isOffline ? 'Offline' : 'No breakdown data yet'}
        </p>
      ) : (
        <ul className="space-y-2 text-xs">
          {entries.map(([key, count]) => (
            <li key={key} className="flex justify-between items-center border-b border-white/5 pb-1">
              <span className="text-muted-foreground">{key}</span>
              <span className="font-semibold text-foreground">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
