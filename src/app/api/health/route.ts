import { NextResponse } from 'next/server';
import { defaultSheetsClient } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

const PUBLIC_HEALTH_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  Pragma: 'no-cache'
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url || 'http://localhost/api/health');
  const checkType = searchParams.get('type') || searchParams.get('check');

  if (checkType === 'liveness') {
    return NextResponse.json(
      {
        status: 'HEALTHY',
        service: 'AVANI LOAN SERVICES — AVANI AI CRM (Google Sheets Architecture)',
        dataStore: 'GOOGLE_SHEETS',
        available: true,
        timestamp: new Date().toISOString()
      },
      { status: 200, headers: PUBLIC_HEALTH_HEADERS }
    );
  }

  const connectivity = await defaultSheetsClient.checkConnectivity();
  const available = connectivity.online;

  return NextResponse.json(
    {
      status: available ? 'HEALTHY' : 'DEGRADED',
      service: 'AVANI LOAN SERVICES — AVANI AI CRM',
      dataStore: 'GOOGLE_SHEETS',
      spreadsheetName: connectivity.spreadsheetName,
      schemaVersion: connectivity.schemaVersion,
      available,
      ...(connectivity.error ? { error: connectivity.error } : {}),
      timestamp: new Date().toISOString()
    },
    { status: available ? 200 : 503, headers: PUBLIC_HEALTH_HEADERS }
  );
}
