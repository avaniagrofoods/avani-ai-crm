import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { triggerBlandCall } from '@/lib/bland';

export async function POST(request: Request) {
  try {
    // Attempt DB connection, but don't fail if it's missing on Vercel
    try {
      await connectToDatabase();
    } catch (dbErr) {
      console.warn("DB Connection failed:", dbErr);
    }
    
    const body = await request.json();
    const { name, phone, loanType } = body;
    
    if (!name || !phone || !loanType) {
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
      const blandResponse = await triggerBlandCall(formattedPhone, name, loanType);
      
      if (blandResponse && blandResponse.call_id && newLead.save) {
        newLead.callId = blandResponse.call_id;
        await newLead.save();
      }
      return NextResponse.json({ success: true, callId: blandResponse?.call_id || 'unknown' });
    } catch (callError: any) {
      console.error(`Failed to trigger call for ${name}:`, callError);
      return NextResponse.json({ error: "Failed to trigger Bland AI call" }, { status: 500 });
    }
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
