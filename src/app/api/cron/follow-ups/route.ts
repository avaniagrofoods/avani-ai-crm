import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { sendAiSensyWhatsApp } from '@/lib/aisensy';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    // Simple cron secret protection
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'avani_cron_secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Find leads where last interaction was more than 24 hours ago, followUpCount is < 3
    // And status is one of the active funnel states
    const activeStatuses = ['New', 'Contacted', 'Documents Requested', 'Documents Partially Received', 'Processing'];
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const staleLeads = await Lead.find({
      status: { $in: activeStatuses },
      lastInteractionAt: { $lt: twentyFourHoursAgo },
      followUpCount: { $lt: 3 }
    }).limit(50);

    let followedUpCount = 0;

    for (const lead of staleLeads) {
      console.log(`Sending automated follow-up to ${lead.phone} (Count: ${lead.followUpCount})`);
      
      const message = `Namaste ${lead.name || 'Customer'}! We noticed you haven't completed your loan application with AVANI LOAN SERVICES yet. Are you still interested in proceeding? Please reply to continue, or let us know if you need any help from our experts!`;

      try {
        await sendAiSensyWhatsApp({
          destination: lead.phone,
          userName: lead.name || 'Customer',
          text: message
        }, `CRON_FOLLOWUP_${Date.now()}_${lead.phone}`);

        // Update lead state
        lead.followUpCount = (lead.followUpCount || 0) + 1;
        lead.lastInteractionAt = new Date(); // Reset timer
        await lead.save();
        
        followedUpCount++;
      } catch (err: any) {
        console.error(`Follow-up failed for ${lead.phone}:`, err.message);
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: followedUpCount, 
      totalFound: staleLeads.length 
    });
  } catch (error: any) {
    console.error("Cron Follow-up Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
