import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Contact } from '@/models/Contact';
import { Lead } from '@/models/Lead';
import { Message } from '@/models/Message';
import { requireAuth, requireRole, buildLeadVisibilityFilter } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Production persistence unavailable.' },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    let query: Record<string, any> = {};
    if (phone) query = { phone };

    if (auth.session.role !== 'ADMIN') {
      const visibilityFilter = buildLeadVisibilityFilter(auth.session);
      const assignedLeads = await Lead.find(visibilityFilter).select('phone normalizedMobile').lean();
      const allowedPhones = new Set<string>();
      for (const l of assignedLeads as any[]) {
        const p = String(l.phone || l.normalizedMobile || '');
        const digits = p.replace(/\D/g, '').slice(-10);
        if (digits) {
          allowedPhones.add(digits);
          allowedPhones.add(`+91${digits}`);
          allowedPhones.add(`91${digits}`);
          allowedPhones.add(`0${digits}`);
        }
        if (p) allowedPhones.add(p);
      }
      const allowedList = Array.from(allowedPhones);
      if (allowedList.length === 0) {
        return NextResponse.json({ success: true, contacts: [] });
      }
      query = phone ? { $and: [{ phone }, { phone: { $in: allowedList } }] } : { phone: { $in: allowedList } };
    }

    const contacts = await Contact.find(query).sort({ updatedAt: -1, createdAt: -1 }).limit(200).lean();

    const contactsWithMessages = await Promise.all(
      contacts.map(async (c: any) => {
        const cPhone = c.phone || c.mobile || c.customerPhone || '';
        const rawDigits = cPhone.replace(/\D/g, '');
        const last10 = rawDigits.slice(-10);
        const phoneVariants = Array.from(new Set([
          cPhone,
          last10,
          `+91${last10}`,
          `91${last10}`,
          `0${last10}`
        ].filter(Boolean)));

        const lastMsg = await Message.findOne({
          $or: [
            { phone: { $in: phoneVariants } },
            { senderPhone: { $in: phoneVariants } },
            { recipientPhone: { $in: phoneVariants } }
          ]
        }).sort({ createdAt: -1 });

        if (lastMsg) {
          return {
            ...c,
            phone: c.phone || last10,
            messages: [{
              content: lastMsg.text || (lastMsg.templateName ? `[${lastMsg.templateName}]` : ''),
              timestamp: lastMsg.createdAt
            }]
          };
        }
        return {
          ...c,
          phone: c.phone || last10
        };
      })
    );

    return NextResponse.json({ success: true, contacts: contactsWithMessages });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN', 'ADVISOR']);
    if (!auth.ok) return auth.response;

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Production persistence unavailable.' },
        { status: 503 }
      );
    }
    const body = await req.json();

    const { name, phone, email, city, optedIn } = body;

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required.' }, { status: 400 });
    }

    const contact = await Contact.findOneAndUpdate(
      { phone },
      {
        $set: {
          name, phone, email, city, optedIn, updatedAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    return NextResponse.json({ success: true, contact });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
