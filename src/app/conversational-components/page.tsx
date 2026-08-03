"use client";
import { useState } from "react";
import { Smartphone, ShieldCheck, HelpCircle, MessageSquare, AlertCircle, Plus, Trash2, Send, Check } from "lucide-react";

export default function ConversationalComponentsPage() {
  const [activeSubTab, setActiveSubTab] = useState<"automations" | "profile" | "insights">("automations");
  
  // Ice breakers state
  const [showIceBreakersModal, setShowIceBreakersModal] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState<"icebreakers" | "commands">("icebreakers");
  
  const [iceBreakers, setIceBreakers] = useState<string[]>([
    "Where are you located?",
    "Check Personal Loan eligibility",
    "Speak with a loan advisor"
  ]);
  const [newIceBreaker, setNewIceBreaker] = useState("");

  // Commands state
  const [commands, setCommands] = useState<{ cmd: string; desc: string }[]>([
    { cmd: "/apply", desc: "Start a new loan application" },
    { cmd: "/cibil", desc: "Check your CIBIL score instantly" },
    { cmd: "/status", desc: "Track your current loan application status" },
    { cmd: "/help", desc: "View all available bot services" }
  ]);
  const [newCmdText, setNewCmdText] = useState("");
  const [newCmdDesc, setNewCmdDesc] = useState("");

  // Interactive chat simulator state
  const [chatMessages, setChatMessages] = useState<{ sender: "user" | "bot"; text: string; time: string }[]>([
    { sender: "bot", text: "Welcome to AVANI LOAN SERVICES! How can we help you today?", time: "10:24 AM" }
  ]);

  const handleAddIceBreaker = () => {
    if (!newIceBreaker.trim()) return;
    if (iceBreakers.length >= 4) {
      alert("Meta allows a maximum of 4 active Ice Breakers.");
      return;
    }
    setIceBreakers([...iceBreakers, newIceBreaker.trim()]);
    setNewIceBreaker("");
  };

  const handleRemoveIceBreaker = (idx: number) => {
    setIceBreakers(iceBreakers.filter((_, i) => i !== idx));
  };

  const handleAddCommand = () => {
    if (!newCmdText.trim() || !newCmdDesc.trim()) return;
    let cleanCmd = newCmdText.trim();
    if (!cleanCmd.startsWith("/")) {
      cleanCmd = "/" + cleanCmd;
    }
    setCommands([...commands, { cmd: cleanCmd, desc: newCmdDesc.trim() }]);
    setNewCmdText("");
    setNewCmdDesc("");
  };

  const handleRemoveCommand = (idx: number) => {
    setCommands(commands.filter((_, i) => i !== idx));
  };

  // Simulate user sending an Ice Breaker / Command
  const handleSimulateSend = (text: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { sender: "user" as const, text, time };
    
    // Determine automated bot reply based on trigger
    let replyText = "Thank you for contacting AVANI LOAN SERVICES. Our team will get back to you shortly.";
    const lowerText = text.toLowerCase();

    if (lowerText.includes("located")) {
      replyText = "📍 Our office is located at: Rajiv Gandhi Chauk, Opposite Bank of Baroda, Above Monginis Cake Shop, Ausa Road, Latur – 413512, Maharashtra.";
    } else if (lowerText.includes("eligibility") || lowerText === "/apply") {
      replyText = "📝 To check your loan eligibility, please visit our forms section or reply with 'YES' to start the qualifying questionnaire.";
    } else if (lowerText.includes("advisor")) {
      replyText = "📞 Routing you to our Personal Loan desk. सचिन शिंदे (Sachin Shinde) will call you shortly.";
    } else if (lowerText === "/cibil") {
      replyText = "💳 Please provide your PAN Card and Full Name to fetch your latest credit score update.";
    } else if (lowerText === "/status") {
      replyText = "🔍 Enter your 8-digit Application Reference ID (e.g., PL2026001) to fetch status updates.";
    } else if (lowerText === "/help") {
      replyText = "🤖 Available Commands:\n\n/apply - Apply for loan\n/cibil - Check credit score\n/status - Track application\n/help - Show services";
    }

    const botMsg = { sender: "bot" as const, text: replyText, time };
    setChatMessages(prev => [...prev, userMsg, botMsg]);
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6 text-zinc-200 bg-zinc-950">
      {/* Top Breadcrumb Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            WhatsApp Manager &gt; Phone numbers
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Manage conversational components and automations for AVANI LOAN SERVICES phone profiles.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-450 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-500/20">
          <ShieldCheck className="w-4 h-4" />
          WhatsApp API Connected
        </div>
      </div>

      {/* Main Profile Info Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-indigo-650/10 border border-indigo-500/30 rounded-full flex items-center justify-center text-indigo-400">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white">IN +91 72491 08474</h3>
              <span className="text-[10px] bg-zinc-850 px-2 py-0.5 rounded text-zinc-400 font-mono">India</span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">avani loan services</p>
            <p className="text-[10px] text-zinc-550 font-mono mt-1">Phone number ID: 1236781312848399</p>
          </div>
        </div>
        
        {/* Sub Navigation Tabs */}
        <div className="flex gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-850">
          <button 
            onClick={() => setActiveSubTab("insights")}
            className={`px-3 py-1.5 rounded text-xs font-semibold ${activeSubTab === "insights" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-350"}`}
          >
            Insights
          </button>
          <button 
            onClick={() => setActiveSubTab("profile")}
            className={`px-3 py-1.5 rounded text-xs font-semibold ${activeSubTab === "profile" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-350"}`}
          >
            Profile
          </button>
          <button 
            onClick={() => setActiveSubTab("automations")}
            className={`px-3 py-1.5 rounded text-xs font-semibold ${activeSubTab === "automations" ? "bg-zinc-800 text-white animate-pulse" : "text-zinc-500 hover:text-zinc-350"}`}
          >
            Automations
          </button>
        </div>
      </div>

      {/* Automations Tab Content */}
      {activeSubTab === "automations" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Conversational Components Control */}
          <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Conversational components</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Automations that can enhance conversational experiences. Using AI can help make these components more efficient.
              </p>
            </div>

            {/* Ice Breaker Row */}
            <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-850 flex items-center justify-between hover:border-zinc-800 transition-all">
              <div className="flex items-start gap-3 max-w-[80%]">
                <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">Ice breakers</h4>
                  <p className="text-xs text-zinc-450 leading-relaxed mt-0.5">
                    These are common questions that people can easily ask you when starting a chat. Meta displays these as quick action buttons.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {iceBreakers.map((ib, idx) => (
                      <span key={idx} className="text-[10px] bg-zinc-900 border border-zinc-805 px-2 py-0.5 rounded text-zinc-300 font-medium">
                        "{ib}"
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { setModalActiveTab("icebreakers"); setShowIceBreakersModal(true); }}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold border border-zinc-700 transition-colors"
              >
                Edit
              </button>
            </div>

            {/* Commands Row */}
            <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-850 flex items-center justify-between hover:border-zinc-800 transition-all">
              <div className="flex items-start gap-3 max-w-[80%]">
                <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">Commands</h4>
                  <p className="text-xs text-zinc-455 leading-relaxed mt-0.5">
                    These are special keywords prefixed with `/` that tell the WhatsApp bot what to do. Customers see these in the command list.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {commands.map((cmdObj, idx) => (
                      <span key={idx} className="text-[10px] bg-emerald-950/40 border border-emerald-900/40 px-2.5 py-0.5 rounded text-emerald-400 font-mono font-bold">
                        {cmdObj.cmd}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { setModalActiveTab("commands"); setShowIceBreakersModal(true); }}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold border border-zinc-700 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>

          {/* Right Live Simulator Panel */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-3.5">Live WhatsApp Chat Sandbox</span>
            <div className="w-full max-w-[340px] bg-zinc-900 border-[6px] border-zinc-800 rounded-[32px] shadow-2xl relative aspect-[9/18] flex flex-col overflow-hidden select-none">
              
              {/* Header */}
              <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-3 shrink-0 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-650 flex items-center justify-center font-bold text-xs text-white">
                  AL
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white leading-tight">avani loan services</h4>
                  <p className="text-[9px] text-emerald-450 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Online Bot Active
                  </p>
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-950 flex flex-col justify-end">
                <div className="flex-1"></div>
                {chatMessages.map((m, idx) => {
                  const isBot = m.sender === "bot";
                  return (
                    <div key={idx} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] rounded-xl p-2.5 text-[11px] leading-relaxed ${
                        isBot ? "bg-zinc-900 text-zinc-300 rounded-bl-none" : "bg-emerald-650 text-white rounded-br-none"
                      }`}>
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <span className="block text-[8px] text-right text-zinc-550 mt-1 font-mono">{m.time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Quick Triggers (Simulate Ice Breakers) */}
              <div className="bg-zinc-950 px-3 pb-2 pt-1 border-t border-zinc-900 space-y-1.5 shrink-0">
                {chatMessages.length <= 1 && (
                  <div className="space-y-1 pt-1.5">
                    <span className="text-[8px] font-bold text-zinc-650 uppercase tracking-wide block mb-1">Click to trigger Ice Breaker:</span>
                    {iceBreakers.map((ib) => (
                      <button 
                        key={ib}
                        onClick={() => handleSimulateSend(ib)}
                        className="w-full text-left px-3 py-1.5 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-300 font-semibold rounded-lg transition-all"
                      >
                        ⚡ "{ib}"
                      </button>
                    ))}
                  </div>
                )}

                {/* Commands Quick List Trigger */}
                <div className="flex items-center gap-1.5 pt-1.5">
                  <div className="flex-1 flex gap-1.5 overflow-x-auto py-0.5 custom-scrollbar">
                    {commands.map((cmdObj) => (
                      <button 
                        key={cmdObj.cmd}
                        onClick={() => handleSimulateSend(cmdObj.cmd)}
                        className="px-2 py-1 bg-emerald-950/40 border border-emerald-900/40 text-[9px] font-mono font-bold text-emerald-450 rounded-full shrink-0"
                      >
                        {cmdObj.cmd}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Input Area */}
              <div className="h-10 bg-zinc-900 px-3 flex items-center justify-between border-t border-zinc-805 shrink-0">
                <span className="text-[10px] text-zinc-500 font-semibold">Type a message...</span>
                <Send className="w-3.5 h-3.5 text-zinc-600 cursor-not-allowed" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal replicating Meta Business Manager */}
      {showIceBreakersModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-all animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col md:flex-row">
            {/* Left Modal Controls */}
            <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-zinc-800 space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-lg font-bold text-white">Conversational components</h3>
                <button 
                  onClick={() => setShowIceBreakersModal(false)}
                  className="text-zinc-500 hover:text-white font-semibold text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Modal Tabs Selector */}
              <div className="flex border-b border-zinc-805">
                <button 
                  onClick={() => setModalActiveTab("icebreakers")}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                    modalActiveTab === "icebreakers" ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-350"
                  }`}
                >
                  Ice breakers
                </button>
                <button 
                  onClick={() => setModalActiveTab("commands")}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                    modalActiveTab === "commands" ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-350"
                  }`}
                >
                  Commands
                </button>
              </div>

              {/* Tab Content: Ice breakers */}
              {modalActiveTab === "icebreakers" && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    To start using ice breakers, read <span className="text-indigo-400 hover:underline cursor-pointer">how to set up ice breakers</span>. Then you can fill out the fields on this page.
                  </p>

                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {iceBreakers.map((ib, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-zinc-950 p-2.5 rounded-lg border border-zinc-805">
                        <span className="text-xs font-mono text-zinc-500">#{idx + 1}</span>
                        <input 
                          type="text" 
                          value={ib}
                          onChange={(e) => {
                            const newIbs = [...iceBreakers];
                            newIbs[idx] = e.target.value;
                            setIceBreakers(newIbs);
                          }}
                          className="flex-1 bg-transparent text-xs text-zinc-200 focus:outline-none"
                        />
                        <button 
                          onClick={() => handleRemoveIceBreaker(idx)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-zinc-850">
                    <input 
                      type="text"
                      placeholder="Add new ice breaker question... (e.g. Check rates)"
                      value={newIceBreaker}
                      onChange={(e) => setNewIceBreaker(e.target.value)}
                      maxLength={80}
                      className="flex-1 bg-zinc-950 border border-zinc-805 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                    />
                    <button 
                      onClick={handleAddIceBreaker}
                      className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Tab Content: Commands */}
              {modalActiveTab === "commands" && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    To start using commands, read <span className="text-indigo-400 hover:underline cursor-pointer">how to set up commands</span>. Then you can fill out the fields on this page. You must use a / before each keyword.
                  </p>

                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {commands.map((cmdObj, idx) => (
                      <div key={idx} className="flex items-start justify-between bg-zinc-950 p-2.5 rounded-lg border border-zinc-805">
                        <div className="flex-1">
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{cmdObj.cmd}</span>
                          <p className="text-xs text-zinc-400 mt-1">{cmdObj.desc}</p>
                        </div>
                        <button 
                          onClick={() => handleRemoveCommand(idx)}
                          className="text-red-400 hover:text-red-300 p-1 self-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t border-zinc-850">
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Command keyword (e.g. /apply)"
                        value={newCmdText}
                        onChange={(e) => setNewCmdText(e.target.value)}
                        maxLength={32}
                        className="w-1/3 bg-zinc-950 border border-zinc-805 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 font-mono"
                      />
                      <input 
                        type="text"
                        placeholder="Description of the command..."
                        value={newCmdDesc}
                        onChange={(e) => setNewCmdDesc(e.target.value)}
                        maxLength={256}
                        className="flex-1 bg-zinc-950 border border-zinc-805 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                      />
                      <button 
                        onClick={handleAddCommand}
                        className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800 mt-4">
                <button 
                  onClick={() => setShowIceBreakersModal(false)}
                  className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowIceBreakersModal(false);
                    alert("Conversational components updated successfully! Saved changes to Meta Business database.");
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Save & Publish
                </button>
              </div>
            </div>

            {/* Right Modal WhatsApp Device Preview Mockup */}
            <div className="hidden md:flex md:w-[320px] bg-zinc-950 p-6 flex-col items-center justify-center relative select-none">
              <span className="text-[9px] uppercase font-bold text-zinc-550 tracking-wider mb-2.5 block">Live Device Mockup Preview</span>
              <div className="w-[240px] bg-zinc-900 border-4 border-zinc-800 rounded-[28px] relative aspect-[9/18.5] flex flex-col overflow-hidden">
                {/* Screen Header */}
                <div className="bg-zinc-900 border-b border-zinc-850 px-3.5 py-2.5 flex items-center gap-2 shrink-0">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-[9px] text-white">
                    AL
                  </div>
                  <div>
                    <h5 className="text-[10px] font-bold text-white leading-tight">avani loan services</h5>
                    <p className="text-[7px] text-zinc-500 font-mono">91756 35165</p>
                  </div>
                </div>

                {/* Mock Content */}
                <div className="flex-1 p-3 bg-zinc-950 flex flex-col justify-end">
                  {modalActiveTab === "icebreakers" ? (
                    <div className="space-y-1.5">
                      <span className="text-[7px] font-bold text-zinc-650 uppercase tracking-wide block mb-1">Ice Breaker Options:</span>
                      {iceBreakers.map((ib) => (
                        <div key={ib} className="px-2.5 py-1 bg-zinc-900 border border-zinc-805 text-[9px] text-zinc-300 font-semibold rounded-md shadow-xs">
                          {ib}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1 bg-zinc-900 p-2 border border-zinc-805 rounded-xl shadow-md">
                      <span className="text-[7px] font-bold text-emerald-450 uppercase tracking-wide block border-b border-zinc-800 pb-1">Commands Menu (/)</span>
                      {commands.map((cmdObj) => (
                        <div key={cmdObj.cmd} className="flex justify-between items-center text-[8px] border-b border-zinc-950/20 pb-0.5">
                          <span className="font-mono font-bold text-emerald-400">{cmdObj.cmd}</span>
                          <span className="text-zinc-500 truncate max-w-[65%]">{cmdObj.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Simulated Input */}
                <div className="h-8 bg-zinc-900 border-t border-zinc-805 px-3 flex items-center justify-between shrink-0">
                  <span className="text-[9px] text-zinc-600">
                    {modalActiveTab === "icebreakers" ? "Type a message..." : "/"}
                  </span>
                  <Send className="w-3 h-3 text-zinc-700" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
