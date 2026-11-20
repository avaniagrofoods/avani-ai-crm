import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { evaluateBulkBroadcastPolicy } from '@/lib/safeguards';
import {
  CrmSheetsService,
  followupRepository,
  SheetsCrmError
} from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  try {
    await CrmSheetsService.assertHealthy();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let rows = await followupRepository.findAll();
    if (status) {
      rows = rows.filter((r) => r.followup_status === status);
    }

    const schedules = rows.map((r) => ({
      _id: r.followup_id,
      scheduleId: r.followup_id,
      followupId: r.followup_id,
      leadId: r.lead_id,
      customerId: r.customer_id,
      advisorId: r.advisor_id,
      title: r.short_notes || r.followup_type,
      type: r.followup_type,
      scheduledAt: r.followup_date,
      status: r.followup_status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return NextResponse.json({
      success: true,
      schedules,
      total: schedules.length
    });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(req, ['ADMIN', 'ADVISOR']);
  if (!auth.ok) return auth.response;
  try {
    await CrmSheetsService.assertHealthy();

    const body = await req.json();
    const { title, date, time, type, leadId, customerId, advisorId, shortNotes } = body;

    if (type === 'Broadcast') {
      const bulkPolicy = evaluateBulkBroadcastPolicy();
      if (!bulkPolicy.allowed) {
        return NextResponse.json(
          { success: false, error: bulkPolicy.error, message: bulkPolicy.message },
          { status: bulkPolicy.status }
        );
      }
    }

    const targetDateStr = date || body.followup_date;
    if (!title && !shortNotes && !type) {
      return NextResponse.json(
        { success: false, error: 'MISSING_FIELDS', message: 'Follow-up title or type is required.' },
        { status: 400 }
      );
    }

    let scheduledDateObj = targetDateStr ? new Date(targetDateStr) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (time && date) {
      const combined = `${date}T${time.trim().slice(0, 5)}:00`;
      const parsed = new Date(combined);
      if (!isNaN(parsed.getTime())) scheduledDateObj = parsed;
    }

    const { record } = await followupRepository.createOrUpdateFollowup({
      followup_id: body.followupId || body.scheduleId,
      lead_id: leadId || body.lead_id || 'LEAD-GENERAL',
      customer_id: customerId || body.customer_id || 'CUST-GENERAL',
      advisor_id: advisorId || body.advisor_id || 'ADV-SACHIN-01',
      followup_date: scheduledDateObj,
      followup_type: type || body.followup_type || 'Follow-up Call',
      followup_status: 'PENDING',
      short_notes: shortNotes || title || 'Scheduled follow-up'
    });

    return NextResponse.json({
      success: true,
      schedule: {
        _id: record.followup_id,
        scheduleId: record.followup_id,
        followupId: record.followup_id,
        leadId: record.lead_id,
        customerId: record.customer_id,
        advisorId: record.advisor_id,
        title: record.short_notes,
        type: record.followup_type,
        scheduledAt: record.followup_date,
        status: record.followup_status,
        createdAt: record.created_at,
        updatedAt: record.updated_at
      }
    });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireRole(req, ['ADMIN', 'ADVISOR']);
  if (!auth.ok) return auth.response;
  try {
    await CrmSheetsService.assertHealthy();

    const body = await req.json();
    const targetId = body.followupId || body.scheduleId || body.id;
    if (!targetId) {
      return NextResponse.json({ success: false, error: 'ID_REQUIRED' }, { status: 400 });
    }

    const existing = await followupRepository.findById(targetId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Follow-up not found' }, { status: 404 });
    }

    const nextStatus =
      body.action === 'CANCEL'
        ? 'CANCELLED'
        : body.action === 'COMPLETE'
          ? 'COMPLETED'
          : body.status || existing.followup_status;

    const { record } = await followupRepository.createOrUpdateFollowup({
      followup_id: existing.followup_id,
      lead_id: existing.lead_id,
      customer_id: existing.customer_id,
      advisor_id: body.advisorId || existing.advisor_id,
      followup_date: body.followup_date || existing.followup_date,
      followup_type: body.type || existing.followup_type,
      followup_status: nextStatus,
      short_notes: body.shortNotes ?? body.title ?? existing.short_notes
    });

    return NextResponse.json({ success: true, schedule: record });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireRole(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  try {
    await CrmSheetsService.assertHealthy();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id') || searchParams.get('scheduleId') || searchParams.get('followupId');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID_REQUIRED' }, { status: 400 });
    }
    await followupRepository.deleteById(id);
    return NextResponse.json({ success: true, message: 'Schedule deleted successfully.' });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}
