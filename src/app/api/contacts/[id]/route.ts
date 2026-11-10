import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Contact } from '@/models/Contact';
import { Message } from '@/models/Message';
import { Conversation } from '@/models/Conversation';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Persistence unavailable.' },
        { status: 503 }
      );
    }
    const resolvedParams = await params;
    const contact = await Contact.findById(resolvedParams.id);
    if (!contact) return NextResponse.json({ success: false, error: 'Contact not found' }, { status: 404 });

    // Generate normalized phone variants for robust message matching
    const contactPhone = contact.phone || '';
    const rawDigits = contactPhone.replace(/\D/g, '');
    const last10 = rawDigits.slice(-10);
    const phoneVariants = Array.from(new Set([
      contactPhone,
      last10,
      `+91${last10}`,
      `91${last10}`,
      `0${last10}`
    ].filter(Boolean)));

    // Fetch message history for CRM Inbox conversation panel
    const rawMessages = await Message.find({
      $or: [
        { phone: { $in: phoneVariants } },
        { senderPhone: { $in: phoneVariants } },
        { recipientPhone: { $in: phoneVariants } }
      ]
    }).sort({ createdAt: 1 });

    let messages = rawMessages.map(m => ({
      id: m._id?.toString() || m.messageId || m.providerMessageId || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      content: m.text || (m.templateName ? `[WhatsApp Template: ${m.templateName}]` : ''),
      role: (m.direction === 'inbound' || m.direction === 'INBOUND' || m.direction === 'received' || m.direction === 'Received') ? 'user' : 'assistant',
      status: m.status || 'SENT',
      timestamp: m.createdAt || new Date()
    }));

    // Fallback to conversation history if Message collection is empty
    if (messages.length === 0) {
      const conv = await Conversation.findOne({ 
        customerPhone: { $in: phoneVariants } 
      });
      if (conv && Array.isArray(conv.history)) {
        messages = conv.history.map((h: any, i: number) => ({
          id: `conv_${i}`,
          content: h.text || '',
          role: h.role === 'model' ? 'assistant' : h.role,
          timestamp: h.timestamp || conv.updatedAt || new Date()
        }));
      }
    }

    return NextResponse.json({ success: true, contact, messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Persistence unavailable.' },
        { status: 503 }
      );
    }
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
