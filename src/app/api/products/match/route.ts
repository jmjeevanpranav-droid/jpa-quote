import { NextRequest, NextResponse } from 'next/server';
import { findMatchingRate } from '@/lib/catalog/rate-memory';
import { seedDb } from '@/lib/db/seed';

export async function POST(req: NextRequest) {
  await seedDb();
  try {
    const body = await req.json();
    const { description, specification, pack, unit, customerId } = body;

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ matched: false, confidence: 'none' });
    }

    const match = await findMatchingRate({
      description,
      specification,
      pack,
      unit,
      customerId,
    });

    return NextResponse.json(match, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
