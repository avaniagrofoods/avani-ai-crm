import { Message } from '@/models/Message';
import { WebhookInbox } from '@/models/WebhookInbox';

export interface WhatsappTelemetrySummary {
  mockAttempts: number;
  providerAccepted: number;
  delivered: number;
  failed: number;
  inboundReceived: number;
  webhookProcessingErrors: number;
  duplicateWebhookEvents: number;
  pendingDeliveryConfirmations: number;
}

export const MOCK_MESSAGE_CRITERIA = [
  { 'providerResponse.mock': true },
  { provider: /mock/i },
  { messageId: /^CM-MOCK-/i },
  { providerMessageId: /^CM-MOCK-/i },
  { idempotencyKey: /mock/i }
];

const OUTBOUND_DIRECTIONS = ['OUTBOUND', 'outbound'];
const INBOUND_DIRECTIONS = ['INBOUND', 'inbound'];
const ACCEPTED_STATUSES = [
  'PROVIDER_ACCEPTED',
  'API_ACCEPTED',
  'PROVIDER_MESSAGE_ID_CREATED',
  'SENT',
  'Sent',
  'DELIVERED',
  'Delivered',
  'READ',
  'Read'
];
const DELIVERED_STATUSES = ['DELIVERED', 'Delivered', 'READ', 'Read'];
const PENDING_CONFIRMATION_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'Processing',
  'DISPATCHED',
  'PROVIDER_REQUESTED',
  'PROVIDER_ACCEPTED',
  'API_ACCEPTED',
  'WAITING_FOR_PROVIDER_STATUS',
  'PROVIDER_MESSAGE_ID_CREATED',
  'SENT',
  'Sent'
];
const FAILURE_STATUSES = [
  'FAILED',
  'Failed',
  'API_FAILED',
  'PROVIDER_FAILED',
  'BALANCE_BLOCKED',
  'INVALID_DESTINATION',
  'TEMPLATE_REJECTED',
  'WEBHOOK_TIMEOUT'
];

export async function computeWhatsappTelemetry(): Promise<WhatsappTelemetrySummary> {
  const nonMockCondition = { $nor: MOCK_MESSAGE_CRITERIA };

  const [
    mockAttempts,
    providerAccepted,
    delivered,
    failed,
    inboundReceived,
    webhookProcessingErrors,
    duplicateWebhookEvents,
    pendingDeliveryConfirmations
  ] = await Promise.all([
    Message.countDocuments({
      direction: { $in: OUTBOUND_DIRECTIONS },
      $or: MOCK_MESSAGE_CRITERIA
    }),
    Message.countDocuments({
      direction: { $in: OUTBOUND_DIRECTIONS },
      status: { $in: ACCEPTED_STATUSES },
      ...nonMockCondition
    }),
    Message.countDocuments({
      direction: { $in: OUTBOUND_DIRECTIONS },
      status: { $in: DELIVERED_STATUSES },
      ...nonMockCondition
    }),
    Message.countDocuments({
      direction: { $in: OUTBOUND_DIRECTIONS },
      status: { $in: FAILURE_STATUSES },
      ...nonMockCondition
    }),
    Message.countDocuments({
      direction: { $in: INBOUND_DIRECTIONS }
    }),
    WebhookInbox.countDocuments({
      status: 'FAILED'
    }),
    WebhookInbox.countDocuments({
      $or: [{ status: 'DUPLICATE' }, { attemptCount: { $gt: 1 } }]
    }),
    Message.countDocuments({
      direction: { $in: OUTBOUND_DIRECTIONS },
      status: { $in: PENDING_CONFIRMATION_STATUSES },
      ...nonMockCondition
    })
  ]);

  return {
    mockAttempts,
    providerAccepted,
    delivered,
    failed,
    inboundReceived,
    webhookProcessingErrors,
    duplicateWebhookEvents,
    pendingDeliveryConfirmations
  };
}
