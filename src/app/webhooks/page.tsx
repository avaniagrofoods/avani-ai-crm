"use client";
import { useState, useEffect } from "react";
import { Globe, Trash2, RefreshCw } from "lucide-react";

const API_URL = typeof window !== 'undefined' ? ('https://avani-ai-crm.vercel.app/api') : 'https://avani-ai-crm.vercel.app/api';

export default function WebhooksPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/webhooks`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear all logged webhook events?")) return;
    try {
      const res = await fetch(`${API_URL}/webhooks`, { method: 'DELETE' });
      if (res.ok) {
        fetchEvents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Webhook Events</h2>
          <p className="text-sm text-zinc-400">Monitor raw inbound status events and API payloads from Meta WhatsApp Business Platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchEvents}
            className="flex items-center gap-2 px-3 py-2 border border-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-3 py-2 border border-red-900/30 text-red-400 rounded-lg hover:bg-red-950/20 transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Clear Logs
          </button>
        </div>
      </div>

      {loading && events.length === 0 ? (
        <div className="text-zinc-500 text-center py-12">Loading event logs...</div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-zinc-800 rounded-xl bg-zinc-900/50 text-zinc-500">
          <Globe className="w-12 h-12 text-zinc-700 mb-3" />
          <h3 className="text-zinc-300 font-medium mb-1">No Webhook events logged yet</h3>
          <p className="text-sm text-center max-w-sm">When WhatsApp triggers status notifications (sent, delivered, read, incoming message), you will see the payload appear here in real-time.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Latest Raw Logs ({events.length})
          </div>
          <div className="flex flex-col gap-2">
            {events.map((evt) => {
              const isExpanded = expandedEventId === evt.id;
              return (
                <div key={evt.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
                  <div
                    onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                    className="flex justify-between items-center px-5 py-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${evt.payload?.type === 'verification_attempt' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <span className="text-sm font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                        {evt.payload?.type || 'EVENT_RECEIVED'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-zinc-500 font-mono">
                        {new Date(evt.timestamp).toLocaleTimeString()} {new Date(evt.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-zinc-800/80 bg-zinc-950/60 p-4 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre">
                      {JSON.stringify(evt.payload, null, 2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
