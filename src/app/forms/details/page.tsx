"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle, Smartphone, Shield, Check, ExternalLink } from "lucide-react";

const formsData: Record<string, any> = {
  "f1": {
    name: "AVANI - Personal Loan Qualified Leads",
    headline: "Check Your Personal Loan Eligibility",
    description: "Submit your details and our loan advisor will contact you to discuss suitable personal loan options based on your profile.",
    fields: ["Full Name", "Phone Number", "Email Address"],
    questions: [
      {
        q: "What is your monthly income?",
        options: ["Less than ₹20,000", "₹20,000 – ₹35,000", "₹35,000 – ₹50,000", "Above ₹50,000"]
      },
      {
        q: "Are you salaried or self-employed?",
        options: ["Salaried", "Self-employed", "Professional"]
      },
      {
        q: "What loan amount are you looking for?",
        options: ["Up to ₹2 Lakhs", "₹2 – ₹5 Lakhs", "₹5 – ₹10 Lakhs", "Above ₹10 Lakhs"]
      },
      {
        q: "What is your current CIBIL score (approx.)?",
        options: ["Below 650", "650 – 700", "700 – 750", "Above 750", "Not Sure"]
      },
      {
        q: "How soon do you need the loan?",
        options: ["Immediately", "Within 7 Days", "Within 30 Days", "Just Exploring"]
      }
    ]
  },
  "f2": {
    name: "AVANI - Business Loan Qualified Leads",
    headline: "Apply for AVANI Business Loan",
    description: "Get funding for your business expansion and working capital needs.",
    fields: ["Full Name", "Phone Number", "Email Address"],
    questions: [
      {
        q: "What type of business do you operate?",
        options: ["Proprietorship", "Partnership", "LLP", "Private Limited"]
      },
      {
        q: "How many years has your business been operating?",
        options: ["Less than 1 Year", "1 – 3 Years", "3 – 5 Years", "Above 5 Years"]
      },
      {
        q: "Annual business turnover?",
        options: ["Below ₹10 Lakhs", "₹10 – ₹50 Lakhs", "₹50 Lakhs – ₹1 Crore", "Above ₹1 Crore"]
      },
      {
        q: "Required loan amount?",
        options: ["Up to ₹5 Lakhs", "₹5 – ₹20 Lakhs", "₹20 – ₹50 Lakhs", "Above ₹50 Lakhs"]
      },
      {
        q: "When do you need funding?",
        options: ["Immediately", "Within 15 Days", "Within 30 Days", "Planning Stage"]
      }
    ]
  },
  "f3": {
    name: "AVANI - Doctor Loan Qualified Leads",
    headline: "Special Professional Loans for Doctors & CAs",
    description: "Finance your clinic setup, equipment purchases, or professional expansion.",
    fields: ["Full Name", "Phone Number", "Email Address"],
    questions: [
      {
        q: "Your profession?",
        options: ["Doctor", "Dentist", "CA", "Architect", "Other Professional"]
      },
      {
        q: "Years of practice?",
        options: ["Less than 1 Year", "1 – 3 Years", "3 – 5 Years", "Above 5 Years"]
      },
      {
        q: "Monthly professional income?",
        options: ["Below ₹50,000", "₹50,000 – ₹1 Lakh", "₹1 – ₹3 Lakhs", "Above ₹3 Lakhs"]
      },
      {
        q: "Required loan amount?",
        options: ["Up to ₹10 Lakhs", "₹10 – ₹25 Lakhs", "₹25 – ₹50 Lakhs", "Above ₹50 Lakhs"]
      },
      {
        q: "Purpose of loan?",
        options: ["Clinic Setup", "Equipment Purchase", "Expansion", "Working Capital"]
      }
    ]
  },
  "f4": {
    name: "AVANI - Home Loan Qualified Leads",
    headline: "Apply for a Home Loan at Lowest Rates",
    description: "Own your dream home today with our easy home loan processing.",
    fields: ["Full Name", "Phone Number", "Email Address"],
    questions: [
      {
        q: "Property type?",
        options: ["New Property", "Resale Property", "Plot + Construction", "Under Construction"]
      },
      {
        q: "Property value?",
        options: ["Up to ₹25 Lakhs", "₹25 – ₹50 Lakhs", "₹50 Lakhs – ₹1 Crore", "Above ₹1 Crore"]
      },
      {
        q: "Employment type?",
        options: ["Salaried", "Self-employed", "Professional"]
      },
      {
        q: "Down payment available?",
        options: ["Below 10%", "10% – 20%", "20% – 30%", "Above 30%"]
      },
      {
        q: "When do you plan to purchase?",
        options: ["Immediately", "Within 3 Months", "Within 6 Months", "Just Exploring"]
      }
    ]
  },
  "f5": {
    name: "AVANI - Mortgage Loan Qualified Leads",
    headline: "Get Loan Against Property (LAP) easily",
    description: "Unlock the hidden value of your property for business expansion or personal needs.",
    fields: ["Full Name", "Phone Number", "Email Address"],
    questions: [
      {
        q: "Property ownership?",
        options: ["Self Owned Residential", "Self Owned Commercial", "Industrial Property", "Mixed Use Property"]
      },
      {
        q: "Estimated property value?",
        options: ["Up to ₹25 Lakhs", "₹25 – ₹50 Lakhs", "₹50 Lakhs – ₹1 Crore", "Above ₹1 Crore"]
      },
      {
        q: "Required loan amount?",
        options: ["Up to ₹10 Lakhs", "₹10 – ₹25 Lakhs", "₹25 – ₹50 Lakhs", "Above ₹50 Lakhs"]
      },
      {
        q: "Purpose of funds?",
        options: ["Business Expansion", "Debt Consolidation", "Personal Requirement", "Working Capital"]
      },
      {
        q: "Existing mortgage on property?",
        options: ["Yes", "No"]
      }
    ]
  },
  "f6": {
    name: "AVANI - Education Loan India Qualified Leads",
    headline: "Fund Higher Education in India",
    description: "Hassle-free education loans for leading colleges and universities in India.",
    fields: ["Student Name", "Parent Name", "Mobile Number", "Email Address"],
    questions: [
      {
        q: "Student admission status?",
        options: ["Admission Confirmed", "Applied", "Planning"]
      },
      {
        q: "Course level?",
        options: ["Undergraduate", "Postgraduate", "Professional Course"]
      },
      {
        q: "Course fees required?",
        options: ["Up to ₹5 Lakhs", "₹5 – ₹10 Lakhs", "₹10 – ₹20 Lakhs", "Above ₹20 Lakhs"]
      },
      {
        q: "Co-applicant available?",
        options: ["Yes", "No"]
      },
      {
        q: "When is fee payment required?",
        options: ["Within 15 Days", "Within 30 Days", "Within 60 Days", "Not Finalized"]
      }
    ]
  },
  "f7": {
    name: "AVANI - Education Loan Abroad Qualified Leads",
    headline: "Fund Your Study Abroad Dream",
    description: "Global education loans covering tuition, living expenses, and travel for USA, UK, Canada, Australia & Europe.",
    fields: ["Student Name", "Mobile Number", "Email Address"],
    questions: [
      {
        q: "Preferred study destination?",
        options: ["USA", "UK", "Canada", "Australia", "Europe", "Other"]
      },
      {
        q: "Admission status?",
        options: ["Confirmed", "Applied", "Planning"]
      },
      {
        q: "Loan requirement?",
        options: ["Up to ₹20 Lakhs", "₹20 – ₹50 Lakhs", "₹50 Lakhs – ₹1 Crore", "Above ₹1 Crore"]
      },
      {
        q: "Co-applicant available?",
        options: ["Yes", "No"]
      },
      {
        q: "Expected departure date?",
        options: ["Within 3 Months", "Within 6 Months", "Within 12 Months"]
      }
    ]
  },
  "f8": {
    name: "AVANI - Institutional Funding Qualified Leads",
    headline: "Institutional Project & Infrastructure Funding",
    description: "Get funding for school/college expansion, infrastructure setup, or working capital.",
    fields: ["Institution Name", "Contact Person", "Mobile Number", "Email Address"],
    questions: [
      {
        q: "Institution type?",
        options: ["School", "Junior College", "Degree College", "Coaching Institute"]
      },
      {
        q: "Funding purpose?",
        options: ["Infrastructure", "Equipment", "Expansion", "Working Capital"]
      },
      {
        q: "Funding amount required?",
        options: ["Up to ₹10 Lakhs", "₹10 – ₹50 Lakhs", "₹50 Lakhs – ₹1 Crore", "Above ₹1 Crore"]
      },
      {
        q: "Years of operation?",
        options: ["Less than 3 Years", "3 – 5 Years", "5 – 10 Years", "Above 10 Years"]
      },
      {
        q: "Funding timeline?",
        options: ["Immediate", "Within 30 Days", "Within 90 Days"]
      }
    ]
  },
  "f9": {
    name: "AVANI - CIBIL Improvement Consultation Qualified Leads",
    headline: "Improve Your Credit Score & Get Loan Approval",
    description: "Professional advice to improve your credit score, resolve defaults, and build a strong credit profile.",
    fields: ["Full Name", "Phone Number", "Email Address"],
    questions: [
      {
        q: "Current CIBIL score?",
        options: ["Below 550", "550 – 650", "650 – 700", "Above 700", "Not Sure"]
      },
      {
        q: "Have you faced loan rejection before?",
        options: ["Yes", "No"]
      },
      {
        q: "Main issue affecting your CIBIL?",
        options: ["Late Payments", "Credit Card Outstanding", "Loan Settlement", "Multiple Enquiries", "Not Sure"]
      },
      {
        q: "What is your goal?",
        options: ["Personal Loan", "Home Loan", "Business Loan", "Credit Card", "General Improvement"]
      },
      {
        q: "When do you want to improve your score?",
        options: ["Immediately", "Within 30 Days", "Within 90 Days", "Just Need Consultation"]
      }
    ]
  }
};

