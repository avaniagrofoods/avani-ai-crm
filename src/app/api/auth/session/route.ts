import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
  Pragma: 'no-cache'
};

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  }
  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: session.sub,
        name: session.name,
        email: session.email,
        role: session.role
      }
    },
    { headers: NO_STORE_HEADERS }
  );
}
