import { NextResponse } from 'next/server';
import {
  CrmSheetsService,
  customerRepository,
  consentRepository,
  messageEventRepository,
  SheetsCrmError
} from '@/lib/google-sheets';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    await CrmSheetsService.assertHealthy();
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    const [customers, consents, msgEvents] = await Promise.all([
      customerRepository.findAll(),
      consentRepository.findAll(),
      messageEventRepository.findAll()
    ]);

    const consentMap = new Map(consents.map((c) => [c.customer_id, c]));
    let filtered = customers;
    if (phone) {
      const digits = phone.replace(/\D/g, '').slice(-10);
      filtered = customers.filter(
        (c) => c.mobile_number === phone || (digits && c.mobile_number.endsWith(digits))
      );
    }

    const contactsWithMessages = filtered.map((c) => {
      const consent = consentMap.get(c.customer_id);
      const custEvents = msgEvents
        .filter((m) => m.customer_id === c.customer_id)
        .sort((a, b) => (a.event_timestamp < b.event_timestamp ? 1 : -1));
      const lastEvent = custEvents[0];

      return {
        _id: c.customer_id,
        customerId: c.customer_id,
        name: c.customer_name,
        phone: c.mobile_number,
        city: c.city,
        optedIn: consent ? consent.optout_status !== 'OPTED_OUT' : c.record_status !== 'OPTED_OUT',
        recordStatus: c.record_status,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        ...(lastEvent
          ? {
              messages: [
                {
                  content: `[${lastEvent.direction.toUpperCase()}:${lastEvent.message_type}] (${lastEvent.delivery_status})`,
                  timestamp: lastEvent.event_timestamp
                }
              ]
            }
          : {})
      };
    });

    return NextResponse.json({ success: true, contacts: contactsWithMessages });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN', 'ADVISOR']);
    if (!auth.ok) return auth.response;

    await CrmSheetsService.assertHealthy();
    const body = await req.json();
    const { name, phone, city, optedIn, enquiry_source } = body;

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required.' }, { status: 400 });
    }

    const isOptedOut = optedIn === false;
    const { record: customer } = await customerRepository.upsertCustomer({
      customer_name: name || 'Valued Customer',
      mobile_number: phone,
      city: city || 'Latur',
      enquiry_source: enquiry_source || 'CRM_MANUAL',
      record_status: isOptedOut ? 'OPTED_OUT' : 'ACTIVE'
    });

    await consentRepository.upsertConsent({
      customer_id: customer.customer_id,
      channel: 'WHATSAPP',
      consent_status: isOptedOut ? 'WITHDRAWN' : 'GRANTED',
      consent_source: 'CRM_CONTACT_BOOK',
      optout_status: isOptedOut ? 'OPTED_OUT' : 'OPTED_IN'
    });

    return NextResponse.json({
      success: true,
      contact: {
        _id: customer.customer_id,
        customerId: customer.customer_id,
        name: customer.customer_name,
        phone: customer.mobile_number,
        city: customer.city,
        optedIn: !isOptedOut,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at
      }
    });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}
