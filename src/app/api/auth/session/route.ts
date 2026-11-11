import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.sub,
      name: session.name,
      email: session.email,
      role: session.role
    }
  });
}
