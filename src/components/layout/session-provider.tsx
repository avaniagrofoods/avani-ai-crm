'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export interface ClientSessionUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'ADVISOR';
}

interface SessionContextValue {
  user: ClientSessionUser | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  refreshSession: async () => {},
  logout: async () => {}
});

export function useCrmSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ClientSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUser(data?.authenticated ? data.user : null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [pathname, refreshSession]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      router.push('/login');
      router.refresh();
    }
  }, [router]);

  return (
    <SessionContext.Provider value={{ user, loading, refreshSession, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
