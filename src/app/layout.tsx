import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AVANI Loan Services | AI CRM",
  description: "Advanced AI CRM and Automation Platform for AVANI Loan Services",
};

import { AppShell } from "@/components/layout/app-shell";

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
