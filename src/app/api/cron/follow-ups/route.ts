import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { FollowUpEngine } from '@/lib/followup-engine';
import { requireRole, constantTimeEqualStrings } from '@/lib/auth';
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

    // APR-008 Phase 3B: Preserve scheduled Vercel Cron health cleanly without MongoDB customer fallback.
    if (process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true') {
      return NextResponse.json(
        {
          success: true,
          skipped: true,
          reason: 'CANONICAL_SHEETS_MODE_LEGACY_MONGO_DRIP_PAUSED',
          timestamp: new Date().toISOString(),
          workflow: 'AVANI_LOAN_DRIP_D0_D15',
          processedCount: 0,
          results: []
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const conn = await connectToDatabase();
    const readyState = mongoose.connection?.readyState ?? conn?.connection?.readyState;
    if (!conn || readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline.' },
        { status: 503 }
      );
    }

    const result = await FollowUpEngine.processDripFollowUps(50);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      workflow: 'AVANI_LOAN_DRIP_D0_D15',
      processedCount: result.processedCount,
      results: result.results
    });
  } catch (error: unknown) {
    console.error('[CronFollowUp] Error processing drip follow-ups:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
