import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  GraduationCap,
  HelpCircle,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Users
} from 'lucide-react';
import {
  CORE_OFFICIAL_SERVICES,
  HOMEPAGE_FAQS,
  OFFICIAL_BUSINESS,
  PUBLIC_BLOG_ARTICLES,
  TARGET_AUDIENCES,
  buildOfficialWhatsAppUrl,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd
} from '@/config/public-website';
import { PublicShell } from './public-shell';
import { PublicEnquiryForm } from './enquiry-form';
import { JsonLdScript } from './json-ld';

const WHY_CHOOSE_ITEMS = [
  {
    title: 'Focused Loan Consultancy',
    description:
      'Clear guidance across Personal, Business, Doctor, Home, Mortgage, Education and Institutional funding categories.'
  },
  {
    title: 'Structured Documentation Clarity',
    description:
      'Practical awareness of lender-requested general checklists so you organise records cleanly before formal lender submission.'
  },
  {
    title: 'Dedicated Lender Coordination',
    description:
      'Consistent enquiry coordination with relevant lending institutions led by Founder Sachin Shinde from Latur, Maharashtra.'
  },
  {
    title: 'Privacy-First Minimal Intake',
    description:
      'We collect only minimal enquiry information online and never ask for Aadhaar, PAN or bank statements through unsecured forms.'
  }
] as const;

const ASSISTANCE_PROCESS = [
  {
    step: '01',
    title: 'Submit Basic Enquiry',
    detail: 'Share your name, mobile number, city and loan category via our enquiry form or official WhatsApp.'
  },
  {
    step: '02',
    title: 'Requirement & Category Review',
    detail: 'Discuss your funding goal to identify suitable loan categories for salaried, business, professional or education needs.'
  },
  {
    step: '03',
    title: 'General Checklist Guidance',
    detail: 'Understand general eligibility factors and documents commonly requested by lending institutions.'
  },
  {
    step: '04',
    title: 'Lender Coordination',
    detail: 'Coordinate application steps with relevant lending institutions. Final credit approval and terms remain solely with the lender.'
  }
] as const;

