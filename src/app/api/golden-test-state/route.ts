import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Call } from '@/models/Call';

export async function GET(req: Request) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. State retrieval unavailable.' },
        { status: 503 }
      );
    }
    
    const url = new URL(req.url);
    const phone = url.searchParams.get('phone');
    const callId = url.searchParams.get('callId');
    
    let lead = null;
    let call = null;
    
    if (phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        lead = await Lead.findOne({ phone: { $regex: cleanPhone } });
    }
    
    if (callId) {
        call = await Call.findOne({ providerCallId: callId });
    }
    
    return NextResponse.json({ success: true, lead, call });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
