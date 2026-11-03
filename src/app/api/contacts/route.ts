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

    // Attach latest message snippet for Inbox UI compatibility
    const contactsWithMessages = await Promise.all(
      contacts.map(async (c: any) => {
        const lastMsg = await Message.findOne({
          $or: [
            { phone: c.phone },
            { senderPhone: c.phone },
            { recipientPhone: c.phone }
          ]
        }).sort({ createdAt: -1 });

        if (lastMsg) {
          return {
            ...c,
            messages: [{ content: lastMsg.text || '' }]
          };
        }
        return c;
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
