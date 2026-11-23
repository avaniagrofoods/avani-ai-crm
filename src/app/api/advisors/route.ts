import { NextResponse } from 'next/server';
import { advisorRepository, CrmSheetsService, SheetsCrmError } from '@/lib/google-sheets';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    await CrmSheetsService.assertHealthy();
    const rows = await advisorRepository.listActiveAdvisors();

    const advisors = rows.map((r) => ({
      advisorId: r.advisor_id,
      name: r.advisor_name,
      role: r.role,
      isActive: r.active_status === 'ACTIVE',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return NextResponse.json({ success: true, count: advisors.length, advisors });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    const message = error instanceof SheetsCrmError ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: code, message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    await CrmSheetsService.assertHealthy();
    const body = await req.json();
    const name = String(body.name || body.advisor_name || '').trim();
    const role = body.role || 'LOAN_ADVISOR';

    if (!name) {
      return NextResponse.json({ success: false, error: 'Advisor name is required' }, { status: 400 });
    }

    const { record } = await advisorRepository.upsertAdvisor({
      advisor_id: body.advisorId || body.advisor_id,
      advisor_name: name,
      role,
      active_status: 'ACTIVE'
    });

    return NextResponse.json({
      success: true,
      advisor: {
        advisorId: record.advisor_id,
        name: record.advisor_name,
        role: record.role,
        isActive: record.active_status === 'ACTIVE',
        createdAt: record.created_at,
        updatedAt: record.updated_at
      }
    });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    const message = error instanceof SheetsCrmError ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: code, message }, { status });
  }
}
