"use client";

import { useState, useEffect } from "react";
import { 
  Users, Layers, ArrowRight, ShieldCheck, CheckCircle2, 
  Clock, PhoneCall, Check, Tag, Hash, FileText, Search,
  Filter, Award, Calendar, AlertCircle, Building2, Landmark,
  IndianRupee, ChevronRight, RefreshCw, PlusCircle, CheckSquare
} from "lucide-react";
import { CANONICAL_LEAD_STAGES, STAGE_CONFIG, AVANI_LOAN_PRODUCTS, type CanonicalLeadStage } from "@/config/pipeline";
import { CATEGORY_DOCUMENT_CHECKLISTS } from "@/lib/document-checklist";

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStageFilter, setSelectedStageFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState<"DETAILS" | "STAGE" | "QUALIFY" | "TASKS" | "DOCS" | "APPLICATION">("DETAILS");
  
  // Transition Form state
  const [newStage, setNewStage] = useState<CanonicalLeadStage>("NEW_ENQUIRY");
  const [stageReason, setStageReason] = useState("");
  const [stageNotes, setStageNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  // New task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("MEDIUM");

  // Application/Sanction/Disbursement form state
  const [appLender, setAppLender] = useState("HDFC Bank");
  const [appNumber, setAppNumber] = useState("");
  const [appAmount, setAppAmount] = useState("");
  const [sanctionAmount, setSanctionAmount] = useState("");
  const [sanctionLetterRef, setSanctionLetterRef] = useState("");
  const [disburseAmount, setDisburseAmount] = useState("");
  const [disburseUtr, setDisburseUtr] = useState("");
  const [revenueReceived, setRevenueReceived] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/leads', window.location.origin);
      if (searchQuery) url.searchParams.set('q', searchQuery);
      if (selectedCategory !== 'ALL') url.searchParams.set('product', selectedCategory);
      if (selectedStageFilter !== 'ALL') url.searchParams.set('stage', selectedStageFilter);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
        if (selectedLead) {
          const refreshed = (data.leads || []).find((l: any) => l._id === selectedLead._id);
          if (refreshed) setSelectedLead(refreshed);
        }
      }
    } catch (e) {
      console.error("Failed to load leads", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [selectedCategory, selectedStageFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeads();
  };

  const handleStageTransition = async () => {
    if (!selectedLead) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${selectedLead._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: newStage,
          stageChangeReason: stageReason || 'Manual Advisor Transition',
          stageNotes,
          changedBy: 'Sachin Shinde'
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedLead(data.lead);
        setStageReason("");
        setStageNotes("");
        fetchLeads();
        alert(`Stage updated to ${newStage}!`);
      } else {
        alert(data.error || 'Failed to update stage');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleRunQualification = async () => {
    if (!selectedLead) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${selectedLead._id}/qualify`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        alert(`Qualification Score Calculated: ${data.score}/100 (${data.tierLabel})`);
        fetchLeads();
      } else {
        alert(data.error || 'Failed to qualify lead');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleInitializeTasks = async () => {
    if (!selectedLead) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${selectedLead._id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'INITIALIZE_STANDARD_SEQUENCE' })
      });
      const data = await res.json();
      if (data.success) {
        alert('D0–D30 Follow-Up Sequence initialized!');
        fetchLeads();
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !taskTitle || !taskDueDate) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${selectedLead._id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          dueDate: taskDueDate,
          priority: taskPriority
        })
      });
      const data = await res.json();
      if (data.success) {
        setTaskTitle("");
        setTaskDueDate("");
        fetchLeads();
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!selectedLead) return;
    try {
      await fetch(`/api/leads/${selectedLead._id}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          status: 'COMPLETED',
          completedBy: 'Sachin Shinde'
        })
      });
      fetchLeads();
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplicationAction = async (action: string) => {
    if (!selectedLead) return;
    setUpdating(true);
    try {
      let body: any = { action };
      if (action === 'SUBMIT_APPLICATION') {
        body.lenderName = appLender;
        body.applicationNumber = appNumber || `APP-${Date.now().toString().slice(-6)}`;
        body.appliedAmount = Number(appAmount) || selectedLead.requiredLoanAmount || 0;
      } else if (action === 'RECORD_SANCTION') {
        body.sanctionedAmount = Number(sanctionAmount) || 0;
        body.sanctionLetterRef = sanctionLetterRef;
      } else if (action === 'RECORD_DISBURSEMENT') {
        body.disbursedAmount = Number(disburseAmount) || 0;
        body.utrNumber = disburseUtr;
      } else if (action === 'RECORD_REVENUE') {
        body.actualRevenueReceived = Number(revenueReceived) || 0;
        body.invoiceNumber = invoiceNumber;
        body.paymentStatus = 'RECEIVED';
      }

      const res = await fetch(`/api/leads/${selectedLead._id}/application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        alert(`${action} recorded successfully!`);
        fetchLeads();
      } else {
        alert(data.error || 'Operation failed');
      }
    } finally {
      setUpdating(false);
    }
  };

  const productChecklist = selectedLead ? (CATEGORY_DOCUMENT_CHECKLISTS[selectedLead.loanType] || CATEGORY_DOCUMENT_CHECKLISTS['Personal Loan']) : [];

  return (
    <div className="flex flex-col gap-6 h-full p-6 max-w-7xl mx-auto text-zinc-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
              AVANI LOAN SERVICES • CP-26
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              20 Canonical Stages
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-2 flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-500" />
            Lead-to-Revenue Conversion Operations
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Enquiry → Qualification → Document Collection → Lender Matching → Sanction → Disbursement → Revenue Tracking
          </p>
        </div>
        <button 
          onClick={fetchLeads} 
          className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Pipeline
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
        <form onSubmit={handleSearchSubmit} className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <input 
            type="text" 
            placeholder="Search by Lead ID, Name, Phone..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 pl-9 pr-4 py-2 text-xs rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
        </form>

        <div>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Loan Products (9 Categories)</option>
            {AVANI_LOAN_PRODUCTS.map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <select 
            value={selectedStageFilter} 
            onChange={(e) => setSelectedStageFilter(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Pipeline Stages (20 Stages)</option>
            {CANONICAL_LEAD_STAGES.map(s => (
              <option key={s} value={s}>{STAGE_CONFIG[s]?.label || s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Leads List & Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Leads Table & Summary */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Active Leads ({leads.length})</span>
            <span className="text-[11px] text-zinc-500">Click any lead to view full lifecycle</span>
          </div>

          {loading ? (
            <div className="text-center text-zinc-500 py-12">Loading conversion pipeline...</div>
          ) : leads.length === 0 ? (
            <div className="text-center text-zinc-500 py-12 text-xs">No leads matching current filters.</div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[650px] pr-1">
              {leads.map((lead) => {
                const stageMeta = STAGE_CONFIG[lead.stage as CanonicalLeadStage] || { label: lead.stage, color: '#3B82F6' };
                const isSelected = selectedLead && selectedLead._id === lead._id;
                const score = lead.qualificationScore || 0;

                return (
                  <div
                    key={lead._id}
                    onClick={() => {
                      setSelectedLead(lead);
                      setNewStage(lead.stage || 'NEW_ENQUIRY');
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected ? 'bg-blue-950/20 border-blue-500 shadow-md shadow-blue-950/30' : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{lead.name || lead.phone}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">{lead.leadId}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{lead.phone} • {lead.city || 'Latur'}</p>
                      </div>

                      <span 
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border truncate max-w-[150px]"
                        style={{ borderColor: `${stageMeta.color}40`, backgroundColor: `${stageMeta.color}15`, color: stageMeta.color }}
                      >
                        {stageMeta.label}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-zinc-900 text-[11px]">
                      <span className="text-zinc-400 font-medium">
                        {lead.loanType} • <span className="font-mono text-zinc-200">₹{lead.requiredLoanAmount || lead.requestedAmount || '0'}</span>
                      </span>

                      <div className="flex items-center gap-2">
                        {score > 0 ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            score >= 80 ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' :
                            score >= 60 ? 'bg-blue-950 text-blue-400 border border-blue-500/30' :
                            'bg-yellow-950 text-yellow-400 border border-yellow-500/30'
                          }`}>
                            Score: {score}/100
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500">Unscored</span>
                        )}
                        <span className="text-[10px] text-zinc-500 truncate max-w-[100px]">{lead.assignedAdvisor?.name || 'Sachin Shinde'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Lead Detailed Management Console */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
          {selectedLead ? (
            <>
              {/* Header */}
              <div className="border-b border-zinc-800 pb-3 flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-blue-400 font-mono uppercase">{selectedLead.leadId}</span>
                  <h3 className="text-lg font-bold text-white mt-0.5">{selectedLead.name}</h3>
                  <p className="text-xs text-zinc-400">{selectedLead.phone} • {selectedLead.loanType}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 block">Assigned Advisor</span>
                  <span className="text-xs font-bold text-zinc-300">{selectedLead.assignedAdvisor?.name || 'Sachin Shinde'}</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-[11px] font-semibold overflow-x-auto">
                <button 
                  onClick={() => setActiveTab('DETAILS')} 
                  className={`px-2.5 py-1.5 rounded-lg shrink-0 transition-colors ${activeTab === 'DETAILS' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  Profile
                </button>
                <button 
                  onClick={() => setActiveTab('STAGE')} 
                  className={`px-2.5 py-1.5 rounded-lg shrink-0 transition-colors ${activeTab === 'STAGE' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  Stage & Audit
                </button>
                <button 
                  onClick={() => setActiveTab('QUALIFY')} 
                  className={`px-2.5 py-1.5 rounded-lg shrink-0 transition-colors ${activeTab === 'QUALIFY' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  Score (0-100)
                </button>
                <button 
                  onClick={() => setActiveTab('TASKS')} 
                  className={`px-2.5 py-1.5 rounded-lg shrink-0 transition-colors ${activeTab === 'TASKS' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  Follow-ups
                </button>
                <button 
                  onClick={() => setActiveTab('DOCS')} 
                  className={`px-2.5 py-1.5 rounded-lg shrink-0 transition-colors ${activeTab === 'DOCS' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  Checklist
                </button>
                <button 
                  onClick={() => setActiveTab('APPLICATION')} 
                  className={`px-2.5 py-1.5 rounded-lg shrink-0 transition-colors ${activeTab === 'APPLICATION' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  Lender/Revenue
                </button>
              </div>

              {/* TAB 1: DETAILS */}
              {activeTab === 'DETAILS' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Employment / Profession</span>
                      <span className="text-zinc-200 font-medium">{selectedLead.employmentType || 'Unspecified'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Monthly Income / Range</span>
                      <span className="text-zinc-200 font-medium">₹{selectedLead.monthlyIncome || selectedLead.monthlyIncomeRange || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Requested Loan Amount</span>
                      <span className="text-emerald-400 font-bold font-mono">₹{selectedLead.requiredLoanAmount || selectedLead.requestedAmount || '0'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Preferred Tenure</span>
                      <span className="text-zinc-200 font-medium">{selectedLead.preferredTenure || selectedLead.preferredTenureYears || '5'} Years</span>
                    </div>
                  </div>

                  {/* Product Specific Cards */}
                  {selectedLead.loanType === 'Doctor Loan' && (
                    <div className="bg-blue-950/20 border border-blue-500/30 p-3 rounded-xl space-y-2">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">🩺 Doctor Loan Profile</span>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div><span className="text-zinc-400">Specialization:</span> <span className="text-white">{selectedLead.doctorLoanDetails?.specialization || 'General / MBBS'}</span></div>
                        <div><span className="text-zinc-400">Experience:</span> <span className="text-white">{selectedLead.doctorLoanDetails?.practiceExperienceYears || '3+'} Years</span></div>
                        <div><span className="text-zinc-400">Clinic:</span> <span className="text-white">{selectedLead.doctorLoanDetails?.clinicHospitalOwnership || 'Owned / Rented'}</span></div>
                        <div><span className="text-zinc-400">Equipment Need:</span> <span className="text-white">{selectedLead.doctorLoanDetails?.equipmentType || 'Clinic Expansion'}</span></div>
                      </div>
                    </div>
                  )}

                  {selectedLead.loanType === 'Home Loan' && (
                    <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl space-y-2">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">🏠 Home Loan Property Details</span>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div><span className="text-zinc-400">Location:</span> <span className="text-white">{selectedLead.homeLoanDetails?.propertyLocation || selectedLead.city || 'Latur'}</span></div>
                        <div><span className="text-zinc-400">Property Value:</span> <span className="text-white font-mono">₹{selectedLead.homeLoanDetails?.propertyValue || '50,00,000'}</span></div>
                      </div>
                    </div>
                  )}

                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1 text-[11px]">
                    <span className="text-zinc-500 block text-[10px]">DPDP Act Consent Status</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={13} /> {selectedLead.consentStatus || 'GRANTED'} ({selectedLead.consentPurpose || 'LOAN_ELIGIBILITY_PROCESSING'})
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 2: STAGE & AUDIT */}
              {activeTab === 'STAGE' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-3">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Transition Lead Stage (20 Stages)</span>
                    <select
                      value={newStage}
                      onChange={(e) => setNewStage(e.target.value as CanonicalLeadStage)}
                      className="w-full bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs rounded-lg text-white"
                    >
                      {CANONICAL_LEAD_STAGES.map(s => (
                        <option key={s} value={s}>{STAGE_CONFIG[s]?.label || s}</option>
                      ))}
                    </select>

                    <input 
                      type="text" 
                      placeholder="Reason for stage change (e.g., Documents verified, application filed)..." 
                      value={stageReason}
                      onChange={(e) => setStageReason(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs rounded-lg text-white"
                    />

                    <textarea
                      placeholder="Audit notes / advisor observations..."
                      value={stageNotes}
                      onChange={(e) => setStageNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs rounded-lg text-white"
                    />

                    <button
                      onClick={handleStageTransition}
                      disabled={updating}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 font-bold rounded-lg text-white transition-colors disabled:opacity-50"
                    >
                      {updating ? 'Updating...' : 'Confirm Stage Transition'}
                    </button>
                  </div>

                  {/* Stage History */}
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Stage Audit Trail</span>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto">
                      {(selectedLead.stageHistory || []).slice().reverse().map((hist: any, idx: number) => (
                        <div key={idx} className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-blue-400">{hist.stage}</span>
                            <span className="text-[9px] text-zinc-500">{new Date(hist.changedAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-zinc-300 mt-1">{hist.reason}</p>
                          {hist.notes && <p className="text-[10px] text-zinc-500 italic mt-0.5">{hist.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: QUALIFY */}
              {activeTab === 'QUALIFY' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center space-y-2">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Qualification Score</span>
                    <div className="text-3xl font-black text-white">
                      {selectedLead.qualificationScore || 0} <span className="text-base text-zinc-500 font-normal">/ 100</span>
                    </div>
                    <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${
                      (selectedLead.qualificationScore || 0) >= 80 ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' :
                      (selectedLead.qualificationScore || 0) >= 60 ? 'bg-blue-950 text-blue-400 border border-blue-500/30' :
                      'bg-yellow-950 text-yellow-400 border border-yellow-500/30'
                    }`}>
                      {(selectedLead.qualificationScore || 0) >= 80 ? 'High-Priority Lead' :
                       (selectedLead.qualificationScore || 0) >= 60 ? 'Qualified Lead' :
                       (selectedLead.qualificationScore || 0) >= 40 ? 'Needs Further Info' : 'Incomplete / Low Priority'}
                    </span>
                    <div className="pt-2">
                      <button
                        onClick={handleRunQualification}
                        disabled={updating}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors"
                      >
                        Recalculate Qualification Score
                      </button>
                    </div>
                  </div>

                  {selectedLead.qualificationBreakdown && (
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2 text-[11px]">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Score Breakdown (7 Categories)</span>
                      <div className="space-y-1.5 text-zinc-300">
                        <div className="flex justify-between"><span>Contactability (max 15):</span> <span className="font-mono">{selectedLead.qualificationBreakdown.contactability || 0}</span></div>
                        <div className="flex justify-between"><span>Requirement Clarity (max 15):</span> <span className="font-mono">{selectedLead.qualificationBreakdown.clarity || 0}</span></div>
                        <div className="flex justify-between"><span>Amount & Purpose (max 15):</span> <span className="font-mono">{selectedLead.qualificationBreakdown.amountPurpose || 0}</span></div>
                        <div className="flex justify-between"><span>Income & Financials (max 20):</span> <span className="font-mono">{selectedLead.qualificationBreakdown.incomeFinancials || 0}</span></div>
                        <div className="flex justify-between"><span>Document Readiness (max 15):</span> <span className="font-mono">{selectedLead.qualificationBreakdown.docReadiness || 0}</span></div>
                        <div className="flex justify-between"><span>Responsiveness (max 10):</span> <span className="font-mono">{selectedLead.qualificationBreakdown.responsiveness || 0}</span></div>
                        <div className="flex justify-between"><span>Follow-up Engagement (max 10):</span> <span className="font-mono">{selectedLead.qualificationBreakdown.followUpEngagement || 0}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: TASKS */}
              {activeTab === 'TASKS' && (
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Scheduled Tasks ({selectedLead.followUpTasks?.length || 0})</span>
                    <button 
                      onClick={handleInitializeTasks}
                      className="text-[10px] text-blue-400 hover:underline font-semibold"
                    >
                      + Init D0–D30 Sequence
                    </button>
                  </div>

                  {/* Task List */}
                  <div className="space-y-2 max-h-[220px] overflow-y-auto">
                    {(selectedLead.followUpTasks || []).map((t: any) => (
                      <div key={t.taskId} className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            {t.status === 'COMPLETED' ? (
                              <CheckCircle2 size={13} className="text-emerald-400" />
                            ) : (
                              <Clock size={13} className="text-amber-400" />
                            )}
                            <span className={`font-bold text-[11px] ${t.status === 'COMPLETED' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                              {t.title}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-0.5">Due: {new Date(t.dueDate).toLocaleDateString()} • {t.assignedTo}</p>
                        </div>

                        {t.status !== 'COMPLETED' && (
                          <button 
                            onClick={() => handleCompleteTask(t.taskId)}
                            className="text-[10px] px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-900"
                          >
                            Done
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Task Form */}
                  <form onSubmit={handleAddTask} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Add Custom Task</span>
                    <input 
                      type="text" 
                      placeholder="Task description (e.g. Call back regarding ITR)..." 
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-xs rounded text-white"
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="date" 
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-xs rounded text-white"
                        required
                      />
                      <select 
                        value={taskPriority} 
                        onChange={(e) => setTaskPriority(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-xs rounded text-white"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 font-bold rounded text-white text-xs">
                      Schedule Task
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 5: DOCS */}
              {activeTab === 'DOCS' && (
                <div className="space-y-4 text-xs">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    {selectedLead.loanType} Document Checklist
                  </span>
                  <div className="space-y-2">
                    {productChecklist.map((doc, idx) => (
                      <div key={idx} className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-blue-400 shrink-0" />
                          <div>
                            <span className="text-zinc-200 font-medium block text-[11px]">{doc.name}</span>
                            <span className="text-[9px] text-zinc-500 uppercase">{doc.category} {doc.mandatory && '• Mandatory'}</span>
                          </div>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-semibold">
                          UNDER REVIEW
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: APPLICATION & REVENUE */}
              {activeTab === 'APPLICATION' && (
                <div className="space-y-4 text-xs">
                  {/* Step 1: Submit Application */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">1. Lender Application</span>
                    <div className="grid grid-cols-2 gap-2">
                      <select 
                        value={appLender} 
                        onChange={(e) => setAppLender(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 p-1.5 rounded text-white text-[11px]"
                      >
                        <option value="HDFC Bank">HDFC Bank</option>
                        <option value="Bajaj Finserv">Bajaj Finserv</option>
                        <option value="SBI">State Bank of India</option>
                        <option value="ICICI Bank">ICICI Bank</option>
                        <option value="Poonawalla Fincorp">Poonawalla Fincorp</option>
                        <option value="Avanse">Avanse Financial</option>
                      </select>
                      <input 
                        type="text" 
                        placeholder="App Number (Auto if empty)" 
                        value={appNumber}
                        onChange={(e) => setAppNumber(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 p-1.5 rounded text-white text-[11px]"
                      />
                    </div>
                    <button 
                      onClick={() => handleApplicationAction('SUBMIT_APPLICATION')}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 rounded font-bold text-white text-xs"
                    >
                      Record Application Submission
                    </button>
                  </div>

                  {/* Step 2: Record Sanction */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">2. Record Sanction</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="number" 
                        placeholder="Sanctioned Amount (₹)" 
                        value={sanctionAmount}
                        onChange={(e) => setSanctionAmount(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 p-1.5 rounded text-white text-[11px]"
                      />
                      <input 
                        type="text" 
                        placeholder="Sanction Letter Ref" 
                        value={sanctionLetterRef}
                        onChange={(e) => setSanctionLetterRef(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 p-1.5 rounded text-white text-[11px]"
                      />
                    </div>
                    <button 
                      onClick={() => handleApplicationAction('RECORD_SANCTION')}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded font-bold text-white text-xs"
                    >
                      Record Sanction Milestone
                    </button>
                  </div>

                  {/* Step 3: Record Disbursement */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                    <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">3. Record Disbursement</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="number" 
                        placeholder="Disbursed Amount (₹)" 
                        value={disburseAmount}
                        onChange={(e) => setDisburseAmount(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 p-1.5 rounded text-white text-[11px]"
                      />
                      <input 
                        type="text" 
                        placeholder="Bank UTR Number" 
                        value={disburseUtr}
                        onChange={(e) => setDisburseUtr(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 p-1.5 rounded text-white text-[11px]"
                      />
                    </div>
                    <button 
                      onClick={() => handleApplicationAction('RECORD_DISBURSEMENT')}
                      className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 rounded font-bold text-white text-xs"
                    >
                      Record Loan Disbursement
                    </button>
                  </div>

                  {/* Step 4: Record Revenue */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">4. Revenue Reconciliation</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="number" 
                        placeholder="Revenue Received (₹)" 
                        value={revenueReceived}
                        onChange={(e) => setRevenueReceived(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 p-1.5 rounded text-white text-[11px]"
                      />
                      <input 
                        type="text" 
                        placeholder="Invoice / Ref Number" 
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 p-1.5 rounded text-white text-[11px]"
                      />
                    </div>
                    <button 
                      onClick={() => handleApplicationAction('RECORD_REVENUE')}
                      className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 rounded font-bold text-white text-xs"
                    >
                      Record Revenue Received
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-500 text-xs">
              <Users className="w-8 h-8 text-zinc-700 mb-2" />
              Select a lead from the pipeline to manage qualification, documents, lender matching and revenue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
