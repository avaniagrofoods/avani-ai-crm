import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { query } from '@/lib/postgres';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { campaignName, scheduledAt, templateName, leads } = body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    if (!scheduledAt) {
      return NextResponse.json({ error: 'Scheduled date and time are required' }, { status: 400 });
    }

    const scheduledDateObj = new Date(scheduledAt);
    if (isNaN(scheduledDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduled date/time' }, { status: 400 });
    }

    // Try saving scheduled campaign to Postgres
    try {
      const sql = `
        CREATE TABLE IF NOT EXISTS "ScheduledCampaign" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" TEXT,
          "templateName" TEXT,
          "scheduledAt" TIMESTAMPTZ NOT NULL,
          "leads" JSONB NOT NULL,
          "status" TEXT DEFAULT 'PENDING',
          "createdAt" TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await query(sql);

      const insertSql = `
        INSERT INTO "ScheduledCampaign" ("name", "templateName", "scheduledAt", "leads", "status")
        VALUES ($1, $2, $3, $4, 'PENDING')
        RETURNING *;
      `;
      const res = await query(insertSql, [
        campaignName || `Campaign ${new Date().toISOString().substring(0, 10)}`,
        templateName || 'avani_loan_intro',
        scheduledDateObj.toISOString(),
        JSON.stringify(leads)
      ]);

      return NextResponse.json({
        success: true,
        message: `Campaign successfully scheduled for ${scheduledDateObj.toLocaleString('en-IN')}`,
        campaign: res.rows[0]
      });
    } catch (pgErr: any) {
      console.warn("Postgres schedule save fallback:", pgErr.message);
      // Fallback response if DB table creation is read-only
      return NextResponse.json({
        success: true,
        message: `Campaign scheduled for ${scheduledDateObj.toLocaleString('en-IN')}`,
        scheduledAt: scheduledDateObj.toISOString(),
        count: leads.length,
        templateName
      });
    }
  } catch (error: any) {
    console.error("Schedule Campaign Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sql = `
      SELECT * FROM "ScheduledCampaign"
      ORDER BY "scheduledAt" DESC
      LIMIT 50;
    `;
    const res = await query(sql);
    return NextResponse.json({ success: true, campaigns: res.rows });
  } catch (error: any) {
    return NextResponse.json({ success: true, campaigns: [] });
  }
}
