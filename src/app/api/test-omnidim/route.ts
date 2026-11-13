import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { evaluateAuthorizedTestRecipient, getConfiguredAuthorizedTestPhone } from '@/lib/safeguards';

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { phoneNumber, mode } = body;

    const { defaultVoiceService } = require('@/lib/voice-provider');
    const configuredTestPhone = getConfiguredAuthorizedTestPhone();
    const resolvedPhone = phoneNumber || configuredTestPhone.e164 || '';

    const callOptions = {
      phoneNumber: resolvedPhone,
      customerName: body.customerName || 'Test Customer',
      loanType: body.loanType || 'Doctor Loan',
      profession: body.profession || 'Doctor / Medical Professional',
      city: body.city || 'Latur',
      language: body.language || 'mr'
    };

    if (mode === 'mock' || process.env.OMNIDM_LIVE_ENABLED !== 'true') {
      return NextResponse.json({
        success: true,
        message: 'Mock Mode Success (live voice calling disabled)',
        t0: true,
        t1: true,
        options: callOptions
      });
    }

    const recipientCheck = evaluateAuthorizedTestRecipient(resolvedPhone);
    if (!recipientCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: recipientCheck.error || 'LIVE_DISPATCH_RESTRICTED',
          message: recipientCheck.message,
          rawResponse: { status: 'BLOCKED_UNAUTHORIZED_RECIPIENT' }
        },
        { status: recipientCheck.status }
      );
    }

    const result = await defaultVoiceService.dispatchCall(callOptions);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
