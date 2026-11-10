import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Contact } from '@/models/Contact';
import { Message } from '@/models/Message';

export async function GET(req: Request) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Production persistence unavailable.' },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    
    let query = {};
    if (phone) query = { phone };

    const contacts = await Contact.find(query).sort({ updatedAt: -1, createdAt: -1 }).limit(200).lean();

    // Attach latest message snippet for Inbox UI compatibility using normalized variants
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
