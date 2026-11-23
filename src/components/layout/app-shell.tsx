'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { SessionProvider } from '@/components/layout/session-provider';
import { AppSurface, isPublicWebsitePath } from '@/lib/routing-policy';

function isPublicMarketingRender(pathname: string, surface: AppSurface): boolean {
  if (pathname === '/') return surface === 'public';
  return isPublicWebsitePath(pathname);
}

function ShellInner({ children, surface }: { children: React.ReactNode; surface: AppSurface }) {
  const pathname = usePathname() || '/';

  // Public business website uses clean bright financial-services styling (zero black CRM chrome)
  if (isPublicMarketingRender(pathname, surface)) {
    return <div className="min-h-screen w-full bg-[#FFFFFF] text-[#253447]">{children}</div>;
  }

  // Protected CRM owner login renders standalone dark auth surface
  if (pathname === '/login') {
    return <main className="min-h-screen w-full bg-zinc-950 text-zinc-100">{children}</main>;
  }

  // Authenticated private AVANI AI CRM workspace
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

export function AppShell({
  children,
  surface = 'crm'
}: {
  children: React.ReactNode;
  surface?: AppSurface;
}) {
  return (
    <SessionProvider surface={surface}>
      <ShellInner surface={surface}>{children}</ShellInner>
    </SessionProvider>
  );
}
