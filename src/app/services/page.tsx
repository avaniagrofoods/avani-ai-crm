import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageCircle, ShieldAlert } from 'lucide-react';
import {
  CORE_OFFICIAL_SERVICES,
  OFFICIAL_BUSINESS,
  PUBLIC_LOAN_SERVICES,
  buildBreadcrumbJsonLd,
  buildOfficialWhatsAppUrl
} from '@/config/public-website';
import { PublicShell } from '@/components/public/public-shell';
import { JsonLdScript } from '@/components/public/json-ld';

export const metadata: Metadata = {
  title: 'Loan Services — Personal, Business, Doctor, Home, Mortgage & Education Loans',
  description:
    'Explore all eight official loan consultancy services offered by AVANI LOAN SERVICES in Latur, Maharashtra, including Personal, Business, Doctor, Home, Mortgage, Education and School & College Funding.',
  alternates: {
    canonical: '/services'
  },
  openGraph: {
    title: `Loan Services | ${OFFICIAL_BUSINESS.name}`,
    description:
      'Independent loan consultancy across Personal, Business, Doctor, Home, Mortgage, Education and School & College Funding.',
    url: `${OFFICIAL_BUSINESS.websiteUrl}/services`,
    type: 'website'
  }
};

export default function ServicesPage() {
  const relatedServices = PUBLIC_LOAN_SERVICES.filter((s) => !s.coreOfficial);
  const whatsappUrl = buildOfficialWhatsAppUrl();

  return (
    <PublicShell>
      <JsonLdScript
        id="ld-breadcrumb-services"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Loan Services', path: '/services' }
        ])}
      />

      <section className="bg-[#EFF8FE] border-b border-[#E2EAF0] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <nav aria-label="Breadcrumb" className="text-xs text-[#64748B] flex items-center gap-2">
            <Link href="/" className="hover:text-[#176B9A]">
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#176B9A]">Loan Services</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#253447] tracking-tight">
            Loan Consultancy &amp; Advisory Services
          </h1>
          <p className="text-base text-[#64748B] max-w-3xl leading-relaxed">
            {OFFICIAL_BUSINESS.name} assists individuals, professionals, enterprises and educational institutions with
            structured loan enquiries, general documentation guidance and lender coordination across all eight official
            loan categories and related commercial/professional financing options.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div>
            <h2 className="text-2xl font-extrabold text-[#253447] mb-6">
              Eight Core Official Services
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {CORE_OFFICIAL_SERVICES.map((svc) => (
                <article
                  key={svc.slug}
                  className="rounded-2xl bg-white border border-[#E2EAF0] hover:border-[#38A9E8] hover:shadow-md transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="w-8 h-1 rounded-full bg-[#E8CF91] mb-3" />
                    <h3 className="text-base font-bold text-[#176B9A]">{svc.name}</h3>
                    <p className="text-xs text-[#64748B] mt-2 leading-relaxed">{svc.shortSummary}</p>
                    <p className="text-[11px] text-[#253447] mt-3 font-medium">
                      Suitable for: <span className="text-[#64748B] font-normal">{svc.suitableFor[0]}</span>
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-[#E2EAF0] flex items-center justify-between text-xs font-semibold">
                    <Link
                      href={`/services/${svc.slug}`}
                      className="text-[#176B9A] hover:text-[#38A9E8] inline-flex items-center gap-1"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </Link>
                    <Link
                      href={`/enquiry?loanType=${encodeURIComponent(svc.enquiryCategory)}`}
                      className="text-[#38A9E8] hover:text-[#176B9A]"
                    >
                      Enquire
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-[#253447] mb-6">
              Related Business &amp; Professional Advisory Categories
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {relatedServices.map((svc) => (
                <article
                  key={svc.slug}
                  className="rounded-2xl bg-[#EFF8FE]/60 border border-[#E2EAF0] hover:border-[#38A9E8] p-6 flex flex-col justify-between"
                >
                  <div>
                    <h3 className="text-lg font-bold text-[#176B9A]">{svc.name}</h3>
                    <p className="text-sm text-[#64748B] mt-2 leading-relaxed">{svc.intro}</p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/services/${svc.slug}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-[#E2EAF0] text-xs font-bold text-[#176B9A] hover:border-[#38A9E8]"
                    >
                      <span>Read Full Guide</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </Link>
                    <Link
                      href={`/enquiry?loanType=${encodeURIComponent(svc.enquiryCategory)}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#38A9E8] hover:bg-[#176B9A] text-white text-xs font-bold"
                    >
                      <span>Submit Enquiry</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Transparent Financial Advisory Notice */}
          <div className="rounded-2xl bg-[#FBF6E9] border border-[#E8CF91] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#176B9A] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs sm:text-sm text-[#253447] space-y-1">
                <p className="font-bold text-[#176B9A]">Independent Advisory &amp; Document Safety Notice</p>
                <p className="text-[#64748B]">
                  All eligibility norms, interest rates, fees and approval timelines are strictly lender-dependent. Do
                  not upload Aadhaar, PAN, bank statements or property papers on public website forms.
                </p>
              </div>
            </div>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#176B9A] hover:bg-[#38A9E8] text-white px-5 py-3 text-xs font-bold shrink-0"
            >
              <MessageCircle className="w-4 h-4 text-[#E8CF91]" aria-hidden="true" />
              <span>WhatsApp: {OFFICIAL_BUSINESS.whatsappDisplay}</span>
            </a>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
