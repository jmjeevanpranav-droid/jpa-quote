import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';
import { normalizeItemText, getNextItemCode, backfillMissingItemCodes, resequenceItemCodes } from '@/lib/catalog/rate-memory';
import { getSession } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  await seedDb();
  const db = getDb();

  // Auto-resequence any gaps or missing item codes to strictly consecutive JPA-001, JPA-002, etc.
  await resequenceItemCodes(db);

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() || '';
  const category = url.searchParams.get('category')?.trim() || '';
  const sort = url.searchParams.get('sort')?.trim() || '';
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');

  let baseSql = 'FROM products WHERE is_active = 1';
  const args: any[] = [];

  if (category && category !== 'All') {
    baseSql += ' AND category = ?';
    args.push(category);
  }

  if (q) {
    const norm = normalizeItemText(q);
    baseSql += ' AND (normalized_name LIKE ? OR description LIKE ? OR item_code LIKE ?)';
    args.push(`%${norm}%`, `%${q}%`, `%${q}%`);
  }

  // Count total matching items
  const countRes = await db.execute({
    sql: `SELECT COUNT(*) as total ${baseSql}`,
    args: [...args],
  });
  const total = Number(countRes.rows[0]?.total ?? 0);

  let orderSql = '';
  if (sort === 'latest') {
    orderSql = ' ORDER BY COALESCE(updated_at, created_at, last_verified_date) DESC, id DESC';
  } else {
    orderSql = ` ORDER BY 
      CASE 
        WHEN item_code LIKE 'JPA-%' THEN CAST(SUBSTR(item_code, 5) AS INTEGER)
        ELSE 999999
      END ASC, 
      item_code ASC, 
      description ASC`;
  }

  let paginationSql = '';
  const queryArgs = [...args];
  if (limitParam !== null && limitParam !== undefined && limitParam !== '') {
    const limitNum = Math.max(1, parseInt(limitParam, 10) || 10);
    const offsetNum = Math.max(0, parseInt(offsetParam || '0', 10) || 0);
    paginationSql = ' LIMIT ? OFFSET ?';
    queryArgs.push(limitNum, offsetNum);
  }

  const result = await db.execute({
    sql: `SELECT * ${baseSql}${orderSql}${paginationSql}`,
    args: queryArgs,
  });

  return NextResponse.json(
    { products: result.rows, total },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}

export async function POST(req: NextRequest) {
  await seedDb();
  const db = getDb();
  const session = await getSession(req);

  try {
    const body = await req.json();
    const {
      description,
      category = 'Housekeeping',
      specification,
      pack,
      unit = 'Nos',
      default_rate,
      default_gst_rate = 18,
    } = body;

    if (!description || !unit || default_rate === undefined) {
      return NextResponse.json({ error: 'Missing required product fields' }, { status: 400 });
    }

    // Auto-generate next consecutive item code (JPA-001, JPA-002...)
    const itemCode = await getNextItemCode(db);

    const norm = normalizeItemText(description);
    const prodId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const rateNum = Number(default_rate);
    const gstNum = Number(default_gst_rate);

    await db.execute({
      sql: `INSERT INTO products (
        id, item_code, description, normalized_name, category, specification, pack, unit, 
        default_rate, default_gst_rate, is_active, last_verified_date, 
        last_verified_source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      args: [
        prodId,
        itemCode,
        description,
        norm,
        category,
        specification || null,
        pack || null,
        unit,
        rateNum,
        gstNum,
        now.split('T')[0],
        'Direct Catalog Entry',
        now,
        now,
      ],
    });

    // Record initial price history
    await db.execute({
      sql: `INSERT INTO rate_change_history (
        id, product_id, old_rate, new_rate, change_date, source_quote_number, changed_by, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        prodId,
        rateNum,
        rateNum,
        now.split('T')[0],
        'Direct Catalog Entry',
        session?.name || 'Authorized Staff',
        'Direct Catalog Creation',
        now,
      ],
    });

    // Resequence to ensure all products remain gapless
    await resequenceItemCodes(db);

    return NextResponse.json({ success: true, id: prodId, item_code: itemCode });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  await seedDb();
  const db = getDb();
  const session = await getSession(req);

  try {
    const body = await req.json();
    const {
      id,
      description,
      specification,
      pack,
      unit = 'Nos',
      default_rate,
      default_gst_rate = 18,
    } = body;

    if (!id || !description || !unit || default_rate === undefined) {
      return NextResponse.json(
        { error: 'Missing required product fields (id, description, unit, default_rate)' },
        { status: 400 }
      );
    }

    const currentRes = await db.execute({
      sql: 'SELECT * FROM products WHERE id = ?',
      args: [id],
    });

    if (currentRes.rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const currentProd = currentRes.rows[0];
    const norm = normalizeItemText(description);
    const now = new Date().toISOString();
    const rateNum = Number(default_rate);
    const gstNum = Number(default_gst_rate);

    await db.execute({
      sql: `UPDATE products SET
        description = ?,
        normalized_name = ?,
        specification = ?,
        pack = ?,
        unit = ?,
        default_rate = ?,
        default_gst_rate = ?,
        last_verified_date = ?,
        last_verified_source = ?,
        updated_at = ?
      WHERE id = ?`,
      args: [
        description,
        norm,
        specification || null,
        pack || null,
        unit,
        rateNum,
        gstNum,
        now.split('T')[0],
        'Direct Catalog Edit',
        now,
        id,
      ],
    });

    // If rate changed, log into rate_change_history
    if (Number(currentProd.default_rate) !== rateNum) {
      await db.execute({
        sql: `INSERT INTO rate_change_history (
          id, product_id, old_rate, new_rate, change_date, source_quote_number, changed_by, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          id,
          Number(currentProd.default_rate),
          rateNum,
          now.split('T')[0],
          'Rate Library Edit',
          session?.name || 'Authorized Staff',
          'Updated via Rate Library Edit Pop-up',
          now,
        ],
      });
    }

    return NextResponse.json({
      success: true,
      product: {
        ...currentProd,
        description,
        specification: specification || null,
        pack: pack || null,
        unit,
        default_rate: rateNum,
        default_gst_rate: gstNum,
        last_verified_date: now.split('T')[0],
        last_verified_source: 'Direct Catalog Edit',
        updated_at: now,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const all = url.searchParams.get('all');

    if (all === 'true') {
      await db.execute('DELETE FROM product_rates');
      await db.execute('DELETE FROM rate_change_history');
      await db.execute('DELETE FROM product_aliases');
      const res = await db.execute('DELETE FROM products');
      return NextResponse.json({ success: true, deleted: res.rowsAffected });
    }

    if (id) {
      await db.execute({ sql: 'DELETE FROM product_rates WHERE product_id = ?', args: [id] });
      await db.execute({ sql: 'DELETE FROM rate_change_history WHERE product_id = ?', args: [id] });
      await db.execute({ sql: 'DELETE FROM product_aliases WHERE product_id = ?', args: [id] });
      await db.execute({ sql: 'DELETE FROM products WHERE id = ?', args: [id] });
      // Resequence remaining active items immediately to close any gaps created by deletion
      await resequenceItemCodes(db);
      return NextResponse.json({ success: true, deletedId: id });
    }

    return NextResponse.json({ error: 'Missing id or all parameter' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
