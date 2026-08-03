"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Upload, CheckCircle, RefreshCw, Trash2, Phone } from "lucide-react";

const API_URL = typeof window !== 'undefined' ? ('https://avani-ai-crm.vercel.app/api') : 'https://avani-ai-crm.vercel.app/api';

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Wizard States
  const [showWizard, setShowWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  
  // CSV States
  const [csvFileName, setCsvFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [recipientColumn, setRecipientColumn] = useState("");
  const [nameColumn, setNameColumn] = useState("");
  
  // Scheduling States
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  // Sending Process States
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendStats, setSendStats] = useState({ success: 0, failed: 0, total: 0 });
  const [sendLogs, setSendLogs] = useState<any[]>([]);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`${API_URL}/campaigns`);
      if (res.ok) {
        const data = await res.json();
        // Optionally filter by only VOICE campaigns if we stored a type
        setCampaigns(data);
      }
    } catch (e) {
      console.error("Failed to fetch campaigns", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      const res = await fetch(`${API_URL}/campaigns/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCampaigns();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length === 0) return;
      
      const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
      setCsvHeaders(headers);
      
      // Auto-guess columns
      const phoneCol = headers.find(h => h.toLowerCase().includes("phone") || h.toLowerCase().includes("mobile")) || headers[0];
      setRecipientColumn(phoneCol);

      const nmCol = headers.find(h => h.toLowerCase().includes("name") || h.toLowerCase().includes("customer")) || headers[1] || headers[0];
      setNameColumn(nmCol);
      
      const rows = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
        const rowData: Record<string, string> = {};
        headers.forEach((h, i) => { rowData[h] = values[i] || ""; });
        return rowData;
      });
      setCsvRows(rows);
    };
    reader.readAsText(file);
  };

  const handleSendNow = async () => {
    if (csvRows.length === 0) {
      alert("No contacts to call. Please upload a CSV first.");
      return;
    }

    if (isScheduled && !scheduledAt) {
      alert("Please select a valid date and time for the scheduled campaign.");
      return;
    }
    
    setIsSending(true);

    if (isScheduled) {
      try {
        const res = await fetch(`${API_URL}/campaigns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: campaignName || `OmniDim AI Scheduled Voice Campaign`,
            templateId: "VOICE_CALL",
            status: "SCHEDULED",
            type: "VOICE",
            scheduledAt: new Date(scheduledAt).toISOString(),
            payload: {
              csvRows,
              recipientColumn,
              nameColumn,
              firstMessage: "Hello",
              templateContent: "Outbound AI Call"
            }
          })
        });
        
        if (res.ok) {
          alert(`Campaign scheduled successfully for ${new Date(scheduledAt).toLocaleString()}`);
          fetchCampaigns();
          setShowWizard(false);
        } else {
          alert("Failed to schedule campaign.");
        }
      } catch (err: any) {
        console.error(err);
        alert("Connection error while scheduling campaign.");
      }
      setIsSending(false);
      return;
    }

    setSendProgress(0);
    let successCount = 0;
    let failedCount = 0;
    const logs = [];

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const name = row[nameColumn] || "Customer";
      let phone = row[recipientColumn] || "";
      
      // Fix for Scientific Notation from Excel CSVs (e.g., "9.1853E+11")
      if (phone.toUpperCase().includes('E+')) {
        const num = Number(phone);
        if (!isNaN(num)) {
          phone = num.toLocaleString('fullwide', {useGrouping:false});
        }
      }

      phone = phone.replace(/[^0-9+]/g, ""); // strip non-numeric but keep +
      
      if (!phone.startsWith("+") && phone.length > 0) {
        if (phone.length === 10) phone = "+91" + phone;
        else phone = "+" + phone;
      }

      try {
        const res = await fetch(`${API_URL}/leads/trigger`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, name })
        });
        
        if (res.ok) {
          successCount++;
          logs.unshift({ phone, name, status: "SUCCESS", message: `Call dispatched` });
        } else {
          failedCount++;
          logs.unshift({ phone, name, status: "FAILED", message: `Server error` });
        }
      } catch (err: any) {
        failedCount++;
        logs.unshift({ phone, name, status: "FAILED", message: err.message });
      }
      
      setSendProgress(Math.round(((i + 1) / csvRows.length) * 100));
      setSendStats({ success: successCount, failed: failedCount, total: csvRows.length });
      setSendLogs([...logs]);
      
      // Prevent rate-limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    try {
      await fetch(`${API_URL}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName || `OmniDim Voice Campaign`,
          templateId: "VOICE_CALL",
          type: "VOICE",
          status: "COMPLETED"
        })
      });
      fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
    
    setIsSending(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Voice Campaigns</h2>
          <p className="text-sm text-zinc-400">Manage and dispatch automated AI voice calls via OmniDim AI</p>
        </div>
        <button
          onClick={() => {
            setCampaignName("");
            setCsvRows([]);
            setCsvHeaders([]);
            setCsvFileName("");
            setCurrentStep(1);
            setShowWizard(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 transition-all text-sm"
        >
          <Phone className="w-4 h-4" />
          Create Voice Campaign
        </button>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-zinc-600" />
          Loading campaign history...
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-zinc-400">
              <thead className="text-xs text-zinc-300 uppercase bg-zinc-800/40 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Campaign Name</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Date Dispatched</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-zinc-100">{item.name || "-"}</td>
                    <td className="px-6 py-4 font-mono text-zinc-300 text-xs">{item.templateId === "VOICE_CALL" ? "VOICE" : "WHATSAPP"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.status === "COMPLETED" ? "bg-emerald-950 text-emerald-400" : "bg-yellow-950 text-yellow-400"
                      }`}>
                        {item.status === "COMPLETED" ? <><CheckCircle className="w-3 h-3" /> COMPLETED</> : item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteCampaign(item.id)}
                        className="text-red-400 hover:text-red-300 p-1 transition-colors text-xs font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showWizard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[85vh]">
            <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
              
              {!isSending ? (
                <>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                      <Phone className="text-indigo-500 w-5 h-5" /> 
                      OmniDim AI Voice Campaign Setup
                    </h3>

                    <div className="mb-6">
                      <label className="block text-sm font-bold text-zinc-200 mb-2">1. Campaign Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. October Outreach"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                      />
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-bold text-zinc-200 mb-2">2. Upload CSV File</label>
                      <div className="border border-dashed border-zinc-700 rounded-lg p-6 text-center relative hover:border-indigo-500 transition-colors">
                        <input 
                          type="file" 
                          accept=".csv"
                          onChange={handleCsvUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Upload className="w-8 h-8 mx-auto text-zinc-500 mb-2" />
                        <span className="text-sm font-semibold text-zinc-300 block">
                          {csvFileName ? csvFileName : "Click to select CSV File"}
                        </span>
                      </div>
                    </div>

                    {csvRows.length > 0 && (
                      <div className="mb-6 grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 mb-1">Phone Column</label>
                          <select 
                            value={recipientColumn}
                            onChange={(e) => setRecipientColumn(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                          >
                            {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 mb-1">Name Column</label>
                          <select 
                            value={nameColumn}
                            onChange={(e) => setNameColumn(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                          >
                            {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-2 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="dispatchTime"
                            checked={!isScheduled}
                            onChange={() => setIsScheduled(false)}
                            className="accent-indigo-500 w-4 h-4"
                          />
                          <span className="text-zinc-200 font-bold text-sm">Call Now</span>
                        </label>
                        
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="dispatchTime"
                            checked={isScheduled}
                            onChange={() => setIsScheduled(true)}
                            className="accent-indigo-500 w-4 h-4"
                          />
                          <span className="text-zinc-200 font-bold text-sm">Schedule for Later</span>
                        </label>
                      </div>
                      
                      {isScheduled && (
                        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg flex items-center gap-3 animate-fade-in mb-4">
                          <Phone className="w-5 h-5 text-indigo-500" />
                          <input 
                            type="datetime-local" 
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-200 rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500 flex-1 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-8 flex justify-end gap-3 border-t border-zinc-800 pt-4">
                    <button onClick={() => setShowWizard(false)} className="px-5 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 font-semibold text-sm">Cancel</button>
                    <button 
                      onClick={handleSendNow}
                      disabled={csvRows.length === 0}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 disabled:opacity-50 text-sm flex items-center gap-2"
                    >
                      <Phone className="w-4 h-4" /> {isScheduled ? "Schedule Calls" : "Start Calling"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col h-full">
                  <h3 className="text-xl font-bold text-white mb-2">Dispatching Calls via OmniDim AI</h3>
                  <div className="w-full bg-zinc-800 rounded-full h-2 mb-6 overflow-hidden">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300" style={{ width: `${sendProgress}%` }}></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3"><div className="text-2xl font-bold text-indigo-400">{sendStats.total}</div><div className="text-xs text-zinc-500">Total</div></div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3"><div className="text-2xl font-bold text-emerald-400">{sendStats.success}</div><div className="text-xs text-zinc-500">Dispatched</div></div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3"><div className="text-2xl font-bold text-red-400">{sendStats.failed}</div><div className="text-xs text-zinc-500">Failed</div></div>
                  </div>
                  <div className="flex-1 bg-black border border-zinc-800 rounded-lg overflow-y-auto p-4 font-mono text-xs">
                    {sendLogs.map((log, i) => (
                      <div key={i} className={`mb-2 pb-2 border-b border-zinc-900 ${log.status === "SUCCESS" ? "text-emerald-400" : "text-red-400"}`}>
                        [{new Date().toLocaleTimeString()}] {log.phone} ({log.name}) - {log.message}
                      </div>
                    ))}
                  </div>
                  {sendProgress === 100 && (
                    <button onClick={() => setShowWizard(false)} className="mt-4 w-full px-5 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-500">
                      Done
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
