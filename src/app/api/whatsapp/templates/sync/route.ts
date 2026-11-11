import { NextResponse } from 'next/server';
import { TemplateSyncEngine } from '@/lib/template-sync/aisensy';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const result = await TemplateSyncEngine.syncAllApprovedTemplates();
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
