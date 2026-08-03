"use client";

import { Bell, User, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Sidebar } from './sidebar';

export function Topbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-4 md:px-6 bg-white dark:bg-black">
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden p-2 -ml-2 text-zinc-500"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg md:text-xl font-semibold truncate">Welcome back, Sachin!</h1>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
            <Bell className="h-5 w-5" />
          </button>
          <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
            <User className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar (Slide-over) */}
      <div 
        className={`fixed inset-0 z-50 bg-black/50 md:hidden transition-opacity ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform duration-200 ease-in-out md:hidden flex flex-col ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex h-16 shrink-0 items-center px-6 border-b border-zinc-200 dark:border-zinc-800 gap-2">
            <img src="/logo.svg" alt="Avani Loan Service" className="h-10 w-auto filter drop-shadow-md brightness-110" />
          </div>
          <Sidebar className="w-full" />
        </div>
      </div>
    </>
  );
}
