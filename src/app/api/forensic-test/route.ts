import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Conversation } from '@/models/Conversation';
import { Lead } from '@/models/Lead';
import { WebhookInbox } from '@/models/WebhookInbox';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    
    if (!phone) return NextResponse.json({ error: 'Phone required' });
    
    await connectToDatabase();
    
    const conv = await Conversation.findOne({ customerPhone: phone }).lean();
    const lead = await Lead.findOne({ phone: phone }).lean();
    
    // Check webhook inbox for errors related to this event
    const webhooks = await WebhookInbox.find({ eventType: 'INBOUND_MESSAGE' }).sort({ _id: -1 }).limit(5).lean();
    
    return NextResponse.json({ conv, lead, webhooks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
