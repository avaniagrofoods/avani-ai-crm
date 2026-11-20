import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';

/**
 * TASK 5H.7 (A-03 Remediation):
 * Legacy MongoDB CSV contact upload endpoint disabled.
 * Zero-Document/File-Upload policy enforced; returns HTTP 410 Gone.
 */
export async function POST(req: Request) {
  const auth = await requireRole(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      success: false,
      error: 'CSV_UPLOAD_DISABLED',
      message: 'Legacy CSV contact upload to MongoDB is disabled under the Google Sheets Zero-Upload policy.'
    },
    { status: 410 }
  );
}
