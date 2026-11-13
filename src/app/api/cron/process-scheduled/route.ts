import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Schedule } from '@/models/Schedule';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';
import { OptOutEngine } from '@/lib/optout-engine';
import { ProviderRouter } from '@/lib/provider-router';
import { requireRole, constantTimeEqualStrings } from '@/lib/auth';
import { evaluateBulkBroadcastPolicy } from '@/lib/safeguards';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET?.trim();
    const hasValidCronHeader = Boolean(
      cronSecret && authHeader && constantTimeEqualStrings(authHeader, `Bearer ${cronSecret}`)
    );

    if (!hasValidCronHeader) {
      const auth = await requireRole(req, ['ADMIN']);
      if (!auth.ok) return auth.response;
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
      await Schedule.updateOne(
        { _id: schedule._id, status: 'SCHEDULED' },
        { $set: { status: 'PROCESSING', updatedAt: new Date() } }
      );

      let dispatchedCount = 0;
      let failedCount = 0;
      let suppressedCount = 0;

      if (schedule.type === 'Broadcast') {
        const bulkPolicy = evaluateBulkBroadcastPolicy();
        if (!bulkPolicy.allowed) {
          const executionResult = {
            dispatched: 0,
            failed: 0,
            suppressed: 0,
            blockedByPolicy: true,
            reason: bulkPolicy.error || 'BROADCAST_DISABLED',
            completedAt: new Date().toISOString()
          };

          await Schedule.updateOne(
            { _id: schedule._id },
            {
              $set: {
                status: 'CANCELLED',
                executedAt: new Date(),
                executionResult,
                updatedAt: new Date()
              }
            }
          );

          executedResults.push({
            scheduleId: schedule.scheduleId,
            title: schedule.title,
            status: 'CANCELLED',
            result: executionResult
          });
          continue;
        }

        const leadQuery: any = {
          isOptedOut: { $ne: true },
          status: { $nin: ['Closed', 'Rejected', 'Not Interested', 'OPTED_OUT'] },
          consentStatus: { $nin: ['DENIED', 'WITHDRAWN'] }
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
          const freshLead: any = (await Lead.findById(lead._id).lean()) || lead;
          const { raw10, variants: phoneVariants } = OptOutEngine.getPhoneVariants(freshLead.phone || '');
          const optedOutSiblingLead = phoneVariants.length > 0
            ? await Lead.exists({
                $or: [
                  { phone: { $in: phoneVariants } },
                  ...(raw10.length === 10 ? [{ normalizedMobile: raw10 }] : [])
                ],
                $and: [
                  {
                    $or: [
                      { isOptedOut: true },
                      { status: 'OPTED_OUT' },
                      { consentStatus: { $in: ['DENIED', 'WITHDRAWN'] } }
                    ]
                  }
                ]
              })
            : null;
          const optedOutContact = phoneVariants.length > 0
            ? await Contact.exists({ phone: { $in: phoneVariants }, optedIn: false })
            : null;

          if (
            freshLead.isOptedOut ||
            freshLead.status === 'OPTED_OUT' ||
            freshLead.consentStatus === 'DENIED' ||
            freshLead.consentStatus === 'WITHDRAWN' ||
            Boolean(optedOutSiblingLead) ||
            Boolean(optedOutContact)
          ) {
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

            if (dispatchRes.success) dispatchedCount++;
            else failedCount++;
          } catch {
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
