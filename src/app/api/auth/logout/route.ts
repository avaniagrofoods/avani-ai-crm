import { NextResponse } from 'next/server';
import { buildSessionCookieOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const response = NextResponse.json({ success: true, message: 'Logged out' });
  response.cookies.set({
    ...buildSessionCookieOptions(req, 0),
    value: ''
  });
  return response;
}
