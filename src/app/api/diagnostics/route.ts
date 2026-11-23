import { NextResponse } from 'next/server';
import { defaultSheetsClient } from '@/lib/google-sheets';
import { constantTimeEqualStrings, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DIAGNOSTICS_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  Pragma: 'no-cache'
};

function flagStatus(val?: string): 'CONFIGURED' | 'MISSING' {
  return val && val.trim().length > 0 ? 'CONFIGURED' : 'MISSING';
}

function verifyMonitoringBearer(req: Request): 'AUTHORIZED' | 'INVALID' | 'ABSENT' {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return 'ABSENT';
  if (!authHeader.startsWith('Bearer ')) return 'INVALID';
  const provided = authHeader.slice(7).trim();
  const expected = (process.env.DIAGNOSTICS_SECRET || process.env.CRON_SECRET || '').trim();
  if (!provided || !expected) return 'INVALID';
  return constantTimeEqualStrings(provided, expected) ? 'AUTHORIZED' : 'INVALID';
}

export async function GET(request: Request) {
  const bearerStatus = verifyMonitoringBearer(request);
  if (bearerStatus === 'INVALID') {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: 'Invalid monitoring credential.' },
      { status: 401, headers: DIAGNOSTICS_HEADERS }
    );
  }

  if (bearerStatus === 'ABSENT') {
    const auth = await requireRole(request, ['ADMIN']);
    if (!auth.ok) {
      auth.response.headers.set('Cache-Control', DIAGNOSTICS_HEADERS['Cache-Control']);
      auth.response.headers.set('CDN-Cache-Control', 'no-store');
      return auth.response;
    }
  }

  const processHealth = {
    status: 'UP',
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024))
  };

  // APR-008 Phase 3B: Check canonical Google Sheets CRM Gateway (zero MongoDB customer fallback).
  let databaseReady = false;
  let spreadsheetName = '';
  let schemaVersion = '';
  try {
    const connectivity = await defaultSheetsClient.checkConnectivity();
    databaseReady = Boolean(connectivity.online);
    spreadsheetName = connectivity.spreadsheetName || '';
    schemaVersion = connectivity.schemaVersion || '';
  } catch {
    databaseReady = false;
  }

  const chatmitraKey = process.env.CHATMITRA_API_KEY || process.env.CHATMANTRA_API_KEY;
  const aisensyKey = process.env.AISENSY_WABA_API_KEY || process.env.AISENSY_API_KEY;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID;
  const activeWhatsappProvider = (
    process.env.WHATSAPP_PROVIDER ||
    process.env.DEFAULT_WHATSAPP_PROVIDER ||
    'CHATMITRA'
  ).toUpperCase();

  const report = {
    status: databaseReady ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    service: 'AVANI LOAN SERVICES — AVANI AI CRM',
    dataStore: 'GOOGLE_SHEETS',
    process: processHealth,
    readiness: {
      status: databaseReady ? 'READY' : 'NOT_READY',
      databaseReady
    },
    environment: {
      appMode: process.env.APP_MODE || 'production',
      providerMode: process.env.PROVIDER_MODE || 'mock',
      autoReplyEnabled: process.env.CHATMITRA_INBOUND_AUTO_REPLY_ENABLED === 'true',
      whatsappInboundAiReplyEnabled: process.env.WHATSAPP_INBOUND_AI_REPLY_ENABLED === 'true',
      aisensyInboundWebhookEnabled: process.env.AISENSY_INBOUND_WEBHOOK_ENABLED === 'true',
      bulkBroadcastEnabled: process.env.BULK_BROADCAST_ENABLED === 'true',
      omniLiveEnabled: process.env.OMNIDM_LIVE_ENABLED === 'true',
      legacyMongoDbRoutesEnabled: process.env.LEGACY_MONGODB_ROUTES_ENABLED === 'true'
    },
    integrations: {
      database: {
        status: databaseReady ? 'HEALTHY' : 'BLOCKED',
        provider: 'Google Sheets Gateway',
        spreadsheetName,
        schemaVersion,
        configured: Boolean(process.env.GOOGLE_SHEETS_GATEWAY_URL || process.env.GOOGLE_SHEET_ID)
      },
      chatmitra: {
        status: chatmitraKey ? 'HEALTHY' : 'READY_MOCK',
        configured: flagStatus(chatmitraKey),
        activeProvider: activeWhatsappProvider === 'CHATMITRA' || activeWhatsappProvider === 'CHATMANTRA'
      },
      aisensy: {
        status: aisensyKey ? 'HEALTHY' : 'DEGRADED',
        configured: flagStatus(aisensyKey),
        activeProvider: activeWhatsappProvider === 'AISENSY'
      },
      metaWaba: {
        status: metaPhoneId ? 'HEALTHY' : 'DEGRADED',
        configured: flagStatus(metaPhoneId)
      },
      avaniAiAgent: {
        status: process.env.GEMINI_API_KEY ? 'HEALTHY' : 'CONFIGURED_DEFAULT',
        configured: flagStatus(process.env.GEMINI_API_KEY)
      },
      omniDM: {
        status: process.env.OMNIDM_LIVE_ENABLED === 'true' ? 'HEALTHY' : 'READY_DISABLED',
        liveEnabled: process.env.OMNIDM_LIVE_ENABLED === 'true'
      },
      hubspot: {
        status: process.env.HUBSPOT_ACCESS_TOKEN ? 'HEALTHY' : 'CONFIGURED_DEFAULT',
        configured: flagStatus(process.env.HUBSPOT_ACCESS_TOKEN)
      },
      googleSheets: {
        status: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT ? 'HEALTHY' : 'CONFIGURED_DEFAULT',
        configured: flagStatus(process.env.GOOGLE_SHEET_ID)
      },
      zapier: {
        status: process.env.ZAPIER_WEBHOOK_URL ? 'HEALTHY' : 'CONFIGURED_DEFAULT',
        configured: flagStatus(process.env.ZAPIER_WEBHOOK_URL)
      }
    }
  };

  return NextResponse.json(report, {
    status: databaseReady ? 200 : 503,
    headers: DIAGNOSTICS_HEADERS
  });
}
