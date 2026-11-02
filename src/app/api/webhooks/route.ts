import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { WebhookInbox } from '@/models/WebhookInbox';

export async function GET(req: Request) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 1. Static registered endpoints configuration
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://avani-ai-crm.vercel.app';
    const endpoints = [
      {
        id: 'wh_chatmitra',
        event: 'ChatMitra WhatsApp Webhook (Meta WABA)',
        url: `${baseUrl}/api/chatmitra-webhook`,
        status: 'ACTIVE',
        provider: 'ChatMitra',
        subscribedEvents: ['message.received', 'message.sent', 'message.delivered', 'message.read', 'template.status'],
        lastTrigger: new Date().toISOString()
      },
      {
        id: 'wh_meta_cloud',
        event: 'Meta Cloud API Inbound & Status Gateway',
        url: `${baseUrl}/api/meta-webhook`,
        status: 'ACTIVE',
        provider: 'Meta',
        subscribedEvents: ['messages', 'message_status'],
        lastTrigger: new Date().toISOString()
      },
      {
        id: 'wh_omnidm',
        event: 'OmniDM Voice Agent Telephony Callback',
        url: `${baseUrl}/api/omnidim-webhook`,
        status: process.env.OMNIDM_LIVE_ENABLED === 'true' ? 'ACTIVE' : 'READY_DISABLED',
        provider: 'OmniDM',
        subscribedEvents: ['call.completed', 'call.transcription'],
        lastTrigger: new Date().toISOString()
      },
      {
        id: 'wh_callkaro',
        event: 'CallKaro Voice Agent Callback',
        url: `${baseUrl}/api/callkaro-webhook`,
        status: 'ACTIVE',
        provider: 'CallKaro',
        subscribedEvents: ['call.status', 'call.summary'],
        lastTrigger: new Date().toISOString()
      }
    ];

    // 2. Fetch live recent events from WebhookInbox
    const recentEvents = await WebhookInbox.find({})
      .sort({ receivedAt: -1 })
      .limit(limit);

    return NextResponse.json({
      success: true,
      endpoints,
      recentEvents,
      totalEvents: recentEvents.length
    });

  } catch (error: any) {
    console.error('[WebhooksAPI] Error loading webhooks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
