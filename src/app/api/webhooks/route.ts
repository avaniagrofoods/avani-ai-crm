import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { sanitizeErrorForLog } from '@/lib/aisensy';
import {
  CrmSheetsService,
  SheetsCrmError,
  webhookEventRepository
} from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
  Pragma: 'no-cache'
};

/**
 * GET /api/webhooks
 *
 * Blocker 6 Remediation: Migrated from legacy MongoDB `WebhookInbox` to canonical
 * Google Sheets `WEBHOOK_EVENTS` (zero MongoDB connection or fallback).
 */
export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    await CrmSheetsService.assertHealthy();

    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, rawLimit)) : 50;

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://avani-ai-crm.vercel.app').replace(/\/+$/, '');
    const legacyEnabled = process.env.LEGACY_MONGODB_ROUTES_ENABLED === 'true';

    const allEvents = await webhookEventRepository.findAll();
    const sortedEvents = [...allEvents]
      .sort((a, b) => (a.received_at < b.received_at ? 1 : -1))
      .slice(0, limit);

    const lastByProvider = new Map<string, string>();
    for (const ev of sortedEvents) {
      const pKey = String(ev.provider || '').toLowerCase();
      if (pKey && !lastByProvider.has(pKey)) {
        lastByProvider.set(pKey, ev.received_at);
      }
    }

    const endpoints = [
      {
        id: 'wh_chatmitra',
        event: 'ChatMitra WhatsApp Webhook (Canonical Google Sheets)',
        url: `${baseUrl}/api/chatmitra-webhook`,
        status: 'ACTIVE',
        provider: 'ChatMitra',
        subscribedEvents: ['message.received', 'message.sent', 'message.delivered', 'message.read', 'message.failed'],
        lastTrigger: lastByProvider.get('chatmitra') || null
      },
      {
        id: 'wh_whatsapp_meta',
        event: 'Meta WhatsApp Cloud API Inbound & Status Gateway (Canonical Google Sheets)',
        url: `${baseUrl}/api/whatsapp-webhook`,
        status: 'ACTIVE',
        provider: 'Meta',
        subscribedEvents: ['messages', 'statuses'],
        lastTrigger: lastByProvider.get('meta') || null
      },
      {
        id: 'wh_meta_leadads_legacy',
        event: 'Meta Lead Ads Webhook (Legacy MongoDB Route — Disabled by Default)',
        url: `${baseUrl}/api/meta-webhook`,
        status: legacyEnabled ? 'LEGACY_ENABLED' : 'LEGACY_DISABLED',
        provider: 'Meta_LeadAds',
        subscribedEvents: ['leadgen'],
        lastTrigger: null
      },
      {
        id: 'wh_omnidm',
        event: 'OmniDM Voice Agent Telephony Callback',
        url: `${baseUrl}/api/omnidim-webhook`,
        status: process.env.OMNIDM_LIVE_ENABLED === 'true' ? 'ACTIVE' : 'READY_DISABLED',
        provider: 'OmniDM',
        subscribedEvents: ['call.completed', 'call.summary'],
        lastTrigger: lastByProvider.get('omnidim') || null
      }
    ];

    const recentEvents = sortedEvents.map((ev) => ({
      _id: ev.event_id,
      eventId: ev.event_id,
      provider: ev.provider,
      eventType: ev.event_type,
      status: ev.processing_status,
      errorCode: ev.error_code || '',
      receivedAt: ev.received_at
    }));

    return NextResponse.json(
      {
        success: true,
        storageBackend: 'GOOGLE_SHEETS',
        endpoints,
        recentEvents,
        totalEvents: allEvents.length
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error: any) {
    if (error instanceof SheetsCrmError) {
      return NextResponse.json(
        {
          success: false,
          error: error.code,
          message: sanitizeErrorForLog(error.message)
        },
        { status: error.httpStatus, headers: NO_STORE_HEADERS }
      );
    }
    const safeMsg = sanitizeErrorForLog(error?.message || 'Failed to load webhook telemetry');
    console.error('[WebhooksAPI] Error loading webhooks:', safeMsg);
    return NextResponse.json(
      { success: false, error: 'WEBHOOKS_LOAD_ERROR', message: safeMsg },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
