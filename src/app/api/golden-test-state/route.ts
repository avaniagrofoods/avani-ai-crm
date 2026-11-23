import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Call } from '@/models/Call';
import { requireRole } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    // APR-008 Phase 3B: Fail-closed isolation of obsolete test-harness MongoDB route.
    if (process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true') {
      return NextResponse.json(
        {
          success: false,
          error: 'LEGACY_MONGODB_ROUTE_DISABLED',
          message: 'Legacy MongoDB /api/golden-test-state test route is disabled; canonical CRM persistence is Google Sheets.'
        },
        { status: 410, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. State retrieval unavailable.' },
        { status: 503 }
      );
    }

    const url = new URL(req.url);
    const phone = url.searchParams.get('phone');
    const callId = url.searchParams.get('callId');

    let lead = null;
    let call = null;

    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      lead = await Lead.findOne({ phone: { $regex: cleanPhone } });
    }

    if (callId) {
      call = await Call.findOne({ providerCallId: callId });
    }

    return NextResponse.json({ success: true, lead, call });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
