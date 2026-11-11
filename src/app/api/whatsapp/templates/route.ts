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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
