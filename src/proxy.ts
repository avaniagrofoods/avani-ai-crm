import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  verifyActiveSession,
  verifyCsrfRequest
} from '@/lib/auth';

const PUBLIC_PAGE_PATHS = new Set(['/login']);

const PUBLIC_API_EXACT = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/health',
  '/api/public/enquiry',
  '/api/chatmitra-webhook',
  '/api/chatmantra-webhook',
  '/api/meta-webhook',
  '/api/whatsapp-webhook',
  '/api/whatsapp-webhook-worker',
  '/api/omnidim-webhook',
  '/api/vapi-webhook',
  '/api/callkaro-webhook',
  '/api/documents/secure-upload'
]);

const CRON_API_PREFIX = '/api/cron/';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_API_EXACT.has(pathname) || pathname.startsWith(CRON_API_PREFIX)) {
    return NextResponse.next();
  }

  // Monitoring callers authenticating via Bearer secret reach /api/diagnostics handler directly
  if (pathname === '/api/diagnostics' && request.headers.get('authorization')?.startsWith('Bearer ')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    const csrf = verifyCsrfRequest(request);
    if (!csrf.ok) {
      return NextResponse.json(
        { success: false, error: csrf.error, message: 'Cross-site state change blocked.' },
        { status: csrf.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifyActiveSession(token);

  if (PUBLIC_PAGE_PATHS.has(pathname)) {
    if (session) {
      return NextResponse.redirect(new URL('/crm', request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Authentication required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname && pathname !== '/') {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
