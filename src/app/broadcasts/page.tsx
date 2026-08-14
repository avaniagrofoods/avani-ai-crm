"use client";

import { useState, useEffect } from "react";
import { Upload, Send, CheckCircle2, AlertCircle, RefreshCw, PhoneCall, FileSpreadsheet, Users, ShieldCheck, HelpCircle, CalendarClock } from "lucide-react";

export default function BroadcastsPage() {
  const [csvFileName, setCsvFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [recipientColumn, setRecipientColumn] = useState("");
  const [nameColumn, setNameColumn] = useState("");
  const [templateName, setTemplateName] = useState("avani_loan_intro_v2");
  const [syncedTemplates, setSyncedTemplates] = useState<any[]>([]);
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);
  const [broadcastType, setBroadcastType] = useState<"whatsapp" | "voice">("whatsapp");
  const [scheduleDate, setScheduleDate] = useState("");
  const [isTestMode, setIsTestMode] = useState(false);
  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null);

  const loadTemplates = async () => {
    try {
      const API_BASE = typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api';
      const res = await fetch(`${API_BASE}/whatsapp/templates`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.templates) && data.templates.length > 0) {
          setSyncedTemplates(data.templates);
          if (!templateName || templateName === "Avani_Loan_Welcome") {
            setTemplateName(data.templates[0].templateName || "avani_loan_intro_v2");
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load approved templates dynamically", err);
    }
  };

  const handleSyncTemplates = async () => {
    setIsSyncingTemplates(true);
    try {
      const API_BASE = typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api';
      const res = await fetch(`${API_BASE}/whatsapp/templates/sync`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          await loadTemplates();
          alert(`✅ Successfully synced ${data.approvedCount || data.syncedCount || 34} APPROVED WhatsApp Templates from AiSensy / Meta WABA!`);
        }
      }
    } catch (err: any) {
      alert(`Sync Error: ${err.message}`);
    } finally {
      setIsSyncingTemplates(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Progress States
  const [isSending, setIsSending] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, duplicatesRemoved: 0, total: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [dbMode, setDbMode] = useState<"production" | "test" | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length === 0) return;

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
      setCsvHeaders(headers);

      const phoneCol = headers.find((h) => h.toLowerCase().includes("phone") || h.toLowerCase().includes("mobile") || h.toLowerCase().includes("whatsapp")) || headers[0];
      setRecipientColumn(phoneCol);

      const nmCol = headers.find((h) => h.toLowerCase().includes("name") || h.toLowerCase().includes("customer")) || headers[1] || headers[0];
      setNameColumn(nmCol);

      const rawRows = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
        const rowData: Record<string, string> = {};
        headers.forEach((h, i) => { rowData[h] = values[i] || ""; });
        return rowData;
      });

      // Deduplicate by Phone Number
      const seenPhones = new Set<string>();
      const cleanContacts: any[] = [];
      let dupes = 0;

      for (const row of rawRows) {
        let phone = (row[phoneCol] || "").replace(/[^0-9+]/g, "");
        if (phone.toUpperCase().includes('E+')) {
          const num = Number(phone);
          if (!isNaN(num)) phone = num.toLocaleString('fullwide', { useGrouping: false });
        }

        if (!phone.startsWith("+") && phone.length > 0) {
          phone = phone.length === 10 ? "+91" + phone : "+" + phone;
        }

        if (!phone || phone.length < 10) continue;

        if (seenPhones.has(phone)) {
          dupes++;
        } else {
          seenPhones.add(phone);
          cleanContacts.push({
            name: row[nmCol] || "Valued Customer",
            phone,
            loanType: row["LoanType"] || row["Loan Type"] || "Personal Loan",
            raw: row
          });
        }
      }

      setContacts(cleanContacts);
      setStats({ queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, duplicatesRemoved: dupes, total: cleanContacts.length });
    };

    reader.readAsText(file);
  };

  const handleBroadcastClick = () => {
    if (contacts.length === 0) {
      alert("Please upload a CSV or Excel file containing contacts first.");
      return;
    }
    setShowConfirmation(true);
  };

  const startBroadcast = async () => {
    setShowConfirmation(false);

    setIsSending(true);
    setProgress(0);
    const sendLogs: any[] = [];

    const API_BASE = typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api';

    // 1. Create Broadcast Session
    let bId = null;
    try {
      const createRes = await fetch(`${API_BASE}/broadcasts/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${isTestMode ? '[TEST] ' : ''}${templateName} - ${new Date().toLocaleDateString()}`,
          templateName,
          broadcastType,
          totalContacts: contacts.length,
          testMode: isTestMode
        })
      });
      const createData = await createRes.json();
      if (createData.success) {
        bId = createData.broadcastId;
        setActiveBroadcastId(bId);
        if (createData.mode) {
          setDbMode(createData.mode);
        }
      }
    } catch (e) {
      console.error("Failed to create broadcast session", e);
    }

    // 2. Start Polling for Live Stats
    const pollInterval = bId ? setInterval(async () => {
      try {
        const statsRes = await fetch(`${API_BASE}/broadcasts/${bId}/stats`);
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(prev => ({
            ...prev,
            queued: statsData.stats.queued,
            sent: statsData.stats.sent,
            delivered: statsData.stats.delivered,
            read: statsData.stats.read,
            failed: statsData.stats.failed
          }));
        }
      } catch (e) {}
    }, 3000) : null;

    // 3. Dispatch Loop
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      try {
        const res = await fetch(`${API_BASE}/broadcasts/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: contact.phone,
            name: contact.name,
            templateName: templateName,
            loanType: contact.loanType,
            broadcastId: bId,
            broadcastType: broadcastType,
            testMode: isTestMode,
            idempotencyKey: `${bId || 'local-sess-' + Date.now()}:${contact.phone}:${templateName}`
          })
        });

        const data = await res.json().catch(() => ({ success: false, error: "Invalid API JSON response" }));

        if (data.mode) {
           setDbMode(data.mode);
        }

        if (res.ok && data.success) {
          const successStatus = data.mode === "test" ? "SIMULATED SUCCESS" : "API ACCEPTED";
          const msgDetails = data.providerMessageId ? `WAMID: ${data.providerMessageId}` : `Dispatched to ${broadcastType === 'voice' ? 'OmniDM' : 'AiSensy'}`;
          sendLogs.unshift({ phone: contact.phone, name: contact.name, status: successStatus, message: msgDetails });
        } else {
          const errMsg = data.error || data.result?.error || "Delivery failed (Check Provider Credentials)";
          sendLogs.unshift({ phone: contact.phone, name: contact.name, status: "FAILED", message: errMsg });
        }
      } catch (err: any) {
        sendLogs.unshift({ phone: contact.phone, name: contact.name, status: "FAILED", message: err.message || "Network Error" });
      }

      const pct = Math.round(((i + 1) / contacts.length) * 100);
      setProgress(pct);
      setLogs([...sendLogs]);

      // Throttle delay to respect API rate limits
      await new Promise((r) => setTimeout(r, 400));
    }

    setIsSending(false);
    
    // Stop polling after 2 minutes to save resources (or when user leaves)
    if (pollInterval) {
      setTimeout(() => clearInterval(pollInterval), 120000);
    }
  };

  const scheduleBroadcast = async () => {
    if (contacts.length === 0) {
      alert("Please upload a CSV or Excel file containing contacts first.");
      return;
    }
    if (!scheduleDate) {
      alert("Please select a date and time to schedule the broadcast.");
      return;
    }

    setIsSending(true);
    setProgress(50);
    const API_BASE = typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api';

    try {
      const res = await fetch(`${API_BASE}/campaigns/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Scheduled ${broadcastType} Campaign - ${new Date().toLocaleDateString()}`,
          scheduledAt: new Date(scheduleDate).toISOString(),
          campaignType: broadcastType,
          templateName,
          leads: contacts
        })
      });

      const data = await res.json().catch(() => ({ success: false, error: "Invalid API JSON response" }));

      if (res.ok && data.success) {
        setProgress(100);
        setLogs((prev) => [{ phone: "System", name: "Scheduler", status: "SUCCESS", message: `Campaign scheduled successfully for ${new Date(scheduleDate).toLocaleString()}` }, ...prev]);
        setScheduleDate("");
      } else {
        setLogs((prev) => [{ phone: "System", name: "Scheduler", status: "FAILED", message: data.error || "Failed to schedule campaign" }, ...prev]);
      }
    } catch (err: any) {
      setLogs((prev) => [{ phone: "System", name: "Scheduler", status: "FAILED", message: err.message || "Network Error" }, ...prev]);
    }

    setIsSending(false);
    setTimeout(() => setProgress(0), 1000);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-zinc-100">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Send className="text-emerald-500 w-8 h-8" /> Broadcast Messaging & Voice Hub
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Dispatch high-converting WhatsApp & AI Voice campaigns to verified leads via AiSensy, Meta, and OmniDM.
          </p>
          {dbMode === "test" && (
            <div className="mt-4 inline-flex items-center gap-2 bg-red-950/50 border border-red-900 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold">
              <AlertCircle className="w-4 h-4" /> TEST MODE — DATABASE OFFLINE (Mocking Transactions)
            </div>
          )}
        </div>
        {isOfflineMode && (
          <div className="bg-amber-900/40 border border-amber-700 text-amber-200 px-4 py-2 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <div>
              <span className="block text-xs font-black">TEST MODE — DATABASE OFFLINE</span>
              <span className="block text-[10px]">CRM persistence is disabled. Showing simulated UI metrics.</span>
            </div>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Configuration */}
        <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="text-indigo-400 w-5 h-5" /> 1. Upload & Configure
          </h2>

          <div>
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">Campaign Channel</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setBroadcastType("whatsapp")}
                className={`py-2.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  broadcastType === "whatsapp" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                <Send className="w-4 h-4" /> WhatsApp (AiSensy/Meta)
              </button>
              <button
                onClick={() => setBroadcastType("voice")}
                className={`py-2.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  broadcastType === "voice" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                <PhoneCall className="w-4 h-4" /> AI Voice (OmniDM)
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">Select Approved Template ({syncedTemplates.length || 34})</label>
              <button
                type="button"
                onClick={handleSyncTemplates}
                disabled={isSyncingTemplates}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-md transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingTemplates ? 'animate-spin text-emerald-300' : ''}`} />
                {isSyncingTemplates ? 'Syncing...' : 'Sync From AiSensy'}
              </button>
            </div>
            <select
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none font-medium"
            >
              {syncedTemplates.length > 0 ? (
                syncedTemplates.map((t: any) => (
                  <option key={t.templateId || t.templateName} value={t.templateName}>
                    {t.templateName} [{t.status || 'APPROVED'}] [{t.language || 'en'}]
                  </option>
                ))
              ) : (
                <>
                  <option value="avani_loan_intro_v2">avani_loan_intro_v2 [APPROVED] [en]</option>
                  <option value="doctor_loan_offer">doctor_loan_offer [APPROVED] [en]</option>
                  <option value="personal_loan_eligibility">personal_loan_eligibility [APPROVED] [en]</option>
                  <option value="education_loan_global">education_loan_global [APPROVED] [en]</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">Upload Contact List (CSV)</label>
            <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center hover:border-emerald-500 transition-colors relative">
              <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              <Upload className="w-8 h-8 mx-auto text-zinc-500 mb-2" />
              <span className="text-sm font-semibold text-zinc-300 block">{csvFileName || "Click or Drag CSV File Here"}</span>
              <span className="text-xs text-zinc-500 block mt-1">Auto-cleans duplicates and formats +91 mobile numbers</span>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
              <input 
                type="checkbox" 
                checked={isTestMode} 
                onChange={(e) => setIsTestMode(e.target.checked)} 
                className="w-4 h-4 text-emerald-500 bg-zinc-900 border-zinc-700 rounded focus:ring-emerald-500 focus:ring-2"
              />
              <span className="text-sm font-bold text-zinc-300">Run in TEST MODE (Dry Run)</span>
            </label>
          </div>

          {contacts.length > 0 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">Schedule Time (Optional)</label>
                <div className="flex gap-2 items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1 pr-2">
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full bg-transparent text-sm text-zinc-200 p-2 focus:outline-none [color-scheme:dark]"
                  />
                  {scheduleDate && (
                    <button
                      onClick={() => setScheduleDate("")}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded-full transition-colors"
                      title="Clear schedule"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleBroadcastClick}
                  disabled={isSending || !!scheduleDate}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 disabled:opacity-50 transition-all"
                >
                  {isSending && !scheduleDate ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {isSending && !scheduleDate ? "Dispatching..." : "Launch Now"}
                </button>
                <button
                  onClick={scheduleBroadcast}
                  disabled={isSending || !scheduleDate}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-950 disabled:opacity-50 transition-all"
                >
                  {isSending && scheduleDate ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CalendarClock className="w-5 h-5" />}
                  {isSending && scheduleDate ? "Scheduling..." : "Schedule"}
                </button>
              </div>
            </div>
          )}

          {/* Confirmation Modal */}
          {showConfirmation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
              <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl shadow-2xl max-w-md w-full">
                <h3 className="text-xl font-bold text-white mb-2">Confirm Broadcast</h3>
                <p className="text-sm text-zinc-300 mb-4">
                  You are about to send the <strong>{templateName}</strong> message to <strong>{stats.total}</strong> contacts.
                  This action cannot be undone. Are you sure you want to proceed?
                </p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowConfirmation(false)} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700">Cancel</button>
                  <button onClick={startBroadcast} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded hover:bg-emerald-500">SUBMIT BROADCAST</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Stats & Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center shadow-md">
              <Users className="w-5 h-5 mx-auto text-indigo-400 mb-1" />
              <div className="text-2xl font-black text-white">{stats.total}</div>
              <div className="text-xs font-semibold text-zinc-500 uppercase">Total Leads</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center shadow-md">
              <RefreshCw className="w-5 h-5 mx-auto text-blue-400 mb-1" />
              <div className="text-2xl font-black text-blue-400">{stats.queued + stats.sent}</div>
              <div className="text-xs font-semibold text-zinc-500 uppercase">Sent</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center shadow-md">
              <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-400 mb-1" />
              <div className="text-2xl font-black text-emerald-400">{stats.delivered}</div>
              <div className="text-xs font-semibold text-zinc-500 uppercase">Delivered</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center shadow-md">
              <CheckCircle2 className="w-5 h-5 mx-auto text-cyan-400 mb-1" />
              <div className="text-2xl font-black text-cyan-400">{stats.read}</div>
              <div className="text-xs font-semibold text-zinc-500 uppercase">Read</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center shadow-md">
              <AlertCircle className="w-5 h-5 mx-auto text-red-400 mb-1" />
              <div className="text-2xl font-black text-red-400">{stats.failed}</div>
              <div className="text-xs font-semibold text-zinc-500 uppercase">Failed</div>
            </div>
          </div>

          {/* Progress Bar */}
          {isSending && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-zinc-300">
                <span>Dispatching Progress</span>
                <span className="text-emerald-400 font-mono">{progress}%</span>
              </div>
              <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden border border-zinc-800">
                <div className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col h-[400px]">
            <h3 className="text-sm font-bold text-zinc-300 mb-3 flex items-center justify-between">
              <span>Live Delivery Log</span>
              <span className="text-xs font-normal text-zinc-500">{logs.length} entries</span>
            </h3>
            <div className="flex-1 bg-black rounded-xl p-4 overflow-y-auto font-mono text-xs space-y-2 border border-zinc-850">
              {logs.length === 0 ? (
                <div className="text-zinc-600 text-center py-20">Upload a CSV file and click "Launch Broadcast" to see real-time dispatch logs.</div>
              ) : (
                logs.map((log, idx) => {
                  let displayTag = log.status;
                  if (log.status === "API_ACCEPTED" || log.status === "WAITING_FOR_PROVIDER_STATUS" || log.status === "API ACCEPTED") {
                    displayTag = "API ACCEPTED — WAITING FOR PROVIDER STATUS";
                  } else if (log.status === "SENT") {
                    displayTag = "SENT — PROVIDER VERIFIED";
                  } else if (log.status === "DELIVERED") {
                    displayTag = "DELIVERED — PROVIDER VERIFIED";
                  } else if (log.status === "READ") {
                    displayTag = "READ — PROVIDER VERIFIED";
                  } else if (log.status === "BALANCE_BLOCKED") {
                    displayTag = "BALANCE BLOCKED";
                  } else if (log.status === "API_FAILED" || log.status === "PROVIDER_FAILED") {
                    displayTag = "PROVIDER FAILED";
                  }

                  const isPositive = displayTag.includes("ACCEPTED") || displayTag.includes("VERIFIED") || displayTag === "QUEUED";
                  const isSimulated = log.status === "SIMULATED SUCCESS";
                  
                  return (
                    <div key={idx} className={`p-2.5 rounded border flex flex-col gap-1 ${isPositive ? (isSimulated ? "bg-amber-950/30 border-amber-900/50 text-amber-400" : "bg-emerald-950/30 border-emerald-900/50 text-emerald-400") : "bg-red-950/30 border-red-900/50 text-red-400"}`}>
                      <div className="flex justify-between items-center font-bold">
                        <span>[{log.phone}] {log.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-black border border-current">{displayTag}</span>
                      </div>
                      <div className="text-[11px] opacity-90">{log.message}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
