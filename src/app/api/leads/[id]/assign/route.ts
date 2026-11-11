import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Advisor } from '@/models/Advisor';
import { requireRole, isValidObjectId } from '@/lib/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const resolvedParams = await params;
    if (!isValidObjectId(resolvedParams.id)) {
      return NextResponse.json({ success: false, error: 'Invalid lead ID format.' }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { advisorName, advisorEmail, advisorRole, notes } = body;

    if (!advisorName || !advisorEmail) {
      return NextResponse.json(
        { success: false, error: 'Advisor name and email are required.' },
        { status: 400 }
      );
    }

    const lead = await Lead.findById(resolvedParams.id);
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    const previousAdvisor = lead.assignedAdvisor?.name || 'Unassigned';

    lead.assignedAdvisor = {
      name: advisorName,
      email: String(advisorEmail).trim().toLowerCase(),
      role: advisorRole || 'LOAN_ADVISOR',
      phone: body.advisorPhone || '+91 72491 08474',
      assignedAt: new Date()
    };

    if (!lead.assignmentHistory) lead.assignmentHistory = [];
    lead.assignmentHistory.push({
      advisorName,
      advisorEmail: String(advisorEmail).trim().toLowerCase(),
      assignedBy: auth.session.name,
      assignedAt: new Date(),
      notes: notes || `Reassigned from ${previousAdvisor} to ${advisorName}`
    });

    lead.updatedAt = new Date();
    await lead.save();

    await Advisor.findOneAndUpdate(
      { email: String(advisorEmail).trim().toLowerCase() },
      { $inc: { activeLeadsCount: 1 } }
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      leadId: lead.leadId,
      assignedAdvisor: lead.assignedAdvisor,
      assignmentHistory: lead.assignmentHistory
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
