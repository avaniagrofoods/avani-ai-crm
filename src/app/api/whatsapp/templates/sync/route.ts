import { NextResponse } from 'next/server';
import { TemplateSyncEngine } from '@/lib/template-sync/aisensy';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await TemplateSyncEngine.syncAllApprovedTemplates();
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
