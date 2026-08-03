"use client";
import { useState } from "react";
import { 
  Book, Users, FileText, ClipboardList, Tag, Columns, 
  Settings2, Globe, Image as ImageIcon, HelpCircle, 
  MessageSquare, Bot, GitMerge, Folder, CheckCircle, 
  Settings, Code, Search
} from 'lucide-react';

const guideData = [
  {
    title: "Contacts",
    icon: Users,
    purpose: "Manage all your leads and customer data.",
    procedure: [
      "Click the Contacts tab in the sidebar.",
      "To upload contacts in bulk, click Import CSV. (Ensure your CSV matches the format downloaded via Template CSV).",
      "To send a mass WhatsApp message to everyone, click Send Bulk Message and type your broadcast.",
      "To add a single contact, click Add Contact."
    ]
  },
  {
    title: "Whatsapp Templates",
    icon: FileText,
    purpose: "Create and submit pre-approved Meta message templates (required to start conversations after 24 hours).",
    procedure: [
      "Open the Whatsapp Templates tab.",
      "Draft your template (e.g., 'Hello {{1}}, your loan is approved!').",
      "Submit to Meta for approval. Once approved, use these templates to blast leads."
    ]
  },
  {
    title: "Whatsapp Forms",
    icon: ClipboardList,
    purpose: "Build native WhatsApp forms to collect data (e.g., Loan Requirements, KYC).",
    procedure: [
      "Go to Whatsapp Forms.",
      "Create a new form and define the required fields (Name, Loan Amount, Income).",
      "Send the form trigger to a contact in the Chatbot or Inbox."
    ]
  },
  {
    title: "Tags",
    icon: Tag,
    purpose: "Segment your audience for targeted marketing.",
    procedure: [
      "Navigate to Tags.",
      "Create tags like 'Hot Lead', 'Home Loan', 'Rejected'.",
      "Apply these tags to contacts in the Contacts page to easily filter them later."
    ]
  },
  {
    title: "Columns",
    icon: Columns,
    purpose: "Customize the data you collect for each contact.",
    procedure: [
      "Go to Columns.",
      "Add custom fields like 'CIBIL Score', 'Monthly Income', or 'Property Value'.",
      "These fields will appear on the Contact detail view."
    ]
  },
  {
    title: "Opts Management",
    icon: Settings2,
    purpose: "Manage user consent to comply with WhatsApp anti-spam policies.",
    procedure: [
      "Go to Opts Management.",
      "View users who have opted in or opted out of marketing messages.",
      "Never send bulk messages to users on the opt-out list."
    ]
  },
  {
    title: "Webhook Events",
    icon: Globe,
    purpose: "Monitor incoming data from WhatsApp in real-time.",
    procedure: [
      "Open Webhook Events.",
      "Watch this feed for live message delivery receipts, read receipts, and inbound texts."
    ]
  },
  {
    title: "Gallery",
    icon: ImageIcon,
    purpose: "Store media (PDFs, Images) to send to customers.",
    procedure: [
      "Open the Gallery.",
      "Upload loan brochures, EMI charts, or promotional images.",
      "Attach these to your bulk messages or chatbot responses."
    ]
  },
  {
    title: "FAQ Bot",
    icon: HelpCircle,
    purpose: "Automate answers to common questions.",
    procedure: [
      "Go to FAQ Bot.",
      "Add exact question-answer pairs (e.g., Q: 'What is the ROI?', A: 'Our ROI starts at 8.5%.').",
      "The bot will instantly reply when these keywords are detected."
    ]
  },
  {
    title: "Chatbot",
    icon: MessageSquare,
    purpose: "The Live 2-Way Inbox & Automated Menu Builder.",
    procedure: [
      "Click Chatbot (which routes to your Inbox).",
      "See a live view of all inbound messages from customers.",
      "Click a conversation to manually type and send a reply."
    ]
  },
  {
    title: "Ai assistant",
    icon: Bot,
    purpose: "Configure Gemini AI to act as an intelligent loan advisor.",
    procedure: [
      "Go to Ai assistant.",
      "Set the 'System Prompt' to define the AI's behavior (e.g., 'You are an expert loan advisor at Avani Loan Services...')."
    ]
  },
  {
    title: "Flows",
    icon: GitMerge,
    purpose: "Build complex, multi-screen UI flows inside WhatsApp.",
    procedure: [
      "Open Flows.",
      "Design interactive screens for booking appointments or calculating EMIs right inside the WhatsApp chat."
    ]
  },
  {
    title: "Projects & Tasks",
    icon: Folder,
    purpose: "Internal team management.",
    procedure: [
      "Navigate to Projects or Tasks.",
      "Assign leads or specific loan applications to your team members and track their progress."
    ]
  },
  {
    title: "Settings",
    icon: Settings,
    purpose: "Configure core CRM integrations.",
    procedure: [
      "Open Settings.",
      "Manage your Meta API Tokens, WhatsApp Phone Number ID, and Gemini API keys here."
    ]
  },
  {
    title: "Knowledge Base",
    icon: Book,
    purpose: "Give the AI assistant context about your specific products.",
    procedure: [
      "Go to Knowledge Base.",
      "Upload your company's policy PDFs, loan eligibility criteria, and rate charts. The AI will read these to answer customer questions accurately."
    ]
  },
  {
    title: "Developers",
    icon: Code,
    purpose: "API access for custom integrations.",
    procedure: [
      "Open Developers.",
      "Generate API keys to connect the CRM to external tools like Zapier or your website lead forms."
    ]
  }
];

export default function GuidePage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGuides = guideData.filter(
    (g) =>
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.purpose.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 h-full p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Book className="w-8 h-8 text-primary" />
            CRM Operations Guide
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Step-by-step procedures to operate every tool available in your sidebar.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search operations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredGuides.map((guide, idx) => {
          const Icon = guide.icon;
          return (
            <div key={idx} className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 hover:border-zinc-700/80 transition-all flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">{guide.title}</h3>
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">Sidebar Tool</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] uppercase font-bold text-primary tracking-wide">Purpose</span>
                <p className="text-sm text-zinc-300 mt-1">{guide.purpose}</p>
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <span className="text-[11px] uppercase font-bold text-primary tracking-wide">Procedure</span>
                <ol className="list-decimal list-inside text-sm text-zinc-400 flex flex-col gap-1.5 pl-1">
                  {guide.procedure.map((step, sIdx) => (
                    <li key={sIdx} className="leading-relaxed">
                      <span className="text-zinc-300">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
