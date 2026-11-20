/**
 * OmniDimension AI Calling Adapter (Skeleton / Future Provider)
 * AVANI AI CRM — Task 5H.22 Architecture
 *
 * DESIGN PRINCIPLE: Disabled by default. Zero live calls until explicitly approved.
 */

import type {
  ICallingProvider,
  InitiateCallRequest,
  InitiateCallResponse,
  CallWebhookCallback,
  CallAuditRecord
} from './calling-provider-interface.ts';
import crypto from 'crypto';

export class OmniDimensionAdapter implements ICallingProvider {
  readonly providerName = 'OMNIDIMENSION';

  get isEnabled(): boolean {
    return process.env.OMNIDIMENSION_LIVE_ENABLED === 'true' &&
           process.env.AI_CALLING_PROVIDER === 'OMNIDIMENSION';
  }

  private maskPhone(phone: string): string {
    const cleaned = String(phone || '').replace(/[^0-9+]/g, '');
    if (cleaned.length <= 4) return '****';
    return cleaned.slice(0, cleaned.length - 4).replace(/./g, '*') + cleaned.slice(-4);
  }

  async initiateCall(request: InitiateCallRequest): Promise<InitiateCallResponse> {
    const maskedPhone = this.maskPhone(request.phoneNumber);
    const lang = request.language || 'mr';

    // 1. DND / Opt-Out Guard
    if (request.isOptedOut === true) {
      return {
        success: false,
        provider: this.providerName,
        status: 'BLOCKED_DND',
        reason: 'Customer has opted out of automated telephony under TCCCPR / DPDP regulations.',
        auditTrail: {
          leadId: request.leadId,
          phoneNumberMasked: maskedPhone,
          language: lang,
          loanCategory: request.loanCategory,
          provider: this.providerName,
          consentVerified: false,
          dndSuppressed: true,
          callStatus: 'SUPPRESSED_DND',
          timestamp: new Date().toISOString(),
          idempotencyKey: request.idempotencyKey
        }
      };
    }

    // 2. Explicit Consent Verification Guard
    if (request.consentGranted !== true) {
      return {
        success: false,
        provider: this.providerName,
        status: 'BLOCKED_NO_CONSENT',
        reason: 'Call blocked: Prior applicant consent is required under DPDP Act 2023.',
        auditTrail: {
          leadId: request.leadId,
          phoneNumberMasked: maskedPhone,
          language: lang,
          loanCategory: request.loanCategory,
          provider: this.providerName,
          consentVerified: false,
          dndSuppressed: false,
          callStatus: 'BLOCKED_NO_CONSENT',
          timestamp: new Date().toISOString(),
          idempotencyKey: request.idempotencyKey
        }
      };
    }

    // 3. Safety Gate: Disabled by Default Standby Mode
    if (!this.isEnabled) {
      return {
        success: false,
        provider: this.providerName,
        status: 'DISABLED_STANDBY',
        reason: 'OmniDimension integration is architected in standby mode. Live calling requires separate owner authorization.',
        auditTrail: {
          leadId: request.leadId,
          phoneNumberMasked: maskedPhone,
          language: lang,
          loanCategory: request.loanCategory,
          provider: this.providerName,
          consentVerified: true,
          dndSuppressed: false,
          callStatus: 'STANDBY_NOT_CONNECTED',
          timestamp: new Date().toISOString(),
          idempotencyKey: request.idempotencyKey
        }
      };
    }

    // When enabled in a future release, HTTP dispatch occurs here.
    return {
      success: false,
      provider: this.providerName,
      status: 'FAILED',
      reason: 'Adapter live calling path not active in this release.',
      auditTrail: {
        leadId: request.leadId,
        phoneNumberMasked: maskedPhone,
        language: lang,
        loanCategory: request.loanCategory,
        provider: this.providerName,
        consentVerified: true,
        dndSuppressed: false,
        callStatus: 'NOT_ACTIVE',
        timestamp: new Date().toISOString(),
        idempotencyKey: request.idempotencyKey
      }
    };
  }

  verifyWebhookSignature(headers: Record<string, string>, rawBody: string): boolean {
    const secret = process.env.OMNIDIMENSION_WEBHOOK_SECRET;
    if (!secret || secret.length < 16) return false;

    const signature = headers['x-omnidimension-signature'] || headers['x-webhook-signature'];
    if (!signature) return false;

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSig, 'utf8')
      );
    } catch {
      return false;
    }
  }

  parseWebhookPayload(payload: Record<string, any>): CallWebhookCallback {
    const status = String(payload?.status || 'COMPLETED').toUpperCase();
    const summary = String(payload?.summary || payload?.transcript_summary || '');
    const lower = summary.toLowerCase();

    let callOutcome: CallWebhookCallback['callOutcome'] = 'QUALIFIED';
    let nextAction: CallWebhookCallback['nextAction'] = 'SEND_WHATSAPP_CHECKLIST';
    let advisorHandoff = false;

    if (lower.includes('not interested') || lower.includes('cancel')) {
      callOutcome = 'NOT_INTERESTED';
      nextAction = 'CLOSE_LEAD';
    } else if (lower.includes('human') || lower.includes('advisor') || lower.includes('sachin')) {
      callOutcome = 'HUMAN_HANDOFF';
      advisorHandoff = true;
      nextAction = 'ASSIGN_TO_SACHIN_SHINDE';
    } else if (lower.includes('call later') || lower.includes('callback') || status !== 'COMPLETED') {
      callOutcome = 'CALLBACK_REQUESTED';
      nextAction = 'SCHEDULE_FOLLOWUP_CALL';
    }

    return {
      provider: this.providerName,
      callId: String(payload?.call_id || payload?.id || `OMNI-${Date.now()}`),
      leadId: payload?.lead_id || payload?.variables?.lead_id,
      callStatus: status.includes('FAIL') ? 'FAILED' : status.includes('BUSY') ? 'BUSY' : 'COMPLETED',
      callOutcome,
      durationSeconds: Number(payload?.duration || 0),
      callSummary: summary || 'Call processed by OmniDimension AI agent',
      transcript: payload?.transcript,
      nextAction,
      advisorHandoff,
      signatureVerified: true
    };
  }
}
