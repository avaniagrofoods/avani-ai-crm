import { NextResponse } from 'next/server';
import { OmniDMVoiceProvider } from '@/lib/voice-provider';
import axios from 'axios';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phoneNumber, mode } = body;

    console.log("=== OMNIDM TEST ROUTE ===");
    console.log(`Target: ${phoneNumber}`);
    console.log(`Mode: ${mode}`);

    const { defaultVoiceService } = require('@/lib/voice-provider');
    const fs = require('fs');
    const path = require('path');
    
    // T0
    console.log("[T0] CRM Request initiated");
    
    // Check if test_contact exists in the known scratch path or fallback
    let contactData = { name: "Test Customer", phone: "919175635165", loanType: "Personal Loan", profession: "Salaried", city: "Mumbai" };
    try {
       const contactFile = "C:\\Users\\ALPHA-1\\.gemini\\antigravity-ide\\brain\\06e7cb8e-f414-441b-ba61-6919b59997d5\\scratch\\test_contact.json";
       if (fs.existsSync(contactFile)) {
           const parsed = JSON.parse(fs.readFileSync(contactFile, 'utf8'));
           contactData.name = parsed.name || contactData.name;
           contactData.phone = parsed.phone || contactData.phone;
           // We will map loanType dynamically for test if needed, assume Doctor from csv
           contactData.loanType = "Doctor Loan";
           contactData.profession = "Doctor / Medical Professional";
       }
    } catch(e) {}

    const callOptions = {
        phoneNumber: phoneNumber || contactData.phone,
        customerName: contactData.name,
        loanType: contactData.loanType,
        profession: contactData.profession,
        city: contactData.city,
        language: "mr"
    };

    console.log("[T1] Dispatching Call with Options:", JSON.stringify(callOptions, null, 2));

    if (mode === 'mock') {
        return NextResponse.json({ success: true, message: "Mock Mode Success", t0: true, t1: true, options: callOptions });
    }

    try {
        const result = await defaultVoiceService.dispatchCall(callOptions);
        console.log("[T2] OmniDM Response Received. Success:", result.success);
        console.log("[T3] Call ID Created:", result.callId);
        console.log("[T4] Call Data:", JSON.stringify(result.rawResponse, null, 2));

        return NextResponse.json(result);
    } catch (apiError: any) {
        console.error("OmniDM API Error:", apiError?.response?.data || apiError.message);
        return NextResponse.json({ success: false, error: apiError?.response?.data || apiError.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Test Route Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
