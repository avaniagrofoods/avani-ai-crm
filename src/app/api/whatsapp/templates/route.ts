import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Template } from '@/models/Template';
import { TemplateSyncEngine } from '@/lib/template-sync/aisensy';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    // APR006-P3-01: Fail-closed isolation of legacy MongoDB template route.
    if (process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true') {
      return NextResponse.json(
        {
          success: false,
          error: 'LEGACY_MONGODB_ROUTE_DISABLED',
          message: 'Legacy MongoDB /api/whatsapp/templates route is disabled; canonical CRM persistence is Google Sheets.'
        },
        { status: 410, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Templates unavailable.', templates: [], count: 0 },
        { status: 503 }
      );
    }

    let templates = await Template.find({ status: 'APPROVED' }).sort({ templateName: 1 });

    if (templates.length === 0) {
      await TemplateSyncEngine.syncAllApprovedTemplates();
      templates = await Template.find({ status: 'APPROVED' }).sort({ templateName: 1 });
    }

    return NextResponse.json({
      success: true,
      count: templates.length,
      provider: 'AiSensy / Meta WABA',
      templates
    }, { status: 200 });
  } catch {
    return NextResponse.json({ success: false, error: 'TEMPLATES_FETCH_FAILED', message: 'Unable to fetch WhatsApp templates.' }, { status: 500 });
  }
}
