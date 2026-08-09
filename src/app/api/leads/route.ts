import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Contact } from '@/models/Contact';

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    
    let query = {};
    if (phone) query = { phone };

    const leads = await Lead.find(query).sort({ createdAt: -1 }).limit(200);
    return NextResponse.json({ success: true, leads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const { name, phone, loanType, email, city, leadSource, campaign } = body;

    if (!name || !phone || !loanType) {
      return NextResponse.json({ success: false, error: 'Name, phone, and loanType are required.' }, { status: 400 });
    }

    // Upsert Lead
    const lead = await Lead.findOneAndUpdate(
      { phone },
      { 
        $set: { 
          name, phone, loanType, email, city, leadSource, campaign, 
          updatedAt: new Date()
        } 
      },
      { new: true, upsert: true }
    );

    // Upsert Contact to maintain synchronized Contact book
    await Contact.findOneAndUpdate(
      { phone },
      { 
        $set: { 
          name, phone, email, city, leadId: lead._id, updatedAt: new Date()
        } 
      },
      { new: true, upsert: true }
    );

    return NextResponse.json({ success: true, lead });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
