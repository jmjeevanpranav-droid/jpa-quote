import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await seedDb();
  const db = getDb();
  const { id } = await params;

  try {
    const history = await db.execute({
      sql: `SELECT * FROM rate_change_history WHERE product_id = ? ORDER BY change_date DESC, created_at DESC`,
      args: [id],
    });

    const product = await db.execute({
      sql: `SELECT * FROM products WHERE id = ? LIMIT 1`,
      args: [id],
    });

    return NextResponse.json({
      product: product.rows[0] || null,
      history: history.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
