"use client";

import { useState, useEffect } from "react";
import { Plus, ClipboardList, Eye, Trash2, X, CheckCircle } from "lucide-react";

const preconfiguredForms = [
  {
    id: "f1",
    name: "AVANI | Personal Loan Enquiry",
    fields: "Full Name, Mobile, Email, City, Loan Amount (₹50k-₹10L+), Employment (Salaried/Self-Employed), Monthly Income",
    assignment: "Personal Loan Team",
    docs: "PAN Card, Aadhaar Card, Salary Slips, Bank Statement"
  },
  {
    id: "f2",
    name: "AVANI | Business Loan Enquiry",
    fields: "Full Name, Mobile, Business Name, Business Vintage (1-5+ Years), Annual Turnover, Loan Requirement (Working Capital/Expansion/Machinery/OD-CC/Term Loan)",
    assignment: "Business Loan Desk",
    docs: "GST Returns, ITR, Bank Statements, Udyam Registration, Company PAN"
  },
  {
    id: "f3",
    name: "AVANI | Doctor Loan Enquiry",
    fields: "Name, Mobile, Profession (Doctor/Dentist/CA/Architect/Consultant), Experience, Annual Income, Loan Requirement",
    assignment: "Professional Loan Team",
    docs: "Degree Certificate, Registration Certificate, ITR, Bank Statements"
  },
  {
    id: "f4",
    name: "AVANI | Home Loan Assistance",
    fields: "Name, Mobile, Property Location, Property Type (New/Resale/Plot/Construction), Property Value, Required Loan Amount, Employment",
    assignment: "Home Loan Specialist",
    docs: "Aadhaar, PAN, Income Proof, Property Documents"
  },
  {
    id: "f5",
    name: "AVANI | Mortgage Loan",
    fields: "Name, Mobile, Property Type, Property Market Value, Existing Loan on Property (Yes/No), Required Amount",
    assignment: "Mortgage Team",
    docs: "Property Papers, Latest Tax Receipt, PAN, Aadhaar, Bank Statements"
  },
  {
    id: "f6",
    name: "AVANI | Education Loan (INDIA)",
    fields: "Student Name, Parent Name, Mobile, Course Name, College Name, Course Fees, State",
    assignment: "India Education Loan Team",
    docs: "Admission Letter, Fee Structure, Aadhaar, PAN, Academic Records"
  },
  {
    id: "f7",
    name: "AVANI | Education Loan (ABROAD)",
    fields: "Student Name, Mobile, Country (USA/UK/Canada/Australia/Germany/Ireland), University Name, Course, Total Cost, Intake (Jan/May/Sep)",
    assignment: "Global Education Team",
    docs: "Offer Letter, Passport, Academic Records, Co-applicant Income Proof"
  },
  {
    id: "f8",
    name: "AVANI | School & College Funding",
    fields: "Institution Name, Contact Person, Mobile, Institution Type (School/Junior College/Degree/University), Funding Requirement, Required Amount",
    assignment: "Institution Funding Team",
    docs: "Trust Registration, Financial Statements, Institution Approval Documents"
  },
  {
    id: "f9",
    name: "AVANI | CIBIL Improvement Consultation",
    fields: "Full Name, Mobile, Email, Current CIBIL, Past Loan Rejection (Yes/No), CIBIL Issue, Goal, Timeline",
    assignment: "Credit Counseling Team",
    docs: "Latest CIBIL Report, ID Proof, PAN Card"
  }
];

export default function FormsPage() {
  const [items, setItems] = useState<any[]>(preconfiguredForms);
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [formName, setFormName] = useState("");
  const [fields, setFields] = useState("");
  const [assignment, setAssignment] = useState("Personal Loan Team");
  const [docs, setDocs] = useState("");

  const handleCreateForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !fields) {
      alert("Please fill in form name and fields.");
      return;
    }

    const newForm = {
      id: "f_" + Date.now(),
      name: formName,
      fields,
      assignment,
      docs: docs || "PAN Card, Aadhaar Card, Income Proof"
    };

    setItems([newForm, ...items]);
    setFormName("");
    setFields("");
    setDocs("");
    setIsCreateModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (id.startsWith('f') && id.length < 5) {
      alert("Pre-configured system forms cannot be deleted.");
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6 text-zinc-200 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-emerald-400" />
            Meta WhatsApp Lead Forms
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Pre-configured forms for Meta Instant Lead Ads and in-chat validation.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Create Form
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((form) => (
          <div key={form.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors shadow-md">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {form.assignment}
                </span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">{form.name}</h3>
              <p className="text-xs text-zinc-400 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80 mb-3 font-mono leading-relaxed">
                {form.fields}
              </p>
              <p className="text-xs text-zinc-500">
                <strong className="text-zinc-400">Required Docs:</strong> {form.docs}
              </p>
            </div>
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800/80">
              <button 
                onClick={() => setSelectedForm(form)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Preview Form
              </button>
              <button 
                onClick={() => handleDelete(form.id)}
                className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-400/10 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Form Preview Modal */}
      {selectedForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-400" />
                {selectedForm.name}
              </h3>
              <button onClick={() => setSelectedForm(null)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <p><strong className="text-white">Assigned Desk:</strong> {selectedForm.assignment}</p>
              <p><strong className="text-white">Captured Fields:</strong></p>
              <ul className="list-disc list-inside bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono space-y-1">
                {selectedForm.fields.split(',').map((f: string, i: number) => (
                  <li key={i}>{f.trim()}</li>
                ))}
              </ul>
              <p><strong className="text-white">Required Verification Documents:</strong> {selectedForm.docs}</p>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button onClick={() => setSelectedForm(null)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Create New Lead Form
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateForm} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Form Name</label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. AVANI | Professional Loan Form"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Form Fields (comma separated)</label>
                <textarea 
                  rows={3}
                  value={fields}
                  onChange={(e) => setFields(e.target.value)}
                  placeholder="Full Name, Mobile, Email, Monthly Income, Loan Amount"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Assigned Team Desk</label>
                <select 
                  value={assignment}
                  onChange={(e) => setAssignment(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Personal Loan Team">Personal Loan Team</option>
                  <option value="Business Loan Desk">Business Loan Desk</option>
                  <option value="Professional Loan Team">Professional Loan Team</option>
                  <option value="Home Loan Specialist">Home Loan Specialist</option>
                  <option value="Mortgage Team">Mortgage Team</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Save Form
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
