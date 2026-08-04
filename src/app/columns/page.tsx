"use client";

import { useState } from "react";
import { Plus, Columns, Trash2, X } from "lucide-react";

const preconfiguredColumns = [
  { id: "c1", name: "Loan Product Type", type: "TEXT", createdAt: new Date().toISOString() },
  { id: "c2", name: "Monthly Net Salary / Income", type: "NUMBER", createdAt: new Date().toISOString() },
  { id: "c3", name: "Business Vintage (Years)", type: "NUMBER", createdAt: new Date().toISOString() },
  { id: "c4", name: "CIBIL Score", type: "NUMBER", createdAt: new Date().toISOString() },
  { id: "c5", name: "Co-applicant Name", type: "TEXT", createdAt: new Date().toISOString() },
  { id: "c6", name: "Property Valuation", type: "NUMBER", createdAt: new Date().toISOString() }
];

export default function ColumnsPage() {
  const [items, setItems] = useState<any[]>(preconfiguredColumns);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [colName, setColName] = useState("");
  const [colType, setColType] = useState("TEXT");

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colName) return;

    const newCol = {
      id: "col_" + Date.now(),
      name: colName,
      type: colType,
      createdAt: new Date().toISOString()
    };

    setItems([newCol, ...items]);
    setColName("");
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
            <Columns className="w-8 h-8 text-amber-400" />
            Custom Columns Management
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Add custom data fields to your customer profiles and lead tables.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Column
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-300 uppercase bg-zinc-800/50 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Column Name</th>
              <th className="px-6 py-4 font-semibold">Data Type</th>
              <th className="px-6 py-4 font-semibold">Created Date</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-zinc-200">{item.name}</td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 rounded text-xs font-mono bg-zinc-800 text-amber-400 border border-zinc-700">
                    {item.type}
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

      {/* Add Column Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Columns className="w-5 h-5 text-amber-400" />
                Add Custom Column
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddColumn} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Column Name</label>
                <input 
                  type="text" 
                  value={colName}
                  onChange={(e) => setColName(e.target.value)}
                  placeholder="e.g. Existing EMI Amount"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Data Type</label>
                <select 
                  value={colType}
                  onChange={(e) => setColType(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="TEXT">Text String</option>
                  <option value="NUMBER">Number / Currency</option>
                  <option value="DATE">Date</option>
                  <option value="BOOLEAN">Yes / No</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Save Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
