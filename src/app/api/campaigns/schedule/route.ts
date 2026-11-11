import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Schedule } from '@/models/Schedule';
import { requireAuth, requireRole } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { campaignName, scheduledAt, templateName, leads, name, campaignType } = body;

    if (!scheduledAt) {
      return NextResponse.json({ error: 'Scheduled date and time are required' }, { status: 400 });
    }

    const scheduledDateObj = new Date(scheduledAt);
    if (isNaN(scheduledDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduled date/time' }, { status: 400 });
    }

    const title = name || campaignName || `Campaign ${new Date().toISOString().substring(0, 10)}`;
    const scheduleId = `SCHED-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newSchedule = await Schedule.create({
      scheduleId,
      title,
      type: campaignType === 'whatsapp' ? 'Broadcast' : 'Follow-up Call',
      scheduledAt: scheduledDateObj,
      date: scheduledDateObj.toISOString().split('T')[0],
      time: scheduledDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      targetAudience: leads && leads.length ? `${leads.length}_LEADS` : 'ALL_LEADS',
      templateName: templateName || 'Avani_Loan_Welcome',
      status: 'SCHEDULED'
    });

    return NextResponse.json({
      success: true,
      message: `Campaign successfully scheduled for ${scheduledDateObj.toLocaleString('en-IN')}`,
      campaign: newSchedule
    });
  } catch (error: any) {
    console.error("Schedule Campaign Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json({ success: true, campaigns: [] });
    }

    const campaigns = await Schedule.find({}).sort({ scheduledAt: -1 }).limit(50);
    return NextResponse.json({ success: true, campaigns });
  } catch {
    return NextResponse.json({ success: true, campaigns: [] });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireRole(request, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { campaignId, action } = body;
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    const targetStatus = action === 'PAUSE' || action === 'CANCEL' ? 'CANCELLED' : 'SCHEDULED';
    const updated = await Schedule.findOneAndUpdate(
      { $or: [{ scheduleId: campaignId }, { _id: campaignId }] },
      { $set: { status: targetStatus, updatedAt: new Date() } },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      message: `Campaign status updated to ${targetStatus}`,
      campaign: updated || { id: campaignId, status: targetStatus }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
