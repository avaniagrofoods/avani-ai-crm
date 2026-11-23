import { NextResponse } from 'next/server';
import {
  persistMessageEventToSheets,
  sanitizeErrorForLog,
  sendAiSensyWhatsApp
} from '@/lib/aisensy';
import { sendChatMitraMessage, classifyLoanCategory } from '@/lib/chatmitra';
import { AgentEngine } from '@/lib/ai-agent';
import { OptOutEngine } from '@/lib/optout-engine';
import { normalizeMessageStatus, canTransitionStatus } from '@/lib/message-status';
import { constantTimeEqualStrings } from '@/lib/auth';
import { evaluateWebhookReplyPolicy, maskPhoneForLog } from '@/lib/safeguards';
import {
  KNOWN_MEDIA_MESSAGE_TYPES,
  PersistenceState,
  isSupportedWorkerEventType,
  normalizeSupportedProvider,
  resolveInboundMessageType
} from '@/lib/messaging-contract';
import {
  CrmSheetsService,
  SheetsCrmError,
  UNRESOLVED_CUSTOMER_PREFIX,
  buildCanonicalMessageEventId,
  buildScopedUnresolvedCustomerId,
  consentRepository,
  customerMatchesPhone,
  customerRepository,
  isUnresolvedCustomerId,
  leadRepository,
  markIdentityReconciliationCompleted,
  messageEventRepository,
  stagePendingIdentityReconciliation,
  tryNormalizeRaw10,
  verifyCustomerAndLeadOwnership,
  webhookEventRepository
} from '@/lib/google-sheets';

const MEDIA_MESSAGE_TYPES = KNOWN_MEDIA_MESSAGE_TYPES;
const MIN_ROTATION_SECRET_LEN = 16;

/**
 * Verifies internal worker authentication against INTERNAL_WORKER_SECRET
 * (and optional INTERNAL_WORKER_SECRET_PREVIOUS during zero-downtime secret rotation).
 * Always fails closed when INTERNAL_WORKER_SECRET is unset; never falls back to a default secret.
 */
