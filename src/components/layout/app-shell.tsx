'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { SessionProvider } from '@/components/layout/session-provider';

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') {
    return <main className="min-h-screen w-full bg-zinc-950">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ShellInner>{children}</ShellInner>
    </SessionProvider>
  );
}
