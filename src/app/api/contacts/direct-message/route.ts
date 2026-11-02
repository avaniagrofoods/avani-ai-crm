import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Contact } from '@/models/Contact';
import { Lead } from '@/models/Lead';
import { Message } from '@/models/Message';
import { ProviderRouter } from '@/lib/provider-router';

export async function POST(req: Request) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Persistence unavailable.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { phone, message, name, templateName, templateParams } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'PHONE_REQUIRED', message: 'Phone number is required.' },
        { status: 400 }
      );
    }

    if (!message && !templateName) {
      return NextResponse.json(
        { success: false, error: 'CONTENT_REQUIRED', message: 'Either message text or templateName is required.' },
        { status: 400 }
      );
    }

    // Normalize phone number
    let cleanPhone = phone.trim().replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.length === 10 ? '+91' + cleanPhone : '+' + cleanPhone;
    }

    // Check opt-out status across Lead and Contact
    const [existingLead, existingContact] = await Promise.all([
      Lead.findOne({ phone: { $in: [cleanPhone, cleanPhone.replace('+91', ''), cleanPhone.replace('+', '')] } }),
      Contact.findOne({ phone: { $in: [cleanPhone, cleanPhone.replace('+91', ''), cleanPhone.replace('+', '')] } })
    ]);

    if (existingLead?.isOptedOut || existingLead?.status === 'OPTED_OUT' || existingContact?.optedIn === false) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'CONTACT_OPTED_OUT', 
          message: 'Recipient has opted out of WhatsApp communications under TRAI / DPDP compliance.' 
        },
        { status: 403 }
      );
    }

    const contactName = name || existingContact?.name || existingLead?.name || 'Valued Customer';

    // Dispatch via ProviderRouter (defaults to CHATMITRA)
    const dispatchRes = await ProviderRouter.dispatchMessage({
      phone: cleanPhone,
      name: contactName,
      messageText: message,
      templateName,
      templateParams,
      journeyStage: 'DIRECT_MESSAGE',
      leadId: existingLead?.leadId,
      campaignId: `DIRECT_${Date.now()}`
    });

    // Also update last interaction timestamp on Lead if present
    if (existingLead) {
      await Lead.updateOne(
        { _id: existingLead._id },
        { 
          $set: { 
            lastInteractionAt: new Date(),
            updatedAt: new Date()
          } 
        }
      );
    }

    return NextResponse.json({
      success: dispatchRes.success,
      message: dispatchRes.success ? 'Message sent successfully.' : 'Failed to deliver message via WhatsApp provider.',
      provider: dispatchRes.provider,
      providerMessageId: dispatchRes.providerMessageId,
      status: dispatchRes.status,
      idempotencyKey: dispatchRes.idempotencyKey
    });

  } catch (error: any) {
    console.error('[DirectMessageAPI] Error sending direct message:', error);
    return NextResponse.json(
      { success: false, error: 'DISPATCH_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
