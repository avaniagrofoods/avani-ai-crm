import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Contact } from '@/models/Contact';
import { Lead } from '@/models/Lead';
import { Broadcast } from '@/models/Broadcast';
import { OptOutEngine } from '@/lib/optout-engine';
import { ProviderRouter } from '@/lib/provider-router';
import { requireRole } from '@/lib/auth';
import { evaluateBulkBroadcastPolicy } from '@/lib/safeguards';

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Persistence unavailable.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { message, templateName, templateParams, filter } = body;

    if (!message && !templateName) {
      return NextResponse.json(
        { success: false, error: 'CONTENT_REQUIRED', message: 'Please provide message text or templateName.' },
        { status: 400 }
      );
    }

    const bulkPolicy = evaluateBulkBroadcastPolicy();
    if (!bulkPolicy.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: bulkPolicy.error,
          message: bulkPolicy.message
        },
        { status: bulkPolicy.status }
      );
    }

    const contactQuery: any = { optedIn: { $ne: false } };
    if (filter?.city) contactQuery.city = filter.city;

    const contacts = await Contact.find(contactQuery).limit(500);

    if (contacts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible opted-in contacts found to receive bulk message.',
        total: 0,
        sent: 0,
        failed: 0,
        suppressed: 0
      });
    }

    const phones = Array.from(
      new Set(contacts.flatMap(c => OptOutEngine.getPhoneVariants(c.phone || '').variants))
    );
    const optedOutLeads = await Lead.find({
      $or: [
        { isOptedOut: true },
        { status: 'OPTED_OUT' },
        { consentStatus: { $in: ['DENIED', 'WITHDRAWN'] } }
      ],
      phone: { $in: phones }
    }).select('phone');
    const optedOutContacts = await Contact.find({
      optedIn: false,
      phone: { $in: phones }
    }).select('phone');

    const optedOutPhoneSet = new Set([
      ...optedOutLeads.flatMap(l => OptOutEngine.getPhoneVariants(l.phone || '').variants),
      ...optedOutContacts.flatMap(c => OptOutEngine.getPhoneVariants(c.phone || '').variants)
    ]);
    const eligibleContacts = contacts.filter(c => !optedOutPhoneSet.has(c.phone));
    const suppressedCount = contacts.length - eligibleContacts.length;

    const broadcastName = `Broadcast_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const broadcastRecord = await Broadcast.create({
      name: broadcastName,
      templateName: templateName || 'direct_bulk_message',
      broadcastType: 'whatsapp',
      status: 'Processing',
      totalContacts: contacts.length,
      validContacts: eligibleContacts.length,
      invalidContacts: suppressedCount,
      queuedCount: eligibleContacts.length,
      sentCount: 0,
      failedCount: 0
    });

    let sentCount = 0;
    let failedCount = 0;
    const campaignId = `BULK_${Date.now()}`;

    const batchSize = 5;
    for (let i = 0; i < eligibleContacts.length; i += batchSize) {
      const batch = eligibleContacts.slice(i, i + batchSize);
      await Promise.all(batch.map(async (contact) => {
        try {
          const res = await ProviderRouter.dispatchMessage({
            phone: contact.phone,
            name: contact.name || 'Valued Customer',
            messageText: message,
            templateName,
            templateParams: templateParams || [contact.name || 'Valued Customer'],
            campaignId,
            journeyStage: 'BULK_BROADCAST'
          });

          if (res.success) sentCount++;
          else failedCount++;
        } catch {
          failedCount++;
        }
      }));
    }

    await Broadcast.findByIdAndUpdate(broadcastRecord._id, {
      $set: {
        status: failedCount === eligibleContacts.length && eligibleContacts.length > 0 ? 'Failed' : 'Completed',
        sentCount,
        failedCount,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: `Bulk message dispatched to ${sentCount} contact(s). ${suppressedCount} contact(s) suppressed due to opt-out.`,
      broadcastId: broadcastRecord._id,
      totalContacts: contacts.length,
      eligibleContacts: eligibleContacts.length,
      sentCount,
      failedCount,
      suppressedCount
    });
  } catch (error: any) {
    console.error('[BulkMessageAPI] Error processing bulk message:', error);
    return NextResponse.json(
      { success: false, error: 'BULK_DISPATCH_FAILED', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
