'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Lock, Mail, ArrowRight } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/crm';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid credentials');
        setSubmitting(false);
        return;
      }

      const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/crm';
      router.push(safeNext);
      router.refresh();
    } catch {
      setError('Unable to reach authentication service. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">AVANI LOAN SERVICES</h1>
            <p className="text-xs text-zinc-400">AVANI AI CRM — Authorized Staff Access</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="crm-email" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Work Email
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="crm-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="advisor@avanifinserv.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="crm-password" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="crm-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              data-testid="login-error"
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            data-testid="login-submit"
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition"
          >
            {submitting ? 'Signing in...' : 'Sign In to CRM'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-6 text-[11px] text-zinc-500 text-center">
          Protected financial &amp; customer data system. Access is role-scoped and audited.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <LoginForm />
    </Suspense>
  );
}
