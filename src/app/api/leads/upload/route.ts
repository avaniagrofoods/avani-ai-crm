import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { triggerOutboundCall } from '@/lib/vapi';

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
      const loanType = leadData.LoanType || leadData['Loan Type'] || leadData.loanType;
      
      if (!name || !phone || !loanType) continue;
      
      let newLead: any = { name, phone, loanType, status: 'New' };
      
      try {
        if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('localhost')) {
          newLead = await Lead.create({ name, phone, loanType, status: 'New' });
        }
      } catch (dbError) {
        console.warn("DB Save skipped (Likely no cloud DB provided yet):", dbError);
      }
      
      try {
        // Trigger VAPI Call
        const vapiResponse = await triggerOutboundCall(phone, name, loanType);
        
        // Update lead with callId to track the webhook later
        if (vapiResponse && vapiResponse.id && newLead.save) {
          newLead.callId = vapiResponse.id;
          await newLead.save();
        }
      } catch (callError) {
        console.error(`Failed to trigger call for ${name}:`, callError);
      }
      
      savedLeads.push(newLead);
    }
    
    return NextResponse.json({ success: true, count: savedLeads.length, leads: savedLeads });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
