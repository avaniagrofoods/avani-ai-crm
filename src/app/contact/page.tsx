import type { Metadata } from 'next';
import Link from 'next/link';
import { Globe, Mail, MapPin, MessageCircle, User } from 'lucide-react';
import {
  OFFICIAL_BUSINESS,
  buildBreadcrumbJsonLd,
  buildOfficialWhatsAppUrl
} from '@/config/public-website';
import { PublicShell } from '@/components/public/public-shell';
import { PublicEnquiryForm } from '@/components/public/enquiry-form';
import { JsonLdScript } from '@/components/public/json-ld';

export const metadata: Metadata = {
  title: 'Contact Us — Latur Office, Email & WhatsApp',
  description:
    'Contact AVANI LOAN SERVICES (Founder: Sachin Shinde) in Latur, Maharashtra via email enquiry@avanifinserv.com, WhatsApp +91 91756 35165, or our minimal loan enquiry form.',
  alternates: {
    canonical: '/contact'
  },
  openGraph: {
    title: `Contact Us | ${OFFICIAL_BUSINESS.name}`,
    description:
      'Official contact information, Latur office address, email and WhatsApp Business desk for AVANI LOAN SERVICES.',
    url: `${OFFICIAL_BUSINESS.websiteUrl}/contact`,
    type: 'website'
  }
};

export default function ContactPage() {
  const whatsappUrl = buildOfficialWhatsAppUrl();

  return (
    <PublicShell>
      <JsonLdScript
        id="ld-breadcrumb-contact"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Contact Us', path: '/contact' }
        ])}
      />

      <section className="bg-[#EFF8FE] border-b border-[#E2EAF0] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <nav aria-label="Breadcrumb" className="text-xs text-[#64748B] flex items-center gap-2">
            <Link href="/" className="hover:text-[#176B9A]">
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#176B9A]">Contact Us</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#253447] tracking-tight">
            Contact {OFFICIAL_BUSINESS.name}
          </h1>
          <p className="text-base text-[#64748B] max-w-3xl leading-relaxed">
            Reach our loan consultancy desk in Latur, Maharashtra for enquiries on Personal, Business, Doctor, Home,
            Mortgage, Education and School &amp; College Funding.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Official Business Contact Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl bg-[#FBF6E9] border border-[#E8CF91] p-6 sm:p-8 space-y-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#176B9A]">
                  Official Business Details
                </span>
                <h2 className="text-xl font-extrabold text-[#253447] mt-1">
                  {OFFICIAL_BUSINESS.name}
                </h2>
                <p className="text-xs text-[#64748B] mt-1">{OFFICIAL_BUSINESS.industry}</p>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-[#176B9A] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      Owner &amp; Founder
                    </span>
                    <span className="font-semibold text-[#253447]">{OFFICIAL_BUSINESS.ownerFounder}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-[#176B9A] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      Official Email
                    </span>
                    <a
                      href={OFFICIAL_BUSINESS.mailtoHref}
                      className="font-bold text-[#176B9A] hover:underline break-all"
                    >
                      {OFFICIAL_BUSINESS.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 text-[#176B9A] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      Official WhatsApp Business
                    </span>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#176B9A] hover:underline block"
                    >
                      {OFFICIAL_BUSINESS.whatsappDisplay}
                    </a>
                    <span className="text-xs text-[#64748B]">Direct WhatsApp consultation link</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-[#176B9A] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      Official Website
                    </span>
                    <span className="font-medium text-[#253447]">{OFFICIAL_BUSINESS.websiteDisplay}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#176B9A] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      Official Office Address
                    </span>
                    <address className="not-italic text-xs sm:text-sm font-medium text-[#253447] leading-relaxed mt-0.5">
                      {OFFICIAL_BUSINESS.officeAddressFull}
                    </address>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#176B9A] hover:bg-[#38A9E8] text-white px-4 py-3 text-xs font-bold transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#E8CF91]" aria-hidden="true" />
                  <span>Message on WhatsApp</span>
                </a>
                <a
                  href={OFFICIAL_BUSINESS.mailtoHref}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-[#176B9A]/30 text-[#176B9A] hover:bg-[#EFF8FE] px-4 py-3 text-xs font-bold transition-colors"
                >
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  <span>Send Email</span>
                </a>
              </div>
            </div>
          </div>

          {/* Minimal Enquiry Form */}
          <div className="lg:col-span-7">
            <PublicEnquiryForm />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
