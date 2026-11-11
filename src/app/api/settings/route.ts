import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';

let currentSettings: any = {
  name: "Avani Loan Services",
  timezone: "IST",
  currency: "INR",
  autoReply: true,
  whatsappToken: process.env.META_ACCESS_TOKEN || '',
  whatsappPhoneNumberId: process.env.CHATMITRA_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '1062614709598311',
  geminiApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '',
  backendApiUrl: "/api"
};

export async function GET(req: Request) {
  const auth = await requireRole(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const safeSettings = {
    ...currentSettings,
    whatsappToken: currentSettings.whatsappToken ? '••••••••' + currentSettings.whatsappToken.slice(-4) : '',
    geminiApiKey: currentSettings.geminiApiKey ? '••••••••' + currentSettings.geminiApiKey.slice(-4) : ''
  };
  return NextResponse.json([safeSettings]);
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    currentSettings = { ...currentSettings, ...body };
    const safeSettings = {
      ...currentSettings,
      whatsappToken: currentSettings.whatsappToken ? '••••••••' + currentSettings.whatsappToken.slice(-4) : '',
      geminiApiKey: currentSettings.geminiApiKey ? '••••••••' + currentSettings.geminiApiKey.slice(-4) : ''
    };
    return NextResponse.json({ success: true, settings: safeSettings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
