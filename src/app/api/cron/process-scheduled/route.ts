import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { triggerBlandCall } from '@/lib/bland';

export async function GET() {
  try {
    const selectSql = `
      SELECT * FROM "ScheduledCampaign"
      WHERE "status" = 'PENDING' AND "scheduledAt" <= NOW()
      ORDER BY "scheduledAt" ASC
      LIMIT 5;
    `;
    const res = await query(selectSql);

    if (!res.rows || res.rows.length === 0) {
      return NextResponse.json({ success: true, message: "No scheduled campaigns pending execution." });
    }

    const executedCampaigns = [];

    for (const campaign of res.rows) {
      const leads = campaign.leads || [];
      console.log(`Processing scheduled campaign: ${campaign.name} with ${leads.length} leads`);

      for (const lead of leads) {
        const name = lead.name || lead.Name;
        const phone = lead.phone || lead.Phone || lead.PhoneNumber;
        const loanType = lead.loanType || lead.LoanType || 'Personal Loan';

        if (name && phone) {
          let formattedPhone = phone.toString().trim();
          if (!formattedPhone.startsWith('+')) {
            formattedPhone = formattedPhone.length === 10 ? '+91' + formattedPhone : '+' + formattedPhone;
          }
          try {
            await triggerBlandCall(formattedPhone, name, loanType);
          } catch (err: any) {
            console.error(`Scheduled call error for ${name}:`, err.message);
          }
        }
      }

      await query(`UPDATE "ScheduledCampaign" SET "status" = 'COMPLETED' WHERE id = $1`, [campaign.id]);
      executedCampaigns.push(campaign.id);
    }

    return NextResponse.json({ success: true, processedCount: executedCampaigns.length, campaignIds: executedCampaigns });
  } catch (error: any) {
    console.error("Cron Processing Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
