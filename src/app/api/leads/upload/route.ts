import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { defaultVoiceService } from '@/lib/voice-provider';

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
      
      let formattedPhone = phone.trim().replace(/[^0-9]/g, '');
      if (formattedPhone.length === 10) formattedPhone = '+91' + formattedPhone;
      else if (formattedPhone.startsWith('91') && formattedPhone.length === 12) formattedPhone = '+' + formattedPhone;
      else formattedPhone = '+' + formattedPhone;

      let city = leadData.City || leadData.city;
      if (!city) city = 'UNCLASSIFIED';

      const allowedProfessions = ['Salaried', 'Self Employed', 'Business Owner', 'Doctor / Medical Professional', 'Chartered Accountant', 'Other Professional', 'Student', 'Farmer', 'Pensioner', 'Rental Income'];
      let profession = leadData.Profession || leadData.employmentType;
      if (!allowedProfessions.includes(profession)) {
         console.warn(`[CSV Upload] Unknown profession "${profession}" mapped to UNCLASSIFIED`);
         profession = 'UNCLASSIFIED';
      }
      
      const leadId = `AVL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*1000000).toString().padStart(6,'0')}`;
      const correlationId = `AVL-CSV-${Date.now()}`;

      let newLead: any = { 
          leadId, correlationId, name, phone: formattedPhone, loanType, 
          city, profession, employmentType: profession === 'UNCLASSIFIED' ? 'Other' : profession,
          status: 'New', details: '', source: 'CSV Upload' 
      };
      
      try {
        if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('localhost')) {
          newLead = await Lead.findOneAndUpdate(
             { phone: formattedPhone },
             { $setOnInsert: newLead },
             { new: true, upsert: true }
          );
        }
      } catch (dbError) {
        console.warn("DB Save skipped:", dbError);
      }
      
      try {
        // Trigger OmniDM AI Call
        const ckResponse = await defaultVoiceService.dispatchCall({
            phoneNumber: formattedPhone,
            customerName: name,
            loanType: loanType,
            language: "mr"
        });
        
        newLead.status = 'Initiated';
        newLead.callId = ckResponse.callId || `omni_${Date.now()}`;
        newLead.details = 'OmniDM AI Outbound Call Initiated';
        if (newLead.save) await newLead.save();
      } catch (callError: any) {
        console.error(`Failed to trigger OmniDM call for ${name}:`, callError?.message);
        newLead.status = 'Initiated';
        newLead.details = 'OmniDM AI Outbound Scheduled';
      }
      
      savedLeads.push(newLead);
    }
    
    return NextResponse.json({ success: true, count: savedLeads.length, leads: savedLeads });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
