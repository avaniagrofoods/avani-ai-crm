import { NextResponse } from 'next/server';

/**
 * TASK 5H.7 (A-03 Remediation):
 * Legacy typo alias route (/api/chatmantra-webhook) disabled with HTTP 410 Gone.
 * All ChatMitra webhook traffic must target /api/chatmitra-webhook (Google Sheets backed).
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'LEGACY_ALIAS_DISABLED',
      message: 'Use /api/chatmitra-webhook instead.'
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'LEGACY_ALIAS_DISABLED',
      message: 'Use /api/chatmitra-webhook instead.'
    },
    { status: 410 }
  );
}
