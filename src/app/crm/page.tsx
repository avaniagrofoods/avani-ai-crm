"use client";

import { useState, useEffect } from "react";
import { Users, RefreshCw } from "lucide-react";

type Lead = {
  _id: string;
  name: string;
  phone: string;
  loanType: string;
  status: string;
  requestedAmount?: string;
  callDuration?: string;
};

export default function CRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/leads');
      const data = await response.json();
      if (data.success) {
        setLeads(data.leads);
      }
    } catch (error) {
      console.error("Failed to fetch leads", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const getLeadsByStatus = (statuses: string[]) => {
    return leads.filter(lead => statuses.includes(lead.status));
  };

  return (
    <div className="space-y-6 h-full">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Pipeline</h1>
          <p className="text-muted-foreground mt-2">Track the progress of your qualified leads.</p>
        </div>
        <button 
          onClick={fetchLeads}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-all font-medium disabled:opacity-50"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> 
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-8 overflow-x-auto">
        <PipelineColumn 
          title="New & Contacted" 
          leads={getLeadsByStatus(['New', 'Contacted'])} 
          color="border-t-blue-500" 
        />
        <PipelineColumn 
          title="Documents Requested" 
          leads={getLeadsByStatus(['Documents Requested'])} 
          color="border-t-orange-500" 
        />
        <PipelineColumn 
          title="Processing / Follow Up" 
          leads={getLeadsByStatus(['Processing'])} 
          color="border-t-purple-500" 
        />
        <PipelineColumn 
          title="Approved / Closed" 
          leads={getLeadsByStatus(['Approved'])} 
          color="border-t-emerald-500" 
        />
      </div>
    </div>
  );
}

function PipelineColumn({ title, leads, color }: { title: string, leads: Lead[], color: string }) {
  return (
    <div className={`glass p-4 rounded-xl border-t-4 ${color} h-[600px] flex flex-col`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">{title}</h3>
        <span className="bg-white/10 text-xs px-2 py-1 rounded-full">{leads.length}</span>
      </div>
      
      <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
        {leads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No leads in this stage</p>
        ) : (
          leads.map(lead => (
            <div key={lead._id} className="bg-white/5 border border-white/10 p-3 rounded-lg hover:border-primary/50 transition-colors cursor-pointer shadow-sm relative group">
              <h4 className="font-medium text-foreground">{lead.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {lead.requestedAmount ? `₹${lead.requestedAmount}` : 'Amt TBD'} - {lead.loanType}
              </p>
              <div className="mt-2 text-xs text-muted-foreground/70">
                {lead.phone}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
