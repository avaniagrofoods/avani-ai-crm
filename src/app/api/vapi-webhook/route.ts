import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { logToGoogleSheets, syncToHubSpot, triggerMakeWebhook, triggerPabblyWebhook, sendWhatsAppChecklist, sendMissedCallWhatsApp } from '@/lib/integrations';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // VAPI sends events in body.message
    if (!body.message || body.message.type !== 'end-of-call-report') {
      return NextResponse.json({ success: true, note: "Ignored non end-of-call event" });
    }

    const { call, analysis } = body.message;
    const callId = call?.id;
    const summary = analysis?.summary || call?.summary || '';
    const duration = call?.duration || 0;
    
    // Check structured data from the call analysis
    const isInterested = analysis?.structuredData?.qualification_status === 'qualified' || analysis?.structuredData?.isInterested || false;
    let requestedAmount = analysis?.structuredData?.loanAmount || analysis?.structuredData?.loan_amount || '';

    // Extract fallback lead info from Vapi payload
    const fallbackName = analysis?.structuredData?.customer_name || body.message.artifact?.variableValues?.name || call?.customer?.name || 'Customer';
    const fallbackPhone = call?.customer?.number || body.message.artifact?.variableValues?.customer?.number || '';
    const fallbackLoanType = analysis?.structuredData?.loan_type || body.message.artifact?.variableValues?.loanType || 'Personal Loan';

    let lead: any = null;
    let dbConnected = false;

    try {
      await connectToDatabase();
      dbConnected = true;
      lead = await Lead.findOne({ callId });
    } catch (dbErr) {
      console.warn("MongoDB unavailable. Falling back to Vapi payload data.");
    }

    if (!lead) {
      console.warn("Lead not found in DB or DB failed. Constructing from payload.");
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
        save: async () => {} // Dummy save function to avoid crash
      };
    } else {
      lead.callSummary = summary;
      lead.callDuration = duration.toString();
      if (!lead.requestedAmount && requestedAmount) {
        lead.requestedAmount = requestedAmount;
      } else if (lead.requestedAmount) {
        requestedAmount = lead.requestedAmount;
      }
    }
    
    // Check if the call was missed/unanswered
    const endedReason = call?.endedReason || '';
    const isMissedCall = ['customer-did-not-answer', 'customer-busy', 'voicemail', 'failed', 'silence', 'customer-ended-call', 'hangup', 'silence-timed-out'].includes(endedReason.toLowerCase()) || endedReason.toLowerCase().includes('error') || endedReason.toLowerCase().includes('failed') || endedReason.toLowerCase().includes('silence');

    if (isMissedCall) {
      lead.status = 'Missed Call';
      
      // Forward to AVANI LOAN AGENTS for WhatsApp Fallback
      try {
        await axios.post('https://avani-loan-agents.onrender.com/api/incoming-lead', {
          name: lead.name,
          phone: lead.phone,
          loanType: lead.loanType,
          requestedAmount: lead.requestedAmount,
          callSummary: summary,
          event_type: 'missed_call'
        });
        console.log("Pushed Missed Call event to AVANI LOAN AGENTS");
      } catch (err: any) {
        console.error("Failed to push missed call event:", err.message);
      }
      
      // Send WhatsApp message from 7249108474
      await sendMissedCallWhatsApp(lead.phone, lead.name);
    } else if (isInterested || analysis?.structuredData?.next_action === 'human_callback') {
      lead.status = 'Documents Requested';
      
      // Trigger Integrations
      await Promise.allSettled([
        logToGoogleSheets(lead),
        syncToHubSpot(lead),
        triggerMakeWebhook(lead),
        triggerPabblyWebhook(lead)
      ]);
      
      // Send data to main AVANI LOAN AGENTS dashboard
      try {
        await axios.post('https://avani-loan-agents.onrender.com/api/incoming-lead', {
          name: lead.name,
          phone: lead.phone,
          loanType: lead.loanType,
          requestedAmount: lead.requestedAmount,
          callSummary: summary,
          event_type: 'interested_lead'
        });
        console.log("Successfully pushed lead to AVANI LOAN AGENTS dashboard");
      } catch (err: any) {
        console.error("Failed to push lead to dashboard:", err.message);
      }
      
      // Keep legacy WhatsApp logic just in case
      await sendWhatsAppChecklist(lead.phone, lead.name, lead.loanType);
    } else {
      lead.status = 'Not Interested';
    }

    if (dbConnected && typeof lead.save === 'function' && lead.constructor.modelName === 'Lead') {
      await lead.save();
    }

    return NextResponse.json({ success: true, leadId: lead._id || 'fallback-id' });
  } catch (error: any) {
    console.error("VAPI Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
