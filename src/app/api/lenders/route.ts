import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lender, DEFAULT_AVANI_LENDERS } from '@/models/Lender';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json({ success: true, count: DEFAULT_AVANI_LENDERS.length, lenders: DEFAULT_AVANI_LENDERS });
    }

    let lenders = await Lender.find({ isActive: true }).sort({ name: 1 });

    if (!lenders || lenders.length === 0) {
      await Lender.insertMany(DEFAULT_AVANI_LENDERS).catch(() => {});
      lenders = await Lender.find({ isActive: true }).sort({ name: 1 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    if (category) {
      lenders = lenders.filter((l: any) => l.categories.some((c: string) => c.toLowerCase().includes(category.toLowerCase())));
    }

    return NextResponse.json({ success: true, count: lenders.length, lenders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json({ success: false, error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }
    const body = await req.json();
    const { name, categories, minAmount, maxAmount, indicativeRoi, maxTenureMonths, processingFee, contactPerson } = body;

    if (!name || !categories || categories.length === 0) {
      return NextResponse.json({ success: false, error: 'Lender name and categories are required' }, { status: 400 });
    }

    const shortCode = name.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase();
    const lenderId = `LEN-${shortCode}-${Date.now().toString().slice(-4)}`;

    const lender = await Lender.create({
      lenderId,
      name,
      shortCode,
      categories,
      minAmount: Number(minAmount) || 50000,
      maxAmount: Number(maxAmount) || 10000000,
      indicativeRoi: indicativeRoi || '9.5%–14.0% p.a.',
      maxTenureMonths: Number(maxTenureMonths) || 120,
      processingFee: processingFee || '1% + GST',
      contactPerson,
      isActive: true
    });

    return NextResponse.json({ success: true, lender });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
