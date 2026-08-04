"use client";

import { useState } from "react";
import { Globe, Trash2, RefreshCw, Plus, X, CheckCircle2 } from "lucide-react";

const preconfiguredWebhooks = [
  { id: "w1", event: "Meta WhatsApp Cloud API Inbound & Status", url: "https://avani-ai-crm.vercel.app/api/whatsapp-webhook", status: "ACTIVE", lastTrigger: new Date().toISOString() },
  { id: "w2", event: "AiSensy WABA Broadcast Callback Gateway", url: "https://avani-ai-crm.vercel.app/api/meta-webhook", status: "ACTIVE", lastTrigger: new Date().toISOString() },
  { id: "w3", event: "OmniDM AI Voice Post-Call Trigger", url: "https://avani-ai-crm.vercel.app/api/omnidim-webhook", status: "ACTIVE", lastTrigger: new Date().toISOString() },
  { id: "w4", event: "CallKaro Voice Agent Callback", url: "https://avani-ai-crm.vercel.app/api/callkaro-webhook", status: "ACTIVE", lastTrigger: new Date().toISOString() }
];

export default function WebhooksPage() {
  const [events, setEvents] = useState<any[]>(preconfiguredWebhooks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");

  const handleAddWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetUrl) return;

    const newWh = {
      id: "wh_" + Date.now(),
      event: name,
      url: targetUrl,
      status: "ACTIVE",
      lastTrigger: new Date().toISOString()
    };

    setEvents([newWh, ...events]);
    setName("");
    setTargetUrl("");
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6 text-zinc-200 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Globe className="w-8 h-8 text-cyan-400" />
            Webhook Endpoints & Events
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Monitor real-time inbound status events and API webhooks from Meta, AiSensy & OmniDM.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-cyan-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-300 uppercase bg-zinc-800/50 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Event Name</th>
              <th className="px-6 py-4 font-semibold">Webhook Endpoint URL</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Last Active</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {events.map((evt) => (
              <tr key={evt.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-zinc-200">{evt.event}</td>
                <td className="px-6 py-4 font-mono text-xs text-zinc-400">{evt.url}</td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-fit">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {evt.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-zinc-500">{new Date(evt.lastTrigger).toLocaleTimeString()}</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(evt.id)} 
                    className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-400/10 transition-colors text-xs font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Webhook Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                Add Webhook Endpoint
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddWebhook} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Webhook / Integration Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HubSpot Lead Sync Webhook"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Target Endpoint URL</label>
                <input 
                  type="url" 
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://your-domain.com/api/webhook"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Save Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
