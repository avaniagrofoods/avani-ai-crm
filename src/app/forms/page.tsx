"use client";
import { useState, useEffect } from "react";
import { Plus, ClipboardList, Eye, Trash2 } from "lucide-react";

const API_URL = typeof window !== 'undefined' ? ('https://avani-ai-crm.vercel.app/api') : 'https://avani-ai-crm.vercel.app/api';

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
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<any>(null);

  const fetchItems = async () => {
    try {
      const response = await fetch(`${API_URL}/forms`);
      if (response.ok) {
        const data = await response.json();
        // Merge DB forms with preconfigured ones
        setItems([...preconfiguredForms, ...data]);
      } else {
        setItems(preconfiguredForms);
      }
    } catch (error) {
      console.error(error);
      setItems(preconfiguredForms);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAdd = async () => {
    const name = prompt("Enter new custom form name:");
    if (!name) return;
    try {
      const response = await fetch(`${API_URL}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, fields: "name, phone, query" }),
      });
      if (response.ok) {
        fetchItems();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith('f')) {
      alert("Pre-configured system templates cannot be deleted.");
      return;
    }
    if (!confirm("Are you sure?")) return;
    try {
      await fetch(`${API_URL}/forms/${id}`, { method: 'DELETE' });
      fetchItems();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-primary" />
            Meta WhatsApp Lead Forms
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Pre-configured forms for Meta Instant Lead Ads and in-chat validation.</p>
        </div>
        <button onClick={handleAdd} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 text-sm">
          Create Custom Form
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forms Table */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-zinc-400">
              <thead className="text-xs text-zinc-300 uppercase bg-zinc-850/60 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Form Name</th>
                  <th className="px-6 py-4 font-semibold">Team Route</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-800 hover:bg-zinc-850/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-zinc-200">{item.name}</td>
                    <td className="px-6 py-4 text-xs font-mono text-zinc-400">
                      {item.assignment || "Round-Robin Router"}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <a 
                        href={`/forms/details?id=${item.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 p-2 hover:bg-primary/10 rounded transition-colors text-xs font-semibold flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Details
                      </a>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="text-red-400 hover:text-red-300 p-2 hover:bg-red-400/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Details Preview */}
        <div>
          {selectedForm ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
              <div className="border-b border-zinc-850 pb-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Form Configuration</span>
                <h3 className="text-lg font-bold text-white mt-1 leading-tight">{selectedForm.name}</h3>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Field Schema Details</span>
                <p className="text-xs text-zinc-300 leading-relaxed mt-1">{selectedForm.fields}</p>
              </div>

              {selectedForm.docs && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Required Documents (WhatsApp Automation)</span>
                  <ul className="list-disc list-inside text-xs text-zinc-300 flex flex-col gap-1 mt-1 pl-1">
                    {selectedForm.docs.split(', ').map((doc: string, idx: number) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider block mb-1">Integration Endpoint (Meta webhook)</span>
                <code className="text-[10px] text-zinc-400 font-mono break-all">
                  https://holder-stylish-performed-expanded.trycloudflare.com/whatsapp/webhook
                </code>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-800/80 border-dashed rounded-2xl p-8 text-center text-zinc-500 flex flex-col items-center justify-center min-h-[250px]">
              <ClipboardList className="w-10 h-10 text-zinc-700 mb-3" />
              <p className="text-xs max-w-xs">Select any WhatsApp form details to inspect fields, document requirements, and route destinations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
