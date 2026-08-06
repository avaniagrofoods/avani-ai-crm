"use client";

import { useState } from "react";
import { Upload, X, CheckCircle, Loader2, XCircle, Calendar, Clock, MessageSquare, Send } from "lucide-react";
import Papa from "papaparse";
import { normalizeIndianPhone } from "@/lib/phone";

export interface ValidatedCSVRow {
  rowNumber: number;
  cleanPhone: string;
  name: string;
  city: string;
  isLineValid: boolean;
  rejectReason: string | null;
}

export function validateIncomingCSVData(rawRows: any[]): { approvedLeads: any[], rejectedLeads: ValidatedCSVRow[] } {
  const approvedLeads: any[] = [];
  const rejectedLeads: ValidatedCSVRow[] = [];

  rawRows.forEach((row, index) => {
    const rawPhone = String(row.MobileNumber || row.phone || row.mobile || row.PhoneNumber || "").trim();
    const customerName = String(row.FullName || row.name || row.Name || "Customer").trim();
    const cityLocation = String(row.City || row.city || "Unknown").trim();

    const cleanPhone = normalizeIndianPhone(rawPhone);
    let rejectReason: string | null = null;

    if (cleanPhone.length !== 10) {
      rejectReason = "Invalid mobile length (Must be standard 10-digit Indian format)";
    } else if (!customerName || customerName === "Customer") {
      rejectReason = "Missing Customer Name variable parameter";
    }

    if (rejectReason) {
      rejectedLeads.push({
        rowNumber: index + 2,
        cleanPhone: cleanPhone || rawPhone,
        name: customerName,
        city: cityLocation,
        isLineValid: false,
        rejectReason
      });
    } else {
      approvedLeads.push({
        ...row,
        phone: cleanPhone,
        name: customerName,
        city: cityLocation,
        loanType: row.LoanType || row['Loan Type'] || row.loanType || "Personal Loan"
      });
    }
  });

  return { approvedLeads, rejectedLeads };
}

