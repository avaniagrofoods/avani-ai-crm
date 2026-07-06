import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { logToGoogleSheets, syncToHubSpot, triggerMakeWebhook, triggerPabblyWebhook, sendWhatsAppChecklist } from '@/lib/integrations';
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
    const summary = call?.summary;
    const duration = call?.duration;
    
    // Check structured data from the call analysis
    const isInterested = analysis?.structuredData?.isInterested || false;
    const requestedAmount = analysis?.structuredData?.loanAmount || '';

    await connectToDatabase();

    const lead = await Lead.findOne({ callId });
    if (!lead) {
      console.warn("Lead not found for callId:", callId);
      return NextResponse.json({ success: true, note: "Lead not found" });
    }

    lead.callSummary = summary;
    lead.callDuration = duration?.toString() || '0';
    lead.requestedAmount = requestedAmount;
    
    if (isInterested) {
      lead.status = 'Documents Requested';
      
      // Trigger Integrations
      await Promise.allSettled([
        logToGoogleSheets(lead),
        syncToHubSpot(lead),
        triggerMakeWebhook(lead),
        triggerPabblyWebhook(lead)
      ]);
      
      // Trigger WhatsApp integration
      await sendWhatsAppChecklist(lead.phone, lead.name, lead.loanType);
    } else {
      lead.status = 'Not Interested';
    }

    await lead.save();

    return NextResponse.json({ success: true, leadId: lead._id });
  } catch (error: any) {
    console.error("VAPI Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
