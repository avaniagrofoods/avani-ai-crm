import { Save } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground mt-2">Configure VAPI integrations and system prompts.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* VAPI Config */}
        <div className="glass p-6 rounded-xl space-y-4">
          <h2 className="text-xl font-semibold mb-4">Voice AI (VAPI)</h2>
          
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">API Key</label>
            <input type="password" value="************************" readOnly className="w-full bg-background/50 border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Assistant ID</label>
            <input type="text" value="9f322737-3bb8-467a-95e3-7a66f9a93dc1" readOnly className="w-full bg-background/50 border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">VAPI Phone Number</label>
            <input type="text" value="+91 7249108474" readOnly className="w-full bg-background/50 border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors" />
          </div>
        </div>

        {/* Messaging Config */}
        <div className="glass p-6 rounded-xl space-y-4">
          <h2 className="text-xl font-semibold mb-4">WhatsApp (Twilio)</h2>
          
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Account SID</label>
            <input type="password" value="************************" readOnly className="w-full bg-background/50 border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">WhatsApp Number</label>
            <input type="text" value="+91 7249108474" readOnly className="w-full bg-background/50 border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors" />
          </div>
        </div>

        {/* Global Prompts */}
        <div className="glass p-6 rounded-xl space-y-4 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">AI Scripts & Prompts</h2>
          <p className="text-sm text-muted-foreground mb-4">The exact prompts fed into VAPI for the AI persona. (Based on your custom scripts)</p>
          
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Base System Prompt</label>
            <textarea readOnly rows={5} className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground text-sm font-mono focus:outline-none focus:border-primary transition-colors" defaultValue={`Act as an elite, automated Banking Customer Care Executive representing Avani Loan Services. The assistant manages both high-priority Inbound Customer Support inquiries and proactive Outbound Cold Calling / Lead Generation campaigns.`}></textarea>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end mt-6">
        <button className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all">
          <Save size={18} /> Save Configurations
        </button>
      </div>
    </div>
  );
}
