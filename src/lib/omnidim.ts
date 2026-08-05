import { defaultVoiceService } from './voice-provider';

export async function triggerOmnidimCall(customerPhone: string, customerName: string, loanType: string, language: 'mr' | 'hi' | 'en' = 'hi', city?: string, profession?: string, loanRequirement?: string) {
  const result = await defaultVoiceService.dispatchCall({
    phoneNumber: customerPhone,
    customerName,
    loanType,
    language,
    city,
    profession,
    loanRequirement
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to dispatch voice call via OmniDM');
  }

  return { call_id: result.callId, status: 'dispatched', provider: result.provider };
}
