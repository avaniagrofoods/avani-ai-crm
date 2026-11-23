import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Conversation } from '@/models/Conversation';
import { Lead } from '@/models/Lead';
import { WebhookInbox } from '@/models/WebhookInbox';
import { requireRole } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ['ADMIN']);
    if (!auth.ok) return auth.response;

    // APR-008 Phase 3B: Fail-closed isolation of obsolete debug/forensic MongoDB PII route.
    if (process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true') {
      return NextResponse.json(
        {
          success: false,
          error: 'LEGACY_MONGODB_ROUTE_DISABLED',
          message: 'Legacy MongoDB /api/forensic-test debug route is disabled; canonical CRM persistence is Google Sheets.'
        },
        { status: 410, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 });

    await connectToDatabase();

    const conv = await Conversation.findOne({ customerPhone: phone }).lean();
    const lead = await Lead.findOne({ phone }).lean();
    const webhooks = await WebhookInbox.find({ eventType: 'INBOUND_MESSAGE' }).sort({ _id: -1 }).limit(5).lean();

    return NextResponse.json({ conv, lead, webhooks });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
