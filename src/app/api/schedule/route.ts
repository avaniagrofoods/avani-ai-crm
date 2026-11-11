import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import { Schedule } from '@/models/Schedule';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  try {
    const conn = await connectToDatabase();
    const readyState = mongoose.connection?.readyState ?? conn?.connection?.readyState;
    if (!conn || readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const query: any = {};
    if (status) query.status = status;

    let schedules = await Schedule.find(query).sort({ scheduledAt: -1 }).limit(100);

    // If fresh, seed initial reference items
    if (schedules.length === 0 && !status) {
      const seedItems = [
        {
          scheduleId: 'SCHED-20261015-0001',
          title: 'Diwali Festive Loan Advisory Broadcast',
          type: 'Broadcast',
          scheduledAt: new Date('2026-10-15T10:00:00+05:30'),
          date: '2026-10-15',
          time: '10:00 AM',
          targetAudience: 'ALL_LEADS',
          templateName: 'Avani_Loan_Welcome',
          status: 'COMPLETED',
          executedAt: new Date('2026-10-15T10:00:12+05:30'),
          executionResult: { dispatched: 24, failed: 0 }
        },
        {
          scheduleId: 'SCHED-20261105-0002',
          title: 'Doctor Loan Inquiry Follow-Up Queue',
          type: 'Broadcast',
          scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          time: '11:00 AM',
          targetAudience: 'DOCTOR_LEADS',
          templateName: 'drip_day_1_eligibility',
          status: 'SCHEDULED'
        },
        {
          scheduleId: 'SCHED-20261110-0003',
          title: 'Monthly Document Pending Advisory Call Task',
          type: 'Task Reminder',
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          time: '15:30 PM',
          targetAudience: 'DOCUMENTS_PENDING',
          status: 'SCHEDULED'
        }
      ];

      for (const item of seedItems) {
        await Schedule.findOneAndUpdate(
          { scheduleId: item.scheduleId },
          { $set: item },
          { upsert: true }
        );
      }
      schedules = await Schedule.find(query).sort({ scheduledAt: -1 }).limit(100);
    }

    return NextResponse.json({
      success: true,
      schedules,
      total: schedules.length
    });

  } catch (error: any) {
    console.error('[ScheduleAPI] Error loading schedules:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { title, date, time, type, targetAudience, templateName, messageText } = body;

    if (!title || !date) {
      return NextResponse.json(
        { success: false, error: 'MISSING_FIELDS', message: 'Title and date are required.' },
        { status: 400 }
      );
    }

    // Parse scheduled date/time
    let scheduledDateObj: Date;
    if (time) {
      // Parse e.g. "10:00" or "14:30" or "10:00 AM"
      const cleanTime = time.trim();
      const combined = `${date}T${cleanTime.includes(':') && cleanTime.length <= 5 ? cleanTime + ':00' : '10:00:00'}`;
      scheduledDateObj = new Date(combined);
      if (isNaN(scheduledDateObj.getTime())) {
        scheduledDateObj = new Date(`${date} 10:00:00`);
      }
    } else {
      scheduledDateObj = new Date(`${date} 10:00:00`);
    }

    if (isNaN(scheduledDateObj.getTime())) {
      return NextResponse.json(
        { success: false, error: 'INVALID_DATE', message: 'Invalid date or time format provided.' },
        { status: 400 }
      );
    }

    // Deterministic Idempotency Key & Duplicate Prevention
    const idempotencyKey = `SCHED:${title.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}:${date}:${time || 'default'}`;
    const existing = await Schedule.findOne({ idempotencyKey });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'DUPLICATE_SCHEDULE',
          message: 'A schedule with identical parameters already exists (idempotent match).',
          schedule: existing,
          isDuplicate: true
        },
        { status: 409 }
      );
    }

    const scheduleId = `SCHED-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newSchedule = await Schedule.create({
      scheduleId,
      title: title.trim(),
      type: type || 'Broadcast',
      scheduledAt: scheduledDateObj,
      date,
      time: time || '10:00 AM',
      targetAudience: targetAudience || 'ALL_LEADS',
      templateName: templateName || 'Avani_Loan_Welcome',
      messageText,
      status: 'SCHEDULED',
      idempotencyKey
    });

    return NextResponse.json({
      success: true,
      message: `Schedule created successfully for ${scheduledDateObj.toLocaleString('en-IN')}`,
      schedule: newSchedule
    });

  } catch (error: any) {
    console.error('[ScheduleAPI] Error creating schedule:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireRole(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const scheduleId = searchParams.get('scheduleId');

    if (!id && !scheduleId) {
      return NextResponse.json(
        { success: false, error: 'ID_REQUIRED', message: 'Either id or scheduleId is required.' },
        { status: 400 }
      );
    }

    const query = id ? { _id: id } : { scheduleId };
    await Schedule.findOneAndDelete(query);

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted successfully.'
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireRole(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { scheduleId, id, action, status, title, time, date, targetAudience, templateName, messageText } = body;

    if (!id && !scheduleId) {
      return NextResponse.json(
        { success: false, error: 'ID_REQUIRED', message: 'Either id or scheduleId is required.' },
        { status: 400 }
      );
    }

    const query = id ? { _id: id } : { scheduleId };
    const updateFields: any = { updatedAt: new Date() };

    if (action) {
      updateFields.status = action === 'CANCEL' ? 'CANCELLED' : (action === 'RESUME' ? 'SCHEDULED' : 'COMPLETED');
    } else if (status) {
      updateFields.status = status;
    }

    if (title) updateFields.title = title.trim();
    if (time) updateFields.time = time.trim();
    if (date) updateFields.date = date.trim();
    if (targetAudience) updateFields.targetAudience = targetAudience;
    if (templateName) updateFields.templateName = templateName;
    if (messageText !== undefined) updateFields.messageText = messageText;

    if (date || time) {
      const targetDate = date || body.existingDate;
      const targetTime = time || body.existingTime;
      if (targetDate) {
        const combined = `${targetDate}T${targetTime && targetTime.includes(':') && targetTime.length <= 5 ? targetTime + ':00' : '10:00:00'}`;
        const newDateObj = new Date(combined);
        if (!isNaN(newDateObj.getTime())) {
          updateFields.scheduledAt = newDateObj;
        }
      }
    }

    const updated = await Schedule.findOneAndUpdate(
      query,
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Schedule updated successfully`,
      schedule: updated
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
