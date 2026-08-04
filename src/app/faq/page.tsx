"use client";

import { useState } from "react";
import { Plus, HelpCircle, Trash2, X } from "lucide-react";

const preconfiguredFaqs = [
  { id: "f1", trigger: "Interest Rate / ROI", reply: "Our interest rates start from 8.40% p.a. for Home Loans and 10.50% p.a. for Personal & Business Loans.", createdAt: new Date().toISOString() },
  { id: "f2", trigger: "Documents Required", reply: "Basic docs needed: PAN Card, Aadhaar Card, 6 Months Bank Statement, and 3 Months Salary Slips (or 2 Yrs ITR for business).", createdAt: new Date().toISOString() },
  { id: "f3", trigger: "Approval Time / Processing", reply: "AVANI Loan Services provides fast approval within 24 to 48 hours after document verification.", createdAt: new Date().toISOString() },
  { id: "f4", trigger: "Office Address / Location", reply: "Opposite Bank of Baroda, Above Monginis Cake Shop, Rajiv Gandhi Chauk, Ausa Road, Latur, Maharashtra 413512.", createdAt: new Date().toISOString() }
];

export default function FaqPage() {
  const [items, setItems] = useState<any[]>(preconfiguredFaqs);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [reply, setReply] = useState("");

  const handleAddFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trigger || !reply) return;

    const newFaq = {
      id: "faq_" + Date.now(),
      trigger,
      reply,
      createdAt: new Date().toISOString()
    };

    setItems([newFaq, ...items]);
    setTrigger("");
    setReply("");
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
            <HelpCircle className="w-8 h-8 text-blue-400" />
            FAQ & Automated Support Knowledgebase
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Configure keyword triggers and instant automated answers for WhatsApp customer inquiries.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          Add FAQ Rule
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-300 uppercase bg-zinc-800/50 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Keyword Trigger</th>
              <th className="px-6 py-4 font-semibold">Automated AI Reply</th>
              <th className="px-6 py-4 font-semibold">Created Date</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-bold text-white">{item.trigger}</td>
                <td className="px-6 py-4 text-xs text-zinc-300 bg-zinc-950/40 p-3 font-sans rounded-lg border border-zinc-800/60 max-w-md">
                  {item.reply}
                </td>
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

      {/* Add FAQ Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                Add FAQ Automation Rule
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddFaq} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Keyword Trigger</label>
                <input 
                  type="text" 
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  placeholder="e.g. Prepayment / Foreclosure"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Automated WhatsApp Response</label>
                <textarea 
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Zero prepayment charges after 6 EMIs on personal loans."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
