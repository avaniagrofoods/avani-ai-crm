"use client";

import { useState } from "react";
import { Upload, Send, CheckCircle2, AlertCircle, RefreshCw, PhoneCall, FileSpreadsheet, Users, ShieldCheck } from "lucide-react";

export default function BroadcastsPage() {
  const [csvFileName, setCsvFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [recipientColumn, setRecipientColumn] = useState("");
  const [nameColumn, setNameColumn] = useState("");
  const [templateName, setTemplateName] = useState("Avani_Loan_Welcome");
  const [broadcastType, setBroadcastType] = useState<"whatsapp" | "voice">("whatsapp");

  // Progress States
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ success: 0, failed: 0, duplicatesRemoved: 0, total: 0 });
  const [logs, setLogs] = useState<any[]>([]);

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
      setStats({ success: 0, failed: 0, duplicatesRemoved: dupes, total: cleanContacts.length });
    };

    reader.readAsText(file);
  };

  const startBroadcast = async () => {
    if (contacts.length === 0) {
      alert("Please upload a CSV or Excel file containing contacts first.");
      return;
    }

    setIsSending(true);
    setProgress(0);
    let successCount = 0;
    let failedCount = 0;
    const sendLogs: any[] = [];

    const API_BASE = typeof window !== 'undefined' ? `${window.location.origin}/api` : 'https://avani-ai-crm.vercel.app/api';

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      try {
        if (broadcastType === "whatsapp") {
          const res = await fetch(`${API_BASE}/whatsapp-webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "send_template",
              phone: contact.phone,
              name: contact.name,
              template: templateName
            })
          });

          if (res.ok) {
            successCount++;
            sendLogs.unshift({ phone: contact.phone, name: contact.name, status: "SUCCESS", message: "WhatsApp message delivered" });
          } else {
            failedCount++;
            sendLogs.unshift({ phone: contact.phone, name: contact.name, status: "FAILED", message: "Delivery failed" });
          }
        } else {
          // Voice Call Broadcast via OmniDM
          const res = await fetch(`${API_BASE}/leads/trigger`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: contact.phone,
              name: contact.name,
              loanType: contact.loanType
            })
          });

          if (res.ok) {
            successCount++;
            sendLogs.unshift({ phone: contact.phone, name: contact.name, status: "SUCCESS", message: "OmniDM AI Voice Call dispatched" });
          } else {
            failedCount++;
            sendLogs.unshift({ phone: contact.phone, name: contact.name, status: "FAILED", message: "OmniDM Dispatch failed" });
          }
        }
      } catch (err: any) {
        failedCount++;
        sendLogs.unshift({ phone: contact.phone, name: contact.name, status: "FAILED", message: err.message });
      }

      const pct = Math.round(((i + 1) / contacts.length) * 100);
      setProgress(pct);
      setStats((prev) => ({ ...prev, success: successCount, failed: failedCount }));
      setLogs([...sendLogs]);

      // Throttle delay to respect API rate limits
      await new Promise((r) => setTimeout(r, 400));
    }

    setIsSending(false);
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
        </div>
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
                <Send className="w-4 h-4" /> WhatsApp (AiSensy)
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
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">Select Template</label>
            <select
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
            >
              <option value="Avani_Loan_Welcome">Avani Loan Welcome & Intro</option>
              <option value="avani_doctor_loan">Doctor Loan Exclusive Offer</option>
              <option value="avani_ca_loan">CA & Professional Loan Special</option>
              <option value="avani_business_growth">Business Loan Fast Approval</option>
              <option value="avani_education_global">Global & India Education Funding</option>
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

          {contacts.length > 0 && (
            <button
              onClick={startBroadcast}
              disabled={isSending}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 disabled:opacity-50 transition-all"
            >
              {isSending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {isSending ? "Dispatching Broadcast..." : `Launch Broadcast (${contacts.length} Contacts)`}
            </button>
          )}
        </div>

        {/* Step 2: Stats & Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center shadow-md">
              <Users className="w-5 h-5 mx-auto text-indigo-400 mb-1" />
              <div className="text-2xl font-black text-white">{stats.total}</div>
              <div className="text-xs font-semibold text-zinc-500 uppercase">Total Leads</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center shadow-md">
              <ShieldCheck className="w-5 h-5 mx-auto text-yellow-400 mb-1" />
              <div className="text-2xl font-black text-yellow-400">{stats.duplicatesRemoved}</div>
              <div className="text-xs font-semibold text-zinc-500 uppercase">Dupes Removed</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center shadow-md">
              <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-400 mb-1" />
              <div className="text-2xl font-black text-emerald-400">{stats.success}</div>
              <div className="text-xs font-semibold text-zinc-500 uppercase">Delivered</div>
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
                logs.map((log, idx) => (
                  <div key={idx} className={`p-2 rounded border flex justify-between items-center ${log.status === "SUCCESS" ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400" : "bg-red-950/30 border-red-900/50 text-red-400"}`}>
                    <span>[{log.phone}] {log.name}</span>
                    <span className="font-bold">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
