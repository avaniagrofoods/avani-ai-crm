"use client";

import { useState } from "react";
import { Plus, Tag, Trash2, X } from "lucide-react";

const preconfiguredTags = [
  { id: "t1", name: "Personal Loan Lead", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", createdAt: new Date().toISOString() },
  { id: "t2", name: "Business Loan VIP", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", createdAt: new Date().toISOString() },
  { id: "t3", name: "Doctor Loan Priority", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", createdAt: new Date().toISOString() },
  { id: "t4", name: "CA Professional Lead", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", createdAt: new Date().toISOString() },
  { id: "t5", name: "Home Loan Inquiry", color: "bg-pink-500/10 text-pink-400 border-pink-500/20", createdAt: new Date().toISOString() },
  { id: "t6", name: "CIBIL Counseling", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", createdAt: new Date().toISOString() }
];

export default function TagsPage() {
  const [items, setItems] = useState<any[]>(preconfiguredTags);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tagName, setTagName] = useState("");

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName) return;

    const newTag = {
      id: "tag_" + Date.now(),
      name: tagName,
      color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      createdAt: new Date().toISOString()
    };

    setItems([newTag, ...items]);
    setTagName("");
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
            <Tag className="w-8 h-8 text-indigo-400" />
            Contact Tags Management
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Organize and segment leads for broadcast targeting.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Tag
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-300 uppercase bg-zinc-800/50 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Tag Name</th>
              <th className="px-6 py-4 font-semibold">Badge Style</th>
              <th className="px-6 py-4 font-semibold">Created Date</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-zinc-200">{item.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${item.color}`}>
                    {item.name}
                  </span>
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

      {/* Add Tag Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-400" />
                Add New Tag
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTag} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Tag Name</label>
                <input 
                  type="text" 
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g. High Networth Client"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Save Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
