"use client";

import { useState } from "react";
import { Plus, ShieldCheck, Trash2, X } from "lucide-react";

const preconfiguredOpts = [
  { id: "o1", phone: "+91 91756 35165", status: "OPTED_IN", source: "Website Form", createdAt: new Date().toISOString() },
  { id: "o2", phone: "+91 72491 08474", status: "OPTED_IN", source: "Meta Lead Ad", createdAt: new Date().toISOString() },
  { id: "o3", phone: "+91 72190 53645", status: "OPTED_IN", source: "Direct WhatsApp", createdAt: new Date().toISOString() }
];

export default function OptsPage() {
  const [items, setItems] = useState<any[]>(preconfiguredOpts);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("OPTED_IN");
  const [source, setSource] = useState("Manual CRM Opt-in");

  const handleAddOpt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.length === 10 ? '+91 ' + formattedPhone : '+' + formattedPhone;
    }

    const newOpt = {
      id: "opt_" + Date.now(),
      phone: formattedPhone,
      status,
      source,
      createdAt: new Date().toISOString()
    };

    setItems([newOpt, ...items]);
    setPhone("");
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6 text-zinc-200 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            Opt-in & Consent Management
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Manage TRAI & Meta compliant WhatsApp user consent registries.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Opt Preference
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-300 uppercase bg-zinc-800/50 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Phone Number</th>
              <th className="px-6 py-4 font-semibold">Consent Status</th>
              <th className="px-6 py-4 font-semibold">Consent Source</th>
              <th className="px-6 py-4 font-semibold">Opt Date</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-zinc-200">{item.phone}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${item.status === 'OPTED_IN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-zinc-400">{item.source}</td>
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

      {/* Add Opt Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Add Opt Preference
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddOpt} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Phone Number</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Consent Status</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="OPTED_IN">OPTED_IN (Subscribed)</option>
                  <option value="OPTED_OUT">OPTED_OUT (Unsubscribed / STOP)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Opt Source</label>
                <input 
                  type="text" 
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. Meta Lead Form / WhatsApp Reply"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Save Consent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
