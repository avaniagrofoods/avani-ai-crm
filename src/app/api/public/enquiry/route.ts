import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { sanitizeErrorForLog } from '@/lib/aisensy';
import { extractClientIp } from '@/lib/auth-store';
import {
  CrmSheetsService,
  SheetsCrmError,
  findProhibitedSensitivePayloadKeys,
  normalizeMobileNumber,
  validateLoanCategory
} from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
  Pragma: 'no-cache'
};

const PUBLIC_ENQUIRY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const PUBLIC_ENQUIRY_MAX_PER_IP = 10;

const publicEnquiryHits = new Map<string, number[]>();

export function resetPublicEnquiryRateLimitForTesting(): void {
  publicEnquiryHits.clear();
}

function checkPublicEnquiryRateLimit(ip: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  const key = crypto
    .createHash('sha256')
    .update(`AVANI_PUB_ENQ_V1:${String(ip || 'loopback').trim().slice(0, 64)}`, 'utf8')
    .digest('hex')
    .slice(0, 16);

  const recent = (publicEnquiryHits.get(key) || []).filter((ts) => now - ts < PUBLIC_ENQUIRY_WINDOW_MS);
  if (recent.length >= PUBLIC_ENQUIRY_MAX_PER_IP) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((PUBLIC_ENQUIRY_WINDOW_MS - (now - oldest)) / 1000));
    publicEnquiryHits.set(key, recent);
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  publicEnquiryHits.set(key, recent);
  return { allowed: true };
}

/**
 * POST /api/public/enquiry
 *
 * Minimal public loan enquiry intake endpoint backed exclusively by Google Sheets
 * (CUSTOMERS, LEADS, CONSENTS, FOLLOWUPS).
 *
 * Security & Data Minimisation Controls:
 * - Rejects prohibited sensitive KYC/document/binary keys fail-closed (HTTP 400).
 * - Rejects automated bot honeypot submissions before writing to Google Sheets.
 * - Enforces per-IP sliding-window rate limiting (HTTP 429).
 * - Requires explicit DPDP consent (`consent === true` or `consentStatus === 'GRANTED'`).
 * - Supports optional `idempotencyKey` / `enquiryKey` for deterministic duplicate prevention.
 * - Strictly allowlists fields (ignores mass-assigned privileged keys).
 * - Never returns false success if Google Sheets persistence fails.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'INVALID_PAYLOAD', message: 'Invalid request payload.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // 1. Bot honeypot guard (fail closed without touching Sheets)
    const honeypotVal = String(body.website || body.company_website || body.honeypot || '').trim();
    if (honeypotVal.length > 0) {
      return NextResponse.json(
        { success: false, error: 'INVALID_REQUEST', message: 'Automated submission rejected.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // 2. Data minimisation boundary: reject prohibited KYC, document, or base64 attachment fields
    const prohibitedKeys = findProhibitedSensitivePayloadKeys(body);
    if (prohibitedKeys.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'PROHIBITED_SENSITIVE_DATA',
          message:
            'Sensitive KYC, banking, or document attachments are strictly prohibited on public enquiry forms. Submit basic contact and loan category details only.',
          rejectedFields: prohibitedKeys
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // 3. Per-IP sliding-window anti-spam rate limit
    const clientIp = extractClientIp(req);
    const rateCheck = checkPublicEnquiryRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'TOO_MANY_REQUESTS',
          message: 'Too many enquiry attempts from this network. Please wait and try again.'
        },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            'Retry-After': String(rateCheck.retryAfterSeconds)
          }
        }
      );
    }

    // 4. Strictly allowlisted minimal enquiry fields (ignore privileged keys like role/assignedAdvisorId/leadStatus)
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const loanTypeInput = String(body.loanType || '').trim();
    const city = body.city ? String(body.city).trim().slice(0, 80) : undefined;
    const requestedAmount = body.requestedAmount ?? body.requiredLoanAmount ?? '0';
    const rawIdempotencyKey = String(body.idempotencyKey || body.enquiryKey || '')
      .trim()
      .replace(/[^A-Za-z0-9._:-]/g, '')
      .slice(0, 64);
    const idempotencyKey = rawIdempotencyKey || undefined;

    if (!name || !phone || !loanTypeInput) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing mandatory fields: name, phone, and loanType are required.'
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    try {
      normalizeMobileNumber(phone);
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: 'INVALID_MOBILE', message: sanitizeErrorForLog(e?.message || 'Invalid mobile number.') },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const isConsentDenied = body.consentStatus === 'DENIED' || body.consent === false;
    if (isConsentDenied) {
      return NextResponse.json(
        {
          success: false,
          error: 'CONSENT_DENIED',
          message: 'DPDP Act Consent required: processing cannot proceed without applicant consent.'
        },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const isConsentExplicitlyGranted = body.consentStatus === 'GRANTED' || body.consent === true;
    if (!isConsentExplicitlyGranted) {
      return NextResponse.json(
        {
          success: false,
          error: 'CONSENT_REQUIRED',
          message: 'DPDP Act Consent required: missing consent. Provide explicit consentStatus="GRANTED" or consent=true.'
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // 5. Canonical Google Sheets connectivity & persistence (zero MongoDB fallback)
    await CrmSheetsService.assertHealthy();

    const { hydrated } = await CrmSheetsService.registerOrUpdateCustomerLead({
      name,
      phone,
      city,
      loanCategory: validateLoanCategory(loanTypeInput),
      requestedAmount,
      enquiryKey: idempotencyKey,
      leadStatus: 'NEW_ENQUIRY',
      leadSource: body.leadSource ? String(body.leadSource).slice(0, 60) : 'WEBSITE_PUBLIC_FORM',
      consentStatus: 'GRANTED',
      consentSource: 'WEBSITE_PUBLIC_FORM',
      isOptedOut: false
    });

    return NextResponse.json(
      {
        success: true,
        persisted: true,
        leadId: hydrated.leadId,
        customerId: hydrated.customerId,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        message: 'Thank you. Your loan enquiry has been registered safely.'
      },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json(
      {
        success: false,
        persisted: false,
        error: code,
        message: sanitizeErrorForLog(error?.message || 'Unable to register enquiry at this time.')
      },
      { status, headers: NO_STORE_HEADERS }
    );
  }
}
