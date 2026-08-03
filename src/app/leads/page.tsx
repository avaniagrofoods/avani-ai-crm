"use client";
import { useState, useEffect } from "react";
import { 
  Users, Layers, ArrowRight, ShieldCheck, CheckCircle2, 
  Bot, Clock, PhoneCall, Check, Tag
} from "lucide-react";

const pipelineStages = [
  "NEW_LEAD", "CONTACTED", "QUALIFIED", "DOCUMENTS_PENDING", "DOCUMENTS_RECEIVED", 
  "ELIGIBILITY_CHECK", "BANK_DISCUSSION", "APPLICATION_SUBMITTED", 
  "SANCTION_RECEIVED", "DISBURSED", "CLOSED"
];

const initialLeads = [
  { id: "L1", name: "Rajesh Kumar", phone: "+919876543210", product: "Personal / Salary", stage: "NEW_LEAD", tag: "PL-HOT", amount: "5,00,000" },
  { id: "L2", name: "Amit Patel", phone: "+919876543211", product: "Business loan", stage: "CONTACTED", tag: "BL-WARM", amount: "25,00,000" },
  { id: "L3", name: "Dr. Sunita Rao", phone: "+919876543212", product: "CA / Professional", stage: "QUALIFIED", tag: "DOC-HOT", amount: "15,00,000" },
  { id: "L4", name: "Meera Nair", phone: "+919876543214", product: "Home / Mortgage", stage: "DOCUMENTS_PENDING", tag: "HL-HOT", amount: "45,00,000" },
  { id: "L5", name: "Vijay Sharma", phone: "+919876543213", product: "CA / Professional", stage: "DOCUMENTS_RECEIVED", tag: "DOC-HOT", amount: "20,00,000" },
  { id: "L6", name: "Ananya Sen", phone: "+919876543215", product: "Education (India)", stage: "ELIGIBILITY_CHECK", tag: "EDU-INDIA-HOT", amount: "8,00,000" },
  { id: "L7", name: "Vikramaditya Rao", phone: "+919876543216", product: "Education (Global)", stage: "APPLICATION_SUBMITTED", tag: "EDU-GLOBAL-WARM", amount: "35,00,000" },
  { id: "L8", name: "St. Xavier Academy", phone: "+919876543217", product: "School funding", stage: "BANK_DISCUSSION", tag: "SCHOOL-FUNDING-HOT", amount: "50,00,000" },
  { id: "L9", name: "Vikas Commerce College", phone: "+919876543218", product: "college funding", stage: "SANCTION_RECEIVED", tag: "COLLEGE-FUNDING-HOT", amount: "1,00,00,000" }
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
  const [leads, setLeads] = useState<any[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  const moveStage = (leadId: string, nextStage: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: nextStage } : l));
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev: any) => ({ ...prev, stage: nextStage }));
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Layers className="w-8 h-8 text-primary" />
            AVANI AI CRM Pipeline
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Track and transition loans across the 11 system pipeline stages.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Pipeline Stages Vertical Columns */}
        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 overflow-x-auto">
          <div className="flex gap-4 min-w-[1200px] h-full pb-4">
            {pipelineStages.map((stage) => {
              const stageLeads = leads.filter(l => l.stage === stage);
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
                          <h4 className="text-xs font-bold text-zinc-100 group-hover:text-primary transition-colors">{lead.name}</h4>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-mono">{lead.tag}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-medium">{lead.product} • ₹{lead.amount}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info & Essential Automations Tracker Panel */}
        <div className="flex flex-col gap-6">
          {/* Selected Lead Details */}
          {selectedLead ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
              <div className="border-b border-zinc-850 pb-3">
                <span className="text-[10px] uppercase font-bold text-primary font-mono">{selectedLead.id}</span>
                <h3 className="text-base font-bold text-white mt-1 leading-tight">{selectedLead.name}</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">{selectedLead.phone}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500 block">Product</span>
                  <span className="text-zinc-300 font-medium">{selectedLead.product}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Loan Amount</span>
                  <span className="text-zinc-300 font-medium font-mono">₹{selectedLead.amount}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Quick Transition Stage</span>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {pipelineStages.filter(s => s !== selectedLead.stage).slice(0, 4).map((stage) => (
                    <button 
                      key={stage}
                      onClick={() => moveStage(selectedLead.id, stage)}
                      className="px-2 py-1 bg-zinc-950 border border-zinc-850 rounded text-[9px] font-semibold text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors truncate"
                      title={stage}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-850/80 border-dashed rounded-2xl p-6 text-center text-zinc-500 flex flex-col items-center justify-center min-h-[150px]">
              <Users className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-xs">Select a lead card to transition stages or inspect data.</p>
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
