import axios from 'axios';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';

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
  data?: any;
}

export class DownstreamOrchestrator {
  static async dispatchCanonicalEvent(event: CanonicalEventPayload) {
    // Non-blocking execution wrapped in async Promise
    setTimeout(async () => {
      try {
        await connectToDatabase();

        // 1. HubSpot Upsert by leadId
        await this.syncToHubSpot(event);

        // 2. Google Sheets Upsert Row by leadId
        await this.syncToGoogleSheets(event);

        // 3. Zapier Idempotent Dispatch by eventId
        await this.syncToZapier(event);

      } catch (err: any) {
        console.error(`[DownstreamOrchestrator] Non-blocking dispatch error for ${event.eventId}:`, err.message);
      }
    }, 0);

    return { success: true, eventId: event.eventId, status: 'QUEUED_DOWNSTREAM' };
  }

  private static async syncToHubSpot(event: CanonicalEventPayload) {
    const portalId = process.env.HUBSPOT_PORTAL_ID;
    const formId = process.env.HUBSPOT_FORM_ID;
    if (!portalId || !formId) {
      console.log(`[DownstreamOrchestrator] HubSpot credentials pending. Event ${event.eventId} logged locally.`);
      return;
    }

    try {
      const url = `https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`;
      await axios.post(url, {
        fields: [
          { name: "firstname", value: event.data?.name || "Customer" },
          { name: "phone", value: event.data?.phone || "" },
          { name: "hs_lead_status", value: event.eventType },
          { name: "message", value: `LeadID: ${event.leadId} | Event: ${event.eventType} | Correlation: ${event.correlationId}` }
        ]
      });
      console.log(`[DownstreamOrchestrator] HubSpot synced for lead ${event.leadId}`);
    } catch (err: any) {
      console.warn(`[DownstreamOrchestrator] HubSpot warning:`, err.message);
    }
  }

  private static async syncToGoogleSheets(event: CanonicalEventPayload) {
    const url = process.env.GOOGLE_SHEET_APP_SCRIPT_URL;
    if (!url) {
      console.log(`[DownstreamOrchestrator] Google Sheets URL pending. Event ${event.eventId} logged locally.`);
      return;
    }

    try {
      await axios.post(url, {
        eventId: event.eventId,
        leadId: event.leadId,
        eventType: event.eventType,
        timestamp: event.timestamp,
        phone: event.data?.phone || '',
        name: event.data?.name || '',
        loanType: event.data?.product || ''
      });
      console.log(`[DownstreamOrchestrator] Google Sheets updated for lead ${event.leadId}`);
    } catch (err: any) {
      console.warn(`[DownstreamOrchestrator] Google Sheets warning:`, err.message);
    }
  }

  private static async syncToZapier(event: CanonicalEventPayload) {
    const url = process.env.ZAPIER_WEBHOOK_URL;
    if (!url) {
      console.log(`[DownstreamOrchestrator] Zapier Webhook URL pending. Event ${event.eventId} logged locally.`);
      return;
    }

    try {
      await axios.post(url, event);
      console.log(`[DownstreamOrchestrator] Zapier event ${event.eventId} dispatched.`);
    } catch (err: any) {
      console.warn(`[DownstreamOrchestrator] Zapier warning:`, err.message);
    }
  }
}
