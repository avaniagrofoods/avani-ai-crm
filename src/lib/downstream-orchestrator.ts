import axios from 'axios';
import {
  ZapierIntegration,
  isZapierTriggerEvent,
  type ZapierTriggerEvent
} from './zapier-integration';

export interface CanonicalEventPayload {
  eventId: string;
  leadId: string;
  eventType:
    | 'LEAD_CREATED'
    | 'WHATSAPP_SENT'
    | 'WHATSAPP_DELIVERED'
    | 'WHATSAPP_READ'
    | 'CUSTOMER_REPLIED'
    | 'QUALIFICATION_STARTED'
    | 'QUALIFIED'
    | 'DOCUMENT_CHECKLIST_CREATED'
    | 'DOCUMENTS_SUBMITTED'
    | 'ADVISOR_HANDOFF'
    | 'APPLICATION_CREATED'
    | 'APPLICATION_STATUS_CHANGED'
    | 'OPTED_OUT'
    | 'COMPLETED'
    | 'REFERRAL_CREATED'
    | 'CROSS_SELL_CREATED';
  timestamp: string;
  source: string;
  payloadVersion: string;
  correlationId: string;
  data?: Record<string, unknown>;
}

function mapCanonicalEventToZapierTrigger(eventType: CanonicalEventPayload['eventType']): ZapierTriggerEvent | null {
  if (eventType === 'QUALIFIED') return 'LEAD_QUALIFIED';
  if (isZapierTriggerEvent(eventType)) return eventType;
  return null;
}

export class DownstreamOrchestrator {
  static async dispatchCanonicalEvent(event: CanonicalEventPayload) {
    // APR-009 Stage 5F: Strictly zero MongoDB fallback; canonical persistence is Google Sheets.
    setTimeout(async () => {
      try {
        // 1. HubSpot Upsert by leadId (gated strictly to live mode)
        await this.syncToHubSpot(event);

        // 2. Legacy Apps Script notification (gated strictly to live mode; canonical CRM writes via CrmSheetsService)
        await this.syncToGoogleSheets(event);

        // 3. Hardened Zapier Idempotent Dispatch via ZapierIntegration
        await this.syncToZapier(event);
      } catch (err: unknown) {
        console.error(
          `[DownstreamOrchestrator] Non-blocking dispatch error for ${event.eventId}:`,
          err instanceof Error ? err.message : 'unknown'
        );
      }
    }, 0);

    return { success: true, eventId: event.eventId, status: 'QUEUED_DOWNSTREAM' };
  }

  private static async syncToHubSpot(event: CanonicalEventPayload) {
    if (process.env.PROVIDER_MODE !== 'live') {
      return;
    }
    const portalId = process.env.HUBSPOT_PORTAL_ID;
    const formId = process.env.HUBSPOT_FORM_ID;
    if (!portalId || !formId) {
      return;
    }

    try {
      const url = `https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`;
      await axios.post(url, {
        fields: [
          { name: 'firstname', value: String(event.data?.name || 'Customer') },
          { name: 'phone', value: String(event.data?.phone || '') },
          { name: 'hs_lead_status', value: event.eventType },
          { name: 'message', value: `LeadID: ${event.leadId} | Event: ${event.eventType} | Correlation: ${event.correlationId}` }
        ]
      });
    } catch (err: unknown) {
      console.warn('[DownstreamOrchestrator] HubSpot warning:', err instanceof Error ? err.message : 'unknown');
    }
  }

  private static async syncToGoogleSheets(event: CanonicalEventPayload) {
    if (process.env.PROVIDER_MODE !== 'live') {
      return;
    }
    const url = process.env.GOOGLE_SHEET_APP_SCRIPT_URL;
    if (!url) {
      return;
    }

    try {
      await axios.post(url, {
        eventId: event.eventId,
        leadId: event.leadId,
        eventType: event.eventType,
        timestamp: event.timestamp,
        phone: String(event.data?.phone || ''),
        name: String(event.data?.name || ''),
        loanType: String(event.data?.product || '')
      });
    } catch (err: unknown) {
      console.warn('[DownstreamOrchestrator] Google Sheets warning:', err instanceof Error ? err.message : 'unknown');
    }
  }

  private static async syncToZapier(event: CanonicalEventPayload) {
    const triggerType = mapCanonicalEventToZapierTrigger(event.eventType);
    if (!triggerType) {
      return;
    }

    const res = await ZapierIntegration.dispatchTrigger({
      eventId: event.eventId,
      eventType: triggerType,
      leadId: event.leadId,
      correlationId: event.correlationId,
      source: event.source,
      timestamp: event.timestamp,
      consentStatus: typeof event.data?.consentStatus === 'string' ? event.data.consentStatus : undefined,
      isOptedOut: event.data?.isOptedOut === true,
      data: {
        name: typeof event.data?.name === 'string' ? event.data.name : undefined,
        phone: typeof event.data?.phone === 'string' ? event.data.phone : undefined,
        city: typeof event.data?.city === 'string' ? event.data.city : undefined,
        product: typeof event.data?.product === 'string' ? event.data.product : undefined,
        requestedAmount:
          typeof event.data?.requestedAmount === 'number' || typeof event.data?.requestedAmount === 'string'
            ? event.data.requestedAmount
            : undefined,
        stage: event.eventType
      }
    });

    if (!res.dispatched && res.status === 'FAILED') {
      console.warn(`[DownstreamOrchestrator] Zapier dispatch failed for ${event.eventId}:`, res.error || 'unknown');
    }
  }
}
