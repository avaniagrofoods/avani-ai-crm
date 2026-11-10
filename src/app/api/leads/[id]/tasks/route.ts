import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { FollowUpTaskEngine } from '@/lib/followup-task-engine';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json({ success: false, error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }
    const resolvedParams = await params;
    const lead = await Lead.findById(resolvedParams.id);
    if (!lead) return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });

    const evaluatedTasks = FollowUpTaskEngine.evaluateTaskStatuses(lead.followUpTasks || []);
    return NextResponse.json({ success: true, tasks: evaluatedTasks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json({ success: false, error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }
    const resolvedParams = await params;
    const lead = await Lead.findById(resolvedParams.id);
    if (!lead) return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });

    const body = await req.json();

    // If request asks to initialize standard sequence:
    if (body.action === 'INITIALIZE_STANDARD_SEQUENCE') {
      const standardTasks = FollowUpTaskEngine.generateInitialTasks(
        lead.leadId || lead._id.toString(),
        lead.assignedAdvisor?.name || 'Sachin Shinde'
      );
      lead.followUpTasks = standardTasks;
      lead.updatedAt = new Date();
      await lead.save();
      return NextResponse.json({ success: true, tasks: lead.followUpTasks });
    }

    const { title, timingStage, dueDate, priority, notes, assignedTo } = body;
    if (!title || !dueDate) {
      return NextResponse.json({ success: false, error: 'Task title and due date are required.' }, { status: 400 });
    }

    const newTask = {
      taskId: `TSK-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      title,
      timingStage: timingStage || 'CUSTOM',
      dueDate: new Date(dueDate),
      priority: priority || 'MEDIUM',
      status: 'PENDING',
      assignedTo: assignedTo || lead.assignedAdvisor?.name || 'Sachin Shinde',
      notes: notes || ''
    };

    if (!lead.followUpTasks) lead.followUpTasks = [];
    lead.followUpTasks.push(newTask);
    lead.updatedAt = new Date();
    await lead.save();

    return NextResponse.json({ success: true, task: newTask, totalTasks: lead.followUpTasks.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json({ success: false, error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }
    const resolvedParams = await params;
    const lead = await Lead.findById(resolvedParams.id);
    if (!lead) return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });

    const body = await req.json();
    const { taskId, status, notes, completedBy, dueDate, priority } = body;

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'taskId is required' }, { status: 400 });
    }

    const taskIndex = (lead.followUpTasks || []).findIndex((t: any) => t.taskId === taskId);
    if (taskIndex === -1) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    const task = lead.followUpTasks[taskIndex];
    if (status) {
      task.status = status;
      if (status === 'COMPLETED') {
        task.completedAt = new Date();
        task.completedBy = completedBy || 'Sachin Shinde';
      }
    }
    if (notes) task.notes = notes;
    if (dueDate) task.dueDate = new Date(dueDate);
    if (priority) task.priority = priority;

    lead.followUpTasks[taskIndex] = task;
    lead.updatedAt = new Date();
    await lead.save();

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