type UploadResult = {
  id: number;
  name: string;
  phone: string;
  status: "Pending" | "Triggered" | "Scheduled" | "Failed";
  message?: string;
};

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<UploadResult[]>([]);

  // Schedule & Template States
  const [executionType, setExecutionType] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("avani_loan_intro");
  const [customTemplateName, setCustomTemplateName] = useState("");
  const [scheduleNotice, setScheduleNotice] = useState("");

  const META_TEMPLATES = [
    { id: "avani_loan_intro", name: "avani_loan_intro", label: "Avani Loan Services Welcome & Loan Inquiry" },
    { id: "loan_consultation_offer", name: "loan_consultation_offer", label: "Free Consultation & Interest Rate Reduction" },
    { id: "documents_checklist", name: "documents_checklist", label: "Required Loan Documents Checklist" },
    { id: "missed_call_followup", name: "missed_call_followup", label: "Missed Call Callback Notification" },
    { id: "custom", name: "custom", label: "+ Custom Approved Meta Template" }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith('.csv')) {
        setError("Please upload a valid CSV file.");
        return;
      }
      setFile(selectedFile);
      setError("");
      setUploadSuccess(false);
      setScheduleNotice("");
      setProgress({ current: 0, total: 0 });
      setResults([]);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError("");

    const activeTemplate = selectedTemplate === "custom" ? customTemplateName.trim() : selectedTemplate;
    if (selectedTemplate === "custom" && !customTemplateName.trim()) {
      setError("Please enter your custom Meta template name.");
      setIsUploading(false);
      return;
    }

    if (executionType === "scheduled") {
      if (!scheduledDate || !scheduledTime) {
        setError("Please select both Date and Time to schedule your campaign.");
        setIsUploading(false);
        return;
      }
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        try {
          const leads = parsed.data as any[];
          if (!leads || leads.length === 0) throw new Error("No leads found in CSV file");

          const { approvedLeads, rejectedLeads } = validateIncomingCSVData(leads);
          if (rejectedLeads.length > 0) {
            console.error("⚠️ CSV Parsing Pipeline caught incomplete lead profile metrics:", rejectedLeads);
            alert(`CSV Inspection Complete:\n🚀 Approved Leads: ${approvedLeads.length}\n❌ Blocked Lines: ${rejectedLeads.length}\n\nCheck browser console for details.`);
          }
          
          if (approvedLeads.length === 0) throw new Error("No valid leads found after validation");

          const validLeads = approvedLeads;

          if (executionType === "scheduled") {
            const fullScheduledTime = `${scheduledDate}T${scheduledTime}:00`;
            const res = await fetch('/api/campaigns/schedule', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignName: `Campaign - ${file.name}`,
                scheduledAt: fullScheduledTime,
                templateName: activeTemplate,
                leads: validLeads
              })
            });

            const data = await res.json();
            if (res.ok) {
              setUploadSuccess(true);
              setScheduleNotice(`✅ Campaign scheduled for ${new Date(fullScheduledTime).toLocaleString('en-IN')} with template "${activeTemplate}".`);
              setResults(validLeads.map((l, i) => ({
                id: i,
                name: l.name,
                phone: l.phone,
                status: "Scheduled",
                message: `Scheduled for ${scheduledDate} at ${scheduledTime}`
              })));
            } else {
              throw new Error(data.error || "Failed to schedule campaign");
            }
          } else {
            // Immediate Execution
            setProgress({ current: 0, total: validLeads.length });
            const initialResults: UploadResult[] = validLeads.map((lead, i) => ({
              id: i,
              name: lead.name,
              phone: lead.phone,
              status: "Pending"
            }));
            setResults(initialResults);

            for (let i = 0; i < validLeads.length; i++) {
              const lead = validLeads[i];
              try {
                const response = await fetch('/api/leads/trigger', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: lead.name, phone: lead.phone, loanType: lead.loanType, templateName: activeTemplate }),
                });

                if (response.ok) {
                  setResults(prev => prev.map(r => r.id === i ? { ...r, status: "Triggered" } : r));
                } else {
                  let errorMsg = "API Error";
                  try {
                    const errorData = await response.json();
                    if (errorData.error) errorMsg = errorData.error;
                  } catch (e) {}
                  setResults(prev => prev.map(r => r.id === i ? { ...r, status: "Failed", message: errorMsg } : r));
                }
              } catch (triggerError) {
                setResults(prev => prev.map(r => r.id === i ? { ...r, status: "Failed", message: "Network Error" } : r));
              }

              setProgress({ current: i + 1, total: validLeads.length });
              if (i < validLeads.length - 1) await delay(1500);
            }
            setUploadSuccess(true);
          }
          setFile(null);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsUploading(false);
        }
      },
      error: (err) => {
        setError(err.message);
        setIsUploading(false);
      }
    });
  };

  const resetUpload = () => {
    setUploadSuccess(false);
    setResults([]);
    setFile(null);
    setScheduleNotice("");
    setProgress({ current: 0, total: 0 });
  };

  return (
    <div className="space-y-6">
      {/* Upload & Scheduling Control Box */}
      <div className="glass p-8 rounded-xl border-dashed border-2 border-primary/30 relative">
        {file && !isUploading && !uploadSuccess && (
          <button onClick={() => setFile(null)} className="absolute top-4 right-4 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white">
            <X size={16} />
          </button>
        )}

        <div className="text-center">
          {isUploading ? (
            <Loader2 className="mx-auto h-12 w-12 mb-4 text-primary animate-spin" />
          ) : uploadSuccess ? (
            <CheckCircle className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
          ) : (
            <Upload className={`mx-auto h-12 w-12 mb-4 ${file ? 'text-primary' : 'text-muted-foreground'}`} />
          )}

          <h3 className="text-lg font-medium text-white">
            {uploadSuccess ? 'Campaign Successfully Configured!' : file ? file.name : 'Upload Leads (CSV / Excel)'}
          </h3>

          <p className="text-muted-foreground mt-1 mb-6 text-sm">
            {isUploading
              ? `Processing lead ${progress.current} of ${progress.total}... Please keep this window open.`
              : uploadSuccess
                ? scheduleNotice || `Successfully processed ${results.length} leads.`
                : file
                  ? `${(file.size / 1024).toFixed(2)} KB CSV Loaded`
                  : 'Drag & drop CSV file. Format: Name, Phone, LoanType.'}
          </p>

          {isUploading && progress.total > 0 && (
            <div className="w-full bg-secondary/50 rounded-full h-2.5 mb-6 overflow-hidden">
              <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm mb-4 bg-red-950/40 p-2 rounded border border-red-500/20">{error}</p>}

          {!file && !uploadSuccess && !isUploading && (
            <div className="relative inline-block">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all pointer-events-none">
                Select CSV File
              </button>
            </div>
          )}
        </div>

        {/* Campaign Schedule & Meta Approved Template Options */}
        {file && !isUploading && !uploadSuccess && (
          <div className="mt-6 pt-6 border-t border-white/10 space-y-5 text-left">
            {/* Meta Template Selector */}
            <div>
              <label className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <MessageSquare size={14} /> Meta Approved WhatsApp Template Name
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
              >
                {META_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                    {t.label} ({t.name})
                  </option>
                ))}
              </select>

              {selectedTemplate === "custom" && (
                <input
                  type="text"
                  placeholder="Enter exact Meta approved template name (e.g. avani_loan_special_offer)"
                  value={customTemplateName}
                  onChange={(e) => setCustomTemplateName(e.target.value)}
                  className="mt-2 w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                />
              )}
            </div>

            {/* Execution Schedule Options */}
            <div>
              <label className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Calendar size={14} /> Campaign Execution Timing
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExecutionType("immediate")}
                  className={`py-2.5 px-4 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 transition-all ${
                    executionType === "immediate"
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                      : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                  }`}
                >
                  <Send size={15} /> Launch Immediately
                </button>
                <button
                  type="button"
                  onClick={() => setExecutionType("scheduled")}
                  className={`py-2.5 px-4 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 transition-all ${
                    executionType === "scheduled"
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                      : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                  }`}
                >
                  <Clock size={15} /> Schedule for Later Date/Time
                </button>
              </div>
            </div>

            {/* Scheduled Date & Time Pickers */}
            {executionType === "scheduled" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/30 p-4 rounded-lg border border-white/10">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Execution Day & Month (Date)</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Execution Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                onClick={handleUpload}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
              >
                {executionType === "immediate" ? <Send size={16} /> : <Calendar size={16} />}
                {executionType === "immediate" ? "Confirm & Launch Calling Campaign" : "Save & Schedule Campaign"}
              </button>
            </div>
          </div>
        )}

        {uploadSuccess && (
          <div className="mt-4 text-center">
            <button
              onClick={resetUpload}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all"
            >
              Configure Another Campaign
            </button>
          </div>
        )}
      </div>

      {/* Results / Scheduled List Table */}
      {results.length > 0 && (
        <div className="glass p-6 rounded-xl border border-white/10">
          <h3 className="text-lg font-medium mb-4 text-white">Campaign Progress & Status</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-muted-foreground">
                <tr>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Phone</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {results.map((res) => (
                  <tr key={res.id} className="text-foreground">
                    <td className="py-3 text-white">{res.name}</td>
                    <td className="py-3 text-muted-foreground">{res.phone}</td>
                    <td className="py-3">
                      {res.status === "Pending" && <span className="text-yellow-500 flex items-center gap-1"><Loader2 size={14} className="animate-spin"/> Pending</span>}
                      {res.status === "Triggered" && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={14}/> Call Triggered</span>}
                      {res.status === "Scheduled" && <span className="text-cyan-400 flex items-center gap-1"><Clock size={14}/> Scheduled</span>}
                      {res.status === "Failed" && <span className="text-red-400 flex items-center gap-1"><XCircle size={14}/> Failed</span>}
                    </td>
                    <td className="py-3 text-muted-foreground">{res.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
