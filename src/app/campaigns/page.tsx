import { Play } from "lucide-react";
import FileUpload from "@/components/FileUpload";

export default function Campaigns() {
  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">AI Campaigns</h1>
        <p className="text-muted-foreground mt-2">Upload leads and launch your AI calling campaigns.</p>
      </header>

      <FileUpload />

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Active Campaigns</h2>
        <div className="glass p-6 rounded-xl flex items-center justify-between">
          <div>
            <h3 className="font-medium text-lg">Doctors Outreach - July</h3>
            <p className="text-sm text-muted-foreground mt-1">Calling 150 prospects. 45 calls remaining.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-lg transition-all font-medium">
            <Play size={16} /> Resume Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
