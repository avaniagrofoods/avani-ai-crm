import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Contact } from '@/models/Contact';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const resolvedParams = await params;
    const contact = await Contact.findById(resolvedParams.id);
    if (!contact) return NextResponse.json({ success: false, error: 'Contact not found' }, { status: 404 });
    return NextResponse.json({ success: true, contact });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const resolvedParams = await params;
    
    delete body._id;
    body.updatedAt = new Date();

    const contact = await Contact.findByIdAndUpdate(
      resolvedParams.id,
      { $set: body },
      { new: true }
    );

    if (!contact) return NextResponse.json({ success: false, error: 'Contact not found' }, { status: 404 });

    return NextResponse.json({ success: true, contact });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
