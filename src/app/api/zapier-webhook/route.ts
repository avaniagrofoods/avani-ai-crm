import { NextResponse } from 'next/server';
import { requireAuth, verifySharedWebhookSecret } from '@/lib/auth';
import {
  ZapierIntegration,
  buildZapierIdempotencyKey,
  isZapierInboundAction,
  verifyZapierSignature
} from '@/lib/zapier-integration';
import {
  CrmSheetsService,
  consentRepository,
  customerRepository,
  followupRepository,
  normalizeMobileNumber,
  webhookEventRepository
} from '@/lib/google-sheets';
import { maskPhoneForLog } from '@/lib/safeguards';

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    success: true,
    integration: ZapierIntegration.getContractSummary()
  });
}

export async function POST(req: Request) {
  const webhookAuth = verifySharedWebhookSecret(
    req,
    ['ZAPIER_WEBHOOK_SECRET', 'INTERNAL_WORKER_SECRET'],
    ['x-zapier-secret', 'x-webhook-secret']
  );
  if (!webhookAuth.ok) return webhookAuth.response;

  try {
    const rawBody = await req.text();
    const signingSecret = (process.env.ZAPIER_WEBHOOK_SECRET || '').trim();
    const providedSig = req.headers.get('x-zapier-signature');
    if (providedSig && signingSecret && !verifyZapierSignature(rawBody, providedSig, signingSecret)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Zapier HMAC signature', code: 'INVALID_ZAPIER_SIGNATURE' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody || '{}');
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const action = body.action;
    if (!isZapierInboundAction(action)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unsupported or missing Zapier action',
          allowedActions: ZapierIntegration.getContractSummary().actions
        },
        { status: 400 }
      );
    }

    const eventIdRaw = String(body.eventId || req.headers.get('x-idempotency-key') || '').trim();
    const phone = String(body.phone || body.mobile || '').trim();
    if (!phone && action !== 'UPDATE_FOLLOWUP') {
      return NextResponse.json({ success: false, error: 'Valid phone number is required' }, { status: 400 });
    }

    const dedupeKey = eventIdRaw || buildZapierIdempotencyKey(action, String(body.leadId || phone || 'ANON'), rawBody.slice(0, 64));
    const webhookReg = await webhookEventRepository.registerWebhookEventIdempotent({
      event_id: dedupeKey,
      provider: 'Zapier',
      event_type: action,
      rawPayloadForHashOnly: { action, eventId: dedupeKey, phoneMasked: maskPhoneForLog(phone) }
    });

    if (webhookReg.duplicate) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        eventId: dedupeKey,
        message: 'Duplicate Zapier webhook action ignored idempotently'
      });
    }

    if (action === 'CREATE_ENQUIRY') {
      const mobile = normalizeMobileNumber(phone);
      const consentGranted = body.consentGranted === true || String(body.consentStatus || '').toUpperCase() === 'GRANTED';
      const result = await CrmSheetsService.registerOrUpdateCustomerLead({
        enquiryKey: dedupeKey,
        name: String(body.fullName || body.name || 'Zapier Lead').trim(),
        phone: mobile.e164,
        city: body.city ? String(body.city).trim() : undefined,
        loanCategory: String(body.loanProduct || body.loanType || 'Personal Loan').trim(),
        requestedAmount: body.requestedAmount,
        leadSource: 'ZAPIER_WORKFLOW',
        consentStatus: consentGranted ? 'GRANTED' : 'PENDING',
        consentSource: 'ZAPIER_WEBHOOK'
      });

      await webhookEventRepository.markWebhookStatus({ event_id: dedupeKey, processing_status: 'COMPLETED' });
      return NextResponse.json({
        success: true,
        action,
        eventId: dedupeKey,
        leadId: result.lead.lead_id,
        customerId: result.customer.customer_id
      });
    }

    if (action === 'UPDATE_FOLLOWUP') {
      const leadId = String(body.leadId || '').trim();
      const customerId = String(body.customerId || '').trim();
      if (!leadId || !customerId) {
        await webhookEventRepository.markWebhookStatus({
          event_id: dedupeKey,
          processing_status: 'FAILED',
          error_code: 'MISSING_LEAD_OR_CUSTOMER_ID'
        });
        return NextResponse.json({ success: false, error: 'leadId and customerId are required' }, { status: 400 });
      }

      const fup = await followupRepository.createOrUpdateFollowup({
        followup_id: body.followupId ? String(body.followupId) : undefined,
        lead_id: leadId,
        customer_id: customerId,
        followup_date: body.followupDate ? String(body.followupDate) : new Date(Date.now() + 86400000).toISOString(),
        followup_type: body.followupType ? String(body.followupType) : 'ZAPIER_TASK',
        followup_status: 'PENDING',
        short_notes: String(body.notes || 'Follow-up scheduled via Zapier integration').slice(0, 200)
      });

      await webhookEventRepository.markWebhookStatus({ event_id: dedupeKey, processing_status: 'COMPLETED' });
      return NextResponse.json({
        success: true,
        action,
        eventId: dedupeKey,
        followupId: fup.record.followup_id
      });
    }

    // RECORD_CONSENT_OPTOUT
    const mobile = normalizeMobileNumber(phone);
    const existingCustomer = await customerRepository.findByMobile(mobile.e164);
    if (existingCustomer) {
      await consentRepository.upsertConsent({
        customer_id: existingCustomer.customer_id,
        consent_status: 'WITHDRAWN',
        consent_source: 'ZAPIER_OPTOUT',
        channel: 'WHATSAPP',
        optout_status: 'OPTED_OUT'
      });
      await followupRepository.cancelPendingFollowupsForCustomerOrLead({
        customer_id: existingCustomer.customer_id
      });
    }

    await webhookEventRepository.markWebhookStatus({ event_id: dedupeKey, processing_status: 'COMPLETED' });
    return NextResponse.json({
      success: true,
      action,
      eventId: dedupeKey,
      optedOutRecorded: true
    });
  } catch (error: unknown) {
    console.error('[Zapier Webhook] Processing error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: 'Zapier webhook processing unavailable', retryable: true },
      { status: 503 }
    );
  }
}
