import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, PhoneCall, Users, Settings, LogOut } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AVANI Loan Services | AI CRM",
  description: "AI Calling Agent & CRM Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col md:flex-row`}>
        {/* Sidebar */}
        <aside className="w-full md:w-64 glass border-r flex flex-col justify-between sticky top-0 md:h-screen z-50">
          <div>
            <div className="p-6">
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                AVANI AI
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Loan Services CRM</p>
            </div>
            
            <nav className="px-4 space-y-2 mt-4">
              <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all font-medium">
                <LayoutDashboard size={18} /> Dashboard
              </Link>
              <Link href="/campaigns" className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all">
                <PhoneCall size={18} /> Campaigns
              </Link>
              <Link href="/crm" className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all">
                <Users size={18} /> Lead Pipeline
              </Link>
              <Link href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all">
                <Settings size={18} /> Settings
              </Link>
            </nav>
          </div>
          
          <div className="p-4 border-t border-white/10 mt-auto">
            <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all text-left">
              <LogOut size={18} /> Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
