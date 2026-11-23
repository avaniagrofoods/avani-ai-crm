import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Users
} from 'lucide-react';
import {
  CORE_OFFICIAL_SERVICES,
  OFFICIAL_BUSINESS,
  TARGET_AUDIENCES,
  buildBreadcrumbJsonLd,
  buildOfficialWhatsAppUrl
} from '@/config/public-website';
import { PublicShell } from '@/components/public/public-shell';
import { JsonLdScript } from '@/components/public/json-ld';

export const metadata: Metadata = {
  title: 'About Us — Loan Consultancy & Advisory',
  description:
    'Learn about AVANI LOAN SERVICES, founded by Sachin Shinde in Latur, Maharashtra. Independent financial-services loan consultancy, application assistance and lender coordination.',
  alternates: {
    canonical: '/about'
  },
  openGraph: {
    title: `About Us | ${OFFICIAL_BUSINESS.name}`,
    description:
      'Independent loan consultancy and advisory service founded by Sachin Shinde in Latur, Maharashtra.',
    url: `${OFFICIAL_BUSINESS.websiteUrl}/about`,
    type: 'website'
  }
};

export default function AboutPage() {
  const whatsappUrl = buildOfficialWhatsAppUrl();

  return (
    <PublicShell>
      <JsonLdScript
        id="ld-breadcrumb-about"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'About Us', path: '/about' }
        ])}
      />

      {/* Page Hero */}
      <section className="bg-[#EFF8FE] border-b border-[#E2EAF0] py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <nav aria-label="Breadcrumb" className="text-xs text-[#64748B] flex items-center gap-2">
            <Link href="/" className="hover:text-[#176B9A]">
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#176B9A]">About Us</span>
          </nav>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF6E9] border border-[#E8CF91] px-3 py-1 text-xs font-semibold text-[#176B9A]">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{OFFICIAL_BUSINESS.industry}</span>
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#253447] tracking-tight">
            About {OFFICIAL_BUSINESS.name}
          </h1>
          <p className="text-base text-[#64748B] leading-relaxed max-w-3xl">
            {OFFICIAL_BUSINESS.homepageIntro}
          </p>
        </div>
      </section>

      {/* Founder & Advisory Model */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white border border-[#E2EAF0] p-6 space-y-3">
              <div className="w-10 h-1 rounded-full bg-[#38A9E8]" />
              <h2 className="text-xl font-bold text-[#176B9A]">Owner &amp; Founder</h2>
              <p className="text-sm text-[#253447] font-semibold">{OFFICIAL_BUSINESS.ownerFounder}</p>
              <p className="text-sm text-[#64748B] leading-relaxed">
                {OFFICIAL_BUSINESS.name} is founded and led by {OFFICIAL_BUSINESS.ownerFounder} in{' '}
                {OFFICIAL_BUSINESS.locationShort}. Our advisory practice focuses on transparent loan enquiry
                understanding, structured documentation awareness and responsible coordination with relevant lending
                institutions.
              </p>
            </div>

            <div className="rounded-2xl bg-[#FBF6E9] border border-[#E8CF91] p-6 space-y-3">
              <div className="w-10 h-1 rounded-full bg-[#176B9A]" />
              <h2 className="text-xl font-bold text-[#176B9A]">Consultancy vs. Lender Decisions</h2>
              <p className="text-sm text-[#253447] leading-relaxed">
                {OFFICIAL_BUSINESS.name} operates strictly as an independent loan consultancy and advisory service—not
                as a bank or NBFC. We do not underwrite credit directly or guarantee loan sanction, interest rates,
                eligibility or disbursement timelines.
              </p>
              <p className="text-xs text-[#64748B] leading-relaxed">
                All credit assessments, applicable charges, interest rates and sanction decisions remain exclusively
                with the prospective lending institution.
              </p>
            </div>
          </div>

          {/* Core Services */}
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold text-[#253447]">Official Loan Services We Assist With</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CORE_OFFICIAL_SERVICES.map((svc) => (
                <Link
                  key={svc.slug}
                  href={`/services/${svc.slug}`}
                  className="rounded-2xl bg-[#EFF8FE]/60 hover:bg-[#EFF8FE] border border-[#E2EAF0] hover:border-[#38A9E8] p-4 transition-colors block"
                >
                  <h3 className="text-sm font-bold text-[#176B9A]">{svc.name}</h3>
                  <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">{svc.shortSummary}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Twelve Customer Segments */}
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold text-[#253447] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#38A9E8]" aria-hidden="true" />
              <span>Customer Segments We Serve</span>
            </h2>
            <p className="text-sm text-[#64748B]">
              We welcome enquiries from individuals, families, enterprises and educational institutions across these
              categories:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {TARGET_AUDIENCES.map((segment) => (
                <div
                  key={segment}
                  className="rounded-xl bg-white border border-[#E2EAF0] px-3.5 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-medium text-[#253447]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#38A9E8] shrink-0" aria-hidden="true" />
                  <span>{segment}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Official Office & Contact Card */}
          <div className="rounded-3xl bg-[#EFF8FE] border border-[#E2EAF0] p-6 sm:p-8 flex flex-col lg:flex-row justify-between gap-6 items-start lg:items-center">
            <div className="space-y-3">
              <h2 className="text-xl font-extrabold text-[#176B9A]">Official Latur Office &amp; Contact Details</h2>
              <div className="space-y-2 text-sm text-[#253447]">
                <p className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#176B9A] mt-1 shrink-0" aria-hidden="true" />
                  <span>{OFFICIAL_BUSINESS.officeAddressFull}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#176B9A] shrink-0" aria-hidden="true" />
                  <a href={OFFICIAL_BUSINESS.mailtoHref} className="font-semibold text-[#176B9A] hover:underline">
                    {OFFICIAL_BUSINESS.email}
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#176B9A] shrink-0" aria-hidden="true" />
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#176B9A] hover:underline"
                  >
                    WhatsApp Business: {OFFICIAL_BUSINESS.whatsappDisplay}
                  </a>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                href="/enquiry"
                className="inline-flex items-center gap-2 rounded-xl bg-[#38A9E8] hover:bg-[#176B9A] text-white px-5 py-3 text-sm font-bold transition-colors"
              >
                <span>Enquire Now</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#176B9A]/30 text-[#176B9A] hover:bg-[#FBF6E9] px-5 py-3 text-sm font-bold transition-colors"
              >
                <span>Contact Us</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
