import { NextResponse } from 'next/server';
import { constantTimeEqualStrings, requireRole } from '@/lib/auth';
import { sanitizeErrorForLog } from '@/lib/aisensy';
import {
  CrmSheetsService,
  SheetsCrmError,
  getReconciliationDiagnostics,
  reconcilePendingMessageIdentities
} from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
  Pragma: 'no-cache'
};

const MIN_SECRET_LEN = 16;

function verifyReconciliationBearerSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')?.trim() || '';
  if (!/^Bearer\s+/i.test(authHeader)) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  const candidates = [
    process.env.RECONCILIATION_CRON_SECRET?.trim() || '',
    process.env.INTERNAL_WORKER_SECRET?.trim() || '',
    process.env.INTERNAL_WORKER_SECRET_PREVIOUS?.trim() || ''
  ].filter((secret) => secret.length >= MIN_SECRET_LEN);

  if (candidates.length === 0) return false;
  return candidates.some((secret) => constantTimeEqualStrings(token, secret));
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/**
 * POST /api/internal/reconcile-identities
 *
 * Blocker 5 — Authenticated, bounded, manual/external trigger for pending customer
 * identity reconciliation (`reconcilePendingMessageIdentities`).
 *
 * Security & Governance:
 * - NOT scheduled in vercel.json (no production cron active until owner authorizes).
 * - Requires EITHER:
 *     1. `Authorization: Bearer <RECONCILIATION_CRON_SECRET | INTERNAL_WORKER_SECRET>`
 *        (constant-time comparison, minimum 16-char secret, fail-closed when unset), OR
 *     2. An active authenticated ADMIN CRM session cookie + CSRF validation.
 * - Never sends outbound WhatsApp messages (`outboundResent === 0`).
 * - Returns PII-free summary & diagnostics only.
 */
export async function POST(request: Request) {
  let authMethod: 'BEARER_SECRET' | 'ADMIN_SESSION' | null = null;

  if (request.headers.get('authorization')?.trim()) {
    if (!verifyReconciliationBearerSecret(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Invalid or unconfigured reconciliation bearer credential.'
        },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }
    authMethod = 'BEARER_SECRET';
  } else {
    const roleAuth = await requireRole(request, ['ADMIN']);
    if (!roleAuth.ok) {
      return roleAuth.response;
    }
    authMethod = 'ADMIN_SESSION';
  }

  try {
    const body = await request.json().catch(() => ({}));
    const batchLimit = clampInt(body?.batchLimit, 25, 1, 50);
    const maxAttempts = clampInt(body?.maxAttempts, 5, 1, 10);
    const leaseTtlSec = clampInt(body?.leaseTtlSec, 60, 15, 300);
    const includeDiagnostics = body?.includeDiagnostics !== false;

    await CrmSheetsService.assertHealthy();

    const summary = await reconcilePendingMessageIdentities({
      batchLimit,
      maxAttempts,
      leaseTtlSec
    });

    const diagnostics = includeDiagnostics
      ? await getReconciliationDiagnostics()
      : undefined;

    return NextResponse.json(
      {
        success: true,
        authMethod,
        scheduledCronActive: false,
        params: { batchLimit, maxAttempts, leaseTtlSec },
        summary,
        ...(diagnostics ? { diagnostics } : {}),
        executedAt: new Date().toISOString()
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    if (err instanceof SheetsCrmError) {
      return NextResponse.json(
        {
          success: false,
          error: err.code,
          message: sanitizeErrorForLog(err.message),
          retryable: err.retryable
        },
        { status: err.httpStatus, headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: 'RECONCILIATION_RUN_FAILED',
        message: sanitizeErrorForLog(err?.message || 'Reconciliation execution failed.')
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
