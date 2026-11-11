import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
  Pragma: 'no-cache'
};

let currentSettings: any = {
  name: 'Avani Loan Services',
  timezone: 'IST',
  currency: 'INR',
  autoReply: true,
  whatsappToken: process.env.META_ACCESS_TOKEN || '',
  whatsappPhoneNumberId: process.env.CHATMITRA_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  geminiApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '',
  backendApiUrl: '/api'
};

function sanitizeSettingsResponse(settings: any) {
  return {
    name: settings.name,
    timezone: settings.timezone,
    currency: settings.currency,
    autoReply: settings.autoReply,
    backendApiUrl: settings.backendApiUrl,
    whatsappTokenConfigured: Boolean(settings.whatsappToken),
    whatsappPhoneNumberConfigured: Boolean(settings.whatsappPhoneNumberId),
    geminiApiKeyConfigured: Boolean(settings.geminiApiKey)
  };
}

export async function GET(req: Request) {
  const auth = await requireRole(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  return NextResponse.json([sanitizeSettingsResponse(currentSettings)], {
    headers: NO_STORE_HEADERS
  });
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const allowedFields: Record<string, any> = {};
    if (typeof body?.name === 'string') allowedFields.name = body.name;
    if (typeof body?.timezone === 'string') allowedFields.timezone = body.timezone;
    if (typeof body?.currency === 'string') allowedFields.currency = body.currency;
    if (typeof body?.autoReply === 'boolean') allowedFields.autoReply = body.autoReply;
    if (typeof body?.whatsappToken === 'string' && body.whatsappToken) {
      allowedFields.whatsappToken = body.whatsappToken;
    }
    if (typeof body?.whatsappPhoneNumberId === 'string' && body.whatsappPhoneNumberId) {
      allowedFields.whatsappPhoneNumberId = body.whatsappPhoneNumberId;
    }
    if (typeof body?.geminiApiKey === 'string' && body.geminiApiKey) {
      allowedFields.geminiApiKey = body.geminiApiKey;
    }

    currentSettings = { ...currentSettings, ...allowedFields };
    return NextResponse.json(
      { success: true, settings: sanitizeSettingsResponse(currentSettings) },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Unable to update settings.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
