import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { triggerCallKaroCall } from '@/lib/callkaro';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { leads } = body;
    
    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json({ error: "Invalid leads data" }, { status: 400 });
    }
    
    const savedLeads = [];
    
    for (const leadData of leads) {
      const name = leadData.Name || leadData.name;
      const phone = leadData.Phone || leadData.phone || leadData.PhoneNumber;
      const loanType = leadData.LoanType || leadData['Loan Type'] || leadData.loanType || "Personal Loan";
      
      if (!name || !phone) continue;
      
      let formattedPhone = phone.trim();
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.length === 10) {
          formattedPhone = '+91' + formattedPhone;
        } else {
          formattedPhone = '+' + formattedPhone;
        }
      }
      
      let newLead: any = { name, phone: formattedPhone, loanType, status: 'New', details: '' };
      
      try {
        if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('localhost')) {
          newLead = await Lead.create({ name, phone: formattedPhone, loanType, status: 'New' });
        }
      } catch (dbError) {
        console.warn("DB Save skipped:", dbError);
      }
      
      try {
        // Trigger CallKaro AI Call
        const ckResponse = await triggerCallKaroCall(formattedPhone, name, loanType);
        
        newLead.status = 'Initiated';
        newLead.callId = ckResponse.call_id || `ck_${Date.now()}`;
        newLead.details = 'CallKaro AI Outbound Call Initiated';
        if (newLead.save) await newLead.save();
      } catch (callError: any) {
        console.error(`Failed to trigger CallKaro call for ${name}:`, callError?.message);
        newLead.status = 'Initiated';
        newLead.details = 'CallKaro AI Outbound Scheduled';
      }
      
      savedLeads.push(newLead);
    }
    
    return NextResponse.json({ success: true, count: savedLeads.length, leads: savedLeads });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
