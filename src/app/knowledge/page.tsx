"use client";

import { useState } from "react";
import { Plus, Book, Trash2, X, Eye } from "lucide-react";

const preconfiguredKnowledge = [
  { id: "k1", title: "Personal Loan Eligibility Criteria 2026", category: "Eligibility Rules", content: "Salaried individuals with minimum ₹15,000 monthly income and 6 months vintage qualify up to ₹10 Lakhs.", createdAt: new Date().toISOString() },
  { id: "k2", title: "Business Loan Working Capital Policy", category: "Underwriting", content: "Requires 1 year vintage, GST returns, and ₹10 Lakhs annual turnover for un-collateralized business loans.", createdAt: new Date().toISOString() },
  { id: "k3", title: "Doctor Loan Fast Track Clearance", category: "Professional Loans", content: "Doctors with MBBS/BAMS/BHMS degree qualify for instant up to ₹25 Lakhs without financial proof.", createdAt: new Date().toISOString() },
  { id: "k4", title: "Home Loan Interest Subvention Scheme", category: "Property Loans", content: "Covers PMAY interest subsidy eligibility and Latur municipal corporation property valuation norms.", createdAt: new Date().toISOString() }
];

export default function KnowledgePage() {
  const [items, setItems] = useState<any[]>(preconfiguredKnowledge);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Loan Guidelines");
  const [content, setContent] = useState("");

  const handleAddArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    const newKb = {
      id: "kb_" + Date.now(),
      title,
      category,
      content,
      createdAt: new Date().toISOString()
    };

    setItems([newKb, ...items]);
    setTitle("");
    setContent("");
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
            <Book className="w-8 h-8 text-emerald-400" />
            Knowledge Base & AI Training Docs
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Store company policies, loan eligibility criteria, and bank checklists for Gemini AI.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Article
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item) => (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors shadow-md">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {item.category}
                </span>
                <span className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">{item.title}</h3>
              <p className="text-xs text-zinc-400 bg-zinc-950/60 p-3.5 rounded-lg border border-zinc-800/80 leading-relaxed font-sans">
                {item.content}
              </p>
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800/80">
              <button 
                onClick={() => setSelectedArticle(item)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20"
              >
                <Eye className="w-3.5 h-3.5" /> Read Full Policy
              </button>
              <button 
                onClick={() => handleDelete(item.id)} 
                className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-400/10 transition-colors text-xs font-medium"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Article View Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Book className="w-5 h-5 text-emerald-400" />
                {selectedArticle.title}
              </h3>
              <button onClick={() => setSelectedArticle(null)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <p><strong className="text-white">Category:</strong> {selectedArticle.category}</p>
              <p className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 font-sans leading-relaxed text-zinc-300">
                {selectedArticle.content}
              </p>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button onClick={() => setSelectedArticle(null)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Article Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Book className="w-5 h-5 text-emerald-400" />
                Add Knowledge Base Article
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddArticle} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Article Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Education Loan Collateral Guidelines"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Category</label>
                <input 
                  type="text" 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Policy Check"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Article Policy Content</label>
                <textarea 
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter policy rules and criteria for AI retrieval..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Save Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
