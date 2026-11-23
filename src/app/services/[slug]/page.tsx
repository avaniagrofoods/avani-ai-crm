import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  MessageCircle,
  ShieldAlert
} from 'lucide-react';
import {
  OFFICIAL_BUSINESS,
  PUBLIC_LOAN_SERVICES,
  buildBreadcrumbJsonLd,
  buildOfficialWhatsAppUrl,
  buildServiceJsonLd,
  getPublicLoanServiceBySlug
} from '@/config/public-website';
import { PublicShell } from '@/components/public/public-shell';
import { JsonLdScript } from '@/components/public/json-ld';

export function generateStaticParams() {
  return PUBLIC_LOAN_SERVICES.map((svc) => ({ slug: svc.slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getPublicLoanServiceBySlug(slug);
  if (!service) {
    return { title: 'Service Not Found', robots: { index: false, follow: false } };
  }
  return {
    title: service.metaTitle,
    description: service.metaDescription,
    alternates: {
      canonical: `/services/${service.slug}`
    },
    openGraph: {
      title: service.metaTitle,
      description: service.metaDescription,
      url: `${OFFICIAL_BUSINESS.websiteUrl}/services/${service.slug}`,
      type: 'website'
    }
  };
}

export default async function ServiceDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getPublicLoanServiceBySlug(slug);
  if (!service) {
    notFound();
  }

  const related = service.relatedSlugs
    .map((rs) => getPublicLoanServiceBySlug(rs))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const whatsappUrl = buildOfficialWhatsAppUrl(service.whatsappMessage);

  return (
    <PublicShell>
      <JsonLdScript id={`ld-service-${service.slug}`} data={buildServiceJsonLd(service)} />
      <JsonLdScript
        id={`ld-breadcrumb-${service.slug}`}
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Loan Services', path: '/services' },
          { name: service.name, path: `/services/${service.slug}` }
        ])}
      />

      {/* Hero Header */}
      <section className="bg-[#EFF8FE] border-b border-[#E2EAF0] py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <nav aria-label="Breadcrumb" className="text-xs text-[#64748B] flex flex-wrap items-center gap-2">
            <Link href="/" className="hover:text-[#176B9A]">
              Home
            </Link>
            <span>/</span>
            <Link href="/services" className="hover:text-[#176B9A]">
              Loan Services
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#176B9A]">{service.name}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#253447] tracking-tight">
            {service.h1}
          </h1>

          <p className="text-base text-[#64748B] leading-relaxed max-w-3xl">{service.intro}</p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={`/enquiry?loanType=${encodeURIComponent(service.enquiryCategory)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#38A9E8] hover:bg-[#176B9A] text-white px-5 py-3 text-sm font-bold transition-colors"
            >
              <span>Enquire for {service.shortName}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#FBF6E9] hover:bg-[#f5ebd2] border border-[#E8CF91] text-[#176B9A] px-5 py-3 text-sm font-bold transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              <span>WhatsApp: {OFFICIAL_BUSINESS.whatsappDisplay}</span>
            </a>
            <a
              href={OFFICIAL_BUSINESS.mailtoHref}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#E2EAF0] text-[#253447] hover:border-[#38A9E8] px-4 py-3 text-sm font-semibold transition-colors"
            >
              <Mail className="w-4 h-4 text-[#176B9A]" aria-hidden="true" />
              <span>{OFFICIAL_BUSINESS.email}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Suitable Audience */}
            <div className="rounded-2xl bg-white border border-[#E2EAF0] p-6 space-y-3">
              <h2 className="text-lg font-bold text-[#176B9A]">Who This Service May Suit</h2>
              <ul className="space-y-2.5 text-sm text-[#253447]">
                {service.suitableFor.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#38A9E8] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Common Use Cases */}
            <div className="rounded-2xl bg-white border border-[#E2EAF0] p-6 space-y-3">
              <h2 className="text-lg font-bold text-[#176B9A]">Common Funding Requirements</h2>
              <ul className="space-y-2.5 text-sm text-[#253447]">
                {service.commonUseCases.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#38A9E8] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* General Eligibility (Explicitly Lender-Dependent) */}
          <div className="rounded-2xl bg-[#EFF8FE]/70 border border-[#E2EAF0] p-6 space-y-3">
            <h2 className="text-lg font-bold text-[#176B9A]">
              General Eligibility Considerations (Subject to Lender Assessment)
            </h2>
            <p className="text-xs text-[#64748B]">
              Eligibility parameters vary by lending institution and are assessed independently by each bank or NBFC.
              AVANI LOAN SERVICES does not guarantee eligibility or sanction.
            </p>
            <ul className="space-y-2 text-sm text-[#253447] list-disc pl-5">
              {service.eligibilityConsiderations.map((el) => (
                <li key={el}>{el}</li>
              ))}
            </ul>
          </div>

          {/* General Documentation Guidance + Anti-Unsecured-Upload Warning */}
          <div className="rounded-2xl bg-white border border-[#E2EAF0] p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#176B9A]">Documents Commonly Requested by Lenders</h2>
            <ul className="space-y-2 text-sm text-[#253447] list-disc pl-5">
              {service.generalDocuments.map((doc) => (
                <li key={doc}>{doc}</li>
              ))}
            </ul>
            <div className="rounded-xl bg-[#FBF6E9] border border-[#E8CF91] p-4 flex items-start gap-2.5 text-xs text-[#253447]">
              <ShieldAlert className="w-4 h-4 text-[#176B9A] shrink-0 mt-0.5" aria-hidden="true" />
              <p>
                <strong>Important Security Reminder:</strong> Never upload Aadhaar copies, PAN cards, bank statements,
                salary slips, credit reports or property deeds through unsecured public website forms. Share sensitive
                KYC and financial records only through formal lender-verified channels after consultancy onboarding.
              </p>
            </div>
          </div>

          {/* Application Assistance Process */}
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold text-[#253447]">Application Assistance Process</h2>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {service.processSteps.map((step, index) => (
                <li
                  key={step}
                  className="rounded-2xl bg-[#EFF8FE]/40 border border-[#E2EAF0] p-4 flex items-start gap-3"
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#176B9A] text-white text-xs font-bold shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-xs sm:text-sm text-[#253447] leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* FAQs */}
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold text-[#253447]">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {service.faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl bg-white border border-[#E2EAF0] p-5">
                  <h3 className="text-sm font-bold text-[#176B9A]">{faq.question}</h3>
                  <p className="text-xs sm:text-sm text-[#64748B] mt-1.5 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Related Services Internal Links */}
          {related.length > 0 && (
            <div className="pt-6 border-t border-[#E2EAF0] space-y-4">
              <h2 className="text-lg font-extrabold text-[#253447]">Related Loan Services</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {related.map((rel) => (
                  <Link
                    key={rel.slug}
                    href={`/services/${rel.slug}`}
                    className="rounded-xl bg-[#EFF8FE]/50 hover:bg-[#EFF8FE] border border-[#E2EAF0] hover:border-[#38A9E8] p-4 transition-colors block"
                  >
                    <h3 className="text-sm font-bold text-[#176B9A]">{rel.name}</h3>
                    <p className="text-xs text-[#64748B] mt-1">{rel.shortSummary}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
