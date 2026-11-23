'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, ShieldAlert, Send } from 'lucide-react';
import { OFFICIAL_BUSINESS, buildOfficialWhatsAppUrl } from '@/config/public-website';

const ENQUIRY_LOAN_OPTIONS = [
  'Personal Loan',
  'Business Loan',
  'Doctor Loan',
  'Home Loan',
  'Mortgage Loan / LAP',
  'Education Loan — India',
  'Education Loan — Global Studies',
  'School Funding',
  'College Funding',
  'CA Professional Loan'
] as const;

export function PublicEnquiryForm({
  defaultLoanType = 'Personal Loan',
  compact = false
}: {
  defaultLoanType?: string;
  compact?: boolean;
}) {
  const normalizedDefault = ENQUIRY_LOAN_OPTIONS.includes(defaultLoanType as any)
    ? defaultLoanType
    : 'Personal Loan';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Latur');
  const [loanType, setLoanType] = useState(normalizedDefault);
  const [requestedAmount, setRequestedAmount] = useState('');
  const [consent, setConsent] = useState(false);
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedRef, setSubmittedRef] = useState<{ leadId: string; message: string } | null>(null);
  const idempotencyKeyRef = useRef<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');

    const cleanName = name.trim();
    const digits = phone.replace(/\D/g, '');
    const raw10 = digits.length > 10 ? digits.slice(-10) : digits;

    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(raw10)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number starting with 6–9.');
      return;
    }
    if (!city.trim()) {
      setErrorMsg('Please enter your city.');
      return;
    }
    if (!consent) {
      setErrorMsg('Please provide explicit consent so AVANI LOAN SERVICES can contact you about your enquiry.');
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `WEB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          phone: raw10,
          city: city.trim(),
          loanType,
          requestedAmount: requestedAmount.trim() || undefined,
          consent: true,
          consentStatus: 'GRANTED',
          leadSource: 'WEBSITE_PUBLIC_FORM',
          idempotencyKey: idempotencyKeyRef.current,
          website: websiteHoneypot
        })
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setErrorMsg(
          data?.message ||
            data?.error ||
            'We could not register your enquiry right now. Please try again or reach us on official WhatsApp.'
        );
        return;
      }

      setSubmittedRef({
        leadId: data.leadId || 'REGISTERED',
        message:
          data.message ||
          'Thank you. Your loan enquiry has been registered safely. Our advisory desk will contact you shortly.'
      });
      setName('');
      setPhone('');
      setRequestedAmount('');
      setConsent(false);
      idempotencyKeyRef.current = '';
    } catch {
      setErrorMsg(
        'Network error while submitting your enquiry. Your enquiry was NOT confirmed—please retry or contact us on WhatsApp.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedRef) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl bg-[#EFF8FE] border border-[#38A9E8]/40 p-6 space-y-4 text-[#253447]"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-[#176B9A] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h3 className="text-lg font-bold text-[#176B9A]">Enquiry Registered</h3>
            <p className="text-sm text-[#253447] mt-1">{submittedRef.message}</p>
            <p className="text-xs font-mono text-[#64748B] mt-2">
              Reference ID: <strong className="text-[#176B9A]">{submittedRef.leadId}</strong>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => setSubmittedRef(null)}
            className="px-4 py-2 rounded-xl bg-white border border-[#E2EAF0] text-xs font-semibold text-[#176B9A] hover:bg-[#FBF6E9]"
          >
            Submit Another Enquiry
          </button>
          <a
            href={buildOfficialWhatsAppUrl(
              `Hello AVANI LOAN SERVICES, I submitted a loan enquiry (Ref: ${submittedRef.leadId}).`
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-[#176B9A] text-white text-xs font-semibold hover:bg-[#38A9E8]"
          >
            Follow Up on WhatsApp ({OFFICIAL_BUSINESS.whatsappDisplay})
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`rounded-2xl bg-white border border-[#E2EAF0] shadow-sm ${compact ? 'p-5' : 'p-6 sm:p-8'} space-y-4`}
      aria-label="AVANI LOAN SERVICES Minimal Loan Enquiry Form"
    >
      <div>
        <h3 className="text-lg font-bold text-[#176B9A]">Request Loan Consultancy</h3>
        <p className="text-xs text-[#64748B] mt-1">
          Share only your basic enquiry details below. Approval and terms are always subject to lender policy.
        </p>
      </div>

      {/* Anti-Sensitive Document Privacy Guard Banner */}
      <div className="rounded-xl bg-[#FBF6E9] border border-[#E8CF91] p-3 flex items-start gap-2.5 text-xs text-[#253447]">
        <ShieldAlert className="w-4 h-4 text-[#176B9A] shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          <strong>Data Minimisation Notice:</strong> Do not enter or send Aadhaar numbers, PAN numbers, bank account
          numbers, salary slips, bank statements, credit reports or property documents in this form.
        </p>
      </div>

      {/* Honeypot anti-spam field (visually hidden) */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="enquiry-website">Website</label>
        <input
          id="enquiry-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={websiteHoneypot}
          onChange={(e) => setWebsiteHoneypot(e.target.value)}
        />
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-start gap-2 text-xs text-rose-800"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="enquiry-name" className="block text-xs font-semibold text-[#253447] mb-1.5">
            Full Name <span className="text-rose-600">*</span>
          </label>
          <input
            id="enquiry-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
            className="w-full rounded-xl border border-[#E2EAF0] bg-white px-3.5 py-2.5 text-sm text-[#253447] placeholder:text-[#64748B]/70 focus:border-[#38A9E8] focus:outline-none focus:ring-2 focus:ring-[#38A9E8]/25"
          />
        </div>

        <div>
          <label htmlFor="enquiry-phone" className="block text-xs font-semibold text-[#253447] mb-1.5">
            Mobile Number (India) <span className="text-rose-600">*</span>
          </label>
          <input
            id="enquiry-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            maxLength={15}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            className="w-full rounded-xl border border-[#E2EAF0] bg-white px-3.5 py-2.5 text-sm text-[#253447] placeholder:text-[#64748B]/70 focus:border-[#38A9E8] focus:outline-none focus:ring-2 focus:ring-[#38A9E8]/25"
          />
        </div>

        <div>
          <label htmlFor="enquiry-city" className="block text-xs font-semibold text-[#253447] mb-1.5">
            City <span className="text-rose-600">*</span>
          </label>
          <input
            id="enquiry-city"
            name="city"
            type="text"
            required
            maxLength={80}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g., Latur, Pune, Mumbai"
            className="w-full rounded-xl border border-[#E2EAF0] bg-white px-3.5 py-2.5 text-sm text-[#253447] placeholder:text-[#64748B]/70 focus:border-[#38A9E8] focus:outline-none focus:ring-2 focus:ring-[#38A9E8]/25"
          />
        </div>

        <div>
          <label htmlFor="enquiry-loan-type" className="block text-xs font-semibold text-[#253447] mb-1.5">
            Loan Category <span className="text-rose-600">*</span>
          </label>
          <select
            id="enquiry-loan-type"
            name="loanType"
            value={loanType}
            onChange={(e) => setLoanType(e.target.value)}
            className="w-full rounded-xl border border-[#E2EAF0] bg-white px-3.5 py-2.5 text-sm text-[#253447] focus:border-[#38A9E8] focus:outline-none focus:ring-2 focus:ring-[#38A9E8]/25"
          >
            {ENQUIRY_LOAN_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="enquiry-amount" className="block text-xs font-semibold text-[#253447] mb-1.5">
          Approximate Loan Amount in ₹ <span className="text-[#64748B] font-normal">(Optional)</span>
        </label>
        <input
          id="enquiry-amount"
          name="requestedAmount"
          type="text"
          inputMode="numeric"
          maxLength={20}
          value={requestedAmount}
          onChange={(e) => setRequestedAmount(e.target.value)}
          placeholder="e.g., 1500000"
          className="w-full rounded-xl border border-[#E2EAF0] bg-white px-3.5 py-2.5 text-sm text-[#253447] placeholder:text-[#64748B]/70 focus:border-[#38A9E8] focus:outline-none focus:ring-2 focus:ring-[#38A9E8]/25"
        />
      </div>

      <div className="flex items-start gap-2.5 pt-1">
        <input
          id="enquiry-consent"
          name="consent"
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[#E2EAF0] text-[#176B9A] focus:ring-[#38A9E8]"
        />
        <label htmlFor="enquiry-consent" className="text-xs text-[#64748B] leading-relaxed">
          I consent to <strong className="text-[#253447]">{OFFICIAL_BUSINESS.name}</strong> contacting me by phone,
          WhatsApp or email regarding my loan enquiry, in accordance with the{' '}
          <Link href="/privacy" className="text-[#176B9A] underline hover:text-[#38A9E8]">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href="/disclaimer" className="text-[#176B9A] underline hover:text-[#38A9E8]">
            Disclaimer
          </Link>
          . I can withdraw consent at any time.
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#38A9E8] hover:bg-[#176B9A] disabled:opacity-60 text-white px-5 py-3 text-sm font-bold shadow-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#176B9A] focus-visible:ring-offset-2"
      >
        <Send className="w-4 h-4" aria-hidden="true" />
        <span>{submitting ? 'Submitting Enquiry...' : 'Submit Loan Enquiry'}</span>
      </button>
    </form>
  );
}
