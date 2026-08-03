"use client";
import { useState, useEffect } from "react";
import { 
  GitMerge, Play, CheckCircle, Users, 
  MessageSquare, FileText, Sparkles, Send, Award, HelpCircle
} from "lucide-react";

const API_URL = typeof window !== 'undefined' ? ('https://avani-ai-crm.vercel.app/api') : 'https://avani-ai-crm.vercel.app/api';

const workflowStages = [
  {
    stage: "Stage 1",
    name: "Greeting & Welcome",
    icon: Users,
    color: "border-blue-500 text-blue-400 bg-blue-500/10",
    actions: ["Send Welcome Message", "Identify Customer", "Initiate AI Chat"],
    details: "When a customer initiates contact, the AI agent greets them and asks how it can assist.",
    message: "Hello {{Name}},\n\nThank you for contacting AVANI LOAN SERVICES.\n\nOur AI Assistant will help you with your loan requirements.\n\nHow can we help you today?"
  },
  {
    stage: "Stage 2",
    name: "Loan Requirement",
    icon: Sparkles,
    color: "border-purple-500 text-purple-400 bg-purple-500/10",
    actions: ["Ask for Loan Type", "Extract Loan Categories"],
    details: "Gemini AI automatically asks what type of loan the customer needs.",
    aiQuestions: ["What type of loan do you need? (Personal, Business, Doctor, CA, Home, Education)"]
  },
  {
    stage: "Stage 3",
    name: "Employment Status",
    icon: Users,
    color: "border-amber-500 text-amber-400 bg-amber-500/10",
    actions: ["Check Employment Type", "Determine Salaried or Business"],
    details: "Based on the loan type, the AI asks about employment status.",
    aiQuestions: ["Are you salaried or do you have your own business?"]
  },
  {
    stage: "Stage 4",
    name: "Salary & Income Check",
    icon: Award,
    color: "border-emerald-500 text-emerald-400 bg-emerald-500/10",
    actions: ["Check Monthly Income", "Extract Financial Data", "Qualify Lead"],
    details: "The AI agent collects salary and required loan amount details.",
    aiQuestions: ["What is your take-home salary?", "How much loan amount is required?"]
  },
  {
    stage: "Stage 5",
    name: "Document Checklist",
    icon: FileText,
    color: "border-cyan-500 text-cyan-400 bg-cyan-500/10",
    actions: ["Provide Document List", "Send File Upload Links"],
    details: "Automated trigger requests KYC files based on the employment type and loan category.",
    docs: ["PAN Card", "Aadhaar Card", "Salary Slips", "Bank Statement"],
    message: "Here is the list of documents required:\n1. PAN Card\n2. Aadhaar Card\n3. 3 Months Salary Slips\n4. 6 Months Bank Statement"
  }
];

export default function FlowsPage() {
  const [activeTestStage, setActiveTestStage] = useState<number | null>(null);
  const [testLeadName, setTestLeadName] = useState("Sachin Shinde");
  const [testLog, setTestLog] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const fetchFlows = async () => {
    try {
      const res = await fetch(`${API_URL}/flows`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFlows();
  }, []);

  const runSimulation = () => {
    setTestLog([]);
    setActiveTestStage(0);
    logStep("Initiating AVANI AI CRM Lead Flow simulation...");
  };

  const logStep = (msg: string) => {
    setTestLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    if (activeTestStage === null) return;
    if (activeTestStage >= workflowStages.length) {
      logStep("Simulation complete! Lead successfully processed and disbursed.");
      setActiveTestStage(null);
      return;
    }

    const current = workflowStages[activeTestStage];
    const timer = setTimeout(() => {
      logStep(`Entering Stage ${activeTestStage + 1}: ${current.name}`);
      current.actions.forEach(action => {
        logStep(`[Action] Executed: ${action}`);
      });
      if (activeTestStage === 0) {
        logStep(`[WhatsApp Sent] Welcome greeting sent to ${testLeadName}`);
      } else if (activeTestStage === 1) {
        logStep(`[Gemini AI] Asked for Loan Requirement`);
      } else if (activeTestStage === 2) {
        logStep(`[Gemini AI] Checked Employment Status`);
      } else if (activeTestStage === 3) {
        logStep(`[Gemini AI] Collected Salary & Income Info`);
      } else if (activeTestStage === 4) {
        logStep(`[WhatsApp Sent] Document Checklist provided to ${testLeadName}`);
      }
      setActiveTestStage(prev => (prev !== null ? prev + 1 : null));
    }, 2500);

    return () => clearTimeout(timer);
  }, [activeTestStage]);

  return (
    <div className="flex flex-col gap-6 h-full p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <GitMerge className="w-8 h-8 text-primary" />
            AVANI AI CRM Workflow
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Configure, automate, and track lead lifecycles across 6 automation stages.</p>
        </div>
        <button
          onClick={runSimulation}
          disabled={activeTestStage !== null}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors text-sm disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          Test Lead Flow
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stages Tracker */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Active Automation Workflow Board
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflowStages.map((stage, idx) => {
              const Icon = stage.icon;
              const isActive = activeTestStage === idx;
              return (
                <div 
                  key={idx} 
                  className={`bg-zinc-900 border p-5 rounded-2xl flex flex-col gap-3 transition-all ${
                    isActive ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-zinc-800"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{stage.stage}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">ACTIVE</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${stage.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h4 className="text-base font-bold text-white leading-tight">{stage.name}</h4>
                  </div>
                  
                  <div className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-3 mt-1">
                    <span className="text-zinc-500 font-semibold block mb-1">AUTOMATED ACTIONS:</span>
                    <ul className="list-disc list-inside flex flex-col gap-1">
                      {stage.actions.map((act, aIdx) => (
                        <li key={aIdx} className="text-zinc-300">{act}</li>
                      ))}
                    </ul>
                  </div>

                  {stage.message && (
                    <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 font-mono text-[10px] text-zinc-400 whitespace-pre-wrap mt-2">
                      <span className="text-[9px] uppercase font-bold text-primary block mb-1">WhatsApp Template:</span>
                      {stage.message}
                    </div>
                  )}

                  {stage.aiQuestions && (
                    <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/40 text-[11px] text-zinc-400 mt-2">
                      <span className="text-[9px] uppercase font-bold text-primary block mb-1">Gemini AI Prompt Check:</span>
                      {stage.aiQuestions.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Simulator Panel */}
        <div className="flex flex-col gap-4">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Flow Simulation Logger
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 flex-1 h-full min-h-[400px]">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Lead Name for Test</label>
              <input
                type="text"
                value={testLeadName}
                onChange={(e) => setTestLeadName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div className="flex-1 bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 font-mono text-[10px] text-emerald-400 overflow-y-auto max-h-[350px] flex flex-col gap-1.5 custom-scrollbar">
              {testLog.length === 0 ? (
                <span className="text-zinc-600">Click "Test Lead Flow" to simulate WhatsApp automation.</span>
              ) : (
                testLog.map((log, lIdx) => (
                  <div key={lIdx} className="leading-normal break-words border-b border-zinc-900/40 pb-1">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
