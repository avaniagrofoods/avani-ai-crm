'use client';

import React from 'react';
import { Bell, LogOut, Shield, User as UserIcon } from 'lucide-react';
import { useCrmSession } from '@/components/layout/session-provider';

export function Topbar() {
  const { user, logout } = useCrmSession();
  const displayName = user?.name || 'Avani Staff';
  const roleLabel = user?.role || 'STAFF';

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950 px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-white">
          Welcome back, {displayName.split(' ')[0]}!
        </h1>
        {user && (
          <span
            data-testid="topbar-role-badge"
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              user.role === 'ADMIN'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
            }`}
          >
            <Shield className="h-3 w-3" />
            {roleLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="h-9 w-9 rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white transition"
        >
          <Bell className="h-4 w-4" />
        </button>

        {user && (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5">
            <UserIcon className="h-4 w-4 text-zinc-400" />
            <span className="text-xs text-zinc-200 hidden sm:inline" data-testid="topbar-user-name">
              {displayName}
            </span>
          </div>
        )}

        {user && (
          <button
            type="button"
            onClick={logout}
            data-testid="logout-button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}
