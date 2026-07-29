import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

let currentSettings = {
  name: "Avani Loan Services",
  timezone: "IST",
  currency: "INR",
  autoReply: true,
  whatsappToken: "EAAdIUij5eSEBSGriZCTt06QY1yLIkPZCDIQmHY2iE1ZAGiO7plPIiHyV1VnoXIvbvQeFfyhFM0IwWKIxlj0y5haUYPbYIBQMabyJ9XJhTUZA2vUEUYDbSnJH4OIsFYiLTD8yPBFH331fwmBU253NwW48xWhytfkb2gn8E52jZAElt6PcnGL0YZChBtExZCj2AZDZD",
  whatsappPhoneNumberId: "1147494668457940",
  geminiApiKey: "AIzaSyAzz0LUgUt9DxicUZQmkoZv3zRh_EdWMlU",
  backendApiUrl: "https://avani-ai-crm.vercel.app/api"
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json([currentSettings], { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    currentSettings = { ...currentSettings, ...body };
    return NextResponse.json({ success: true, settings: currentSettings }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
