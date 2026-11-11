import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';
import { Broadcast } from '@/models/Broadcast';
import { Message } from '@/models/Message';
import { Call } from '@/models/Call';
import { requireRole, isValidObjectId } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid broadcast ID format' }, { status: 400 });
    }

    await connectToDatabase();

    if (mongoose.connection.readyState !== 1) {
      return NextResponse.json({
        success: false,
        mode: "degraded",
        database: "offline",
        statsVerified: false
      });
    }

    const broadcast = await Broadcast.findById(id);
    if (!broadcast) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 });
    }

    const stats = {
      queued: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      calling: 0,
      answered: 0,
      noAnswer: 0,
      completed: 0
    };

    if (broadcast.broadcastType === 'whatsapp') {
      const messages = await Message.find({ broadcastId: id });
      stats.queued = messages.filter(m => m.status === 'Queued' || m.status === 'Test').length;
      stats.sent = messages.filter(m => m.status === 'Sent').length;
      stats.delivered = messages.filter(m => m.status === 'Delivered').length;
      stats.read = messages.filter(m => m.status === 'Read').length;
      stats.failed = messages.filter(m => m.status === 'Failed').length;

      broadcast.queuedCount = stats.queued;
      broadcast.sentCount = stats.sent;
      broadcast.deliveredCount = stats.delivered;
      broadcast.readCount = stats.read;
      broadcast.failedCount = stats.failed;
      await broadcast.save();
    } else {
      const calls = await Call.find({ broadcastId: id });
      stats.queued = calls.filter(c => c.status === 'Requested' || c.status === 'Test').length;
      stats.sent = calls.filter(c => c.status === 'Initiated').length;
      stats.calling = calls.filter(c => c.status === 'Ringing').length;
      stats.answered = calls.filter(c => c.status === 'Answered').length;
      stats.noAnswer = calls.filter(c => c.status === 'No Answer').length;
      stats.completed = calls.filter(c => c.status === 'Completed').length;
      stats.failed = calls.filter(c => c.status === 'Failed').length;

      broadcast.queuedCount = stats.queued;
      broadcast.sentCount = stats.sent;
      broadcast.deliveredCount = stats.answered + stats.completed;
      broadcast.failedCount = stats.failed + stats.noAnswer;
      await broadcast.save();
    }

    return NextResponse.json({ success: true, stats, broadcast, mode: "production" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
