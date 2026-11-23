'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  X,
  Home,
  Briefcase,
  FileText
} from 'lucide-react';
import {
  CORE_OFFICIAL_SERVICES,
  OFFICIAL_BUSINESS,
  buildOfficialWhatsAppUrl
} from '@/config/public-website';

export function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
    setServicesDropdownOpen(false);
    setMobileServicesOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setServicesDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setServicesDropdownOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const whatsappUrl = buildOfficialWhatsAppUrl();

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFFFF] text-[#253447] antialiased selection:bg-[#EFF8FE] selection:text-[#176B9A]">
      {/* Skip to Content Accessibility Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-[#176B9A] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      {/* Top Official Contact Strip */}
      <div className="bg-[#176B9A] text-white text-xs border-b border-[#E8CF91]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#EFF8FE]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#E8CF91] shrink-0" aria-hidden="true" />
            <span>
              <strong>{OFFICIAL_BUSINESS.name}</strong> — {OFFICIAL_BUSINESS.industry} ({OFFICIAL_BUSINESS.locationShort})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={OFFICIAL_BUSINESS.mailtoHref}
              className="inline-flex items-center gap-1.5 text-white hover:text-[#E8CF91] transition-colors font-medium"
            >
              <Mail className="w-3.5 h-3.5 text-[#E8CF91]" aria-hidden="true" />
              <span>{OFFICIAL_BUSINESS.email}</span>
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-white hover:text-[#E8CF91] transition-colors font-medium"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#E8CF91]" aria-hidden="true" />
              <span>WhatsApp: {OFFICIAL_BUSINESS.whatsappDisplay}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Sticky Professional Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#E2EAF0] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <Link
            href="/"
            className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#38A9E8] rounded-lg"
            aria-label="AVANI LOAN SERVICES — Home"
          >
            <img
              src="/images/avani-brand-mark.svg"
              alt="AVANI LOAN SERVICES emblem"
              width={40}
              height={40}
              className="w-10 h-10 shrink-0 rounded-xl"
            />
            <div className="leading-tight">
              <span className="block text-sm sm:text-base font-extrabold tracking-tight text-[#176B9A]">
                {OFFICIAL_BUSINESS.name}
              </span>
              <span className="block text-[11px] font-medium text-[#64748B]">
                Loan Consultancy &amp; Advisory
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Primary Navigation">
            <Link
              href="/"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/')
                  ? 'bg-[#EFF8FE] text-[#176B9A]'
                  : 'text-[#253447] hover:bg-[#EFF8FE]/70 hover:text-[#176B9A]'
              }`}
              aria-current={isActive('/') ? 'page' : undefined}
            >
              Home
            </Link>

            <Link
              href="/about"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/about')
                  ? 'bg-[#EFF8FE] text-[#176B9A]'
                  : 'text-[#253447] hover:bg-[#EFF8FE]/70 hover:text-[#176B9A]'
              }`}
              aria-current={isActive('/about') ? 'page' : undefined}
            >
              About Us
            </Link>

            {/* Accessible Loan Services Dropdown */}
            <div
              ref={dropdownRef}
              className="relative"
              onMouseEnter={() => setServicesDropdownOpen(true)}
              onMouseLeave={() => setServicesDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => setServicesDropdownOpen((v) => !v)}
                aria-expanded={servicesDropdownOpen}
                aria-haspopup="menu"
                className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#38A9E8] ${
                  isActive('/services')
                    ? 'bg-[#EFF8FE] text-[#176B9A]'
                    : 'text-[#253447] hover:bg-[#EFF8FE]/70 hover:text-[#176B9A]'
                }`}
              >
                <span>Loan Services</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${servicesDropdownOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {servicesDropdownOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full pt-2 w-80 z-50"
                >
                  <div className="rounded-2xl bg-white border border-[#E2EAF0] shadow-xl p-2 space-y-0.5">
                    <Link
                      href="/services"
                      role="menuitem"
                      className="block px-3 py-2 rounded-xl bg-[#EFF8FE] text-[#176B9A] text-xs font-bold hover:bg-[#38A9E8]/15 transition-colors"
                    >
                      All Loan Services Overview →
                    </Link>
                    <div className="my-1 border-t border-[#E2EAF0]" />
                    {CORE_OFFICIAL_SERVICES.map((svc) => (
                      <Link
                        key={svc.slug}
                        href={`/services/${svc.slug}`}
                        role="menuitem"
                        className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                          pathname === `/services/${svc.slug}`
                            ? 'bg-[#FBF6E9] text-[#176B9A] font-semibold'
                            : 'text-[#253447] hover:bg-[#EFF8FE] hover:text-[#176B9A]'
                        }`}
                      >
                        {svc.shortName}
                      </Link>
                    ))}
                    <div className="my-1 border-t border-[#E2EAF0]" />
                    <Link
                      href="/services/msme-working-capital-loan"
                      role="menuitem"
                      className="block px-3 py-1.5 rounded-xl text-xs font-medium text-[#64748B] hover:bg-[#EFF8FE] hover:text-[#176B9A]"
                    >
                      MSME &amp; Working Capital Loans
                    </Link>
                    <Link
                      href="/services/professional-loan"
                      role="menuitem"
                      className="block px-3 py-1.5 rounded-xl text-xs font-medium text-[#64748B] hover:bg-[#EFF8FE] hover:text-[#176B9A]"
                    >
                      Professional Loans (CA, Architects &amp; Engineers)
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/blog"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/blog')
                  ? 'bg-[#EFF8FE] text-[#176B9A]'
                  : 'text-[#253447] hover:bg-[#EFF8FE]/70 hover:text-[#176B9A]'
              }`}
              aria-current={isActive('/blog') ? 'page' : undefined}
            >
              Blogs / Resources
            </Link>

            <Link
              href="/contact"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/contact')
                  ? 'bg-[#EFF8FE] text-[#176B9A]'
                  : 'text-[#253447] hover:bg-[#EFF8FE]/70 hover:text-[#176B9A]'
              }`}
              aria-current={isActive('/contact') ? 'page' : undefined}
            >
              Contact Us
            </Link>
          </nav>

          {/* Desktop Action CTAs */}
          <div className="hidden lg:flex items-center gap-2.5">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E8CF91] bg-[#FBF6E9] hover:bg-[#f5ebd2] text-[#253447] text-sm font-semibold transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-[#176B9A]" aria-hidden="true" />
              <span>WhatsApp</span>
            </a>
            <Link
              href="/enquiry"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#38A9E8] hover:bg-[#176B9A] text-white text-sm font-semibold shadow-xs transition-colors"
            >
              <span>Enquire Now</span>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="lg:hidden inline-flex items-center justify-center p-2 rounded-xl border border-[#E2EAF0] text-[#176B9A] hover:bg-[#EFF8FE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#38A9E8]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile Navigation"
            className="lg:hidden border-t border-[#E2EAF0] bg-white px-4 py-4 space-y-1 shadow-lg"
          >
            <Link
              href="/"
              className={`block px-3 py-2.5 rounded-xl text-sm font-semibold ${
                isActive('/') ? 'bg-[#EFF8FE] text-[#176B9A]' : 'text-[#253447]'
              }`}
            >
              Home
            </Link>
            <Link
              href="/about"
              className={`block px-3 py-2.5 rounded-xl text-sm font-semibold ${
                isActive('/about') ? 'bg-[#EFF8FE] text-[#176B9A]' : 'text-[#253447]'
              }`}
            >
              About Us
            </Link>

            <div>
              <button
                type="button"
                onClick={() => setMobileServicesOpen((v) => !v)}
                aria-expanded={mobileServicesOpen}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-[#253447] hover:bg-[#EFF8FE]"
              >
                <span>Loan Services</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${mobileServicesOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {mobileServicesOpen && (
                <div className="pl-4 mt-1 space-y-1 border-l-2 border-[#E8CF91] ml-3">
                  <Link
                    href="/services"
                    className="block px-3 py-2 rounded-lg text-xs font-bold text-[#176B9A]"
                  >
                    All Loan Services
                  </Link>
                  {CORE_OFFICIAL_SERVICES.map((svc) => (
                    <Link
                      key={svc.slug}
                      href={`/services/${svc.slug}`}
                      className="block px-3 py-1.5 rounded-lg text-sm text-[#253447] hover:bg-[#EFF8FE]"
                    >
                      {svc.shortName}
                    </Link>
                  ))}
                  <Link
                    href="/services/msme-working-capital-loan"
                    className="block px-3 py-1.5 rounded-lg text-sm text-[#64748B] hover:bg-[#EFF8FE]"
                  >
                    MSME &amp; Working Capital
                  </Link>
                  <Link
                    href="/services/professional-loan"
                    className="block px-3 py-1.5 rounded-lg text-sm text-[#64748B] hover:bg-[#EFF8FE]"
                  >
                    Professional Loans
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/blog"
              className={`block px-3 py-2.5 rounded-xl text-sm font-semibold ${
                isActive('/blog') ? 'bg-[#EFF8FE] text-[#176B9A]' : 'text-[#253447]'
              }`}
            >
              Blogs / Resources
            </Link>
            <Link
              href="/contact"
              className={`block px-3 py-2.5 rounded-xl text-sm font-semibold ${
                isActive('/contact') ? 'bg-[#EFF8FE] text-[#176B9A]' : 'text-[#253447]'
              }`}
            >
              Contact Us
            </Link>

            <div className="pt-3 mt-2 border-t border-[#E2EAF0] flex flex-col sm:flex-row gap-2">
              <Link
                href="/enquiry"
                className="flex-1 text-center px-4 py-2.5 rounded-xl bg-[#38A9E8] text-white text-sm font-semibold"
              >
                Enquire Now
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center px-4 py-2.5 rounded-xl bg-[#FBF6E9] border border-[#E8CF91] text-[#176B9A] text-sm font-semibold"
              >
                WhatsApp: {OFFICIAL_BUSINESS.whatsappDisplay}
              </a>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 pb-20 lg:pb-0">
        {children}
      </main>

      {/* Professional Consistent Footer */}
      <footer className="bg-[#176B9A] text-white border-t-4 border-[#E8CF91]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Brand & Identity */}
            <div className="lg:col-span-1 space-y-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="/images/avani-brand-mark.svg"
                  alt="AVANI LOAN SERVICES emblem"
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-lg"
                />
                <span className="font-extrabold tracking-tight text-base text-white">
                  {OFFICIAL_BUSINESS.name}
                </span>
              </div>
              <p className="text-xs font-semibold text-[#E8CF91]">
                Owner &amp; Founder: {OFFICIAL_BUSINESS.ownerFounder}
              </p>
              <p className="text-xs text-[#EFF8FE]/90 leading-relaxed">
                {OFFICIAL_BUSINESS.industry}. Independent loan enquiry assistance and lender coordination based in {OFFICIAL_BUSINESS.locationShort}.
              </p>
            </div>

            {/* Company Links */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#E8CF91] mb-3">
                Company
              </h3>
              <ul className="space-y-2 text-sm text-[#EFF8FE]">
                <li>
                  <Link href="/" className="hover:text-[#E8CF91] transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-[#E8CF91] transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/services" className="hover:text-[#E8CF91] transition-colors">
                    Our Services
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-[#E8CF91] transition-colors">
                    Contact Us
                  </Link>
                </li>
              </ul>
            </div>

            {/* Loan Services Links */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#E8CF91] mb-3">
                Loan Services
              </h3>
              <ul className="space-y-2 text-sm text-[#EFF8FE]">
                <li>
                  <Link href="/services/personal-loan" className="hover:text-[#E8CF91] transition-colors">
                    Personal Loan
                  </Link>
                </li>
                <li>
                  <Link href="/services/business-loan" className="hover:text-[#E8CF91] transition-colors">
                    Business Loan
                  </Link>
                </li>
                <li>
                  <Link href="/services/doctor-loan" className="hover:text-[#E8CF91] transition-colors">
                    Doctor Loan
                  </Link>
                </li>
                <li>
                  <Link href="/services/home-loan" className="hover:text-[#E8CF91] transition-colors">
                    Home Loan
                  </Link>
                </li>
                <li>
                  <Link href="/services/mortgage-loan" className="hover:text-[#E8CF91] transition-colors">
                    Mortgage Loan / LAP
                  </Link>
                </li>
                <li>
                  <Link href="/services/education-loan-india" className="hover:text-[#E8CF91] transition-colors">
                    Education Loan — India
                  </Link>
                </li>
                <li>
                  <Link href="/services/education-loan-global" className="hover:text-[#E8CF91] transition-colors">
                    Education Loan — Global
                  </Link>
                </li>
                <li>
                  <Link href="/services/msme-working-capital-loan" className="hover:text-[#E8CF91] transition-colors">
                    MSME Loan
                  </Link>
                </li>
                <li>
                  <Link href="/services/school-and-college-funding" className="hover:text-[#E8CF91] transition-colors">
                    School &amp; College Funding
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources & Legal */}
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#E8CF91] mb-3">
                  Resources
                </h3>
                <ul className="space-y-2 text-sm text-[#EFF8FE]">
                  <li>
                    <Link href="/blog" className="hover:text-[#E8CF91] transition-colors">
                      Blogs &amp; Financial Guides
                    </Link>
                  </li>
                  <li>
                    <Link href="/#faqs" className="hover:text-[#E8CF91] transition-colors">
                      FAQs
                    </Link>
                  </li>
                  <li>
                    <Link href="/enquiry" className="hover:text-[#E8CF91] transition-colors">
                      Submit Loan Enquiry
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#E8CF91] mb-3">
                  Legal
                </h3>
                <ul className="space-y-2 text-sm text-[#EFF8FE]">
                  <li>
                    <Link href="/privacy" className="hover:text-[#E8CF91] transition-colors">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="hover:text-[#E8CF91] transition-colors">
                      Terms and Conditions
                    </Link>
                  </li>
                  <li>
                    <Link href="/disclaimer" className="hover:text-[#E8CF91] transition-colors">
                      Disclaimer
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Official Contact */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#E8CF91] mb-3">
                Official Contact
              </h3>
              <ul className="space-y-3 text-sm text-[#EFF8FE]">
                <li className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-[#E8CF91] mt-0.5 shrink-0" aria-hidden="true" />
                  <a
                    href={OFFICIAL_BUSINESS.mailtoHref}
                    className="hover:text-[#E8CF91] transition-colors break-all"
                  >
                    {OFFICIAL_BUSINESS.email}
                  </a>
                </li>
                <li className="flex items-start gap-2">
                  <MessageCircle className="w-4 h-4 text-[#E8CF91] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#E8CF91] transition-colors font-semibold block"
                    >
                      {OFFICIAL_BUSINESS.whatsappDisplay}
                    </a>
                    <span className="text-[11px] text-[#EFF8FE]/75">Official WhatsApp Business</span>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#E8CF91] mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="text-xs leading-relaxed text-[#EFF8FE]/90">
                    {OFFICIAL_BUSINESS.officeAddressFull}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Advisory Disclaimer & Copyright Bar */}
          <div className="mt-10 pt-6 border-t border-white/15 space-y-3 text-xs text-[#EFF8FE]/85">
            <p className="leading-relaxed">
              <strong className="text-[#E8CF91]">Important Advisory Notice:</strong> {OFFICIAL_BUSINESS.name} is an
              independent loan consultancy and advisory service and is not a bank or NBFC. Loan sanction, interest
              rates, fees, eligibility criteria and disbursement timelines are determined solely by the respective
              lending institution subject to independent verification and applicable terms. Do not submit Aadhaar,
              PAN, bank statements, salary slips, credit reports or property documents through public website forms.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[#EFF8FE]/75">
              <span>
                © {new Date().getFullYear()} {OFFICIAL_BUSINESS.name}. Founded by {OFFICIAL_BUSINESS.ownerFounder}. All
                rights reserved.
              </span>
              <span>Official Website: {OFFICIAL_BUSINESS.websiteDisplay}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Quick Navigation Bar */}
      <nav
        aria-label="Mobile Quick Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E2EAF0] shadow-lg grid grid-cols-5 text-[11px] font-semibold"
      >
        <Link
          href="/"
          className={`flex flex-col items-center justify-center py-2 gap-0.5 ${
            isActive('/') ? 'text-[#176B9A] bg-[#EFF8FE]' : 'text-[#64748B]'
          }`}
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          <span>Home</span>
        </Link>
        <Link
          href="/services"
          className={`flex flex-col items-center justify-center py-2 gap-0.5 ${
            isActive('/services') ? 'text-[#176B9A] bg-[#EFF8FE]' : 'text-[#64748B]'
          }`}
        >
          <Briefcase className="w-4 h-4" aria-hidden="true" />
          <span>Services</span>
        </Link>
        <Link
          href="/enquiry"
          className={`flex flex-col items-center justify-center py-2 gap-0.5 ${
            isActive('/enquiry') ? 'text-[#176B9A] bg-[#EFF8FE]' : 'text-[#38A9E8]'
          }`}
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          <span>Enquire</span>
        </Link>
        <Link
          href="/contact"
          className={`flex flex-col items-center justify-center py-2 gap-0.5 ${
            isActive('/contact') ? 'text-[#176B9A] bg-[#EFF8FE]' : 'text-[#64748B]'
          }`}
        >
          <Phone className="w-4 h-4" aria-hidden="true" />
          <span>Contact</span>
        </Link>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center py-2 gap-0.5 text-[#176B9A] bg-[#FBF6E9]"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" />
          <span>WhatsApp</span>
        </a>
      </nav>

      {/* Desktop Floating Official WhatsApp Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Chat with AVANI LOAN SERVICES on WhatsApp (${OFFICIAL_BUSINESS.whatsappDisplay})`}
        className="hidden lg:inline-flex fixed bottom-6 right-6 z-40 items-center gap-2 rounded-full bg-[#176B9A] hover:bg-[#38A9E8] text-white px-4 py-3 shadow-lg border-2 border-[#E8CF91] text-sm font-semibold transition-colors"
      >
        <MessageCircle className="w-4 h-4 text-[#E8CF91]" aria-hidden="true" />
        <span>WhatsApp: {OFFICIAL_BUSINESS.whatsappDisplay}</span>
      </a>
    </div>
  );
}
