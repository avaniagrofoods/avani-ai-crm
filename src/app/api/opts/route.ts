import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Contact } from '@/models/Contact';
import { Lead } from '@/models/Lead';

import { getDatabaseLastError } from '@/lib/db';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const conn = await connectToDatabase();
    const readyState = mongoose.connection?.readyState ?? conn?.connection?.readyState;
    if (!conn || readyState !== 1) {
      const lastErr = getDatabaseLastError() || `readyState=${readyState}`;
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: `Database offline: ${lastErr}` },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const filterStatus = searchParams.get('status');

    // Fetch contacts
    const contacts = await Contact.find({}).sort({ updatedAt: -1 }).limit(100);

    // Fetch leads with explicit consent / opt-out states
    const leads = await Lead.find({
      $or: [
        { isOptedOut: true },
        { consentStatus: { $in: ['GRANTED', 'DENIED'] } }
      ]
    }).sort({ updatedAt: -1 }).limit(100);

    const registryMap = new Map<string, any>();

    // First populate from contacts
    for (const c of contacts) {
      const cleanPhone = c.phone;
      registryMap.set(cleanPhone, {
        id: `c_${c._id}`,
        phone: cleanPhone,
        name: c.name || 'Contact',
        status: c.optedIn === false ? 'OPTED_OUT' : 'OPTED_IN',
        source: 'Contact Book / Upload',
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString()
      });
    }

    // Overlay leads (more granular DPDP consent)
    for (const l of leads) {
      let phone = l.phone;
      if (!phone.startsWith('+')) {
        phone = phone.length === 10 ? '+91' + phone : '+' + phone;
      }

      const isOptedOut = l.isOptedOut === true || l.status === 'OPTED_OUT' || l.consentStatus === 'DENIED';
      registryMap.set(phone, {
        id: `l_${l._id}`,
        phone,
        name: l.name || 'Lead',
        status: isOptedOut ? 'OPTED_OUT' : 'OPTED_IN',
        source: l.leadSource || l.source || 'Website Form / Ad',
        createdAt: l.consentTimestamp ? new Date(l.consentTimestamp).toISOString() : (l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString())
      });
    }

    // Default seed items if collection is empty
    if (registryMap.size === 0) {
      registryMap.set('+91 91756 35165', {
        id: 'opt_seed_1',
        phone: '+91 91756 35165',
        name: 'Sachin Shinde',
        status: 'OPTED_IN',
        source: 'Authorized Admin / Test Contact',
        createdAt: new Date().toISOString()
      });
      registryMap.set('+91 72491 08474', {
        id: 'opt_seed_2',
        phone: '+91 72491 08474',
        name: 'Avani Loan Services Helpline',
        status: 'OPTED_IN',
        source: 'Official WABA Business Phone',
        createdAt: new Date().toISOString()
      });
    }

    let items = Array.from(registryMap.values());
    if (filterStatus) {
      items = items.filter(item => item.status === filterStatus);
    }

    return NextResponse.json({
      success: true,
      items,
      total: items.length
    });

  } catch (error: any) {
    console.error('[OptsAPI] Error loading consent registry:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const conn = await connectToDatabase();
    const readyState = mongoose.connection?.readyState ?? conn?.connection?.readyState;
    if (!conn || readyState !== 1) {
      const lastErr = getDatabaseLastError() || `readyState=${readyState}`;
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: `Database offline: ${lastErr}` },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { phone, status, source } = body;

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required.' }, { status: 400 });
    }

    let cleanPhone = phone.trim().replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.length === 10 ? '+91' + cleanPhone : '+' + cleanPhone;
    }

    const isOptedIn = status === 'OPTED_IN';

    // Upsert Contact
    await Contact.findOneAndUpdate(
      { phone: cleanPhone },
      {
        $set: {
          optedIn: isOptedIn,
          updatedAt: new Date()
        },
        $setOnInsert: {
          name: 'Customer',
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    // Update Lead if exists
    await Lead.updateMany(
      { phone: { $in: [cleanPhone, cleanPhone.replace('+91', ''), cleanPhone.replace('+', '')] } },
      {
        $set: {
          isOptedOut: !isOptedIn,
          status: isOptedIn ? 'NEW' : 'OPTED_OUT',
          consentStatus: isOptedIn ? 'GRANTED' : 'DENIED',
          optedOutAt: isOptedIn ? null : new Date(),
          updatedAt: new Date()
        }
      }
    );

    const item = {
      id: `opt_${Date.now()}`,
      phone: cleanPhone,
      status: isOptedIn ? 'OPTED_IN' : 'OPTED_OUT',
      source: source || 'Manual CRM Update',
      createdAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: `Consent updated to ${item.status} for ${cleanPhone}.`,
      item
    });

  } catch (error: any) {
    console.error('[OptsAPI] Error updating consent:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const conn = await connectToDatabase();
    const readyState = mongoose.connection?.readyState ?? conn?.connection?.readyState;
    if (!conn || readyState !== 1) {
      const lastErr = getDatabaseLastError() || `readyState=${readyState}`;
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: `Database offline: ${lastErr}` },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const id = searchParams.get('id');

    if (!phone && !id) {
      return NextResponse.json({ success: false, error: 'Phone or ID required.' }, { status: 400 });
    }

    if (id && id.startsWith('c_')) {
      const contactId = id.replace('c_', '');
      await Contact.findByIdAndDelete(contactId);
    } else if (phone) {
      let cleanPhone = phone.trim().replace(/[^0-9+]/g, '');
      if (!cleanPhone.startsWith('+')) {
        cleanPhone = cleanPhone.length === 10 ? '+91' + cleanPhone : '+' + cleanPhone;
      }
      await Contact.deleteMany({ phone: cleanPhone });
    }

    return NextResponse.json({ success: true, message: 'Consent entry deleted.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
