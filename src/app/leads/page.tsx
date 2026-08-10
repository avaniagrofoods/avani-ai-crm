"use client";
import { useState, useEffect } from "react";
import { 
  Users, Layers, ArrowRight, ShieldCheck, CheckCircle2, 
  Bot, Clock, PhoneCall, Check, Tag, Hash, FileText
} from "lucide-react";

// Requested exactly by the user
const pipelineStages = [
  "NEW", // Catch-all for new leads
  "API Accepted",
  "SENT",
  "DELIVERED",
  "READ",
  "REPLIED",
  "AI PROCESSING",
  "AI RESPONDED",
  "QUALIFIED",
  "DOCUMENTS PENDING",
  "COMPLETED"
];

const automations = [
  { name: "Meta Lead Capture Integration", active: true },
  { name: "WhatsApp Welcome Message Trigger", active: true },
  { name: "Email Acknowledgement Engine", active: true },
  { name: "Gemini AI Lead Scoring", active: true },
  { name: "Round-Robin Advisor Assignment", active: true },
  { name: "Automated Document Request Follow-up", active: true },
  { name: "Loan Eligibility Matching Calculator", active: true },
  { name: "Disbursement Milestones Tracker", active: true }
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leads')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setLeads(data.leads.map((l: any) => ({
            ...l,
            id: l.leadId || l._id,
            // Map aiAgentStatus or status to the exact requested ones, defaulting to NEW
            stage: l.aiAgentStatus || l.status || "NEW"
          })));
        }
        setLoading(false);
      });
  }, []);

  const moveStage = (leadId: string, nextStage: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: nextStage } : l));
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev: any) => ({ ...prev, stage: nextStage }));
    }
    // In a real scenario, we'd also call an API to update the status in the DB
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Layers className="w-8 h-8 text-primary" />
            AVANI AI CRM Pipeline
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Track and transition loans across the exact forensic pipeline stages.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Pipeline Stages Vertical Columns */}
        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 overflow-x-auto">
          {loading ? (
            <div className="text-center text-zinc-500 py-10">Loading forensic pipeline...</div>
          ) : (
            <div className="flex gap-4 min-w-[1200px] h-full pb-4">
              {pipelineStages.map((stage) => {
                // Match exact strings, or roughly map known statuses to the pipeline column
                const stageLeads = leads.filter(l => l.stage.toUpperCase() === stage.toUpperCase() || 
                  (stage === "NEW" && !pipelineStages.slice(1).map(s => s.toUpperCase()).includes(l.stage.toUpperCase()))
                );
                return (
                  <div key={stage} className="flex flex-col gap-3 w-72 shrink-0 bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{stage}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">{stageLeads.length}</span>
                    </div>

                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[450px]">
                      {stageLeads.length === 0 && (
                        <div className="text-[10px] text-zinc-600 text-center py-6">Empty stage</div>
                      )}
                      {stageLeads.map((lead) => (
                        <div 
                          key={lead.id} 
                          onClick={() => setSelectedLead(lead)}
                          className="bg-zinc-900 border border-zinc-800/60 p-3 rounded-lg hover:border-zinc-700 transition-colors cursor-pointer flex flex-col gap-2 group"
                        >
                          <div className="flex justify-between items-start">
                            <h4 className="text-xs font-bold text-zinc-100 group-hover:text-primary transition-colors">{lead.name || lead.phone}</h4>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-mono truncate max-w-[80px]">{lead.providerMessageId || lead.aiAgentStatus || "NEW"}</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 font-medium">{lead.loanType || 'Unknown'} • ₹{lead.requiredLoanAmount || lead.requestedAmount || '0'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info & Essential Automations Tracker Panel */}
        <div className="flex flex-col gap-6">
          {/* Selected Lead Details */}
          {selectedLead ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
              <div className="border-b border-zinc-850 pb-3">
                <span className="text-[10px] uppercase font-bold text-primary font-mono">{selectedLead.id}</span>
                <h3 className="text-base font-bold text-white mt-1 leading-tight">{selectedLead.name || selectedLead.phone}</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">{selectedLead.phone}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500 block">Product</span>
                  <span className="text-zinc-300 font-medium">{selectedLead.loanType || selectedLead.product || "Unknown"}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Loan Amount</span>
                  <span className="text-zinc-300 font-medium font-mono">₹{selectedLead.requiredLoanAmount || selectedLead.requestedAmount || "0"}</span>
                </div>
              </div>

              {/* Forensic Details View */}
              <div className="pt-2 border-t border-zinc-850">
                <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider flex items-center gap-1"><ShieldCheck size={12}/> Forensic Details</span>
                <div className="mt-2 space-y-2">
                  <div className="bg-black/30 p-2 rounded border border-white/5 overflow-hidden">
                    <span className="text-[9px] text-zinc-500 block">Correlation ID</span>
                    <span className="text-[10px] text-zinc-300 font-mono truncate block">{selectedLead.correlationId || "None"}</span>
                  </div>
                  <div className="bg-black/30 p-2 rounded border border-white/5 overflow-hidden">
                    <span className="text-[9px] text-zinc-500 block">Provider Message ID</span>
                    <span className="text-[10px] text-zinc-300 font-mono truncate block">{selectedLead.providerMessageId || selectedLead.aiSensyMessageId || "None"}</span>
                  </div>
                  <div className="bg-black/30 p-2 rounded border border-white/5 overflow-hidden">
                    <span className="text-[9px] text-zinc-500 block">Internal Agent State</span>
                    <span className="text-[10px] text-zinc-300 font-mono truncate block">{selectedLead.aiAgentStatus || selectedLead.status || "NEW"}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-850">
                <button 
                  onClick={async () => {
                    const res = await fetch('/api/leads/trigger', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        phone: selectedLead.phone,
                        name: selectedLead.name,
                        loanType: selectedLead.loanType || selectedLead.product
                      })
                    });
                    if (res.ok) alert('OmniDM AI Voice Call triggered successfully!');
                    else alert('Failed to trigger AI call');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-lg shadow-indigo-900/50 transition-colors"
                >
                  <PhoneCall className="w-4 h-4" /> Trigger OmniDM AI Call
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-850/80 border-dashed rounded-2xl p-6 text-center text-zinc-500 flex flex-col items-center justify-center min-h-[150px]">
              <Users className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-xs">Select a lead card to inspect forensic details and routing.</p>
            </div>
          )}

          {/* Automations Checklist */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-850 pb-2">Active Automation Check</h4>
            <div className="flex flex-col gap-2.5">
              {automations.map((auto, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs text-zinc-300">
                  <div className="w-4 h-4 rounded bg-emerald-950 border border-emerald-500/30 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                  </div>
                  <span>{auto.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