export function PublicHomePage() {
  const whatsappUrl = buildOfficialWhatsAppUrl();

  return (
    <PublicShell>
      <JsonLdScript id="ld-organization" data={buildOrganizationJsonLd()} />
      <JsonLdScript id="ld-website" data={buildWebSiteJsonLd()} />

      {/* 1. Hero Section */}
      <section className="bg-gradient-to-b from-[#EFF8FE] via-[#FFFFFF] to-[#FFFFFF] border-b border-[#E2EAF0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FBF6E9] border border-[#E8CF91] px-3.5 py-1.5 text-xs font-semibold text-[#176B9A]">
                <ShieldCheck className="w-4 h-4 text-[#176B9A]" aria-hidden="true" />
                <span>{OFFICIAL_BUSINESS.industry} • {OFFICIAL_BUSINESS.locationShort}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#253447] leading-tight">
                {OFFICIAL_BUSINESS.homepageHeadline}
              </h1>

              <p className="text-base sm:text-lg text-[#64748B] leading-relaxed max-w-2xl">
                {OFFICIAL_BUSINESS.homepageIntro}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/enquiry"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#38A9E8] hover:bg-[#176B9A] text-white px-6 py-3.5 text-sm font-bold shadow-sm transition-colors"
                >
                  <span>Enquire Now</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-[#EFF8FE] border border-[#176B9A]/30 text-[#176B9A] px-6 py-3.5 text-sm font-bold transition-colors"
                >
                  <span>Explore Loan Services</span>
                </Link>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FBF6E9] hover:bg-[#f5ebd2] border border-[#E8CF91] text-[#253447] px-5 py-3.5 text-sm font-semibold transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#176B9A]" aria-hidden="true" />
                  <span>{OFFICIAL_BUSINESS.whatsappDisplay}</span>
                </a>
              </div>

              <p className="text-xs text-[#64748B]">
                Independent loan consultancy &amp; advisory (not a bank or NBFC). All loan approvals, interest rates
                and terms remain subject to lender evaluation.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-white border border-[#E2EAF0] p-3 shadow-md">
                <img
                  src="/images/hero-advisory-illustration.svg"
                  alt="AVANI LOAN SERVICES — Loan consultancy, checklist guidance and lender coordination overview"
                  width={600}
                  height={440}
                  className="w-full h-auto rounded-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Eight Official Core Loan Services Overview */}
      <section className="py-14 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#38A9E8]">
                Official Loan Services
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#253447] mt-1">
                Eight Core Loan Advisory Categories
              </h2>
              <p className="text-sm text-[#64748B] mt-2 max-w-2xl">
                Explore structured consultancy across personal, business, medical, residential, property-backed, higher
                education and institutional funding requirements.
              </p>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#176B9A] hover:text-[#38A9E8]"
            >
              <span>View All Services &amp; Details</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {CORE_OFFICIAL_SERVICES.map((svc) => (
              <article
                key={svc.slug}
                className="flex flex-col justify-between rounded-2xl bg-white border border-[#E2EAF0] hover:border-[#38A9E8] hover:shadow-md transition-all p-5"
              >
                <div>
                  <div className="w-9 h-1 rounded-full bg-[#E8CF91] mb-3" />
                  <h3 className="text-base font-bold text-[#176B9A]">{svc.name}</h3>
                  <p className="text-xs text-[#64748B] mt-2 leading-relaxed">{svc.shortSummary}</p>
                </div>
                <div className="mt-5 pt-3 border-t border-[#E2EAF0] flex items-center justify-between text-xs font-semibold">
                  <Link
                    href={`/services/${svc.slug}`}
                    className="text-[#176B9A] hover:text-[#38A9E8] inline-flex items-center gap-1"
                  >
                    <span>Learn More</span>
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
      </section>

      {/* 3. Target Customer Categories (All 12 Official Groups) */}
      <section className="py-14 bg-[#EFF8FE] border-y border-[#E2EAF0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-8">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#176B9A]">
              <Users className="w-4 h-4 text-[#38A9E8]" aria-hidden="true" />
              <span>Who We Assist</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#253447] mt-1">
              Tailored Loan Guidance Across Twelve Customer Segments
            </h2>
            <p className="text-sm text-[#64748B] mt-2">
              Whether you are an individual professional, a growing enterprise, a student family or a property buyer,
              AVANI LOAN SERVICES adapts its consultancy to your specific loan enquiry.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {TARGET_AUDIENCES.map((audience) => (
              <div
                key={audience}
                className="rounded-xl bg-white border border-[#E2EAF0] px-4 py-3 flex items-center gap-2.5 shadow-2xs"
              >
                <CheckCircle2 className="w-4 h-4 text-[#38A9E8] shrink-0" aria-hidden="true" />
                <span className="text-xs sm:text-sm font-semibold text-[#253447]">{audience}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Business & Professional + Education & Institutional Highlight Sections */}
      <section className="py-14 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Business & Professional Loans */}
          <div className="rounded-3xl bg-[#EFF8FE]/70 border border-[#E2EAF0] p-7 sm:p-8 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#E2EAF0] px-3 py-1.5 text-xs font-bold text-[#176B9A]">
              <Building2 className="w-4 h-4 text-[#38A9E8]" aria-hidden="true" />
              <span>Business &amp; Professional Advisory</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#253447]">
              Business, MSME, Doctor &amp; Professional Loan Guidance
            </h2>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Dedicated consultancy for Business Owners, MSMEs and SMEs, Doctors, Chartered Accountants, Architects,
              Engineers and Self-Employed Individuals exploring expansion capital, working capital, clinic equipment or
              professional practice loans.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-2">
              <Link
                href="/services/business-loan"
                className="px-4 py-2 rounded-xl bg-white border border-[#E2EAF0] text-xs font-semibold text-[#176B9A] hover:border-[#38A9E8]"
              >
                Business Loan
              </Link>
              <Link
                href="/services/doctor-loan"
                className="px-4 py-2 rounded-xl bg-white border border-[#E2EAF0] text-xs font-semibold text-[#176B9A] hover:border-[#38A9E8]"
              >
                Doctor Loan
              </Link>
              <Link
                href="/services/msme-working-capital-loan"
                className="px-4 py-2 rounded-xl bg-white border border-[#E2EAF0] text-xs font-semibold text-[#176B9A] hover:border-[#38A9E8]"
              >
                MSME &amp; Working Capital
              </Link>
              <Link
                href="/services/professional-loan"
                className="px-4 py-2 rounded-xl bg-white border border-[#E2EAF0] text-xs font-semibold text-[#176B9A] hover:border-[#38A9E8]"
              >
                Professional Loans
              </Link>
            </div>
          </div>

          {/* Education & Institutional Funding */}
          <div className="rounded-3xl bg-[#FBF6E9] border border-[#E8CF91] p-7 sm:p-8 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#E8CF91] px-3 py-1.5 text-xs font-bold text-[#176B9A]">
              <GraduationCap className="w-4 h-4 text-[#176B9A]" aria-hidden="true" />
              <span>Education &amp; Institutional Desk</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#253447]">
              Education Loans (India &amp; Global) and School &amp; College Funding
            </h2>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Practical planning and lender coordination for Students Seeking Higher Education, Parents Seeking
              Education Funding, and school/college trusts planning campus construction, laboratory facilities or
              institutional infrastructure development.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-2">
              <Link
                href="/services/education-loan-india"
                className="px-4 py-2 rounded-xl bg-white border border-[#E8CF91] text-xs font-semibold text-[#176B9A] hover:bg-[#EFF8FE]"
              >
                Education Loan — India
              </Link>
              <Link
                href="/services/education-loan-global"
                className="px-4 py-2 rounded-xl bg-white border border-[#E8CF91] text-xs font-semibold text-[#176B9A] hover:bg-[#EFF8FE]"
              >
                Education Loan — Global Studies
              </Link>
              <Link
                href="/services/school-and-college-funding"
                className="px-4 py-2 rounded-xl bg-white border border-[#E8CF91] text-xs font-semibold text-[#176B9A] hover:bg-[#EFF8FE]"
              >
                School &amp; College Funding
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Why Choose & 4-Step Loan Assistance Process */}
      <section className="py-14 sm:py-16 bg-[#EFF8FE]/50 border-y border-[#E2EAF0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#38A9E8]">
              Advisory Approach
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#253447] mt-1">
              Why Choose {OFFICIAL_BUSINESS.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-7">
              {WHY_CHOOSE_ITEMS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl bg-white border border-[#E2EAF0] p-5 space-y-2 shadow-2xs"
                >
                  <div className="w-8 h-1 rounded-full bg-[#38A9E8]" />
                  <h3 className="text-sm font-bold text-[#176B9A]">{item.title}</h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#176B9A]">
              How It Works
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#253447] mt-1">
              Simple Four-Step Loan Assistance Process
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-7">
              {ASSISTANCE_PROCESS.map((p) => (
                <div
                  key={p.step}
                  className="rounded-2xl bg-white border border-[#E2EAF0] p-5 space-y-2"
                >
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#FBF6E9] border border-[#E8CF91] text-sm font-extrabold text-[#176B9A]">
                    {p.step}
                  </span>
                  <h3 className="text-sm font-bold text-[#253447]">{p.title}</h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">{p.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Latest Educational Articles */}
      <section className="py-14 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#38A9E8]">
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span>Educational Resources</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#253447] mt-1">
                Loan Planning Guides &amp; Articles
              </h2>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#176B9A] hover:text-[#38A9E8]"
            >
              <span>Browse All Articles</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PUBLIC_BLOG_ARTICLES.map((post) => (
              <article
                key={post.slug}
                className="rounded-2xl bg-white border border-[#E2EAF0] hover:border-[#38A9E8] transition-colors p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#64748B] mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EFF8FE] text-[#176B9A] font-semibold">
                      {post.category}
                    </span>
                    <span>•</span>
                    <span>{post.readingTime}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#253447] leading-snug">
                    <Link href={`/blog/${post.slug}`} className="hover:text-[#176B9A]">
                      {post.title}
                    </Link>
                  </h3>
                  <p className="text-xs text-[#64748B] mt-2 leading-relaxed">{post.intro}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E2EAF0] flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">{post.author}</span>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="font-bold text-[#176B9A] hover:text-[#38A9E8] inline-flex items-center gap-1"
                  >
                    <span>Read Guide</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FAQs Section */}
      <section id="faqs" className="py-14 sm:py-16 bg-[#EFF8FE]/60 border-y border-[#E2EAF0]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-9">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#176B9A]">
              <HelpCircle className="w-4 h-4 text-[#38A9E8]" aria-hidden="true" />
              <span>Frequently Asked Questions</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#253447] mt-1">
              Common Questions About Our Loan Consultancy
            </h2>
          </div>

          <div className="space-y-4">
            {HOMEPAGE_FAQS.map((faq) => (
              <div
                key={faq.question}
                className="rounded-2xl bg-white border border-[#E2EAF0] p-5 sm:p-6 shadow-2xs"
              >
                <h3 className="text-sm sm:text-base font-bold text-[#176B9A]">{faq.question}</h3>
                <p className="text-xs sm:text-sm text-[#64748B] mt-2 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Founder Introduction + Contact & Minimal Enquiry Section */}
      <section className="py-14 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#38A9E8]">
                Founder &amp; Official Contact Desk
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#253447] mt-1">
                Connect with {OFFICIAL_BUSINESS.name}
              </h2>
              <p className="text-sm text-[#64748B] mt-3 leading-relaxed">
                Led by Owner &amp; Founder <strong className="text-[#253447]">{OFFICIAL_BUSINESS.ownerFounder}</strong>,
                our Latur office assists applicants with transparent loan consultancy, enquiry structuring and lender
                coordination.
              </p>
            </div>

            <div className="rounded-2xl bg-[#FBF6E9] border border-[#E8CF91] p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#176B9A] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Official Email
                  </span>
                  <a
                    href={OFFICIAL_BUSINESS.mailtoHref}
                    className="text-sm font-bold text-[#176B9A] hover:underline"
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
                    className="text-sm font-bold text-[#176B9A] hover:underline"
                  >
                    {OFFICIAL_BUSINESS.whatsappDisplay}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#176B9A] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Official Office Address
                  </span>
                  <p className="text-xs font-medium text-[#253447] mt-0.5 leading-relaxed">
                    {OFFICIAL_BUSINESS.officeAddressFull}
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#176B9A] hover:text-[#38A9E8]"
            >
              <span>Read More About AVANI LOAN SERVICES</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="lg:col-span-7">
            <PublicEnquiryForm />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
