"use client";

import { useState } from "react";
import { Plus, Code, Trash2, X, Copy, Check } from "lucide-react";

const preconfiguredKeys = [
  { id: "dev1", name: "Meta WhatsApp WABA Production Secret", key: "EAAdIUij5eSEBSPNXXeehEPuB...", scope: "FULL_ACCESS", createdAt: new Date().toISOString() },
  { id: "dev2", name: "AiSensy WABA Gateway API Token", key: "eyJhbGciOiJIUzI1NiIsInR5cCI6...", scope: "BROADCAST_READ_WRITE", createdAt: new Date().toISOString() },
  { id: "dev3", name: "OmniDM AI Voice Dispatch Secret", key: "w-uV11bJBZ3g5icPI-uw97k2Fz...", scope: "VOICE_CALL_DISPATCH", createdAt: new Date().toISOString() }
];

export default function DevelopersPage() {
  const [items, setItems] = useState<any[]>(preconfiguredKeys);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [scope, setScope] = useState("READ_WRITE");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName) return;

    const newKey = {
      id: "key_" + Date.now(),
      name: keyName,
      key: "avani_live_" + Math.random().toString(36).substring(2, 18),
      scope,
      createdAt: new Date().toISOString()
    };

    setItems([newKey, ...items]);
    setKeyName("");
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6 text-zinc-200 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Code className="w-8 h-8 text-indigo-400" />
            Developer API Keys & Webhook Access Tokens
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Manage API keys, webhooks, and developer credentials for AVANI AI CRM.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Generate API Key
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-300 uppercase bg-zinc-800/50 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Key Identifier</th>
              <th className="px-6 py-4 font-semibold">API Secret Token</th>
              <th className="px-6 py-4 font-semibold">Permission Scope</th>
              <th className="px-6 py-4 font-semibold">Created Date</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-bold text-white">{item.name}</td>
                <td className="px-6 py-4 font-mono text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <span className="bg-zinc-950 px-3 py-1 rounded border border-zinc-800">{item.key}</span>
                    <button 
                      onClick={() => handleCopy(item.id, item.key)}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs font-mono text-indigo-400">{item.scope}</td>
                <td className="px-6 py-4 text-xs text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(item.id)} 
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

      {/* Add API Key Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-400" />
                Generate New Developer API Key
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddKey} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Key Label Name</label>
                <input 
                  type="text" 
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Website Lead Form API Key"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Permission Scope</label>
                <select 
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="FULL_ACCESS">Full Access (Read / Write / Delete)</option>
                  <option value="READ_WRITE">Read & Write</option>
                  <option value="READ_ONLY">Read Only</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
