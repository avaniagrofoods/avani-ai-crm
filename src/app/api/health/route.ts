import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

function maskCredential(val?: string): string {
  if (!val) return 'MISSING';
  if (val.length <= 8) return 'CONFIGURED (***)';
  return `${val.substring(0, 4)}...${val.substring(val.length - 4)} (CONFIGURED)`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url || 'http://localhost/api/health');
  const checkType = searchParams.get('type') || searchParams.get('check');

  const processHealth = {
    status: 'UP',
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024))
  };

  // Immediate 200 response for pure liveness probes
  if (checkType === 'liveness') {
    return NextResponse.json({
      status: 'HEALTHY',
      liveness: 'UP',
      process: processHealth,
      timestamp: new Date().toISOString()
    }, { status: 200 });
  }

  const healthReport: any = {
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    service: 'AVANI LOAN SERVICES — AVANI AI CRM',
    process: processHealth,
    readiness: {
      status: 'READY',
      databaseReady: false
    },
    environment: {
      appMode: process.env.APP_MODE || 'production',
      providerMode: process.env.PROVIDER_MODE || 'mock'
    },
    integrations: {}
  };

  // 1. Database Readiness Check
  const hasMongoUri = !!process.env.MONGODB_URI;
  try {
    const conn = await connectToDatabase();
    if (conn && mongoose.connection.readyState === 1) {
      healthReport.integrations.database = { status: 'HEALTHY', provider: 'MongoDB Atlas', uriConfigured: true };
      healthReport.readiness.databaseReady = true;
      healthReport.readiness.status = 'READY';
    } else {
      healthReport.integrations.database = { 
        status: 'BLOCKED', 
        error: hasMongoUri ? 'Connection readyState != 1 (Network/TLS or IP Access blocked)' : 'MONGODB_URI missing in environment',
        uriConfigured: hasMongoUri
      };
      healthReport.readiness.databaseReady = false;
      healthReport.readiness.status = 'NOT_READY';
      healthReport.status = 'DEGRADED';
    }
  } catch (e: any) {
    healthReport.integrations.database = { 
      status: 'BLOCKED', 
      error: e.message,
      uriConfigured: hasMongoUri 
    };
    healthReport.readiness.databaseReady = false;
    healthReport.readiness.status = 'NOT_READY';
    healthReport.status = 'DEGRADED';
  }

  // 2. WhatsApp Provider Configuration (ChatMitra Primary & AiSensy Rollback)
  const chatmitraKey = process.env.CHATMITRA_API_KEY || process.env.CHATMANTRA_API_KEY;
  const aisensyKey = process.env.AISENSY_WABA_API_KEY || process.env.AISENSY_API_KEY;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID;
  const activeWhatsappProvider = (process.env.WHATSAPP_PROVIDER || process.env.DEFAULT_WHATSAPP_PROVIDER || 'CHATMITRA').toUpperCase();

  healthReport.integrations.chatmitra = {
    status: chatmitraKey ? 'HEALTHY' : 'READY_MOCK',
    apiKey: maskCredential(chatmitraKey),
    activeProvider: activeWhatsappProvider === 'CHATMITRA' || activeWhatsappProvider === 'CHATMANTRA',
    baseUrl: process.env.CHATMITRA_BASE_URL || 'https://api.chatmitra.com'
  };

  healthReport.integrations.aisensy = {
    status: aisensyKey ? 'HEALTHY' : 'DEGRADED',
    apiKey: maskCredential(aisensyKey),
    activeProvider: activeWhatsappProvider === 'AISENSY',
    campaignName: process.env.AISENSY_CAMPAIGN_NAME || 'avani_loan_intro_v2'
  };

  healthReport.integrations.metaWaba = {
    status: metaPhoneId ? 'HEALTHY' : 'DEGRADED',
    phoneNumberId: metaPhoneId || '1147494668457940',
    resolvedSenderNumber: '+91 72491 08474'
  };

  // 3. Gemini AI Agent
  const geminiKey = process.env.GEMINI_API_KEY;
  healthReport.integrations.avaniAiAgent = {
    status: geminiKey ? 'HEALTHY' : 'HEALTHY (Default Model Active)',
    apiKey: maskCredential(geminiKey)
  };

  // 4. OmniDM Adapter
  const omniLive = process.env.OMNIDM_LIVE_ENABLED === 'true';
  healthReport.integrations.omniDM = {
    status: 'READY_DISABLED',
    liveEnabled: omniLive,
    agentId: process.env.OMNIDM_DEFAULT_AGENT_ID || '229425',
    notice: 'OmniDM integration READY — live calling disabled pending recharge.'
  };

  // 5. Downstream Integrations (HubSpot, Google Sheets, Zapier)
  healthReport.integrations.hubspot = {
    status: process.env.HUBSPOT_ACCESS_TOKEN ? 'HEALTHY' : 'CONFIGURED_DEFAULT',
    token: maskCredential(process.env.HUBSPOT_ACCESS_TOKEN)
  };

  healthReport.integrations.googleSheets = {
    status: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT ? 'HEALTHY' : 'CONFIGURED_DEFAULT',
    sheetId: maskCredential(process.env.GOOGLE_SHEET_ID)
  };

  healthReport.integrations.zapier = {
    status: process.env.ZAPIER_WEBHOOK_URL ? 'HEALTHY' : 'CONFIGURED_DEFAULT',
    webhookUrl: maskCredential(process.env.ZAPIER_WEBHOOK_URL)
  };

  const httpStatus = healthReport.status === 'HEALTHY' ? 200 : 503;
  return NextResponse.json(healthReport, { status: httpStatus });
}
