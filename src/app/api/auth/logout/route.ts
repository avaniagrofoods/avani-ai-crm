import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  buildSessionCookieOptions,
  parseCookieHeader,
  revokeSessionToken,
  verifyCsrfRequest
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
  Pragma: 'no-cache'
};

export async function POST(req: Request) {
  const csrf = verifyCsrfRequest(req);
  if (!csrf.ok) {
    return NextResponse.json(
      { success: false, error: csrf.error, message: 'Cross-site logout attempt blocked.' },
      { status: csrf.status, headers: NO_STORE_HEADERS }
    );
  }

  const token = parseCookieHeader(req.headers.get('cookie'), SESSION_COOKIE_NAME);
  await revokeSessionToken(token).catch(() => {});

  const response = NextResponse.json(
    { success: true, message: 'Logged out' },
    { headers: NO_STORE_HEADERS }
  );
  response.cookies.set({
    ...buildSessionCookieOptions(req, 0),
    value: ''
  });
  return response;
}
