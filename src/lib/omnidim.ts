import { defaultVoiceService } from './voice-provider';
import { normalizeIndianPhone } from '@/lib/phone';

export async function triggerOmnidimCall(customerPhone: string, customerName: string, loanType: string, language: 'mr' | 'hi' | 'en' = 'hi', city?: string, profession?: string, loanRequirement?: string) {
  const cleanPhone = normalizeIndianPhone(customerPhone);
  if (!cleanPhone) throw new Error('Invalid phone number for OmniDM dispatch');

  const result = await defaultVoiceService.dispatchCall({
    phoneNumber: cleanPhone,
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
