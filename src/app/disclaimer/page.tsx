import type { Metadata } from 'next';
import Link from 'next/link';
import { OFFICIAL_BUSINESS, buildBreadcrumbJsonLd } from '@/config/public-website';
import { PublicShell } from '@/components/public/public-shell';
import { JsonLdScript } from '@/components/public/json-ld';

export const metadata: Metadata = {
  title: 'Financial Advisory Disclaimer',
  description:
    'Important financial consultancy disclaimer for AVANI LOAN SERVICES — independent loan advisory, not a bank or NBFC, with no guarantee of approval or fixed interest rates.',
  alternates: {
    canonical: '/disclaimer'
  }
};

export default function DisclaimerPage() {
  return (
    <PublicShell>
      <JsonLdScript
        id="ld-breadcrumb-disclaimer"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Disclaimer', path: '/disclaimer' }
        ])}
      />

      <section className="bg-[#EFF8FE] border-b border-[#E2EAF0] py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <nav aria-label="Breadcrumb" className="text-xs text-[#64748B] flex items-center gap-2">
            <Link href="/" className="hover:text-[#176B9A]">
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#176B9A]">Disclaimer</span>
          </nav>
          <h1 className="text-3xl font-extrabold text-[#253447]">Financial Advisory Disclaimer</h1>
          <p className="text-sm text-[#64748B]">
            Mandatory Transparency Notice — {OFFICIAL_BUSINESS.name}
          </p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-sm text-[#64748B] leading-relaxed">
          <div className="rounded-2xl bg-[#FBF6E9] border border-[#E8CF91] p-6 space-y-2 text-[#253447]">
            <h2 className="text-lg font-bold text-[#176B9A]">Independent Loan Consultancy — Not a Bank or NBFC</h2>
            <p>
              <strong>{OFFICIAL_BUSINESS.name}</strong> (Owner &amp; Founder: {OFFICIAL_BUSINESS.ownerFounder}) is an
              independent financial-services loan consultancy and advisory desk based in Latur, Maharashtra. We are{' '}
              <strong>not a bank, non-banking financial company (NBFC), or direct lender</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#176B9A]">No Guarantee of Approval, Rates or Timelines</h2>
            <p>
              Information published on {OFFICIAL_BUSINESS.websiteDisplay} is for general educational and enquiry
              guidance only. {OFFICIAL_BUSINESS.name} does not guarantee loan approval, loan disbursement, specific
              interest rates, credit-score improvement, eligibility or fixed processing timelines. Every application is
              evaluated independently by the relevant bank or NBFC according to its prevailing policies and terms.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#176B9A]">Document &amp; Communication Safety</h2>
            <p>
              Applicants should never share OTPs, banking passwords, Aadhaar/PAN scans, bank statements or property
              title copies through unsecured public website forms. Verify all official communications strictly via{' '}
              <a href={OFFICIAL_BUSINESS.mailtoHref} className="text-[#176B9A] font-semibold underline">
                {OFFICIAL_BUSINESS.email}
              </a>{' '}
              or official WhatsApp Business ({OFFICIAL_BUSINESS.whatsappDisplay}).
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
