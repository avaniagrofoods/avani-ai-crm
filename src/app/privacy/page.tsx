import type { Metadata } from 'next';
import Link from 'next/link';
import { OFFICIAL_BUSINESS, buildBreadcrumbJsonLd } from '@/config/public-website';
import { PublicShell } from '@/components/public/public-shell';
import { JsonLdScript } from '@/components/public/json-ld';

export const metadata: Metadata = {
  title: 'Privacy Policy & DPDP Data Minimisation Notice',
  description:
    'Privacy Policy and Data Minimisation practices of AVANI LOAN SERVICES under the Digital Personal Data Protection (DPDP) Act principles.',
  alternates: {
    canonical: '/privacy'
  }
};

export default function PrivacyPage() {
  return (
    <PublicShell>
      <JsonLdScript
        id="ld-breadcrumb-privacy"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Privacy Policy', path: '/privacy' }
        ])}
      />

      <section className="bg-[#EFF8FE] border-b border-[#E2EAF0] py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <nav aria-label="Breadcrumb" className="text-xs text-[#64748B] flex items-center gap-2">
            <Link href="/" className="hover:text-[#176B9A]">
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#176B9A]">Privacy Policy</span>
          </nav>
          <h1 className="text-3xl font-extrabold text-[#253447]">
            Privacy Policy &amp; Data Minimisation Notice
          </h1>
          <p className="text-sm text-[#64748B]">
            Effective for {OFFICIAL_BUSINESS.name} ({OFFICIAL_BUSINESS.websiteDisplay})
          </p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-sm text-[#253447] leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#176B9A]">1. Minimal Information We Collect</h2>
            <p className="text-[#64748B]">
              When you voluntarily submit a loan enquiry through our website, we collect only the minimum information
              needed to respond to your request: your name, Indian mobile number, city, chosen loan category, optional
              approximate loan amount and explicit communication consent timestamp.
            </p>
          </div>

          <div className="space-y-2 rounded-2xl bg-[#FBF6E9] border border-[#E8CF91] p-5">
            <h2 className="text-lg font-bold text-[#176B9A]">2. Prohibited Sensitive Document Policy</h2>
            <p className="text-[#253447]">
              {OFFICIAL_BUSINESS.name} does <strong>NOT</strong> collect or store Aadhaar numbers or copies, PAN
              numbers or copies, bank account numbers, bank statements, salary slips, credit reports, passport copies,
              property documents or WhatsApp media attachments through public website forms or our CRM spreadsheet
              records. Please do not enter or upload sensitive KYC/financial documents on this website.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#176B9A]">3. Purpose Limitation &amp; Consent</h2>
            <p className="text-[#64748B]">
              Your enquiry information is used strictly to provide loan consultancy, share general documentation
              guidance and coordinate with relevant lending institutions upon your request. We record explicit consent
              before initiating advisory follow-ups.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#176B9A]">4. Right to Opt Out &amp; Withdraw Consent</h2>
            <p className="text-[#64748B]">
              You may withdraw consent or opt out of automated/WhatsApp communications at any time by replying{' '}
              <strong>STOP</strong>, <strong>UNSUBSCRIBE</strong>, <strong>थांबवा</strong> or{' '}
              <strong>रोकें</strong> on WhatsApp, or by writing to{' '}
              <a href={OFFICIAL_BUSINESS.mailtoHref} className="text-[#176B9A] font-semibold underline">
                {OFFICIAL_BUSINESS.email}
              </a>
              .
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#176B9A]">5. Privacy &amp; Grievance Contact</h2>
            <p className="text-[#64748B]">
              <strong>{OFFICIAL_BUSINESS.name}</strong> — Owner &amp; Founder: {OFFICIAL_BUSINESS.ownerFounder}
              <br />
              Address: {OFFICIAL_BUSINESS.officeAddressFull}
              <br />
              Email:{' '}
              <a href={OFFICIAL_BUSINESS.mailtoHref} className="text-[#176B9A] font-semibold underline">
                {OFFICIAL_BUSINESS.email}
              </a>
              <br />
              WhatsApp Business: {OFFICIAL_BUSINESS.whatsappDisplay}
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
