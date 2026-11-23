import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lender, DEFAULT_AVANI_LENDERS } from '@/models/Lender';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    // APR-008 Phase 3B: Serve non-customer static lender catalog directly when legacy MongoDB is disabled.
    if (process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true') {
      let catalog = DEFAULT_AVANI_LENDERS;
      if (category) {
        const catLower = category.toLowerCase();
        catalog = catalog.filter((l: any) => l.categories.some((c: string) => c.toLowerCase().includes(catLower)));
      }
      return NextResponse.json({ success: true, source: 'STATIC_CATALOG', count: catalog.length, lenders: catalog });
    }

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      let catalog = DEFAULT_AVANI_LENDERS;
      if (category) {
        const catLower = category.toLowerCase();
        catalog = catalog.filter((l: any) => l.categories.some((c: string) => c.toLowerCase().includes(catLower)));
      }
      return NextResponse.json({ success: true, source: 'STATIC_CATALOG', count: catalog.length, lenders: catalog });
    }

    let lenders = await Lender.find({ isActive: true }).sort({ name: 1 });

    if (!lenders || lenders.length === 0) {
      await Lender.insertMany(DEFAULT_AVANI_LENDERS).catch(() => {});
      lenders = await Lender.find({ isActive: true }).sort({ name: 1 });
    }

    if (category) {
      lenders = lenders.filter((l: any) => l.categories.some((c: string) => c.toLowerCase().includes(category.toLowerCase())));
    }

    return NextResponse.json({ success: true, count: lenders.length, lenders });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    // APR-008 Phase 3B: Fail-closed isolation on legacy MongoDB lender write endpoint.
    if (process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true') {
      return NextResponse.json(
        {
          success: false,
          error: 'LEGACY_MONGODB_ROUTE_DISABLED',
          message: 'Legacy MongoDB POST /api/lenders route is disabled; GET serves the static lender catalog.'
        },
        { status: 410, headers: { 'Cache-Control': 'no-store' } }
      );
    }

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
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
