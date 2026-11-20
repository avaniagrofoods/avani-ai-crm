/**
 * VAPI AI Calling Client — RETIRED PROVIDER MODULE
 *
 * Formal Status: RETIRED_PENDING_KEY_REVOCATION (Task 5H.22)
 * Active calling via Vapi AI has been decommissioned by owner directive.
 * Outbound calls through this module are permanently disabled.
 */

export const VAPI_STATUS = 'RETIRED';

export async function triggerOutboundCall(_customerPhone: string, _customerName: string, _loanType: string) {
  console.warn('[VAPI][RETIRED] Vapi AI voice provider is permanently retired. Outbound call request blocked.');
  return {
    success: false,
    blocked: true,
    retired: true,
    provider: 'Vapi',
    reason: 'VAPI_PROVIDER_PERMANENTLY_RETIRED'
  };
}
