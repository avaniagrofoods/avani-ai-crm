import axios from 'axios';
import { evaluateAuthorizedTestRecipient, maskPhoneForLog } from './safeguards';
import { normalizeMessageStatus, canTransitionStatus } from './message-status';
import {
  PersistenceState,
  ProviderDispatchOutcome,
  normalizeSupportedProvider,
  validateProviderMessageId
} from './messaging-contract';
import {
  CrmSheetsService,
  SheetsCrmError,
  UNRESOLVED_CUSTOMER_PREFIX,
  buildCanonicalMessageEventId,
  buildScopedUnresolvedCustomerId,
  customerMatchesPhone,
  customerRepository,
  isUnresolvedCustomerId,
  markIdentityReconciliationCompleted,
  messageEventRepository,
  redactSensitiveKycPatterns,
  resolveTransportMode,
  stagePendingIdentityReconciliation,
  tryNormalizeRaw10,
  verifyCustomerAndLeadOwnership,
  type MessageEventRow
} from './google-sheets';

export interface AiSensyMessagePayload {
  destination: string;
  userName: string;
  templateName?: string;
  templateParams?: string[];
  tags?: string[];
  text?: string;
  customerId?: string;
  leadId?: string | { toString(): string };
  contactId?: string | { toString(): string };
  broadcastId?: string | { toString(): string };
  idempotencyKey?: string;
  correlationId?: string;
}

export interface AiSensyResponse {
  success: boolean;
  providerAccepted?: boolean;
  providerOutcome?: ProviderDispatchOutcome;
  persistenceState?: PersistenceState;
  messageId?: string;
  provider?: string;
  rawResponse?: any;
  error?: string;
  status?: string;
  httpStatus?: number;
  retryable?: boolean;
  reconciliationRequired?: boolean;
  persisted?: boolean;
  persistenceFailed?: boolean;
  persistenceErrorCode?: string;
  identityPending?: boolean;
  customerResolved?: boolean;
  reconciled?: boolean;
  eventId?: string;
  customerId?: string;
  duplicate?: boolean;
}

export interface MessagePersistenceResult {
  persisted: boolean;
  persistenceState: PersistenceState;
  customerResolved: boolean;
  identityPending: boolean;
  reconciled: boolean;
  duplicate: boolean;
  eventId: string;
  customerId: string;
  deliveryStatus: string;
  record: MessageEventRow;
  resolutionReason?: string;
}

/**
 * Redacts credentials, tokens, PAN/Aadhaar patterns, and raw mobile numbers
 * before emitting logs or returning error summaries.
 */
