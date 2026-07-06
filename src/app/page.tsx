import { PhoneCall, Users, FileText, IndianRupee } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-2">Welcome back to Avani Loan Services. Here is how your AI campaigns are performing.</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Calls Made" value="1,248" icon={<PhoneCall size={22} />} trend="+12% this week" />
        <MetricCard title="Qualified Leads" value="342" icon={<Users size={22} />} trend="+5% this week" />
        <MetricCard title="Documents Collected" value="89" icon={<FileText size={22} />} trend="+18% this week" />
        <MetricCard title="Potential Revenue" value="₹4.2 Cr" icon={<IndianRupee size={22} />} trend="Based on requested amounts" />
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent AI Calls</h2>
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Customer Name</th>
                <th className="px-6 py-4 font-medium">Loan Type</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Call Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium text-foreground">Rahul Sharma</td>
                <td className="px-6 py-4">Personal Loan</td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">Documents Requested</span>
                </td>
                <td className="px-6 py-4 text-muted-foreground">03:42</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium text-foreground">Dr. Priya Patil</td>
                <td className="px-6 py-4">Doctor Loan</td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">Interested - Follow Up</span>
                </td>
                <td className="px-6 py-4 text-muted-foreground">05:15</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium text-foreground">Ajay Tech Systems</td>
                <td className="px-6 py-4">Business Loan</td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium">Not Interested</span>
                </td>
                <td className="px-6 py-4 text-muted-foreground">01:10</td>
              </tr>
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
