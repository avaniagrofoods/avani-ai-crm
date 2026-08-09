import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Contact } from '@/models/Contact';

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    
    let query = {};
    if (phone) query = { phone };

    const contacts = await Contact.find(query).sort({ createdAt: -1 }).limit(200);
    return NextResponse.json({ success: true, contacts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectToDatabase();
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
