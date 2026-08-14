import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Template } from '@/models/Template';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();

    let templates = await Template.find({ status: 'APPROVED' }).sort({ templateName: 1 });

    if (templates.length === 0) {
      // Return standard default approved templates if DB is freshly initialized
      templates = [
        {
          templateId: 'tpl_avani_loan_intro_v2',
          templateName: 'avani_loan_intro_v2',
          language: 'en',
          category: 'MARKETING',
          status: 'APPROVED',
          provider: 'AiSensy'
        },
        {
          templateId: 'tpl_doctor_loan_offer',
          templateName: 'doctor_loan_offer',
          language: 'en',
          category: 'UTILITY',
          status: 'APPROVED',
          provider: 'AiSensy'
        }
      ] as any;
    }

    return NextResponse.json({
      success: true,
      count: templates.length,
      templates
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
