import type { Metadata } from 'next';
import Link from 'next/link';
import { OFFICIAL_BUSINESS, buildBreadcrumbJsonLd } from '@/config/public-website';
import { PublicShell } from '@/components/public/public-shell';
import { JsonLdScript } from '@/components/public/json-ld';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description:
    'Terms and Conditions governing use of the AVANI LOAN SERVICES website and independent loan consultancy services.',
  alternates: {
    canonical: '/terms'
  }
};

export default function TermsPage() {
  return (
    <PublicShell>
      <JsonLdScript
        id="ld-breadcrumb-terms"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Terms and Conditions', path: '/terms' }
        ])}
      />

      <section className="bg-[#EFF8FE] border-b border-[#E2EAF0] py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <nav aria-label="Breadcrumb" className="text-xs text-[#64748B] flex items-center gap-2">
            <Link href="/" className="hover:text-[#176B9A]">
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#176B9A]">Terms and Conditions</span>
          </nav>
          <h1 className="text-3xl font-extrabold text-[#253447]">Terms and Conditions</h1>
          <p className="text-sm text-[#64748B]">
            Applicable to public visitors and enquiry submitters on {OFFICIAL_BUSINESS.websiteDisplay}
          </p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-sm text-[#64748B] leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#176B9A]">1. Scope of Consultancy Services</h2>
            <p>
              {OFFICIAL_BUSINESS.name} provides independent loan consultancy, enquiry support, general documentation
              awareness and lender coordination. Use of this website or submission of an enquiry does not constitute a
              loan offer, credit sanction or binding lending commitment.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#176B9A]">2. Lender-Dependent Credit Decisions</h2>
            <p>
              All loan approvals, rejection decisions, interest rates, processing fees, tenures, collateral valuations
              and disbursement timelines are decided solely by the respective bank or NBFC under its independent credit
              policies and applicable Indian regulations.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#176B9A]">3. Applicant Responsibilities</h2>
            <p>
              Visitors submitting an enquiry agree to provide accurate basic contact details and refrain from uploading
              sensitive KYC documents (such as Aadhaar, PAN, bank statements or salary slips) through unsecured public
              forms.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#176B9A]">4. Contact &amp; Office Details</h2>
            <p>
              Questions regarding these terms may be directed to{' '}
              <strong className="text-[#253447]">{OFFICIAL_BUSINESS.name}</strong> (Owner &amp; Founder:{' '}
              {OFFICIAL_BUSINESS.ownerFounder}) at{' '}
              <a href={OFFICIAL_BUSINESS.mailtoHref} className="text-[#176B9A] font-semibold underline">
                {OFFICIAL_BUSINESS.email}
              </a>{' '}
              or {OFFICIAL_BUSINESS.officeAddressFull}.
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
