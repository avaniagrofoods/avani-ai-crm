import { NextResponse } from 'next/server';
import {
  verifyMetaChallengeHandshake,
  verifyMetaPayloadSignature,
  processMetaLeadEnquiry,
  parseMetaWebhookPayload,
  persistMetaLeadToGoogleSheets
} from '@/lib/meta';
import { WebhookDeduplicationRegistry } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

const metaDeduplicationRegistry = new WebhookDeduplicationRegistry();
const localSeenEvents = new Set<string>();

/**
 * Meta Webhook Verification Handshake (GET)
 * Validates hub.mode === 'subscribe' and constant-time compares hub.verify_token
 * against META_WEBHOOK_VERIFY_TOKEN.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken = (process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.OMNIDIM_VERIFY_TOKEN || '').trim();
  const res = verifyMetaChallengeHandshake({
    mode,
    verifyToken: token,
    challenge,
    expectedVerifyToken: expectedToken
  });

  if (res.ok && res.challengeResponse) {
    return new NextResponse(res.challengeResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }
    });
  }

  return new NextResponse('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Meta Webhook Ingestion (POST)
 * Accepts verified Facebook Page, Instagram Business, and Meta Lead Ad events.
 * Enforces HMAC-SHA256 signature verification, event deduplication, DPDP consent,
 * and canonical Google Sheets CRM persistence (Zero MongoDB fallback).
 */
export async function POST(request: Request) {
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to read request body' }, { status: 400 });
  }

  // 1. Signature Verification
  const sigHeader = request.headers.get('x-hub-signature-256');
  const appSecret = process.env.META_APP_SECRET;

  if (appSecret || process.env.STRICT_META_WEBHOOK_VERIFICATION === 'true') {
    const sigCheck = verifyMetaPayloadSignature(rawBody, sigHeader, appSecret);
    if (!sigCheck.valid) {
      console.warn(`[Meta Webhook Security] Signature check failed: ${sigCheck.errorCode || 'INVALID_SIGNATURE'}`);
      return NextResponse.json(
        { success: false, error: sigCheck.errorCode || 'INVALID_META_WEBHOOK_SIGNATURE' },
        { status: 401 }
      );
    }
  }

  // 2. Parse JSON
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  // 3. Extract Lead / Messaging inputs
  const leadInputs = parseMetaWebhookPayload(body);
  if (leadInputs.length === 0) {
    return NextResponse.json({
      success: true,
      processed: 0,
      message: 'Acknowledged non-lead or unsupported Meta event'
    });
  }

  const results = [];

  for (const input of leadInputs) {
    // 4. In-memory and durable deduplication
    let isDup = false;
    try {
      const dedupeCheck = metaDeduplicationRegistry.isDuplicateOrRecord(input.eventId);
      isDup = dedupeCheck.duplicate;
    } catch {
      isDup = false;
    }

    if (isDup) {
      results.push({
        eventId: input.eventId,
        duplicate: true,
        sourcePlatform: input.sourcePlatform
      });
      continue;
    }

    // 5. Process lead enquiry
    const outcome = processMetaLeadEnquiry(input, localSeenEvents);

    // 6. Persist to Google Sheets if valid and not duplicate
    if (outcome.success && !outcome.duplicate) {
      try {
        const persistRes = await persistMetaLeadToGoogleSheets({ input, outcome });
        results.push({
          eventId: input.eventId,
          leadId: outcome.leadId,
          customerId: outcome.customerId,
          persisted: persistRes.persisted,
          sourcePlatform: outcome.sourcePlatform,
          canonicalLoanProduct: outcome.canonicalLoanProduct
        });
      } catch (err: any) {
        console.error(`[Meta Webhook] Google Sheets persistence error: ${err.message}`);
        results.push({
          eventId: input.eventId,
          leadId: outcome.leadId,
          customerId: outcome.customerId,
          persisted: false,
          error: err.message
        });
      }
    } else {
      results.push({
        eventId: input.eventId,
        success: outcome.success,
        duplicate: outcome.duplicate || false,
        error: outcome.errorCode,
        sourcePlatform: input.sourcePlatform
      });
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results
  });
}
