import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'AVANI AI CRM — Secure Owner Access',
  description: 'Protected administrator login for AVANI AI CRM.',
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