export function sanitizeErrorForLog(rawError: unknown): string {
  const raw =
    typeof rawError === 'string'
      ? rawError
      : rawError instanceof Error
        ? rawError.message
        : rawError && typeof rawError === 'object'
          ? JSON.stringify(rawError)
          : String(rawError ?? 'Unknown error');

  const firstLine = raw.split(/\r?\n\s+at\s+/)[0] || raw;
  const redacted = redactSensitiveKycPatterns(firstLine)
    .replace(/\r?\n/g, ' ')
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/\bEA[A-Za-z0-9]{16,}\b/g, '[REDACTED_META_TOKEN]')
    .replace(
      /(api_?key|access_?token|webhook_?secret|worker_?secret|x-worker-auth|x-webhook-signature|secret|password|authorization|token)\s*[:=]\s*["']?[^\s"',}&]+/gi,
      '$1=[REDACTED]'
    )
    .replace(/(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, (match) => maskPhoneForLog(match));

  return redacted.trim().slice(0, 240);
}

function normalizeOptionalId(val?: string | { toString(): string }): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

export interface CustomerIdentityResolution {
  resolved: boolean;
  customerId?: string;
  leadId?: string;
  source?: 'explicit' | 'lead_and_customer' | 'customer_mobile';
  reason?:
    | 'MISSING_OR_INVALID_PHONE'
    | 'LEAD_FOUND_CUSTOMER_NOT_FOUND'
    | 'CUSTOMER_NOT_FOUND'
    | 'CUSTOMER_ID_NOT_FOUND'
    | 'CUSTOMER_MOBILE_MISMATCH'
    | 'LEAD_NOT_FOUND'
    | 'LEAD_OWNERSHIP_MISMATCH';
}

/**
 * Resolves and VERIFIES the canonical Google Sheets customer_id for a message event
 * (Task 5H.31 R-05 + Task 5H.33 D-01):
 *   1. Candidate payload.customerId MUST exist in canonical CUSTOMERS and match formattedPhone when supplied.
 *   2. Candidate payload.leadId MUST exist in canonical LEADS and belong to a verified CUSTOMERS record
 *      matching formattedPhone when supplied (rejects orphaned or cross-customer leads).
 *   3. Canonical CUSTOMERS lookup via normalized mobile number.
 *
 * Strictly NEVER trusts unverified caller-supplied IDs, NEVER invents a CUST-<phone> identity,
 * and NEVER returns a shared `'UNKNOWN'` placeholder.
 */
export async function resolveCustomerIdentityForMessageEvent(
  payload: AiSensyMessagePayload,
  formattedPhone: string
): Promise<CustomerIdentityResolution> {
  const verified = await verifyCustomerAndLeadOwnership({
    fromPhone: formattedPhone || undefined,
    candidateCustomerId: normalizeOptionalId(payload.customerId) || undefined,
    candidateLeadId: normalizeOptionalId(payload.leadId) || undefined
  });

  if (verified.verified && verified.customerId) {
    const source: CustomerIdentityResolution['source'] =
      verified.source === 'verified_explicit_customer'
        ? 'explicit'
        : verified.source === 'verified_lead_owner'
          ? 'lead_and_customer'
          : 'customer_mobile';
    return {
      resolved: true,
      customerId: verified.customerId,
      leadId: verified.leadId,
      source
    };
  }

  return {
    resolved: false,
    leadId: normalizeOptionalId(payload.leadId) || undefined,
    reason: verified.rejectionReason || 'CUSTOMER_NOT_FOUND'
  };
}

/**
 * Canonical Google Sheets message-event persistence (Task 5H.29 F-02 + Task 5H.31 R-05/R-07 + Task 5H.33).
 *
 * - Writes exclusively through Google Sheets messageEventRepository (zero MongoDB/PostgreSQL).
 * - Requires an explicit, supported messaging provider (H-01 / R-07).
 * - Stores only the 8 canonical MESSAGE_EVENTS metadata columns (zero text body, media, PII docs, or secrets).
 * - Uses provider-scoped deterministic event_id (`MSG_<PROVIDER>_<PROVIDER_MESSAGE_ID>`), preventing
 *   cross-provider collisions while preserving deterministic same-provider legacy compatibility.
 * - Eliminates shared `'UNKNOWN'` customer placeholder: unresolved customer identity stages a
 *   per-message scoped `UNRESOLVED_<PROVIDER>_<hash>` marker AND durable reconciliation checkpoint in
 *   SYSTEM_CONFIG, returns `persisted: false, persistenceState: 'PENDING_CUSTOMER_IDENTITY'`
 *   (fail-closed, zero false success), and reconciles cleanly in-place on retry without duplicates.
 */
export async function persistMessageEventToSheets(params: {
  payload: AiSensyMessagePayload;
  formattedPhone: string;
  providerMessageId: string;
  provider: string;
  status: string;
  direction?: 'inbound' | 'outbound';
  messageType?: string;
  existingEventId?: string;
  webhookEventId?: string;
}): Promise<MessagePersistenceResult> {
  await CrmSheetsService.assertHealthy();

  const normalizedProv = normalizeSupportedProvider(params.provider);
  const canonicalProviderName = normalizedProv.canonicalName;
  const direction = params.direction || 'outbound';
  const normalizedStatus = normalizeMessageStatus(params.status, direction);
  const providerMsgId = String(params.providerMessageId || '').trim();
  if (!providerMsgId) {
    throw new SheetsCrmError({
      code: 'GOOGLE_SHEETS_VALIDATION_FAILED',
      message: 'providerMessageId is required to persist a MESSAGE_EVENTS record.',
      httpStatus: 400,
      retryable: false
    });
  }

  const existingMsg = await messageEventRepository.findByProviderMessageId(
    providerMsgId,
    canonicalProviderName
  );
  const nextStatus =
    !existingMsg || canTransitionStatus(existingMsg.delivery_status, normalizedStatus)
      ? normalizedStatus
      : existingMsg.delivery_status;

  const existingHasResolvedCustomer = Boolean(
    existingMsg && !isUnresolvedCustomerId(existingMsg.customer_id)
  );

  // Task 5H.35 F34-01 defense-in-depth: an already-resolved MESSAGE_EVENTS row cannot be
  // mutated or re-bound using a mismatched customerId or a different customer's phone.
  if (existingHasResolvedCustomer && existingMsg) {
    const suppliedCustomerId = normalizeOptionalId(params.payload.customerId);
    if (suppliedCustomerId && suppliedCustomerId !== existingMsg.customer_id) {
      throw new SheetsCrmError({
        code: 'GOOGLE_SHEETS_VALIDATION_FAILED',
        message: `Message event ownership conflict: event "${existingMsg.event_id}" belongs to another customer.`,
        httpStatus: 400,
        retryable: false
      });
    }
    const rawPhoneStr = String(params.formattedPhone || '').trim();
    if (rawPhoneStr) {
      const ownerRecord = await customerRepository.findById(existingMsg.customer_id);
      if (ownerRecord) {
        const expectedRaw10 = tryNormalizeRaw10(rawPhoneStr);
        if (!customerMatchesPhone(ownerRecord, expectedRaw10)) {
          throw new SheetsCrmError({
            code: 'GOOGLE_SHEETS_VALIDATION_FAILED',
            message: `Message event ownership conflict: phone does not match canonical owner of event "${existingMsg.event_id}".`,
            httpStatus: 400,
            retryable: false
          });
        }
      }
    }
  }

  let customerResolved = existingHasResolvedCustomer;
  let customerIdToStore = existingHasResolvedCustomer ? existingMsg!.customer_id : '';
  let resolutionReason: string | undefined;

  if (!existingHasResolvedCustomer) {
    const identity = await resolveCustomerIdentityForMessageEvent(params.payload, params.formattedPhone);
    if (identity.resolved && identity.customerId) {
      customerResolved = true;
      customerIdToStore = identity.customerId;
    } else {
      customerResolved = false;
      resolutionReason = identity.reason || 'CUSTOMER_NOT_FOUND';
      customerIdToStore =
        existingMsg?.customer_id &&
        existingMsg.customer_id.toUpperCase().startsWith(UNRESOLVED_CUSTOMER_PREFIX)
          ? existingMsg.customer_id
          : buildScopedUnresolvedCustomerId(
              canonicalProviderName,
              providerMsgId,
              params.payload.correlationId
            );
    }
  }

  const reconciled = Boolean(
    existingMsg && isUnresolvedCustomerId(existingMsg.customer_id) && customerResolved
  );

  // Clean idempotent duplicate short-circuit (ONLY when identity state and status are unchanged)
  if (
    existingMsg &&
    existingMsg.provider_message_id === providerMsgId &&
    existingMsg.delivery_status === nextStatus &&
    !reconciled &&
    existingMsg.customer_id === customerIdToStore
  ) {
    if (!customerResolved) {
      await stagePendingIdentityReconciliation({
        messageEventId: existingMsg.event_id,
        provider: canonicalProviderName,
        providerMessageId: providerMsgId,
        fromPhone: params.formattedPhone,
        eventType: direction === 'inbound' ? 'INBOUND_MESSAGE' : 'OUTBOUND_SEND',
        webhookEventId: params.webhookEventId,
        correlationId: params.payload.correlationId,
        errorCode: resolutionReason || 'CUSTOMER_IDENTITY_UNRESOLVED'
      }).catch(() => {});
    }
    return {
      persisted: customerResolved,
      persistenceState: customerResolved ? 'DUPLICATE_ALREADY_PERSISTED' : 'PENDING_CUSTOMER_IDENTITY',
      customerResolved,
      identityPending: !customerResolved,
      reconciled: false,
      duplicate: true,
      eventId: existingMsg.event_id,
      customerId: existingMsg.customer_id,
      deliveryStatus: existingMsg.delivery_status,
      record: existingMsg,
      resolutionReason
    };
  }

  const canonicalEventId = buildCanonicalMessageEventId(canonicalProviderName, providerMsgId);
  const deterministicEventId =
    existingMsg?.event_id ||
    (params.existingEventId && params.existingEventId === canonicalEventId
      ? params.existingEventId
      : canonicalEventId);

  const messageType =
    params.messageType ||
    existingMsg?.message_type ||
    (params.payload.templateName ? 'TEMPLATE' : 'TEXT');

  const { record, created } = await messageEventRepository.recordMessageEvent({
    event_id: deterministicEventId,
    customer_id: customerIdToStore,
    provider: canonicalProviderName,
    message_type: messageType,
    direction,
    delivery_status: nextStatus,
    provider_message_id: providerMsgId
  });

  if (!customerResolved) {
    await stagePendingIdentityReconciliation({
      messageEventId: record.event_id,
      provider: canonicalProviderName,
      providerMessageId: providerMsgId,
      fromPhone: params.formattedPhone,
      eventType: direction === 'inbound' ? 'INBOUND_MESSAGE' : 'OUTBOUND_SEND',
      webhookEventId: params.webhookEventId,
      correlationId: params.payload.correlationId,
      errorCode: resolutionReason || 'CUSTOMER_IDENTITY_UNRESOLVED'
    }).catch(() => {});
  } else if (reconciled) {
    await markIdentityReconciliationCompleted(record.event_id).catch(() => {});
  }

  const isDuplicate = !created && !reconciled;
  const persistenceState: PersistenceState = !customerResolved
    ? 'PENDING_CUSTOMER_IDENTITY'
    : isDuplicate
      ? 'DUPLICATE_ALREADY_PERSISTED'
      : 'PERSISTED';

  return {
    persisted: customerResolved,
    persistenceState,
    customerResolved,
    identityPending: !customerResolved,
    reconciled,
    duplicate: isDuplicate,
    eventId: record.event_id,
    customerId: record.customer_id,
    deliveryStatus: record.delivery_status,
    record,
    resolutionReason
  };
}

/**
 * Triggers OmniDM WhatsApp Campaign API (Campaign #22)
 */
export async function sendOmniDMWhatsApp(phone: string, name: string): Promise<any> {
  if (process.env.PROVIDER_MODE !== 'live') {
    return { success: false, error: 'OmniDM WhatsApp Campaign API blocked in non-live mode' };
  }
  const recipientCheck = evaluateAuthorizedTestRecipient(phone);
  if (!recipientCheck.allowed) {
    console.error(`[OmniDM WhatsApp Safety Clamp] Blocked live dispatch to ${recipientCheck.targetMasked}: ${recipientCheck.reason}`);
    return { success: false, error: recipientCheck.message };
  }
  const omnidmKey = (process.env.OMNIDIM_API_KEY || '').trim();
  if (!omnidmKey) {
    return { success: false, error: 'OMNIDIM_API_KEY is not configured' };
  }

  let formattedPhone = phone.trim();
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = formattedPhone.length === 10 ? '+91' + formattedPhone : '+' + formattedPhone;
  }

  try {
    const res = await axios.post(
      'https://omnidim.io/api/v1/whatsapp/campaign/22/contact',
      {
        phone_number: formattedPhone,
        "$name": name || 'Valued Customer'
      },
      {
        headers: {
          'Authorization': `Bearer ${omnidmKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    console.log(`[OmniDM WhatsApp Campaign 22 Success] Phone: ${maskPhoneForLog(formattedPhone)}`);
    return { success: true, data: res.data };
  } catch (err: any) {
    const safeErr = sanitizeErrorForLog(err?.response?.data || err?.message || err);
    console.warn(`[OmniDM WhatsApp Campaign 22 Warning]: ${safeErr}`);
    return { success: false, error: safeErr };
  }
}

/**
 * Primary WABA Dispatcher using AiSensy Official API + OmniDM & Meta Cloud Fallbacks.
 * Task 5H.29 F-02: All active message persistence routes exclusively through Google Sheets
 * `messageEventRepository` (zero MongoDB and zero PostgreSQL dependencies).
 */
export async function sendAiSensyWhatsApp(
  payload: AiSensyMessagePayload,
  existingMessageId: string
): Promise<AiSensyResponse> {
  const omnidmKey = (process.env.OMNIDIM_API_KEY || '').trim();
  const apiKey = (
    process.env.AISENCY_WABA_API_KEY ||
    process.env.AISENSY_WABA_API_KEY ||
    process.env.AISENSY_API_KEY ||
    ''
  ).trim();
  const automationNumber = process.env.WABA_AUTOMATION_NUMBER || '+917249108474';

  let phone = String(payload.destination || '').trim();
  if (phone && !phone.startsWith('+')) {
    phone = phone.length === 10 ? '+91' + phone : '+' + phone;
  }

  console.log(`[WhatsApp Dispatch] Sending to ${maskPhoneForLog(phone)} from Automation WABA: ${maskPhoneForLog(automationNumber)}`);

  // MOCK PROVIDER SAFETY GATE (Zero MongoDB, Zero PostgreSQL, Zero live provider calls)
  if (process.env.PROVIDER_MODE !== 'live') {
    const mockMsgId = 'mock_wamid_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    if (resolveTransportMode() === 'MOCK_IN_MEMORY') {
      try {
        const persisted = await persistMessageEventToSheets({
          payload,
          formattedPhone: phone,
          providerMessageId: mockMsgId,
          provider: 'MockProvider',
          status: 'SENT',
          direction: 'outbound'
        });
        if (!persisted.persisted && persisted.identityPending) {
          console.warn(`[Provider MOCK] Unresolved customer identity for ${persisted.eventId}; failing closed without false persistence success.`);
          return {
            success: false,
            providerAccepted: true,
            providerOutcome: 'MOCK_ACCEPTED',
            persistenceState: 'PENDING_CUSTOMER_IDENTITY',
            messageId: mockMsgId,
            provider: 'MockProvider',
            status: 'PENDING_CUSTOMER_IDENTITY',
            persisted: false,
            persistenceFailed: true,
            identityPending: true,
            customerResolved: false,
            persistenceErrorCode: 'CUSTOMER_IDENTITY_UNRESOLVED',
            eventId: persisted.eventId,
            customerId: persisted.customerId,
            duplicate: persisted.duplicate,
            error: `Customer identity unresolved (${persisted.resolutionReason || 'CUSTOMER_NOT_FOUND'}); staged with scoped placeholder for reconciliation.`
          };
        }
        console.log(`[Provider MOCK] Safety gate triggered. Recorded in Sheets mock: ${persisted.eventId}`);
        return {
          success: true,
          providerAccepted: true,
          providerOutcome: 'MOCK_ACCEPTED',
          persistenceState: persisted.persistenceState,
          messageId: mockMsgId,
          provider: 'MockProvider',
          status: persisted.deliveryStatus,
          persisted: true,
          customerResolved: true,
          identityPending: false,
          reconciled: persisted.reconciled,
          eventId: persisted.eventId,
          customerId: persisted.customerId,
          duplicate: persisted.duplicate
        };
      } catch (err: any) {
        const safeErr = sanitizeErrorForLog(err?.message || err);
        console.error(`[Provider MOCK Error] Sheets persistence failure: ${safeErr}`);
        return {
          success: false,
          providerAccepted: true,
          providerOutcome: 'MOCK_ACCEPTED',
          persistenceState: 'PERSISTENCE_FAILED',
          messageId: mockMsgId,
          provider: 'MockProvider',
          status: 'PERSISTENCE_FAILED',
          persisted: false,
          persistenceFailed: true,
          persistenceErrorCode: err instanceof SheetsCrmError ? err.code : 'GOOGLE_SHEETS_UNAVAILABLE',
          error: safeErr
        };
      }
    }
    return {
      success: true,
      providerAccepted: false,
      providerOutcome: 'MOCK_ACCEPTED',
      persistenceState: 'PERSISTENCE_FAILED',
      messageId: mockMsgId,
      provider: 'MockProvider',
      status: 'MOCK_NOT_PERSISTED',
      persisted: false
    };
  }

  // MANDATORY SAFETY INVARIANT: Live WhatsApp dispatch restricted to authorized test recipient
  const recipientCheck = evaluateAuthorizedTestRecipient(phone);
  if (!recipientCheck.allowed) {
    console.error(`[AiSensy Safety Clamp] Blocked live dispatch to ${recipientCheck.targetMasked}: ${recipientCheck.reason}`);
    return {
      success: false,
      providerAccepted: false,
      providerOutcome: 'BLOCKED_BY_SAFEGUARD',
      persistenceState: 'PROVIDER_REJECTED',
      status: 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT',
      error: recipientCheck.message,
      retryable: false,
      persisted: false
    };
  }

  const persistOrFailSafe = async (
    providerMessageId: string,
    provider: string,
    status: string,
    rawResponse?: any
  ): Promise<AiSensyResponse> => {
    try {
      const persisted = await persistMessageEventToSheets({
        payload,
        formattedPhone: phone,
        providerMessageId,
        provider,
        status,
        direction: 'outbound'
      });
      if (!persisted.persisted && persisted.identityPending) {
        console.warn(`[WhatsApp Sheets Persistence Pending][${provider}]: customer identity unresolved (${persisted.resolutionReason || 'CUSTOMER_NOT_FOUND'}) for ${persisted.eventId}`);
        return {
          success: false,
          providerAccepted: true,
          providerOutcome: 'PROVIDER_ACCEPTED',
          persistenceState: 'PENDING_CUSTOMER_IDENTITY',
          messageId: providerMessageId,
          provider,
          rawResponse,
          status: 'PENDING_CUSTOMER_IDENTITY',
          persisted: false,
          persistenceFailed: true,
          identityPending: true,
          customerResolved: false,
          reconciliationRequired: true,
          retryable: false,
          persistenceErrorCode: 'CUSTOMER_IDENTITY_UNRESOLVED',
          eventId: persisted.eventId,
          customerId: persisted.customerId,
          duplicate: persisted.duplicate,
          error: `Customer identity unresolved (${persisted.resolutionReason || 'CUSTOMER_NOT_FOUND'}); event staged for safe retry reconciliation.`
        };
      }
      return {
        success: true,
        providerAccepted: true,
        providerOutcome: 'PROVIDER_ACCEPTED',
        persistenceState: persisted.persistenceState,
        messageId: providerMessageId,
        provider,
        rawResponse,
        status: persisted.deliveryStatus,
        persisted: true,
        customerResolved: true,
        identityPending: false,
        reconciled: persisted.reconciled,
        eventId: persisted.eventId,
        customerId: persisted.customerId,
        duplicate: persisted.duplicate
      };
    } catch (persistErr: any) {
      const safeErr = sanitizeErrorForLog(persistErr?.message || persistErr);
      const errCode = persistErr instanceof SheetsCrmError ? persistErr.code : 'GOOGLE_SHEETS_UNAVAILABLE';
      console.error(`[WhatsApp Sheets Persistence Error][${provider}] (${errCode}): ${safeErr}`);
      return {
        success: false,
        providerAccepted: true,
        providerOutcome: 'PROVIDER_ACCEPTED',
        persistenceState: 'PERSISTENCE_FAILED',
        messageId: providerMessageId,
        provider,
        rawResponse,
        status: 'PERSISTENCE_FAILED',
        persisted: false,
        persistenceFailed: true,
        reconciliationRequired: true,
        retryable: false,
        persistenceErrorCode: errCode,
        error: `Google Sheets CRM persistence failed (${errCode}): ${safeErr}`
      };
    }
  };

  const recordFailedDispatchSafe = async (
    provider: string,
    failureStatus: string,
    safeErrStr: string,
    meta?: {
      providerOutcome?: ProviderDispatchOutcome;
      persistenceState?: PersistenceState;
      httpStatus?: number;
      retryable?: boolean;
      reconciliationRequired?: boolean;
      rawResponse?: any;
    }
  ): Promise<AiSensyResponse> => {
    // Task 5H.33 D-02: Never fabricate a timestamp message ID when no reliable correlation key exists
    const reliableErrKey =
      normalizeOptionalId(payload.idempotencyKey) ||
      normalizeOptionalId(existingMessageId) ||
      normalizeOptionalId(payload.correlationId);
    const providerOutcome = meta?.providerOutcome || 'PROVIDER_REJECTED';
    const persistenceState = meta?.persistenceState || 'PROVIDER_REJECTED';
    const auditDeliveryStatus =
      failureStatus === 'UNKNOWN_PROVIDER_OUTCOME' ? 'UNKNOWN' : failureStatus;
    let eventId: string | undefined;

    if (reliableErrKey) {
      const safeKey = reliableErrKey.replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 64);
      const errMsgId = `${provider.toLowerCase()}_err_${safeKey}`;
      try {
        const verifiedIdentity = await resolveCustomerIdentityForMessageEvent(payload, phone);
        if (verifiedIdentity.resolved && verifiedIdentity.customerId) {
          const res = await persistMessageEventToSheets({
            payload: { ...payload, customerId: verifiedIdentity.customerId },
            formattedPhone: phone,
            providerMessageId: errMsgId,
            provider,
            status: auditDeliveryStatus,
            direction: 'outbound'
          });
          eventId = res.eventId;
        }
      } catch (persistErr: any) {
        console.warn(`[WhatsApp Error Event Persistence Skipped][${provider}]: ${sanitizeErrorForLog(persistErr?.message || persistErr)}`);
      }
    }

    return {
      success: false,
      providerAccepted: false,
      providerOutcome,
      persistenceState,
      provider,
      status: failureStatus,
      httpStatus: meta?.httpStatus,
      retryable: meta?.retryable ?? false,
      reconciliationRequired: meta?.reconciliationRequired ?? false,
      persisted: false,
      eventId,
      rawResponse: meta?.rawResponse,
      error: safeErrStr
    };
  };

  // 1. Primary: AiSensy WABA Campaign API (Templates only)
  if (apiKey && !payload.text) {
    try {
      const response = await axios.post(
        'https://backend.aisensy.com/campaign/t1/api/v2',
        {
          apiKey: apiKey,
          campaignName: payload.templateName || 'avani_loan_intro_v2',
          destination: phone,
          userName: payload.userName,
          templateParams:
            payload.templateParams && payload.templateParams.length === 1
              ? payload.templateParams
              : [payload.userName],
          source: 'AVANI AI CRM',
          tags: payload.tags || ['Lead', 'Avani_Finserv']
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      if (
        response.data &&
        (response.data.success === 'true' ||
          response.data.success === true ||
          response.data.submitted_message_id)
      ) {
        // Task 5H.33 D-02: Never fabricate timestamp fallback IDs
        const idCheck = validateProviderMessageId(response.data.submitted_message_id, 'AiSensy');
        if (!idCheck.valid || !idCheck.value) {
          const errMsg = `AiSensy returned HTTP ${response.status || 200} without a valid submitted_message_id (${idCheck.reason || 'MISSING'}); send outcome ambiguous, do not blindly resend.`;
          console.error(`[AiSensy Response Validation Error]: ${errMsg}`);
          return recordFailedDispatchSafe('AiSensy', 'UNKNOWN_PROVIDER_OUTCOME', errMsg, {
            providerOutcome: 'UNKNOWN_PROVIDER_OUTCOME',
            persistenceState: 'UNKNOWN_PROVIDER_OUTCOME',
            httpStatus: response.status || 200,
            retryable: false,
            reconciliationRequired: true,
            rawResponse: response.data
          });
        }
        return persistOrFailSafe(idCheck.value, 'AiSensy', 'API_ACCEPTED', response.data);
      }

      const errMsg = `AiSensy returned HTTP ${response.status || 200} with unrecognized acceptance payload; send outcome ambiguous.`;
      console.error(`[AiSensy Response Validation Error]: ${errMsg}`);
      return recordFailedDispatchSafe('AiSensy', 'UNKNOWN_PROVIDER_OUTCOME', errMsg, {
        providerOutcome: 'UNKNOWN_PROVIDER_OUTCOME',
        persistenceState: 'UNKNOWN_PROVIDER_OUTCOME',
        httpStatus: response.status || 200,
        retryable: false,
        reconciliationRequired: true,
        rawResponse: response.data
      });
    } catch (error: any) {
      const safeErr = sanitizeErrorForLog(error?.response?.data || error?.message || error);
      const httpStatus = typeof error?.response?.status === 'number' ? error.response.status : undefined;
      const isTimeout =
        error?.code === 'ECONNABORTED' ||
        error?.code === 'ETIMEDOUT' ||
        String(error?.message || '').toLowerCase().includes('timeout');
      const isBalanceError =
        safeErr.toLowerCase().includes('balance') ||
        safeErr.toLowerCase().includes('credit') ||
        safeErr.toLowerCase().includes('plan');
      const status = isBalanceError
        ? 'BALANCE_BLOCKED'
        : isTimeout
          ? 'WEBHOOK_TIMEOUT'
          : 'FAILED';

      console.warn(`[AiSensy API Warning]: ${status} - ${safeErr}`);
      return recordFailedDispatchSafe('AiSensy', status, safeErr, {
        providerOutcome: isTimeout ? 'UNKNOWN_PROVIDER_OUTCOME' : 'PROVIDER_REJECTED',
        persistenceState: isTimeout ? 'UNKNOWN_PROVIDER_OUTCOME' : 'PROVIDER_REJECTED',
        httpStatus,
        retryable: !isTimeout && !isBalanceError && (httpStatus === 429 || (typeof httpStatus === 'number' && httpStatus >= 500)),
        reconciliationRequired: isTimeout
      });
    }
  }

  // 2. Secondary Fallback: OmniDM Campaign #22 API (only when configured)
  if (omnidmKey) {
    const omnidmRes = await sendOmniDMWhatsApp(phone, payload.userName);
    if (omnidmRes.success) {
      const idCheck = validateProviderMessageId(omnidmRes.data?.id, 'OmniDM');
      if (!idCheck.valid || !idCheck.value) {
        const errMsg = `OmniDM returned HTTP 200 without a valid message id (${idCheck.reason || 'MISSING'}); send outcome ambiguous, do not blindly resend.`;
        console.error(`[OmniDM Response Validation Error]: ${errMsg}`);
        return recordFailedDispatchSafe('OmniDM', 'UNKNOWN_PROVIDER_OUTCOME', errMsg, {
          providerOutcome: 'UNKNOWN_PROVIDER_OUTCOME',
          persistenceState: 'UNKNOWN_PROVIDER_OUTCOME',
          httpStatus: 200,
          retryable: false,
          reconciliationRequired: true,
          rawResponse: omnidmRes.data
        });
      }
      return persistOrFailSafe(idCheck.value, 'OmniDM', 'SENT', omnidmRes.data);
    }
  }

  // 3. Meta WhatsApp Cloud API v25.0 (Environment-only credentials; zero PostgreSQL fallback)
  const metaToken = (process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN || '').trim();
  const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '1147494668457940').trim();

  if (metaToken && phoneId) {
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const dataPayload: any = {
        messaging_product: 'whatsapp',
        to: cleanPhone
      };

      if (payload.templateName) {
        dataPayload.type = 'template';
        dataPayload.template = {
          name: payload.templateName,
          language: { code: 'en' }
        };
        if (payload.templateParams && payload.templateParams.length > 0) {
          dataPayload.template.components = [
            {
              type: 'body',
              parameters: payload.templateParams.map((param) => ({
                type: 'text',
                text: String(param)
              }))
            }
          ];
        }
      } else {
        dataPayload.type = 'text';
        dataPayload.text = {
          body:
            payload.text ||
            `Namaste ${payload.userName}! I can provide you with detailed information about personal, business, home, doctor, and educational loans within 5 minutes. Please share your name, location, profession or nature of employment (e.g., salaried, businessperson, doctor, CA, etc.), and the type of loan you require.`
        };
      }

      const metaRes = await axios.post(
        `https://graph.facebook.com/v25.0/${phoneId}/messages`,
        dataPayload,
        {
          headers: {
            'Authorization': `Bearer ${metaToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      // Task 5H.33 D-02: HTTP 200 alone never proves acceptance; require valid non-empty messages[0].id
      const messagesArr = metaRes.data?.messages;
      const rawMetaId =
        Array.isArray(messagesArr) && messagesArr.length > 0 ? messagesArr[0]?.id : undefined;
      const idCheck = validateProviderMessageId(rawMetaId, 'Meta');

      if (!Array.isArray(messagesArr) || messagesArr.length === 0 || !idCheck.valid || !idCheck.value) {
        const failureReason = !Array.isArray(messagesArr)
          ? 'MISSING_MESSAGES_ARRAY'
          : messagesArr.length === 0
            ? 'EMPTY_MESSAGES_ARRAY'
            : idCheck.reason || 'INVALID_MESSAGE_ID';
        const errMsg = `Meta Cloud API returned HTTP ${metaRes.status || 200} without a valid messages[0].id (${failureReason}); send outcome ambiguous, do not blindly resend.`;
        console.error(`[Meta Cloud API Validation Error]: ${errMsg}`);
        return recordFailedDispatchSafe('Meta', 'UNKNOWN_PROVIDER_OUTCOME', errMsg, {
          providerOutcome: 'UNKNOWN_PROVIDER_OUTCOME',
          persistenceState: 'UNKNOWN_PROVIDER_OUTCOME',
          httpStatus: metaRes.status || 200,
          retryable: false,
          reconciliationRequired: true,
          rawResponse: metaRes.data
        });
      }

      return persistOrFailSafe(idCheck.value, 'Meta', 'SENT', metaRes.data);
    } catch (metaErr: any) {
      const httpStatus = typeof metaErr?.response?.status === 'number' ? metaErr.response.status : undefined;
      const isTimeout =
        metaErr?.code === 'ECONNABORTED' ||
        metaErr?.code === 'ETIMEDOUT' ||
        String(metaErr?.message || '').toLowerCase().includes('timeout');
      const status = isTimeout ? 'WEBHOOK_TIMEOUT' : 'FAILED';
      const safeErr = sanitizeErrorForLog(
        metaErr?.response?.data?.error?.message || metaErr?.message || metaErr
      );
      console.error(`[Meta Cloud API Error] (${status}): ${safeErr}`);
      return recordFailedDispatchSafe('Meta', status, safeErr, {
        providerOutcome: isTimeout ? 'UNKNOWN_PROVIDER_OUTCOME' : 'PROVIDER_REJECTED',
        persistenceState: isTimeout ? 'UNKNOWN_PROVIDER_OUTCOME' : 'PROVIDER_REJECTED',
        httpStatus,
        retryable: !isTimeout && (httpStatus === 429 || (typeof httpStatus === 'number' && httpStatus >= 500)),
        reconciliationRequired: isTimeout
      });
    }
  }

  return {
    success: false,
    providerAccepted: false,
    providerOutcome: 'PROVIDER_REJECTED',
    persistenceState: 'PROVIDER_REJECTED',
    provider: 'Meta',
    status: 'FAILED',
    retryable: false,
    persisted: false,
    error: 'No valid WhatsApp provider API keys configured'
  };
}
