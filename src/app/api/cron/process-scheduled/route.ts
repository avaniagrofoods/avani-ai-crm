import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Schedule } from '@/models/Schedule';
import { Lead } from '@/models/Lead';
import { ProviderRouter } from '@/lib/provider-router';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'avani_cron_secret';
    
    // Validate authorization if header provided
    if (authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conn = await connectToDatabase();
    const readyState = mongoose.connection?.readyState ?? conn?.connection?.readyState;
    if (!conn || readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline.' },
        { status: 503 }
      );
    }

    const now = new Date();

    // Find pending schedules due for execution
    const pendingSchedules = await Schedule.find({
      status: 'SCHEDULED',
      scheduledAt: { $lte: now }
    }).limit(10);

    if (pendingSchedules.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scheduled campaigns pending execution.',
        processedCount: 0
      });
    }

    const executedResults = [];

    for (const schedule of pendingSchedules) {
      // Set to PROCESSING atomically to prevent concurrent double-execution
      await Schedule.updateOne(
        { _id: schedule._id, status: 'SCHEDULED' },
        { $set: { status: 'PROCESSING', updatedAt: new Date() } }
      );

      console.log(`[ProcessScheduled] Executing schedule ${schedule.scheduleId}: "${schedule.title}" (${schedule.type})`);

      let dispatchedCount = 0;
      let failedCount = 0;
      let suppressedCount = 0;

      if (schedule.type === 'Broadcast') {
        // Query eligible leads
        let leadQuery: any = {
          isOptedOut: { $ne: true },
          status: { $nin: ['Closed', 'Rejected', 'Not Interested', 'OPTED_OUT'] }
        };

        if (schedule.targetAudience === 'DOCTOR_LEADS') {
          leadQuery.$or = [
            { loanType: /doctor/i },
            { profession: /doctor/i },
            { employmentType: /doctor/i }
          ];
        } else if (schedule.targetAudience === 'DOCUMENTS_PENDING') {
          leadQuery.status = 'Documents Pending';
        }

        const candidateLeads = await Lead.find(leadQuery).limit(50);

        for (const lead of candidateLeads) {
          if (lead.isOptedOut || lead.status === 'OPTED_OUT' || lead.consentStatus === 'DENIED') {
            suppressedCount++;
            continue;
          }

          try {
            const dispatchRes = await ProviderRouter.dispatchMessage({
              phone: lead.phone,
              name: lead.name || 'Valued Customer',
              templateName: schedule.templateName || 'Avani_Loan_Welcome',
              templateParams: [lead.name || 'Valued Customer'],
              messageText: schedule.messageText,
              campaignId: schedule.scheduleId,
              leadId: lead.leadId,
              journeyStage: 'SCHEDULED_BROADCAST'
            });

            if (dispatchRes.success) {
              dispatchedCount++;
            } else {
              failedCount++;
            }
          } catch (e) {
            failedCount++;
          }
        }
      }

      const executionResult = {
        dispatched: dispatchedCount,
        failed: failedCount,
        suppressed: suppressedCount,
        completedAt: new Date().toISOString()
      };

      await Schedule.updateOne(
        { _id: schedule._id },
        {
          $set: {
            status: 'COMPLETED',
            executedAt: new Date(),
            executionResult,
            updatedAt: new Date()
          }
        }
      );

      executedResults.push({
        scheduleId: schedule.scheduleId,
        title: schedule.title,
        status: 'COMPLETED',
        result: executionResult
      });
    }

    return NextResponse.json({
      success: true,
      processedCount: executedResults.length,
      schedules: executedResults
    });

  } catch (error: any) {
    console.error('[ProcessScheduled] Error executing scheduled tasks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
