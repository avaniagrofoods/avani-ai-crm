import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { FollowUpEngine } from '@/lib/followup-engine';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'avani_cron_secret';
    
    // Validate cron authorization token if present
    if (authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline.' },
        { status: 503 }
      );
    }

    // Execute standard AVANI D0–D15 drip sequence
    const result = await FollowUpEngine.processDripFollowUps(50);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      workflow: 'AVANI_LOAN_DRIP_D0_D15',
      processedCount: result.processedCount,
      results: result.results
    });

  } catch (error: any) {
    console.error('[CronFollowUp] Error processing drip follow-ups:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
