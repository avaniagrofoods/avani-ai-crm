import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Advisor, DEFAULT_AVANI_ADVISORS } from '@/models/Advisor';

export async function GET() {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json({ success: true, count: DEFAULT_AVANI_ADVISORS.length, advisors: DEFAULT_AVANI_ADVISORS });
    }

    let advisors = await Advisor.find({ isActive: true }).sort({ name: 1 });
    
    // Seed defaults if empty
    if (!advisors || advisors.length === 0) {
      await Advisor.insertMany(DEFAULT_AVANI_ADVISORS).catch(() => {});
      advisors = await Advisor.find({ isActive: true }).sort({ name: 1 });
    }

    return NextResponse.json({ success: true, count: advisors.length, advisors });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json({ success: false, error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }
    const body = await req.json();
    const { name, email, phone, role, specializations } = body;

    if (!name || !email || !phone) {
      return NextResponse.json({ success: false, error: 'Name, email and phone are required' }, { status: 400 });
    }

    const advisorId = `ADV-${name.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const advisor = await Advisor.create({
      advisorId,
      name,
      email,
      phone,
      role: role || 'LOAN_ADVISOR',
      specializations: specializations || ['General Loan Advisory'],
      isActive: true
    });

    return NextResponse.json({ success: true, advisor });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
