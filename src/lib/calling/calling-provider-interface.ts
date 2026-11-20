/**
 * Provider-Neutral AI Calling Interface Specification
 * AVANI AI CRM — Task 5H.22 Architecture
 *
 * Supports future pluggable voice telephony providers (e.g. OmniDimension)
 * while maintaining strict DND, consent, and audit-logging compliance.
 */

export type CallingLanguage = 'mr' | 'hi' | 'en';

export interface InitiateCallRequest {
  leadId: string;
  phoneNumber: string;       // Normalized E.164 (+91XXXXXXXXXX)
  customerName: string;
  loanCategory: string;      // Personal, Business, Doctor, Home Loan, etc.
  language?: CallingLanguage;
  city?: string;
  consentGranted: boolean;   // Mandatory under DPDP Act 2023
  isOptedOut?: boolean;      // TCCCPR / DND opt-out state
  idempotencyKey: string;    // Unique deduplication token
  metadata?: Record<string, any>;
}

export interface InitiateCallResponse {
  success: boolean;
  callId?: string;
  provider: string;
  status: 'QUEUED' | 'DISPATCHED' | 'BLOCKED_DND' | 'BLOCKED_NO_CONSENT' | 'DISABLED_STANDBY' | 'FAILED';
  reason?: string;
  auditTrail: CallAuditRecord;
  rawResponse?: any;
}

export interface CallAuditRecord {
  leadId: string;
  phoneNumberMasked: string;
  language: CallingLanguage;
  loanCategory: string;
  provider: string;
  consentVerified: boolean;
  dndSuppressed: boolean;
  callStatus: string;
  timestamp: string;
  idempotencyKey: string;
}

export interface CallWebhookCallback {
  provider: string;
  callId: string;
  leadId?: string;
  callStatus: 'COMPLETED' | 'NO_ANSWER' | 'BUSY' | 'FAILED' | 'IN_PROGRESS';
  callOutcome: 'QUALIFIED' | 'CALLBACK_REQUESTED' | 'NOT_INTERESTED' | 'HUMAN_HANDOFF' | 'INCOMPLETE';
  durationSeconds: number;
  callSummary: string;
  transcript?: string;
  nextAction: 'SEND_WHATSAPP_CHECKLIST' | 'ASSIGN_TO_SACHIN_SHINDE' | 'SCHEDULE_FOLLOWUP_CALL' | 'CLOSE_LEAD';
  advisorHandoff: boolean;
  signatureVerified: boolean;
}

export interface ICallingProvider {
  readonly providerName: string;
  readonly isEnabled: boolean;
  initiateCall(request: InitiateCallRequest): Promise<InitiateCallResponse>;
  verifyWebhookSignature(headers: Record<string, string>, rawBody: string): boolean;
  parseWebhookPayload(payload: Record<string, any>): CallWebhookCallback;
}
