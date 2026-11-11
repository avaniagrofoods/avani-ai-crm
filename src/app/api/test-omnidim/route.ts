import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { phoneNumber, mode } = body;

    const { defaultVoiceService } = require('@/lib/voice-provider');

    const callOptions = {
      phoneNumber: phoneNumber || '919175635165',
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

    const result = await defaultVoiceService.dispatchCall(callOptions);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
