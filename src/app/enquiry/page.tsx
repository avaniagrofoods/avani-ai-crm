import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import {
  OFFICIAL_BUSINESS,
  buildBreadcrumbJsonLd,
  buildOfficialWhatsAppUrl
} from '@/config/public-website';
import { PublicShell } from '@/components/public/public-shell';
import { PublicEnquiryForm } from '@/components/public/enquiry-form';
import { JsonLdScript } from '@/components/public/json-ld';

export const metadata: Metadata = {
  title: 'Submit Loan Enquiry',
  description:
    'Submit a minimal loan consultancy enquiry with AVANI LOAN SERVICES in Latur, Maharashtra. DPDP-consent verified, with zero sensitive KYC document uploads.',
  alternates: {
    canonical: '/enquiry'
  },
  openGraph: {
    title: `Submit Loan Enquiry | ${OFFICIAL_BUSINESS.name}`,
    description: 'Submit a minimal, privacy-first loan enquiry with AVANI LOAN SERVICES.',
    url: `${OFFICIAL_BUSINESS.websiteUrl}/enquiry`,
    type: 'website'
  }
};

export default async function EnquiryPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const loanType = typeof resolved.loanType === 'string' ? resolved.loanType : 'Personal Loan';
  const whatsappUrl = buildOfficialWhatsAppUrl();

  return (
    <PublicShell>
      <JsonLdScript
        id="ld-breadcrumb-enquiry"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Enquire Now', path: '/enquiry' }
        ])}
      />

      <section className="bg-[#EFF8FE] border-b border-[#E2EAF0] py-10 sm:py-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <nav aria-label="Breadcrumb" className="text-xs text-[#64748B] flex items-center gap-2">
            <Link href="/" className="hover:text-[#176B9A]">
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#176B9A]">Enquire Now</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#253447] tracking-tight">
            Loan Consultancy Enquiry
          </h1>
          <p className="text-sm sm:text-base text-[#64748B] leading-relaxed">
            Provide only your basic contact details and loan category below. Our advisory team led by{' '}
            {OFFICIAL_BUSINESS.ownerFounder} will reach out with general guidance and documentation checklists.
          </p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <PublicEnquiryForm defaultLoanType={loanType} />

          <div className="rounded-2xl bg-[#FBF6E9] border border-[#E8CF91] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs sm:text-sm">
            <div>
              <p className="font-bold text-[#176B9A]">Prefer WhatsApp or Email?</p>
              <p className="text-[#64748B] mt-0.5">
                Email{' '}
                <a href={OFFICIAL_BUSINESS.mailtoHref} className="text-[#176B9A] font-semibold underline">
                  {OFFICIAL_BUSINESS.email}
                </a>{' '}
                or connect on WhatsApp {OFFICIAL_BUSINESS.whatsappDisplay}.
              </p>
            </div>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#176B9A] hover:bg-[#38A9E8] text-white px-4 py-2.5 text-xs font-bold shrink-0"
            >
              <MessageCircle className="w-4 h-4 text-[#E8CF91]" aria-hidden="true" />
              <span>WhatsApp Now</span>
            </a>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
