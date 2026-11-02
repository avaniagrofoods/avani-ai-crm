"use client";

import { useState, useEffect } from "react";
import { Bot, Save, CheckCircle2, ShieldAlert } from "lucide-react";

const CANONICAL_SYSTEM_PROMPT = `You are the Avani Loan Services AI Agent (Founder & Chief Advisor: Sachin Shinde, Helpline: +91 72491 08474, Website: www.avanifinserv.com).

# Core Mission & Identity:
1. AVANI LOAN SERVICES is an authorized loan advisory and consultancy service and does NOT act as a direct lender or bank.
2. We guide customers to secure the best loan options from 40+ partner banks & NBFCs with zero upfront fees.
3. NEVER make false guarantees, 100% approval promises, or CIBIL repair promises.

# Canonical 8 Loan Products Supported:
1. Personal Loan (Salaried & Self-Employed)
2. Business Loan (Collateral-free & Secured)
3. Home Loan (Purchase, Construction, Balance Transfer)
4. Mortgage Loan / Loan Against Property (LAP)
5. Education Loan (Domestic & Overseas Studies)
6. Vehicle Loan / Car Loan (New & Used)
7. Gold Loan (Quick processing via partner branches)
8. Working Capital / MSME Loan (Cash Credit, Overdraft, Professional Loans for Doctors & CAs)

# Conversation Rules:
- Support English, Marathi (मराठी), and Hindi (हिंदी).
- ALWAYS ask ONLY ONE question at a time.
- Collect step-by-step: Full Name, 10-digit Mobile, Email, City, Employment Type, Monthly Income, Loan Product, and Required Loan Amount.
- If the customer asks for a human advisor or requests a call, escalate immediately to Sachin Shinde (+91 72491 08474).`;

export default function AssistantPage() {
  const [name, setName] = useState("Avani Loan Services AI Agent");
  const [model, setModel] = useState("gemini-1.5-flash");
  const [systemPrompt, setSystemPrompt] = useState(CANONICAL_SYSTEM_PROMPT);
  const [temperature, setTemperature] = useState(0.7);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data[0]?.systemPrompt) {
          setSystemPrompt(data[0].systemPrompt);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantName: name,
          aiModel: model,
          systemPrompt,
          temperature
        })
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6 text-zinc-200 max-w-[950px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Bot className="w-8 h-8 text-emerald-400" />
            AI Assistant Configurator
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Configure Google Gemini auto-pilot system instructions, loan qualification rules, and advisory safeguards.</p>
        </div>
      </div>

      {/* Advisory Badge */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 text-amber-300 text-xs leading-relaxed">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-400" />
        <div>
          <span className="font-bold">Statutory Compliance Mandate: </span>
          The AI Assistant strictly operates under AVANI Loan Services advisory protocols. It enforces 8 canonical loan products, disclaims direct lending liability, prohibits guaranteed approval promises, and escalates to Sachin Shinde (+91 72491 08474) upon request.
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5 shadow-md">
        {savedSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> AI Assistant Configuration Saved Successfully to CRM!
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Agent Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">AI Foundation Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (Ultra Fast & Low Latency)</option>
            <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (Deep Multimodal Reasoning)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">System Qualification Instructions & Safety Guidelines (Prompt)</label>
          <textarea
            rows={12}
            required
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono text-xs leading-relaxed"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Temperature / Determinism ({temperature})</label>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 bg-zinc-950"
          />
        </div>

        <div className="pt-3 border-t border-zinc-800 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save AI Config'}
          </button>
        </div>
      </form>
    </div>
  );
}
