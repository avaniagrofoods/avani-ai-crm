import { NextResponse } from 'next/server';
import {
  verifyCrmCredentials,
  signSessionToken,
  buildSessionCookieOptions,
  SESSION_MAX_AGE_SECONDS
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email || '').trim();
    const password = String(body?.password || '');

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const account = await verifyCrmCredentials(email, password);
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials.' },
        { status: 401 }
      );
    }

    const token = await signSessionToken({
      sub: account.id,
      name: account.name,
      email: account.email,
      role: account.role
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role
      }
    });

    response.cookies.set({
      ...buildSessionCookieOptions(req, SESSION_MAX_AGE_SECONDS),
      value: token
    });

    return response;
  } catch (error: any) {
    console.error('[AuthLogin] Login failure:', error?.message || 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Authentication service unavailable.' },
      { status: 500 }
    );
  }
}
