import { NextResponse } from 'next/server';
import { TemplateSyncEngine } from '@/lib/template-sync/aisensy';
import { requireRole } from '@/lib/auth';
import { sanitizeErrorForLog } from '@/lib/aisensy';
import { classifyMetaTokenError } from '@/lib/meta-token-monitor';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    // APR006-P3-01: Fail-closed isolation of legacy MongoDB template sync route.
    if (process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true') {
      return NextResponse.json(
        {
          success: false,
          error: 'LEGACY_MONGODB_ROUTE_DISABLED',
          message: 'Legacy MongoDB /api/whatsapp/templates/sync route is disabled; canonical CRM persistence is Google Sheets.'
        },
        { status: 410, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const result = await TemplateSyncEngine.syncAllApprovedTemplates();
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('[WhatsAppTemplateSync] Error:', sanitizeErrorForLog(error));
    const classified = classifyMetaTokenError(error);
    return NextResponse.json(
      {
        success: false,
        error: classified.error,
        message: classified.message,
        retryable: classified.retryable,
        requiresOwnerTokenRefresh: classified.requiresOwnerTokenRefresh
      },
      { status: classified.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
