import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Template } from '@/models/Template';
import { TemplateSyncEngine } from '@/lib/template-sync/aisensy';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();

    let templates = await Template.find({ status: 'APPROVED' }).sort({ templateName: 1 });

    if (templates.length === 0) {
      console.log("[Template API] DB Template registry empty. Running auto-sync...");
      const syncRes = await TemplateSyncEngine.syncAllApprovedTemplates();
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
