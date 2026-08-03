import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AVANI Loan Services | AI CRM",
  description: "Advanced AI CRM and Automation Platform for AVANI Loan Services",
};

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full font-sans antialiased"
    >
      <body
        className="flex min-h-screen bg-background text-foreground"
      >
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6 bg-zinc-950">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
