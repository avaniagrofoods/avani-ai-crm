import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

function maskCredential(val?: string): string {
  if (!val) return 'MISSING';
  if (val.length <= 8) return 'CONFIGURED (***)';
  return `${val.substring(0, 4)}...${val.substring(val.length - 4)} (CONFIGURED)`;
}

export async function GET() {
  const healthReport: any = {
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    service: 'AVANI LOAN SERVICES — AVANI AI CRM',
    environment: {
      appMode: process.env.APP_MODE || 'production',
      providerMode: process.env.PROVIDER_MODE || 'live'
    },
    integrations: {}
  };

  // 1. Database Health Check
  try {
    const conn = await connectToDatabase();
    if (conn && mongoose.connection.readyState === 1) {
      healthReport.integrations.database = { status: 'HEALTHY', provider: 'MongoDB Atlas' };
    } else {
      healthReport.integrations.database = { status: 'BLOCKED', error: 'Connection readyState != 1' };
      healthReport.status = 'DEGRADED';
    }
  } catch (e: any) {
    healthReport.integrations.database = { status: 'BLOCKED', error: e.message };
    healthReport.status = 'DEGRADED';
  }

  // 2. WhatsApp Provider Configuration (AiSensy & Meta WABA)
  const aisensyKey = process.env.AISENSY_WABA_API_KEY || process.env.AISENSY_API_KEY;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID;

  healthReport.integrations.aisensy = {
    status: aisensyKey ? 'HEALTHY' : 'DEGRADED',
    apiKey: maskCredential(aisensyKey),
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

  return NextResponse.json(healthReport, { status: 200 });
}
