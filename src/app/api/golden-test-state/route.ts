import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Call } from '@/models/Call';

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    
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
    
    return NextResponse.json({ lead, call });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
