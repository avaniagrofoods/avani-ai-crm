"use client";

import { useState, useEffect } from "react";
import { Globe, Trash2, RefreshCw, Plus, X, CheckCircle2, AlertCircle } from "lucide-react";

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/webhooks');
      const data = await res.json();
      if (data.success) {
        setEndpoints(data.endpoints || []);
        setRecentEvents(data.recentEvents || []);
      }
    } catch (err) {
      console.error("Failed to load webhooks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  return (
    <div className="flex flex-col gap-6 h-full p-6 text-zinc-200 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Globe className="w-8 h-8 text-cyan-400" />
            Webhook Endpoints & Events
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Monitor real-time inbound webhook handshakes and events from ChatMitra, Meta & Telephony.</p>
        </div>
        <button 
          onClick={fetchWebhooks}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-cyan-500/20"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Webhooks
        </button>
      </div>

      {/* Registered Webhook Endpoints */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md">
        <div className="p-4 border-b border-zinc-800 bg-zinc-800/40">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Registered Inbound Gateways</h3>
        </div>
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-300 uppercase bg-zinc-800/50 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Gateway / Provider</th>
              <th className="px-6 py-4 font-semibold">Inbound Webhook URL</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Subscribed Events</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {endpoints.map((evt) => (
              <tr key={evt.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-zinc-200">
                  <div className="font-semibold text-white">{evt.event}</div>
                  <div className="text-xs text-zinc-400">{evt.provider}</div>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-cyan-400 select-all">{evt.url}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 w-fit ${
                    evt.status === 'ACTIVE' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {evt.status === 'ACTIVE' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {evt.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-zinc-400">
                  {Array.isArray(evt.subscribedEvents) ? evt.subscribedEvents.join(', ') : 'All events'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Live WebhookInbox Records */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md">
        <div className="p-4 border-b border-zinc-800 bg-zinc-800/40 flex justify-between items-center">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Webhook Event Ingestion Log (MongoDB WebhookInbox)</h3>
          <span className="text-xs text-zinc-400">{recentEvents.length} events logged</span>
        </div>
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-300 uppercase bg-zinc-800/50 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-3 font-semibold">Event ID</th>
              <th className="px-6 py-3 font-semibold">Provider</th>
              <th className="px-6 py-3 font-semibold">Event Type</th>
              <th className="px-6 py-3 font-semibold">Processing Status</th>
              <th className="px-6 py-3 font-semibold">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 font-mono text-xs">
            {recentEvents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500 font-sans text-sm">
                  No webhook events received yet. Inbound webhook payloads from ChatMitra will appear here automatically.
                </td>
              </tr>
            )}
            {recentEvents.map((evt) => (
              <tr key={evt._id || evt.eventId} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-3 text-zinc-300">{evt.eventId}</td>
                <td className="px-6 py-3 text-cyan-400">{evt.provider}</td>
                <td className="px-6 py-3 text-zinc-300">{evt.eventType}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    evt.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                    evt.status === 'PROCESSING' ? 'bg-blue-500/10 text-blue-400' :
                    evt.status === 'FAILED' ? 'bg-rose-500/10 text-rose-400' :
                    'bg-zinc-800 text-zinc-400'
                  }`}>
                    {evt.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-zinc-500">
                  {evt.receivedAt ? new Date(evt.receivedAt).toLocaleTimeString() : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
