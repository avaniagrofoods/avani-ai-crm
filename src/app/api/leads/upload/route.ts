import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { triggerBlandCall } from '@/lib/bland';

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
      const loanType = leadData.LoanType || leadData['Loan Type'] || leadData.loanType || "General";
      
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
        // Trigger Bland AI Call
        const blandResponse = await triggerBlandCall(formattedPhone, name, loanType);
        
        if (blandResponse && blandResponse.call_id) {
          newLead.status = 'Initiated';
          newLead.callId = blandResponse.call_id;
          newLead.details = 'Call initiated via Bland AI';
          if (newLead.save) await newLead.save();
        }
      } catch (callError: any) {
        const errObj = callError?.response?.data;
        const errMsg = errObj?.message || errObj?.error || callError.message || "Insufficient Credits on Bland AI Account";
        console.error(`Failed to trigger call for ${name}:`, errMsg);
        newLead.status = 'Failed';
        newLead.details = errMsg.includes("credit") || errMsg.includes("402") || errMsg.includes("balance") 
          ? "Bland AI Insufficient Balance (-1.31 Credits)" 
          : `API Error: ${errMsg}`;
      }
      
      savedLeads.push(newLead);
    }
    
    return NextResponse.json({ success: true, count: savedLeads.length, leads: savedLeads });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
