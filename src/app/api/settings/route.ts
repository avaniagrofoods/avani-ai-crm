import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  // Mask sensitive values on read
  const safeSettings = {
    ...currentSettings,
    whatsappToken: currentSettings.whatsappToken ? '••••••••' + currentSettings.whatsappToken.slice(-4) : '',
    geminiApiKey: currentSettings.geminiApiKey ? '••••••••' + currentSettings.geminiApiKey.slice(-4) : ''
  };
  return NextResponse.json([safeSettings], { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    currentSettings = { ...currentSettings, ...body };
    const safeSettings = {
      ...currentSettings,
      whatsappToken: currentSettings.whatsappToken ? '••••••••' + currentSettings.whatsappToken.slice(-4) : '',
      geminiApiKey: currentSettings.geminiApiKey ? '••••••••' + currentSettings.geminiApiKey.slice(-4) : ''
    };
    return NextResponse.json({ success: true, settings: safeSettings }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
