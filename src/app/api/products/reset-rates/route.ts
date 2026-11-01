import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  try {
    const db = getDb();

    // 1. Reset all products default_rate to 0 and clear last_verified info
    const pResult = await db.execute(`
      UPDATE products 
      SET default_rate = 0.0, 
          last_verified_date = NULL, 
          last_verified_source = NULL,
          updated_at = datetime('now')
    `);

    // 2. Clear customer-specific product rates
    const prResult = await db.execute('DELETE FROM product_rates');

    // 3. Clear rate change history
    const rhResult = await db.execute('DELETE FROM rate_change_history');

    return NextResponse.json({
      success: true,
      message: 'All product rate memory successfully reset to 0.',
      productsReset: pResult.rowsAffected,
      ratesDeleted: prResult.rowsAffected,
      historyCleared: rhResult.rowsAffected,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to reset rate memory' },
      { status: 500 }
    );
  }
}