export default function FormDetailsPage() {
  const [formId, setFormId] = useState("f1");
  const [activeTab, setActiveTab] = useState<"intro" | "questions" | "privacy" | "thankyou">("intro");
  const [answers, setAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id && formsData[id]) {
        setFormId(id);
      }
    }
  }, []);

  const currentForm = formsData[formId] || formsData["f1"];

  const handleSelectOption = (qIdx: number, val: string) => {
    setAnswers(prev => ({ ...prev, [qIdx]: val }));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 p-6 flex flex-col items-center">
      {/* Top Banner */}
      <div className="w-full max-w-4xl flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.close()} 
            className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-all"
            title="Close Window"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-white">{currentForm.name}</h1>
            <p className="text-xs text-zinc-450 mt-0.5">Meta Lead Ads Verified Compliance Template</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
          <Check className="w-3.5 h-3.5" />
          Meta Compliant
        </div>
      </div>

      {/* Main Grid */}
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Control Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
              Preview Screens
            </h2>
            <p className="text-xs text-zinc-455 leading-relaxed">
              This interactive mockup represents the exact multi-screen layout shown to users inside Facebook & Instagram Instant Forms.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => setActiveTab("intro")}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-between ${
                  activeTab === "intro" 
                    ? "bg-indigo-650 border-indigo-600 text-white shadow-md shadow-indigo-950" 
                    : "bg-zinc-950 border-zinc-805 text-zinc-455 hover:bg-zinc-800"
                }`}
              >
                <span>1. Welcome / Intro Screen</span>
                {activeTab === "intro" && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
              </button>
              <button 
                onClick={() => setActiveTab("questions")}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-between ${
                  activeTab === "questions" 
                    ? "bg-indigo-650 border-indigo-600 text-white shadow-md shadow-indigo-950" 
                    : "bg-zinc-950 border-zinc-805 text-zinc-455 hover:bg-zinc-800"
                }`}
              >
                <span>2. Core Qualification (5 Qs)</span>
                {activeTab === "questions" && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
              </button>
              <button 
                onClick={() => setActiveTab("privacy")}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-between ${
                  activeTab === "privacy" 
                    ? "bg-indigo-650 border-indigo-600 text-white shadow-md shadow-indigo-950" 
                    : "bg-zinc-950 border-zinc-805 text-zinc-455 hover:bg-zinc-800"
                }`}
              >
                <span>3. Consent & Privacy Screen</span>
                {activeTab === "privacy" && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
              </button>
              <button 
                onClick={() => setActiveTab("thankyou")}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-between ${
                  activeTab === "thankyou" 
                    ? "bg-indigo-650 border-indigo-600 text-white shadow-md shadow-indigo-950" 
                    : "bg-zinc-950 border-zinc-805 text-zinc-455 hover:bg-zinc-800"
                }`}
              >
                <span>4. Thank You / CTA Screen</span>
                {activeTab === "thankyou" && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
              </button>
            </div>
          </div>

          {/* Guidelines info */}
          <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl text-xs text-zinc-400 space-y-2">
            <span className="flex items-center gap-1.5 font-bold text-zinc-300">
              <Shield className="w-4 h-4 text-emerald-450" />
              Meta Ads Compliance Rules
            </span>
            <ul className="list-disc pl-4 space-y-1.5 text-zinc-450 leading-relaxed">
              <li>Form utilizes a Higher Intent setup requiring double review to filter fake leads.</li>
              <li>Includes only 5 targeted multiple choice questions.</li>
              <li>Avoids spammy text (like "100% Guaranteed Approved").</li>
              <li>Pre-filled fields are automatically resolved by Facebook profiles.</li>
            </ul>
          </div>
        </div>

        {/* Right Phone Mockup Panel */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="w-full max-w-[370px] bg-zinc-900 border-[6px] border-zinc-800 rounded-[36px] shadow-2xl relative aspect-[9/18.5] flex flex-col overflow-hidden select-none">
            {/* Status bar */}
            <div className="h-6 bg-zinc-900 flex justify-between items-center px-6 text-[10px] text-zinc-550 font-semibold font-mono shrink-0">
              <span>9:41 AM</span>
              <div className="flex gap-1.5 items-center">
                <span>5G</span>
                <div className="w-5 h-2.5 border border-zinc-650 rounded-xs p-0.5">
                  <div className="w-full h-full bg-zinc-555 rounded-2xs"></div>
                </div>
              </div>
            </div>

            {/* In-App Meta Header */}
            <div className="bg-zinc-900/90 border-b border-zinc-800/80 px-4 py-3 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-[9px] text-white">
                  A
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-white leading-tight">AVANI LOAN SERVICES</h4>
                  <p className="text-[8px] text-zinc-500">Sponsored ad form</p>
                </div>
              </div>
              <span className="text-zinc-500 text-xs cursor-pointer">✕</span>
            </div>

            {/* Inner Content scroll area */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col bg-zinc-950">
              {activeTab === "intro" && (
                <div className="space-y-4 my-auto">
                  <div className="h-28 bg-zinc-900 rounded-xl border border-zinc-800/80 flex items-center justify-center text-zinc-500 text-xs overflow-hidden relative">
                    <img 
                      src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=80" 
                      alt="Personal Loan" 
                      className="absolute inset-0 w-full h-full object-cover opacity-35"
                    />
                    <span className="relative font-bold text-white tracking-wider uppercase text-[10px]">AD BANNER PREVIEW</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                      {currentForm.headline}
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {currentForm.description}
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab("questions")}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-bold transition-all shadow-md mt-6"
                  >
                    Start Eligibility Check
                  </button>
                </div>
              )}

              {activeTab === "questions" && (
                <div className="space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-5">
                    <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Step 2 of 4 • Eligibility Qs</span>
                    
                    {currentForm.questions.map((qObj: any, qIdx: number) => (
                      <div key={qIdx} className="space-y-2">
                        <label className="text-xs font-bold text-zinc-300 leading-snug">
                          {qIdx + 1}. {qObj.q}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {qObj.options.map((opt: string) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleSelectOption(qIdx, opt)}
                              className={`py-2 px-2.5 rounded-lg border text-[10px] font-semibold text-left transition-all ${
                                answers[qIdx] === opt
                                  ? "border-emerald-500 bg-emerald-500/10 text-white"
                                  : "border-zinc-805 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Pre-filled fields */}
                    <div className="space-y-3 pt-4 border-t border-zinc-900">
                      <span className="text-[9px] uppercase font-bold text-zinc-555 tracking-wider block">Pre-filled Profile Details</span>
                      {currentForm.fields.map((field: string) => (
                        <div key={field} className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-550 uppercase tracking-wide">{field}</label>
                          <input 
                            type="text" 
                            disabled 
                            value={
                              field.toLowerCase().includes("name") ? "Sachin Shinde" :
                              field.toLowerCase().includes("phone") || field.toLowerCase().includes("mobile") ? "+91 91756 35165" :
                              field.toLowerCase().includes("email") ? "enquiry@avanifinserv.com" :
                              ""
                            }
                            placeholder={`Autofilled ${field}...`}
                            className="w-full bg-zinc-900 border border-zinc-805 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-semibold cursor-not-allowed" 
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab("privacy")}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-bold transition-all shadow-md mt-6"
                  >
                    Next Screen
                  </button>
                </div>
              )}

              {activeTab === "privacy" && (
                <div className="space-y-4 my-auto flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Step 3 of 4 • Consent & Privacy</span>
                    <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
                      Review Privacy Policy
                    </h3>
                    <p className="text-[10px] text-zinc-400 leading-relaxed bg-zinc-900 p-3.5 border border-zinc-805 rounded-xl">
                      "By submitting this form, you agree that AVANI LOAN SERVICES may contact you via call, WhatsApp, SMS, or email regarding loan consultation and related financial services. Submission of this form does not guarantee loan approval. Eligibility is subject to lender policies and documentation."
                    </p>
                    <div className="flex items-start gap-2.5 pt-2">
                      <input 
                        type="checkbox" 
                        defaultChecked
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 shrink-0 mt-0.5" 
                        id="consent-check" 
                      />
                      <label htmlFor="consent-check" className="text-[9px] text-zinc-450 leading-relaxed select-none cursor-pointer">
                        I authorize AVANI LOAN SERVICES to contact me regarding my loan requirement.
                      </label>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab("thankyou")}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-bold transition-all shadow-md mt-6"
                  >
                    Submit Eligibility Form
                  </button>
                </div>
              )}

              {activeTab === "thankyou" && (
                <div className="space-y-5 text-center my-auto">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="w-7 h-7 text-emerald-450" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Thank You For Your Interest
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed px-2">
                      Our loan advisor will review your requirements and contact you shortly.
                    </p>
                  </div>
                  <div className="pt-4 space-y-3">
                    <a 
                      href="https://wa.me/919175635165?text=Hello%20Avani%2520Loans%2C%20I%20just%20submitted%20my%20enquiry%20form."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      WhatsApp Us
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <a 
                      href="https://www.avanifinserv.com/?utm_source=chatgpt.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono block hover:underline"
                    >
                      www.avanifinserv.com
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Home indicator bar */}
            <div className="h-4 bg-zinc-900 flex justify-center items-center shrink-0">
              <div className="w-24 h-1 bg-zinc-700 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
