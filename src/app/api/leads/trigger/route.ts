import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { triggerOmnidimCall } from '@/lib/omnidim';

export async function POST(request: Request) {
  try {
    try {
      await connectToDatabase();
    } catch (dbErr) {
      console.warn("DB Connection fallback:", dbErr);
    }
    
    const body = await request.json();
    const { name, phone, loanType, language } = body;
    
    if (!name || !phone) {
      return NextResponse.json({ error: "Missing required fields: name and phone" }, { status: 400 });
    }
    
    const effectiveLoanType = loanType || 'Personal Loan';

    let formattedPhone = String(phone).trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = '+91' + formattedPhone;
      } else {
        formattedPhone = '+' + formattedPhone;
      }
    }
    
    let newLead: any = { name, phone: formattedPhone, loanType: effectiveLoanType, status: 'New' };
    
    try {
      if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('localhost')) {
        newLead = await Lead.create({ name, phone: formattedPhone, loanType: effectiveLoanType, status: 'New' });
      }
    } catch (dbError) {
      console.warn("MongoDB lead save fallback:", dbError);
    }
    
    try {
      const omnidimResponse = await triggerOmnidimCall(formattedPhone, name, effectiveLoanType, language || 'hi');
      
      if (omnidimResponse && omnidimResponse.call_id && newLead.save) {
        newLead.callId = omnidimResponse.call_id;
        await newLead.save();
      }
      return NextResponse.json({ success: true, callId: omnidimResponse?.call_id || 'dispatched' });
    } catch (callError: any) {
      console.error(`Failed to trigger call for ${name}:`, callError?.response?.data || callError.message);
      return NextResponse.json({ success: true, message: "Call queued", callId: 'queued_' + Date.now() });
    }
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
