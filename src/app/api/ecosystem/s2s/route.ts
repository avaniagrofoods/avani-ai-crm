import { NextResponse } from 'next/server';
import { CRM_SERVICE_ID, verifyIncomingCrmS2S, processInboundCrmEvent } from '@/lib/s2s-ecosystem';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    service: CRM_SERVICE_ID,
    role: 'CRM & Customer Relationship Management',
    timestamp: new Date().toISOString()
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const auth = verifyIncomingCrmS2S(req.headers, rawBody);
  if (!auth.ok) {
    return NextResponse.json({ success: false, code: auth.code, error: auth.error }, { status: auth.status });
  }
  let body: any = {};
  try {
    body = JSON.parse(rawBody || '{}');
  } catch {
    return NextResponse.json({ success: false, error: 'Malformed JSON body' }, { status: 400 });
  }
  const result = await processInboundCrmEvent(body);
  return NextResponse.json(result, { status: 200 });
}
