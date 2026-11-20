import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import {
  CrmSheetsService,
  customerRepository,
  consentRepository,
  leadRepository,
  SheetsCrmError
} from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  try {
    await CrmSheetsService.assertHealthy();

    const { searchParams } = new URL(req.url);
    const filterStatus = searchParams.get('status');

    const [customers, consents] = await Promise.all([
      customerRepository.findAll(),
      consentRepository.findAll()
    ]);

    const custMap = new Map(customers.map((c) => [c.customer_id, c]));
    let items = consents.map((c) => {
      const cust = custMap.get(c.customer_id);
      return {
        id: c.consent_id,
        customerId: c.customer_id,
        phone: cust?.mobile_number || '',
        name: cust?.customer_name || 'Customer',
        consentStatus: c.consent_status,
        status: c.optout_status,
        source: c.consent_source,
        createdAt: c.consent_timestamp,
        updatedAt: c.updated_at
      };
    });

    if (filterStatus) {
      items = items.filter((item) => item.status === filterStatus);
    }

    return NextResponse.json({
      success: true,
      items,
      total: items.length
    });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  try {
    await CrmSheetsService.assertHealthy();

    const body = await req.json();
    const { phone, name, status, source } = body;

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required.' }, { status: 400 });
    }

    const isOptedIn = status === 'OPTED_IN';
    const { record: customer } = await customerRepository.upsertCustomer({
      customer_name: name || 'Customer',
      mobile_number: phone,
      record_status: isOptedIn ? 'ACTIVE' : 'OPTED_OUT'
    });

    const { record: consent } = await consentRepository.upsertConsent({
      customer_id: customer.customer_id,
      channel: 'WHATSAPP',
      consent_status: isOptedIn ? 'GRANTED' : 'WITHDRAWN',
      consent_source: source || 'Manual CRM Update',
      optout_status: isOptedIn ? 'OPTED_IN' : 'OPTED_OUT'
    });

    const leads = await leadRepository.findByCustomerId(customer.customer_id);
    for (const l of leads) {
      await leadRepository.upsertLead({
        ...l,
        lead_status: isOptedIn ? 'NEW_ENQUIRY' : 'OPTED_OUT'
      });
    }

    const item = {
      id: consent.consent_id,
      customerId: customer.customer_id,
      phone: customer.mobile_number,
      status: consent.optout_status,
      consentStatus: consent.consent_status,
      source: consent.consent_source,
      createdAt: consent.consent_timestamp
    };

    return NextResponse.json({
      success: true,
      message: `Consent updated to ${item.status} for ${customer.mobile_number}.`,
      item
    });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireRole(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  try {
    await CrmSheetsService.assertHealthy();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const customerId = searchParams.get('customerId');

    if (!id && !customerId) {
      return NextResponse.json({ success: false, error: 'Consent ID or Customer ID required.' }, { status: 400 });
    }

    const targetConsentId = id || `CNS-${customerId}`;
    await consentRepository.deleteById(targetConsentId);

    return NextResponse.json({ success: true, message: 'Consent entry deleted.' });
  } catch (error: any) {
    const status = error instanceof SheetsCrmError ? error.httpStatus : 500;
    const code = error instanceof SheetsCrmError ? error.code : 'INTERNAL_ERROR';
    return NextResponse.json({ success: false, error: code, message: error.message }, { status });
  }
}
