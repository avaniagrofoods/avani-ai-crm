"use client";

import { useState } from "react";
import { Plus, CheckCircle, Trash2, X } from "lucide-react";

const preconfiguredTasks = [
  { id: "tk1", title: "Collect GST Returns from Ajay Tech Systems", assignee: "Sachin Shinde", status: "PENDING", createdAt: new Date().toISOString() },
  { id: "tk2", title: "Verify Dr. Priya Patil Medical Registration", assignee: "Professional Loan Desk", status: "COMPLETED", createdAt: new Date().toISOString() },
  { id: "tk3", title: "Schedule Home Loan Site Inspection for Rahul", assignee: "Home Loan Team", status: "PENDING", createdAt: new Date().toISOString() },
  { id: "tk4", title: "CIBIL Score Advisory Call - Ramesh Kumar", assignee: "Credit Counselor", status: "COMPLETED", createdAt: new Date().toISOString() }
];

export default function TasksPage() {
  const [items, setItems] = useState<any[]>(preconfiguredTasks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("Sachin Shinde");

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const newTask = {
      id: "task_" + Date.now(),
      title,
      assignee,
      status: "PENDING",
      createdAt: new Date().toISOString()
    };

    setItems([newTask, ...items]);
    setTitle("");
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const toggleStatus = (id: string) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, status: item.status === "PENDING" ? "COMPLETED" : "PENDING" };
      }
      return item;
    }));
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6 text-zinc-200 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
            Lead Verification & Follow-up Tasks
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Track document collection, site visits, and bank submission tasks.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-300 uppercase bg-zinc-800/50 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Task Title</th>
              <th className="px-6 py-4 font-semibold">Assigned Specialist</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Created Date</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={item.status === "COMPLETED"} 
                    onChange={() => toggleStatus(item.id)}
                    className="rounded border-zinc-700 accent-emerald-500 cursor-pointer"
                  />
                  <span className={item.status === "COMPLETED" ? "line-through text-zinc-500" : ""}>
                    {item.title}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-zinc-400">{item.assignee}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${item.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {item.status}
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

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Add Follow-up Task
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Task Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Call customer for property valuation docs"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Assignee</label>
                <input 
                  type="text" 
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="e.g. Sachin Shinde"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
