import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { logToGoogleSheets, syncToHubSpot, triggerMakeWebhook, triggerPabblyWebhook, sendWhatsAppChecklist, sendMissedCallWhatsApp } from '@/lib/integrations';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const callId = body.call_id;
    const summary = body.summary || '';
    const duration = body.call_length || 0;
    const status = body.status; // 'completed', 'no-answer', 'busy', 'failed'
    
    // Fallback variables we sent in `request_data` or `variables`
    const variables = body.variables || {};
    const fallbackName = variables.customerName || body.request_data?.customerName || 'Customer';
    const fallbackPhone = body.to || variables.phone || '';
    const fallbackLoanType = variables.loanType || body.request_data?.loanType || 'Personal Loan';
    const requestedAmount = variables.loanAmount || variables.loan_amount || '';

    let lead: any = null;
    let dbConnected = false;

    try {
      await connectToDatabase();
      dbConnected = true;
      lead = await Lead.findOne({ callId });
    } catch (dbErr) {
      console.warn("MongoDB unavailable. Falling back to payload data.");
    }

    if (!lead) {
      if (!fallbackPhone) {
        return NextResponse.json({ success: true, note: "No phone number available to process" });
      }
      lead = {
        name: fallbackName,
        phone: fallbackPhone,
        loanType: fallbackLoanType,
        callSummary: summary,
        callDuration: duration.toString(),
        requestedAmount: requestedAmount,
        status: 'Unknown',
        save: async () => {} // Dummy save function
      };
    } else {
      lead.callSummary = summary;
      lead.callDuration = duration.toString();
      if (!lead.requestedAmount && requestedAmount) {
        lead.requestedAmount = requestedAmount;
      }
    }
    
    const isMissedCall = ['no-answer', 'busy', 'failed', 'canceled'].includes(status?.toLowerCase());
    
    // Basic sentiment extraction from summary since Bland provides a raw summary
    const isInterested = summary.toLowerCase().includes('interested') || 
                         summary.toLowerCase().includes('wants') || 
                         summary.toLowerCase().includes('yes') ||
                         summary.toLowerCase().includes('send');

    if (isMissedCall) {
      lead.status = 'Missed Call';
      
      try {
        await axios.post('https://avani-loan-agents.onrender.com/api/incoming-lead', {
          name: lead.name,
          phone: lead.phone,
          loanType: lead.loanType,
          requestedAmount: lead.requestedAmount,
          callSummary: summary,
          event_type: 'missed_call'
        });
      } catch (err: any) {}
      
      await sendMissedCallWhatsApp(lead.phone, lead.name);
      
    } else if (isInterested) {
      lead.status = 'Documents Requested';
      
      await Promise.allSettled([
        logToGoogleSheets(lead),
        syncToHubSpot(lead),
        triggerMakeWebhook(lead),
        triggerPabblyWebhook(lead)
      ]);
      
      try {
        await axios.post('https://avani-loan-agents.onrender.com/api/incoming-lead', {
          name: lead.name,
          phone: lead.phone,
          loanType: lead.loanType,
          requestedAmount: lead.requestedAmount,
          callSummary: summary,
          event_type: 'interested_lead'
        });
      } catch (err: any) {}
      
      await sendWhatsAppChecklist(lead.phone, lead.name, lead.loanType);
      
    } else {
      lead.status = 'Not Interested';
    }

    if (dbConnected && typeof lead.save === 'function' && lead.constructor.modelName === 'Lead') {
      await lead.save();
    }

    return NextResponse.json({ success: true, leadId: lead._id || 'fallback-id' });
  } catch (error: any) {
    console.error("Bland Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
