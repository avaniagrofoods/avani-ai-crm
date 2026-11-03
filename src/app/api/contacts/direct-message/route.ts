import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Contact } from '@/models/Contact';
import { Lead } from '@/models/Lead';
import { Message } from '@/models/Message';
import { ProviderRouter } from '@/lib/provider-router';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const conn = await connectToDatabase();
    const readyState = mongoose.connection?.readyState ?? conn?.connection?.readyState;
    if (!conn || readyState !== 1) {
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
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return NextResponse.json(
        { success: false, error: 'INVALID_PHONE', message: 'Valid phone number with at least 10 digits is required.' },
        { status: 400 }
      );
    }
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = digitsOnly.length === 10 ? '+91' + digitsOnly : '+' + digitsOnly;
    }

    // MANDATORY SAFETY INVARIANT: Restrict live dispatch strictly to authorized test contact
    if (process.env.PROVIDER_MODE === 'live' && digitsOnly !== '919175635165' && digitsOnly !== '9175635165') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'LIVE_DISPATCH_RESTRICTED', 
          message: 'Safety invariant: Live WhatsApp dispatch is strictly restricted to authorized test contact +91 91756 35165.' 
        },
        { status: 403 }
      );
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
