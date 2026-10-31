import { PhoneCall, Users, FileText, IndianRupee } from "lucide-react";
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Document } from '@/models/Document';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  let totalCalls = 0;
  let qualifiedLeads = 0;
  let documentsCollected = 0;
  let totalRevenue = 0;
  let recentLeads: any[] = [];
  let isDbOffline = false;

  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      isDbOffline = true;
    } else {
      totalCalls = await Lead.countDocuments({ callId: { $exists: true, $ne: "" } });
      
      qualifiedLeads = await Lead.countDocuments({
        status: { $in: ['Contacted', 'Documents Requested', 'Documents Complete', 'Processing', 'Approved', 'Disbursed'] }
      });
      
      documentsCollected = await Document.countDocuments({
        status: { $in: ['UPLOADED', 'VERIFIED', 'VALID'] }
      });

      // Calculate potential revenue (rough estimate by parsing amounts if possible)
      const leadsWithAmount = await Lead.find({ requestedAmount: { $exists: true, $ne: null } }, 'requestedAmount');
      for (const l of leadsWithAmount) {
        if (l.requestedAmount) {
          const parsed = parseInt(String(l.requestedAmount).replace(/[^0-9]/g, ''));
          if (!isNaN(parsed)) totalRevenue += parsed;
        }
      }

      recentLeads = await Lead.find().sort({ createdAt: -1 }).limit(5);
    }
  } catch (err: any) {
    console.warn("Dashboard DB query skipped due to offline DB:", err?.message);
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
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-2">Welcome back to Avani Loan Services. Here is how your AI campaigns are performing.</p>
        {isDbOffline && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            <strong>System Notice:</strong> Database persistence is currently offline or unreachable. Real-time metric counters and recent lead records are temporarily displaying cached/default values.
          </div>
        )}
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Calls Made" value={isDbOffline ? "—" : totalCalls.toLocaleString()} icon={<PhoneCall size={22} />} trend={isDbOffline ? "Offline" : "Lifetime calls via AI"} />
        <MetricCard title="Qualified Leads" value={isDbOffline ? "—" : qualifiedLeads.toLocaleString()} icon={<Users size={22} />} trend={isDbOffline ? "Offline" : "Active in funnel"} />
        <MetricCard title="Documents Collected" value={isDbOffline ? "—" : documentsCollected.toLocaleString()} icon={<FileText size={22} />} trend={isDbOffline ? "Offline" : "Total files submitted"} />
        <MetricCard title="Potential Revenue" value={isDbOffline ? "—" : formatCurrency(totalRevenue)} icon={<IndianRupee size={22} />} trend={isDbOffline ? "Offline" : "Based on requested amounts"} />
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Inbound Leads</h2>
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Customer Name</th>
                <th className="px-6 py-4 font-medium">Loan Type</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Last Interaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {recentLeads.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-muted-foreground">
                    {isDbOffline ? "Database offline — lead activity temporarily unavailable." : "No recent leads found."}
                  </td>
                </tr>
              )}
              {recentLeads.map((lead: any) => (
                <tr key={lead._id.toString()} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{lead.name || 'Unknown'}</td>
                  <td className="px-6 py-4">{lead.loanType || lead.financialProfile?.loanType || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                      {lead.status || 'New'}
                    </span>
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

function MetricCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <div className="glass p-6 rounded-xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="text-muted-foreground font-medium">{title}</h3>
        <div className="p-2 bg-primary/10 text-primary rounded-lg">
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        <h2 className="text-3xl font-bold text-foreground">{value}</h2>
        <p className="text-xs text-muted-foreground mt-2">{trend}</p>
      </div>
    </div>
  );
}
