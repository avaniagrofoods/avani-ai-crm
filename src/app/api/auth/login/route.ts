import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  buildSessionCookieOptions,
  issueRotatedSession,
  parseCookieHeader,
  verifyCrmCredentials,
  verifyCsrfRequest
} from '@/lib/auth';
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  extractClientIp,
  recordFailedLoginAttempt
} from '@/lib/auth-store';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
  Pragma: 'no-cache'
};

export async function POST(req: Request) {
  try {
    const csrf = verifyCsrfRequest(req);
    if (!csrf.ok) {
      return NextResponse.json(
        { success: false, error: csrf.error, message: 'Cross-site login attempt blocked.' },
        { status: csrf.status, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json().catch(() => null);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const clientIp = extractClientIp(req);
    const rate = await checkLoginRateLimit(clientIp, email);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'TOO_MANY_ATTEMPTS',
          message: 'Too many failed login attempts. Please wait and try again.'
        },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            'Retry-After': String(rate.retryAfterSeconds)
          }
        }
      );
    }

    const account = await verifyCrmCredentials(email, password);
    if (!account) {
      await recordFailedLoginAttempt(clientIp, email);
      return NextResponse.json(
        { success: false, error: 'Invalid credentials.' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    await clearLoginRateLimit(clientIp, email);

    // Anti-fixation & session rotation: revoke any prior cookie before issuing new jti
    const previousToken = parseCookieHeader(req.headers.get('cookie'), SESSION_COOKIE_NAME);
    const { token } = await issueRotatedSession(account, previousToken);

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: account.id,
          name: account.name,
          email: account.email,
          role: account.role
        }
      },
      { headers: NO_STORE_HEADERS }
    );

    response.cookies.set({
      ...buildSessionCookieOptions(req, SESSION_MAX_AGE_SECONDS),
      value: token
    });

    return response;
  } catch (error: any) {
    console.error('[AuthLogin] Login failure:', error?.message || 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Authentication service unavailable.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
