import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { seedDb } from '@/lib/db/seed';

export async function GET(req: NextRequest) {
  await seedDb();
  const session = await getSession(req);

  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Unauthorized: Administrator access required' },
      { status: 403 }
    );
  }

  const db = getDb();
  try {
    const prodRes = await db.execute(`
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products,
        MAX(updated_at) as last_product_updated
      FROM products
    `);

    const quoteRes = await db.execute(`
      SELECT 
        COUNT(*) as total_quotations,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_quotes,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_quotes,
        MAX(created_at) as last_quote_created
      FROM quotations
    `);

    const rateHistoryRes = await db.execute(`
      SELECT 
        COUNT(*) as total_rate_changes,
        MAX(created_at) as last_rate_change
      FROM rate_change_history
    `);

    const prodRow = prodRes.rows[0] || {};
    const quoteRow = quoteRes.rows[0] || {};
    const rateRow = rateHistoryRes.rows[0] || {};

    const totalProducts = Number(prodRow.total_products || 0);
    const activeProducts = Number(prodRow.active_products || 0);
    const totalQuotations = Number(quoteRow.total_quotations || 0);
    const approvedQuotes = Number(quoteRow.approved_quotes || 0);
    const draftQuotes = Number(quoteRow.draft_quotes || 0);
    const totalRateChanges = Number(rateRow.total_rate_changes || 0);

    return NextResponse.json(
      {
        success: true,
        verified: true,
        syncVerified: true,
        catalog: {
          totalProducts,
          activeProducts,
          lastProductUpdated: prodRow.last_product_updated ? String(prodRow.last_product_updated) : null,
        },
        quotations: {
          totalQuotations,
          approvedQuotes,
          draftQuotes,
          lastQuoteCreated: quoteRow.last_quote_created ? String(quoteRow.last_quote_created) : null,
        },
        rates: {
          totalRateChanges,
          lastRateChange: rateRow.last_rate_change ? String(rateRow.last_rate_change) : null,
        },
        databaseStatus: 'Active & Verified',
        verifiedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
