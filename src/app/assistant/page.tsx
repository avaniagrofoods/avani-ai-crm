"use client"

const API_URL = typeof window !== 'undefined' ? ('https://avani-ai-crm.vercel.app/api') : 'https://avani-ai-crm.vercel.app/api';
import { useState, useEffect } from "react";
import { Bot, Save } from "lucide-react";

export default function AssistantPage() {
  const [name, setName] = useState("Avani Agent");
  const [model, setModel] = useState("gemini-1.5-flash");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/assistant`)
      .then(res => res.json())
      .then(data => {
        if (data && data[0]) {
          setName(data[0].name || "");
          setModel(data[0].model || "gemini-1.5-flash");
          setSystemPrompt(data[0].systemPrompt || "");
          setTemperature(data[0].temperature || 0.7);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, model, systemPrompt, temperature }),
      });
      if (res.ok) {
        alert("AI assistant configured successfully!");
      } else {
        alert("Failed to configure AI assistant");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-zinc-500 text-center py-12">Loading assistant settings...</div>;

  return (
    <div className="flex flex-col gap-6 h-full p-6 max-w-xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Bot className="w-6 h-6" />
          AI Assistant Config
        </h2>
        <p className="text-sm text-zinc-400">Configure AI auto-pilot system instructions and parameters.</p>
      </div>

      <form onSubmit={handleSave} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Agent Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
          >
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">System Instructions (Prompt)</label>
          <textarea
            rows={5}
            required
            placeholder="Introduce yourself as Avani Agent. Help qualify customers looking for home/personal loans..."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Temperature ({temperature})</label>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        <button type="submit" className="flex items-center justify-center gap-2 mt-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 text-sm w-full">
          <Save className="w-4 h-4" />
          Save AI Configurations
        </button>
      </form>
    </div>
  );
};