export function verifyInternalWorkerAuthHeader(authHeader?: string | null): boolean {
  const provided = String(authHeader || '').trim();
  const primary = String(process.env.INTERNAL_WORKER_SECRET || '').trim();
  if (!primary || !provided) return false;
  if (constantTimeEqualStrings(provided, primary)) return true;

  const previous = String(process.env.INTERNAL_WORKER_SECRET_PREVIOUS || '').trim();
  if (previous.length >= MIN_ROTATION_SECRET_LEN && constantTimeEqualStrings(provided, previous)) {
    return true;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('x-worker-auth')?.trim();
    if (!verifyInternalWorkerAuthHeader(authHeader)) {
      return NextResponse.json(
        { success: false, persisted: false, error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let payload: any;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
          error: 'INVALID_JSON',
          message: 'Worker request body must be valid JSON.'
        },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
          error: 'INVALID_PAYLOAD',
          message: 'Worker payload must be a JSON object.'
        },
        { status: 400 }
      );
    }

    const { eventId } = payload;
    const correlationId =
      (typeof payload.correlationId === 'string' && payload.correlationId.trim()) ||
      request.headers.get('x-correlation-id')?.trim() ||
      `WRK-${Date.now()}`;

    if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
          error: 'Missing eventId',
          correlationId
        },
        { status: 400 }
      );
    }

    // H-01 / R-07: Strictly validate explicit supported provider (zero silent 'ChatMitra' default)
    let normalizedProvider;
    try {
      normalizedProvider = normalizeSupportedProvider(payload.provider);
    } catch (provErr: any) {
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
          error: 'INVALID_PROVIDER',
          message: sanitizeErrorForLog(provErr?.message || 'Explicit supported provider is required.'),
          eventId,
          correlationId
        },
        { status: 400 }
      );
    }
    const canonicalProviderName = normalizedProvider.canonicalName;

    // D-03: Explicitly enumerate and validate supported worker event types (reject unknown / DIRECT_DISPATCH)
    if (!isSupportedWorkerEventType(payload.eventType)) {
      try {
        await CrmSheetsService.assertHealthy();
        const existingUnsupported = await webhookEventRepository.findById(eventId);
        if (existingUnsupported) {
          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'FAILED',
            error_code: 'UNSUPPORTED_EVENT'
          });
        }
      } catch {
        // Do not mask validation rejection when Sheets is offline
      }
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
          error: 'UNSUPPORTED_EVENT',
          message: `Unsupported worker eventType: "${String(payload.eventType || '')}". Supported types: INBOUND_MESSAGE, STATUS_UPDATE.`,
          eventId,
          correlationId,
          provider: canonicalProviderName
        },
        { status: 400 }
      );
    }
    const eventType = payload.eventType;

    // 1. Google Sheets Connectivity Guard (Zero MongoDB Fallback)
    await CrmSheetsService.assertHealthy();

    // 2. Atomic Lease / Idempotency Check against WEBHOOK_EVENTS
    let existingEvent = await webhookEventRepository.findById(eventId);
    if (
      existingEvent &&
      (existingEvent.processing_status === 'COMPLETED' ||
        existingEvent.processing_status === 'PROCESSING' ||
        existingEvent.processing_status === 'ARCHIVED_HISTORICAL')
    ) {
      console.log(`[Worker] Lease for ${eventId} already claimed/completed (${existingEvent.processing_status}). Bypassing.`);
      return NextResponse.json({
        success: true,
        persisted: false,
        bypassed: true,
        duplicate: true,
        persistenceState: 'DUPLICATE_ALREADY_PERSISTED' as PersistenceState,
        eventId,
        correlationId,
        provider: canonicalProviderName
      });
    }

    if (!existingEvent) {
      const reg = await webhookEventRepository.registerWebhookEventIdempotent({
        event_id: eventId,
        provider: canonicalProviderName,
        event_type: eventType,
        rawPayloadForHashOnly: payload
      });
      existingEvent = reg.record;
    }

    await webhookEventRepository.markWebhookStatus({
      event_id: eventId,
      processing_status: 'PROCESSING'
    });

    try {
      const mergedPayload = {
        ...(payload && typeof payload === 'object' ? payload : {}),
        archiveOnly:
          payload?.archiveOnly === true ||
          payload?.archiveOnly === 'true' ||
          payload?.data?.archiveOnly === true ||
          payload?.data?.archiveOnly === 'true',
        suppressAutoReply:
          payload?.suppressAutoReply === true ||
          payload?.suppressAutoReply === 'true' ||
          payload?.data?.suppressAutoReply === true ||
          payload?.data?.suppressAutoReply === 'true'
      };

      const replyPolicy = evaluateWebhookReplyPolicy({
        eventId,
        provider: canonicalProviderName,
        payload: mergedPayload,
        inboxRecord: existingEvent
      });

      if (replyPolicy.archiveOnly) {
        await webhookEventRepository.markWebhookStatus({
          event_id: eventId,
          processing_status: 'ARCHIVED_HISTORICAL'
        });
        return NextResponse.json({
          success: true,
          persisted: false,
          persistenceState: 'ARCHIVED_HISTORICAL' as PersistenceState,
          archivedOnly: true,
          suppressed: true,
          outboundDispatched: false,
          eventId,
          correlationId,
          provider: canonicalProviderName
        });
      }

      if (eventType === 'STATUS_UPDATE') {
        const {
          msgId,
          statusStr,
          customerId: payloadCustomerId,
          leadId: payloadLeadId,
          fromPhone: statusPhone
        } = payload.data || {};
        if (!msgId || !statusStr) {
          console.warn(`[Worker] Missing msgId or statusStr for STATUS_UPDATE on event ${eventId}`);
          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'FAILED',
            error_code: 'INVALID_STATUS_PAYLOAD'
          });
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
              error: 'INVALID_STATUS_PAYLOAD',
              message: 'STATUS_UPDATE requires non-empty msgId and statusStr.',
              eventId,
              correlationId,
              provider: canonicalProviderName
            },
            { status: 400 }
          );
        }

        const formattedStatus = normalizeMessageStatus(statusStr, 'outbound');
        const existingMsg = await messageEventRepository.findByProviderMessageId(
          msgId,
          canonicalProviderName
        );
        const nextStatus =
          !existingMsg || canTransitionStatus(existingMsg.delivery_status as any, formattedStatus)
            ? formattedStatus
            : existingMsg.delivery_status;

        const canonicalEventId =
          existingMsg?.event_id || buildCanonicalMessageEventId(canonicalProviderName, msgId);

        // D-01 + R-05 + Task 5H.35 F34-01:
        // Trust existing canonical MESSAGE_EVENTS row ONLY if caller-supplied identifiers do not contradict
        // its canonical owner; otherwise require strict phone + customer/lead ownership verification.
        let resolvedCustomerId: string | null = null;
        if (existingMsg && !isUnresolvedCustomerId(existingMsg.customer_id)) {
          const suppliedCustomerId =
            payloadCustomerId !== undefined && payloadCustomerId !== null
              ? String(payloadCustomerId).trim()
              : '';
          const suppliedPhone =
            statusPhone !== undefined && statusPhone !== null
              ? String(statusPhone).trim()
              : '';

          let ownershipConflictReason: string | null = null;
          if (suppliedCustomerId && suppliedCustomerId !== existingMsg.customer_id) {
            ownershipConflictReason = 'CUSTOMER_OWNERSHIP_MISMATCH';
          } else if (suppliedPhone) {
            const ownerRecord = await customerRepository.findById(existingMsg.customer_id);
            const normalizedStatusRaw10 = tryNormalizeRaw10(suppliedPhone);
            if (!normalizedStatusRaw10) {
              ownershipConflictReason = 'MISSING_OR_INVALID_PHONE';
            } else if (ownerRecord && !customerMatchesPhone(ownerRecord, normalizedStatusRaw10)) {
              ownershipConflictReason = 'CUSTOMER_MOBILE_MISMATCH';
            }
          }

          if (ownershipConflictReason) {
            await webhookEventRepository.markWebhookStatus({
              event_id: eventId,
              processing_status: 'FAILED',
              error_code: ownershipConflictReason
            });
            return NextResponse.json(
              {
                success: false,
                persisted: false,
                persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
                error: ownershipConflictReason,
                message: 'STATUS_UPDATE identity does not match canonical message event owner.',
                eventId,
                correlationId,
                provider: canonicalProviderName
              },
              { status: 400 }
            );
          }

          resolvedCustomerId = existingMsg.customer_id;
        } else {
          const verified = await verifyCustomerAndLeadOwnership({
            fromPhone: statusPhone ? String(statusPhone) : undefined,
            candidateCustomerId: payloadCustomerId ? String(payloadCustomerId) : undefined,
            candidateLeadId: payloadLeadId ? String(payloadLeadId) : undefined
          });
          // Task 5H.35 F34-01: Never allow forged/unverified caller-supplied customerId or leadId
          // on STATUS_UPDATE to attach to a victim customer or stage a spoofed identity.
          if (verified.rejectedCandidateCustomerId || verified.rejectedCandidateLeadId) {
            const rejectCode = verified.rejectionReason || 'IDENTITY_OWNERSHIP_MISMATCH';
            await webhookEventRepository.markWebhookStatus({
              event_id: eventId,
              processing_status: 'FAILED',
              error_code: rejectCode
            });
            return NextResponse.json(
              {
                success: false,
                persisted: false,
                persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
                error: rejectCode,
                message: 'STATUS_UPDATE rejected due to unverified or mismatched caller-supplied customer/lead identity.',
                eventId,
                correlationId,
                provider: canonicalProviderName
              },
              { status: 400 }
            );
          }
          if (verified.verified && verified.customerId) {
            resolvedCustomerId = verified.customerId;
          }
        }

        if (!resolvedCustomerId) {
          const scopedUnresolvedId =
            existingMsg?.customer_id &&
            existingMsg.customer_id.toUpperCase().startsWith(UNRESOLVED_CUSTOMER_PREFIX)
              ? existingMsg.customer_id
              : buildScopedUnresolvedCustomerId(canonicalProviderName, msgId, correlationId);

          await messageEventRepository.recordMessageEvent({
            event_id: canonicalEventId,
            customer_id: scopedUnresolvedId,
            provider: canonicalProviderName,
            message_type: existingMsg?.message_type || 'TEXT',
            direction: existingMsg?.direction || 'outbound',
            delivery_status: nextStatus,
            provider_message_id: msgId
          });

          // Durable pending-identity reconciliation checkpoint (Section 9)
          await stagePendingIdentityReconciliation({
            messageEventId: canonicalEventId,
            provider: canonicalProviderName,
            providerMessageId: msgId,
            fromPhone: statusPhone ? String(statusPhone) : undefined,
            eventType: 'STATUS_UPDATE',
            webhookEventId: eventId,
            correlationId,
            errorCode: 'CUSTOMER_IDENTITY_UNRESOLVED'
          }).catch(() => {});

          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'FAILED',
            error_code: 'CUSTOMER_IDENTITY_UNRESOLVED'
          });

          return NextResponse.json(
            {
              success: false,
              persisted: false,
              identityPending: true,
              persistenceState: 'PENDING_CUSTOMER_IDENTITY' as PersistenceState,
              error: 'CUSTOMER_IDENTITY_UNRESOLVED',
              message:
                'Customer identity not yet resolved for status callback; staged with per-message scoped marker and durable reconciliation checkpoint.',
              eventId,
              correlationId,
              provider: canonicalProviderName,
              messageEventId: canonicalEventId,
              customerId: scopedUnresolvedId
            },
            { status: 503 }
          );
        }

        const wasUnresolved = Boolean(existingMsg && isUnresolvedCustomerId(existingMsg.customer_id));
        const recorded = await messageEventRepository.recordMessageEvent({
          event_id: canonicalEventId,
          customer_id: resolvedCustomerId,
          provider: canonicalProviderName,
          message_type: existingMsg?.message_type || 'TEXT',
          direction: existingMsg?.direction || 'outbound',
          delivery_status: nextStatus,
          provider_message_id: msgId
        });

        if (wasUnresolved) {
          await markIdentityReconciliationCompleted(recorded.record.event_id).catch(() => {});
        }

        await webhookEventRepository.markWebhookStatus({
          event_id: eventId,
          processing_status: 'COMPLETED'
        });
        return NextResponse.json({
          success: true,
          persisted: true,
          persistenceState: 'PERSISTED' as PersistenceState,
          eventId,
          correlationId,
          provider: canonicalProviderName,
          messageEventId: recorded.record.event_id,
          customerId: recorded.record.customer_id,
          deliveryStatus: recorded.record.delivery_status
        });
      }

      if (eventType === 'INBOUND_MESSAGE') {
        const {
          message,
          fromPhone,
          msgId,
          profileName,
          customerId: forwardedCustomerId,
          leadId: forwardedLeadId
        } = payload.data || {};
        if (!message || !msgId || !fromPhone) {
          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'FAILED',
            error_code: 'INVALID_INBOUND_PAYLOAD'
          });
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
              error: 'INVALID_INBOUND_PAYLOAD',
              message: 'INBOUND_MESSAGE requires message, msgId, and fromPhone.',
              eventId,
              correlationId,
              provider: canonicalProviderName
            },
            { status: 400 }
          );
        }

        const mediaResolution = resolveInboundMessageType(message);
        if (!mediaResolution.valid) {
          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'FAILED',
            error_code: mediaResolution.error || 'INVALID_MEDIA_PAYLOAD'
          });
          return NextResponse.json(
            {
              success: false,
              persisted: false,
              persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
              error: mediaResolution.error || 'INVALID_MEDIA_PAYLOAD',
              message: 'Invalid inbound media payload rejected.',
              eventId,
              correlationId,
              provider: canonicalProviderName
            },
            { status: 400 }
          );
        }
        const msgType = mediaResolution.messageType;

        // TASK 5H.4 ZERO-DOCUMENT-STORAGE GUARD + TASK 5H.33 D-03 + TASK 5H.35 F34-04 EXPLICIT IGNORED_MEDIA CONTRACT:
        // Inbound media/sticker/document/unknown attachments are strictly ignored; never download, never store mediaId, never convert to text.
        if (mediaResolution.isMedia || MEDIA_MESSAGE_TYPES.has(msgType)) {
          const customer = fromPhone ? await customerRepository.findByMobile(fromPhone) : null;
          const customerResolved = Boolean(
            customer?.customer_id && !isUnresolvedCustomerId(customer.customer_id)
          );
          const mediaCustomerId = customerResolved
            ? customer!.customer_id
            : buildScopedUnresolvedCustomerId(canonicalProviderName, msgId, correlationId);

          const mediaRecord = await messageEventRepository.recordMessageEvent({
            event_id: buildCanonicalMessageEventId(canonicalProviderName, msgId),
            customer_id: mediaCustomerId,
            provider: canonicalProviderName,
            message_type: 'MEDIA_IGNORED',
            direction: 'inbound',
            delivery_status: 'MEDIA_ATTACHMENT_IGNORED',
            provider_message_id: msgId
          });
          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'COMPLETED'
          });
          return NextResponse.json({
            success: true,
            persisted: customerResolved,
            identityPending: !customerResolved,
            persistenceState: 'IGNORED_MEDIA' as PersistenceState,
            mediaRejected: true,
            documentCreated: false,
            eventId,
            correlationId,
            provider: canonicalProviderName,
            messageEventId: mediaRecord.record.event_id,
            customerId: mediaRecord.record.customer_id,
            message: 'Document and media attachment persistence is disabled under Task 5H.4.'
          });
        }

        let incomingText = '';
        if (msgType === 'text') {
          incomingText = message.text?.body || '';
        } else if (msgType === 'button') {
          incomingText = message.button?.text || message.button?.payload || '';
        } else if (msgType === 'interactive') {
          incomingText =
            message.interactive?.button_reply?.title ||
            message.interactive?.list_reply?.title ||
            message.interactive?.button_reply?.id ||
            '';
        } else if (typeof message === 'string') {
          incomingText = message;
        } else if (message.text && typeof message.text === 'string') {
          incomingText = message.text;
        }

        if (!incomingText) {
          incomingText = 'Namaste, I want to apply for a loan';
        }

        // Task 5H.33 D-01 defense-in-depth: strictly verify any forwarded customerId/leadId ownership
        // before passing into registerOrUpdateCustomerLead (never allow cross-customer lead reassignment).
        const verifiedIdentity = await verifyCustomerAndLeadOwnership({
          fromPhone,
          candidateCustomerId:
            typeof forwardedCustomerId === 'string' && forwardedCustomerId.trim()
              ? forwardedCustomerId.trim()
              : undefined,
          candidateLeadId:
            typeof forwardedLeadId === 'string' && forwardedLeadId.trim()
              ? forwardedLeadId.trim()
              : undefined
        });
        if (verifiedIdentity.rejectedCandidateCustomerId || verifiedIdentity.rejectedCandidateLeadId) {
          console.warn(
            `[Worker Security] Rejected unverified forwarded identity (${verifiedIdentity.rejectionReason || 'IDENTITY_UNVERIFIED'}) on ${eventId}`
          );
        }

        // Preserve any pre-existing non-GRANTED consent state (PENDING / DENIED / WITHDRAWN)
        const preExistingCustomer =
          verifiedIdentity.customer || (fromPhone ? await customerRepository.findByMobile(fromPhone) : null);
        const preExistingConsent = preExistingCustomer
          ? await consentRepository.findByCustomerId(preExistingCustomer.customer_id)
          : null;

        const classifiedLoan = classifyLoanCategory(incomingText);
        // Task 5H.35 F34-02: Preserve explicitly verified leadId and generic followups on existing lead,
        // while allowing a distinct specific loan category enquiry (confidence > 0.75) to create/update
        // its own deterministic logical lead rather than falsely merging unrelated loan products.
        const explicitLeadId =
          verifiedIdentity.verified && verifiedIdentity.leadExplicitlyVerified
            ? verifiedIdentity.leadId
            : undefined;
        const targetLeadId =
          explicitLeadId ||
          (classifiedLoan.confidence <= 0.75 && verifiedIdentity.verified ? verifiedIdentity.leadId : undefined);
        const targetLoanCategory =
          !explicitLeadId && classifiedLoan.confidence <= 0.75 && verifiedIdentity.lead?.loan_category
            ? verifiedIdentity.lead.loan_category
            : classifiedLoan.category;

        const { customer, lead, hydrated } = await CrmSheetsService.registerOrUpdateCustomerLead({
          leadId: targetLeadId,
          name: profileName || 'Customer',
          phone: fromPhone,
          loanCategory: targetLoanCategory,
          leadSource: 'WHATSAPP_INBOUND',
          ...(preExistingConsent?.consent_status ? { consentStatus: preExistingConsent.consent_status } : {})
        });

        await messageEventRepository.recordMessageEvent({
          event_id: buildCanonicalMessageEventId(canonicalProviderName, msgId),
          customer_id: customer.customer_id,
          provider: canonicalProviderName,
          message_type: 'TEXT',
          direction: 'inbound',
          delivery_status: 'RECEIVED',
          provider_message_id: msgId
        });

        const isChatMitra =
          normalizedProvider.key === 'CHATMITRA' ||
          (normalizedProvider.key !== 'META' && process.env.ACTIVE_WHATSAPP_PROVIDER === 'chatmitra');

        // Opt-Out Keywords (DPDP Act Compliance: STOP, UNSUBSCRIBE, थांबवा, रोकें)
        if (OptOutEngine.isOptOutMessage(incomingText)) {
          console.log(`[Worker] Opt-out keyword detected for ${maskPhoneForLog(fromPhone)}. Suppressing lead.`);
          await OptOutEngine.processOptOut({
            leadId: lead.lead_id,
            phone: fromPhone,
            messageText: incomingText,
            eventId,
            suppressAcknowledgement: true
          });

          const optOutAck =
            'You have been successfully unsubscribed from AVANI LOAN SERVICES updates. You will not receive any further automated messages. To re-subscribe, text START or contact Sachin Shinde at +91 72491 08474.';
          let outboundAckDispatched = false;
          let outboundAckEventId: string | undefined;
          let outboundAckSuppressedReason: string | undefined;

          if (!replyPolicy.canSendAnyProviderMessage) {
            outboundAckSuppressedReason = replyPolicy.suppressionReason;
            console.log(`[Worker] Outbound provider dispatch suppressed (${replyPolicy.suppressionReason}) for ${maskPhoneForLog(fromPhone)}.`);
          } else if (isChatMitra) {
            const cmRes = await sendChatMitraMessage({
              toPhone: fromPhone,
              messageText: optOutAck,
              leadId: lead.lead_id,
              correlationId
            });
            if (cmRes.status === 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT') {
              outboundAckSuppressedReason = 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT';
            } else if (!cmRes.success) {
              const failCode = cmRes.status || 'OUTBOUND_PROVIDER_FAILED';
              await webhookEventRepository.markWebhookStatus({
                event_id: eventId,
                processing_status: 'FAILED',
                error_code: failCode
              });
              return NextResponse.json(
                {
                  success: false,
                  persisted: false,
                  persistenceState: (cmRes.persistenceState || 'PROVIDER_REJECTED') as PersistenceState,
                  optedOut: true,
                  outboundDispatched: false,
                  eventId,
                  correlationId,
                  provider: canonicalProviderName,
                  error: failCode,
                  message: sanitizeErrorForLog(cmRes.error || 'Failed to dispatch ChatMitra opt-out acknowledgement')
                },
                { status: 502 }
              );
            } else if (cmRes.messageId) {
              const ackPersist = await persistMessageEventToSheets({
                payload: {
                  destination: fromPhone,
                  userName: profileName || 'Customer',
                  customerId: customer.customer_id,
                  leadId: lead.lead_id,
                  correlationId
                },
                formattedPhone: fromPhone,
                providerMessageId: cmRes.messageId,
                provider: 'ChatMitra',
                status: 'SENT',
                direction: 'outbound'
              });
              if (!ackPersist.persisted) {
                throw new SheetsCrmError({
                  code: 'GOOGLE_SHEETS_UNAVAILABLE',
                  message: 'Failed to persist ChatMitra outbound opt-out acknowledgement to Google Sheets',
                  httpStatus: 503,
                  retryable: true
                });
              }
              outboundAckDispatched = true;
              outboundAckEventId = ackPersist.eventId;
            } else {
              await webhookEventRepository.markWebhookStatus({
                event_id: eventId,
                processing_status: 'FAILED',
                error_code: 'UNKNOWN_PROVIDER_OUTCOME'
              });
              return NextResponse.json(
                {
                  success: false,
                  persisted: false,
                  persistenceState: 'UNKNOWN_PROVIDER_OUTCOME' as PersistenceState,
                  optedOut: true,
                  outboundDispatched: false,
                  eventId,
                  correlationId,
                  provider: canonicalProviderName,
                  error: 'UNKNOWN_PROVIDER_OUTCOME',
                  message: 'ChatMitra returned success for opt-out acknowledgement without a valid message identifier.'
                },
                { status: 502 }
              );
            }
          } else {
            const outRes = await sendAiSensyWhatsApp(
              {
                destination: fromPhone,
                userName: profileName || 'Customer',
                text: optOutAck,
                customerId: customer.customer_id,
                leadId: lead.lead_id,
                correlationId
              },
              correlationId
            );
            if (outRes.status === 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT') {
              // Opt-out IS durably saved; do not trigger webhook retry storms under live safety clamp
              outboundAckSuppressedReason = 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT';
            } else if (!outRes.success && outRes.persistenceFailed) {
              throw new SheetsCrmError({
                code: (outRes.persistenceErrorCode as any) || 'GOOGLE_SHEETS_UNAVAILABLE',
                message: outRes.error || 'Failed to persist outbound opt-out acknowledgement to Google Sheets',
                httpStatus: 503,
                retryable: true
              });
            } else if (!outRes.success) {
              const failCode = outRes.status || 'OUTBOUND_PROVIDER_FAILED';
              await webhookEventRepository.markWebhookStatus({
                event_id: eventId,
                processing_status: 'FAILED',
                error_code: failCode
              });
              return NextResponse.json(
                {
                  success: false,
                  persisted: false,
                  persistenceState: (outRes.persistenceState || 'PROVIDER_REJECTED') as PersistenceState,
                  optedOut: true,
                  outboundDispatched: false,
                  eventId,
                  correlationId,
                  provider: canonicalProviderName,
                  error: failCode,
                  message: sanitizeErrorForLog(outRes.error || 'Failed to dispatch outbound opt-out acknowledgement')
                },
                { status: 502 }
              );
            } else if (outRes.persisted !== true) {
              throw new SheetsCrmError({
                code: (outRes.persistenceErrorCode as any) || 'GOOGLE_SHEETS_UNAVAILABLE',
                message: outRes.error || 'Outbound opt-out acknowledgement was not persisted to Google Sheets',
                httpStatus: 503,
                retryable: true
              });
            } else {
              outboundAckDispatched = true;
              outboundAckEventId = outRes.eventId;
            }
          }

          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'COMPLETED'
          });
          return NextResponse.json({
            success: true,
            persisted: true,
            persistenceState: 'OPTED_OUT_SUPPRESSED' as PersistenceState,
            optedOut: true,
            outboundDispatched: outboundAckDispatched,
            outboundEventId: outboundAckEventId,
            ...(outboundAckSuppressedReason ? { outboundSuppressedReason: outboundAckSuppressedReason } : {}),
            eventId,
            correlationId,
            provider: canonicalProviderName,
            customerId: customer.customer_id,
            leadId: lead.lead_id
          });
        }

        // DPDP Guard: If already opted out, suppress AI replies
        if (hydrated.isOptedOut) {
          console.log(`[Worker DPDP Guard] Contact ${maskPhoneForLog(fromPhone)} is opted out. AI replies suppressed.`);
          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'COMPLETED'
          });
          return NextResponse.json({
            success: true,
            persisted: true,
            persistenceState: 'OPTED_OUT_SUPPRESSED' as PersistenceState,
            optedOutSuppressed: true,
            outboundDispatched: false,
            eventId,
            correlationId,
            provider: canonicalProviderName,
            customerId: customer.customer_id,
            leadId: lead.lead_id
          });
        }

        // Consent Eligibility Guard: Do not send customer-facing AI replies unless consent is explicitly GRANTED
        if (hydrated.consentStatus !== 'GRANTED') {
          console.log(
            `[Worker Consent Guard] Contact ${maskPhoneForLog(fromPhone)} has consentStatus=${hydrated.consentStatus}. AI replies suppressed.`
          );
          await webhookEventRepository.markWebhookStatus({
            event_id: eventId,
            processing_status: 'COMPLETED'
          });
          return NextResponse.json({
            success: true,
            persisted: true,
            persistenceState: 'CONSENT_DENIED' as PersistenceState,
            consentSuppressed: true,
            consentStatus: hydrated.consentStatus,
            outboundDispatched: false,
            eventId,
            correlationId,
            provider: canonicalProviderName,
            customerId: customer.customer_id,
            leadId: lead.lead_id
          });
        }

        let outboundDispatched = false;
        let outboundEventId: string | undefined;
        let outboundMessageId: string | undefined;

        if (!replyPolicy.canTriggerAutoReply) {
          await leadRepository.upsertLead({
            lead_id: lead.lead_id,
            customer_id: customer.customer_id,
            loan_category: lead.loan_category,
            requested_amount: lead.requested_amount,
            lead_status: 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP',
            lead_source: lead.lead_source,
            assigned_advisor_id: lead.assigned_advisor_id,
            priority: lead.priority
          });
        } else {
          const syntheticConversation = {
            conversationId: `CONV_${lead.lead_id}`,
            leadId: lead.lead_id,
            customerPhone: fromPhone,
            currentStage: lead.lead_status,
            currentState: lead.lead_status,
            optOutStatus: false,
            language: /[\u0900-\u097F]/.test(incomingText) ? 'hi' : 'en',
            context: {
              fullName: customer.customer_name,
              city: customer.city,
              loanProduct: lead.loan_category
            },
            history: [{ role: 'user', text: incomingText, timestamp: new Date() }]
          };

          let nextQuestion = '';
          let updatedState: string | undefined;
          try {
            const aiResult = await AgentEngine.processMessage(syntheticConversation, incomingText);
            nextQuestion = String(aiResult?.nextQuestion || '').trim();
            updatedState = aiResult?.updatedState;
          } catch (aiErr: any) {
            console.error(
              `[Worker AI Error for ${eventId}]: ${sanitizeErrorForLog(aiErr?.message || aiErr)}`
            );
            await webhookEventRepository
              .markWebhookStatus({
                event_id: eventId,
                processing_status: 'FAILED',
                error_code: 'AI_GENERATION_FAILED'
              })
              .catch(() => {});
            return NextResponse.json(
              {
                success: false,
                persisted: false,
                persistenceState: 'PERSISTENCE_FAILED' as PersistenceState,
                outboundDispatched: false,
                eventId,
                correlationId,
                provider: canonicalProviderName,
                error: 'AI_GENERATION_FAILED',
                message: 'AI response generation failed; no outbound message dispatched.'
              },
              { status: 500 }
            );
          }

          if (!nextQuestion) {
            await webhookEventRepository
              .markWebhookStatus({
                event_id: eventId,
                processing_status: 'FAILED',
                error_code: 'AI_EMPTY_REPLY'
              })
              .catch(() => {});
            return NextResponse.json(
              {
                success: false,
                persisted: false,
                persistenceState: 'PERSISTENCE_FAILED' as PersistenceState,
                outboundDispatched: false,
                eventId,
                correlationId,
                provider: canonicalProviderName,
                error: 'AI_EMPTY_REPLY',
                message: 'AI returned an empty reply; no outbound message dispatched.'
              },
              { status: 500 }
            );
          }

          await leadRepository.upsertLead({
            lead_id: lead.lead_id,
            customer_id: customer.customer_id,
            loan_category: syntheticConversation.context?.loanProduct || lead.loan_category,
            requested_amount: lead.requested_amount,
            lead_status: updatedState || lead.lead_status,
            lead_source: lead.lead_source,
            assigned_advisor_id: lead.assigned_advisor_id,
            priority: lead.priority
          });

          if (!replyPolicy.canSendAnyProviderMessage) {
            console.log(`[Worker] Outbound provider dispatch suppressed (${replyPolicy.suppressionReason}) for ${maskPhoneForLog(fromPhone)}.`);
          } else if (isChatMitra) {
            const cmRes = await sendChatMitraMessage({
              toPhone: fromPhone,
              messageText: nextQuestion,
              leadId: lead.lead_id,
              correlationId
            });
            if (!cmRes.success) {
              const failCode = cmRes.status || 'OUTBOUND_PROVIDER_FAILED';
              await webhookEventRepository.markWebhookStatus({
                event_id: eventId,
                processing_status: 'FAILED',
                error_code: failCode
              });
              return NextResponse.json(
                {
                  success: false,
                  persisted: false,
                  persistenceState: (cmRes.persistenceState || 'PROVIDER_REJECTED') as PersistenceState,
                  outboundDispatched: false,
                  eventId,
                  correlationId,
                  provider: canonicalProviderName,
                  customerId: customer.customer_id,
                  leadId: lead.lead_id,
                  error: failCode,
                  message: sanitizeErrorForLog(cmRes.error || 'Outbound ChatMitra dispatch failed')
                },
                { status: 502 }
              );
            }
            if (!cmRes.messageId) {
              await webhookEventRepository.markWebhookStatus({
                event_id: eventId,
                processing_status: 'FAILED',
                error_code: 'UNKNOWN_PROVIDER_OUTCOME'
              });
              return NextResponse.json(
                {
                  success: false,
                  persisted: false,
                  persistenceState: 'UNKNOWN_PROVIDER_OUTCOME' as PersistenceState,
                  outboundDispatched: false,
                  eventId,
                  correlationId,
                  provider: canonicalProviderName,
                  customerId: customer.customer_id,
                  leadId: lead.lead_id,
                  error: 'UNKNOWN_PROVIDER_OUTCOME',
                  message: 'ChatMitra returned success without a message identifier.'
                },
                { status: 502 }
              );
            }
            const cmPersist = await persistMessageEventToSheets({
              payload: {
                destination: fromPhone,
                userName: profileName || 'Valued Customer',
                customerId: customer.customer_id,
                leadId: lead.lead_id,
                correlationId
              },
              formattedPhone: fromPhone,
              providerMessageId: cmRes.messageId,
              provider: 'ChatMitra',
              status: 'SENT',
              direction: 'outbound'
            });
            if (!cmPersist.persisted) {
              throw new SheetsCrmError({
                code: 'GOOGLE_SHEETS_UNAVAILABLE',
                message: 'Failed to persist outbound ChatMitra reply to Google Sheets',
                httpStatus: 503,
                retryable: true
              });
            }
            outboundDispatched = true;
            outboundEventId = cmPersist.eventId;
            outboundMessageId = cmRes.messageId;
          } else {
            const outRes = await sendAiSensyWhatsApp(
              {
                destination: fromPhone,
                userName: profileName || 'Valued Customer',
                text: nextQuestion,
                customerId: customer.customer_id,
                leadId: lead.lead_id,
                correlationId
              },
              correlationId
            );
            if (!outRes.success && outRes.persistenceFailed) {
              throw new SheetsCrmError({
                code: (outRes.persistenceErrorCode as any) || 'GOOGLE_SHEETS_UNAVAILABLE',
                message: outRes.error || 'Failed to persist outbound Meta reply to Google Sheets',
                httpStatus: 503,
                retryable: true
              });
            }
            if (!outRes.success) {
              const failCode = outRes.status || 'OUTBOUND_PROVIDER_FAILED';
              await webhookEventRepository.markWebhookStatus({
                event_id: eventId,
                processing_status: 'FAILED',
                error_code: failCode
              });
              return NextResponse.json(
                {
                  success: false,
                  persisted: false,
                  persistenceState: (outRes.persistenceState || 'PROVIDER_REJECTED') as PersistenceState,
                  outboundDispatched: false,
                  eventId,
                  correlationId,
                  provider: canonicalProviderName,
                  customerId: customer.customer_id,
                  leadId: lead.lead_id,
                  error: failCode,
                  message: sanitizeErrorForLog(outRes.error || 'Outbound Meta provider dispatch failed')
                },
                { status: 502 }
              );
            }
            // Task 5H.33 D-03: Never ignore persisted: false from provider adapter
            if (outRes.persisted !== true) {
              throw new SheetsCrmError({
                code: (outRes.persistenceErrorCode as any) || 'GOOGLE_SHEETS_UNAVAILABLE',
                message: outRes.error || 'Outbound provider reply was not persisted to Google Sheets',
                httpStatus: 503,
                retryable: true
              });
            }
            outboundDispatched = true;
            outboundEventId = outRes.eventId;
            outboundMessageId = outRes.messageId;
          }
        }

        await webhookEventRepository.markWebhookStatus({
          event_id: eventId,
          processing_status: 'COMPLETED'
        });
        return NextResponse.json({
          success: true,
          persisted: true,
          persistenceState: 'PERSISTED' as PersistenceState,
          eventId,
          correlationId,
          provider: canonicalProviderName,
          customerId: customer.customer_id,
          leadId: lead.lead_id,
          outboundDispatched,
          outboundEventId,
          outboundMessageId
        });
      }

      // Defensive unreachable branch (eventType validated above; never claim persisted: true)
      await webhookEventRepository.markWebhookStatus({
        event_id: eventId,
        processing_status: 'FAILED',
        error_code: 'UNSUPPORTED_EVENT'
      });
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          persistenceState: 'UNSUPPORTED_EVENT' as PersistenceState,
          error: 'UNSUPPORTED_EVENT',
          eventId,
          correlationId,
          provider: canonicalProviderName
        },
        { status: 400 }
      );
    } catch (executionError: any) {
      console.error(
        `[Worker Execution Error for ${payload?.eventId}]: ${sanitizeErrorForLog(executionError)}`
      );
      await webhookEventRepository.markWebhookStatus({
        event_id: eventId,
        processing_status: 'FAILED',
        error_code: executionError instanceof SheetsCrmError ? executionError.code : 'WORKER_EXECUTION_ERROR'
      }).catch(() => {});
      if (executionError instanceof SheetsCrmError) {
        return NextResponse.json(
          {
            success: false,
            persisted: false,
            persistenceState: 'PERSISTENCE_FAILED' as PersistenceState,
            eventId,
            correlationId,
            provider: canonicalProviderName,
            error: executionError.code,
            message: sanitizeErrorForLog(executionError.message)
          },
          { status: executionError.httpStatus }
        );
      }
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          persistenceState: 'PERSISTENCE_FAILED' as PersistenceState,
          eventId,
          correlationId,
          provider: canonicalProviderName,
          error: 'Execution failed, marked FAILED'
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    if (err instanceof SheetsCrmError) {
      return NextResponse.json(
        {
          success: false,
          persisted: false,
          persistenceState: 'PERSISTENCE_FAILED' as PersistenceState,
          error: err.code,
          message: sanitizeErrorForLog(err.message)
        },
        { status: err.httpStatus }
      );
    }
    console.error(`Worker Global Error: ${sanitizeErrorForLog(err)}`);
    return NextResponse.json(
      {
        success: false,
        persisted: false,
        persistenceState: 'PERSISTENCE_FAILED' as PersistenceState,
        error: sanitizeErrorForLog(err)
      },
      { status: 500 }
    );
  }
}
