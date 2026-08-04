"use client";

import { useState } from "react";
import { Bot, Save, CheckCircle2 } from "lucide-react";

export default function AssistantPage() {
  const [name, setName] = useState("Avani Loan Services AI Agent");
  const [model, setModel] = useState("gemini-1.5-flash");
  const [systemPrompt, setSystemPrompt] = useState(`You are the Avani Loan Services AI Agent (Owner: Sachin Shinde, Latur).
Your goal is to collect loan requirements from the user step-by-step in a conversational manner.

# Rules:
1. ALWAYS ask ONLY ONE question at a time.
2. Be polite, professional, and use concise language.
3. First ask loan type: Personal, Business, Doctor, CA, Home, or Education.
4. Collect Full Name, City, Monthly Income / Turnover, and Required Amount.`);
  const [temperature, setTemperature] = useState(0.7);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6 text-zinc-200 max-w-[900px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Bot className="w-8 h-8 text-emerald-400" />
            AI Assistant Configurator
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Configure Gemini 1.5 Flash auto-pilot system instructions and loan qualification rules.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5 shadow-md">
        {savedSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> AI Assistant Configuration Saved Successfully!
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
            <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (Deep Reasoning)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">System Qualification Instructions (Prompt)</label>
          <textarea
            rows={7}
            required
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono text-xs leading-relaxed"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Temperature / Creativity ({temperature})</label>
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
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-emerald-500/20"
          >
            <Save className="w-4 h-4" />
            Save AI Config
          </button>
        </div>
      </form>
    </div>
  );
}
