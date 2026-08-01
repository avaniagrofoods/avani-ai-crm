import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { triggerOmnidimCall } from '@/lib/omnidim';

export async function POST(request: Request) {
  try {
    // Attempt DB connection, but don't fail if it's missing on Vercel
    try {
      await connectToDatabase();
    } catch (dbErr) {
      console.warn("DB Connection failed:", dbErr);
    }
    
    const body = await request.json();
    const { name, phone, loanType = 'Personal Loan' } = body;
    
    if (!name || !phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      // If they gave a 10 digit number without country code, default to +91.
      // If they gave 91... prefix with +.
      if (formattedPhone.length === 10) {
        formattedPhone = '+91' + formattedPhone;
      } else {
        formattedPhone = '+' + formattedPhone;
      }
    }
    
    let newLead: any = { name, phone, loanType, status: 'New' };
    
    try {
      if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('localhost')) {
        newLead = await Lead.create({ name, phone, loanType, status: 'New' });
      }
    } catch (dbError) {
      // ignore
    }
    
    try {
      const omnidimResponse = await triggerOmnidimCall(formattedPhone, name, loanType);
      
      if (omnidimResponse && omnidimResponse.call_id && newLead.save) {
        newLead.callId = omnidimResponse.call_id;
        await newLead.save();
      }
      return NextResponse.json({ success: true, callId: omnidimResponse?.call_id || 'unknown' });
    } catch (callError: any) {
      console.error(`Failed to trigger call for ${name}:`, callError?.response?.data || callError.message);
      const errorMessage = callError?.response?.data?.message || "Failed to trigger OmniDim AI call";
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
