"use client";

import { ShieldCheck, FileCheck2, Lock, PhoneCall } from "lucide-react";

const REFERENCE_CHECKLISTS = [
  {
    category: "Personal Loan",
    stage: "Advisor Verification Only (Zero CRM File Upload)",
    items: ["Identity & Address Verification (Direct to Bank)", "Income & Employment Verification (Direct to Bank)"]
  },
  {
    category: "Doctor / CA Professional Loan",
    stage: "Advisor Verification Only (Zero CRM File Upload)",
    items: ["Professional Registration Verification", "Practice Vintage & Financial Qualification"]
  },
  {
    category: "Business / MSME Loan",
    stage: "Advisor Verification Only (Zero CRM File Upload)",
    items: ["Business Vintage & GST Registration Check", "Turnover & Banking Eligibility Review"]
  },
  {
    category: "Home Loan / Mortgage (LAP)",
    stage: "Advisor Verification Only (Zero CRM File Upload)",
    items: ["Property Location & Valuation Eligibility", "Co-Applicant Income & Repayment Capacity"]
  }
];

export default function GalleryPage() {
  return (
    <div className="flex flex-col gap-6 h-full p-6 text-zinc-200 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            Zero-Document-Storage Compliance & Advisor Checklist Reference
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Customer document and media uploads are disabled. AVANI AI CRM stores only structured customer and loan qualification records in Google Sheets.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-lg text-xs font-semibold">
          <Lock className="w-4 h-4" />
          File Uploads Disabled (Policy Enforced)
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {REFERENCE_CHECKLISTS.map((group) => (
          <div
            key={group.category}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-md"
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {group.category}
                </span>
                <span className="text-xs font-mono text-zinc-500">{group.stage}</span>
              </div>
              <ul className="space-y-2 my-3 text-sm text-zinc-300">
                {group.items.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800/80 text-xs text-zinc-400 flex items-center gap-2">
              <PhoneCall className="w-3.5 h-3.5 text-indigo-400" />
              <span>Coordinate physical/bank verification directly with Assigned Advisor.</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
