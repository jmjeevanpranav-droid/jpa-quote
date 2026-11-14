import { NextRequest, NextResponse, connection } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';

export async function GET(req: NextRequest) {
  try { await connection(); } catch {}
  try {
    await seedDb();
    const db = getDb();

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() || '';

  let sql = 'SELECT * FROM customers WHERE 1=1';
  const args: any[] = [];

  if (q) {
    const numQ = q.replace(/[^0-9.]/g, '');
    sql += ` AND (
      company_name LIKE ? 
      OR trade_name LIKE ? 
      OR store_code LIKE ?
      OR gstin LIKE ?
      OR billing_address LIKE ?
      OR contact_person LIKE ?
      OR phone LIKE ?
      OR id IN (
        SELECT customer_id FROM quotations 
        WHERE quote_number LIKE ? 
        OR quote_date LIKE ? 
        OR reference_no LIKE ?
        OR CAST(grand_total AS TEXT) LIKE ?
        ${numQ ? 'OR CAST(ROUND(grand_total) AS TEXT) LIKE ?' : ''}
      )
    )`;
    args.push(
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      `%${q}%`
    );
    if (numQ) {
      args.push(`%${numQ}%`);
    }
  }

  sql += ' ORDER BY company_name ASC';

  const customers = await db.execute({ sql, args });

  // Attach stores to each customer
  const stores = await db.execute('SELECT * FROM customer_stores ORDER BY store_name ASC');

  // Attach quotations to each customer for omni-search (quote_number, date, grand_total, etc.)
  const quotes = await db.execute(`
    SELECT id, quote_number, customer_id, customer_name, store_name, store_code, quote_date, validity_date, grand_total, status, reference_no
    FROM quotations
    ORDER BY quote_date DESC
  `);

  const customersWithStores = customers.rows.map((c: any) => ({
    ...c,
    stores: stores.rows.filter((s: any) => s.customer_id === c.id),
    quotes: quotes.rows.filter((q: any) =>
      q.customer_id === c.id ||
      (c.store_code && q.store_code && q.store_code === c.store_code) ||
      (c.trade_name && q.store_name && (q.store_name as string).toLowerCase() === (c.trade_name as string).toLowerCase())
    ),
  }));

  return NextResponse.json({ customers: customersWithStores });
  } catch {
    return NextResponse.json({ customers: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  await seedDb();
  const db = getDb();

  try {
    const body = await req.json();
    const {
      companyName,
      tradeName,
      storeCode,
      folderName,
      gstin,
      pan,
      billingAddress,
      deliveryAddress,
      contactPerson,
      phone,
      email,
      stateCode = '33',
      notes,
      stores = [],
    } = body;

    if (!companyName || !billingAddress) {
      return NextResponse.json({ error: 'Company name and billing address are required' }, { status: 400 });
    }

    const custId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO customers (
        id, company_name, trade_name, store_code, folder_name, gstin, pan, billing_address, delivery_address, 
        contact_person, phone, email, state_code, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        custId,
        companyName,
        tradeName || null,
        storeCode || null,
        folderName || null,
        gstin || null,
        pan || null,
        billingAddress,
        deliveryAddress || billingAddress,
        contactPerson || null,
        phone || null,
        email || null,
        stateCode,
        notes || null,
        now,
        now,
      ],
    });

    if (Array.isArray(stores)) {
      for (const st of stores) {
        if (st.storeName) {
          await db.execute({
            sql: `INSERT INTO customer_stores (id, customer_id, store_name, store_code, address, contact_person, phone, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              `store_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              custId,
              st.storeName,
              st.storeCode || storeCode || null,
              st.address || null,
              st.contactPerson || null,
              st.phone || null,
              now,
            ],
          });
        }
      }
    }

    return NextResponse.json({ success: true, id: custId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  await seedDb();
  const db = getDb();

  try {
    const body = await req.json();
    const {
      id,
      companyName,
      tradeName,
      storeCode,
      folderName,
      gstin,
      pan,
      billingAddress,
      deliveryAddress,
      contactPerson,
      phone,
      email,
      stateCode = '33',
      notes,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    await db.execute({
      sql: `UPDATE customers SET 
        company_name = COALESCE(?, company_name),
        trade_name = ?,
        store_code = ?,
        folder_name = COALESCE(?, folder_name),
        gstin = ?,
        pan = ?,
        billing_address = COALESCE(?, billing_address),
        delivery_address = ?,
        contact_person = ?,
        phone = ?,
        email = ?,
        state_code = COALESCE(?, state_code),
        notes = ?,
        updated_at = ?
        WHERE id = ?`,
      args: [
        companyName || null,
        tradeName ?? null,
        storeCode ?? null,
        folderName || null,
        gstin ?? null,
        pan ?? null,
        billingAddress || null,
        deliveryAddress ?? null,
        contactPerson ?? null,
        phone ?? null,
        email ?? null,
        stateCode,
        notes ?? null,
        now,
        id,
      ],
    });

    if (storeCode !== undefined || tradeName !== undefined) {
      const existingStores = await db.execute({
        sql: 'SELECT id FROM customer_stores WHERE customer_id = ?',
        args: [id],
      });
      if (existingStores.rows.length > 0) {
        if (storeCode !== undefined) {
          await db.execute({
            sql: 'UPDATE customer_stores SET store_code = ? WHERE customer_id = ?',
            args: [storeCode || null, id],
          });
        }
        if (tradeName !== undefined && tradeName) {
          await db.execute({
            sql: 'UPDATE customer_stores SET store_name = ? WHERE customer_id = ?',
            args: [tradeName, id],
          });
        }
      } else if (storeCode || tradeName) {
        await db.execute({
          sql: `INSERT INTO customer_stores (id, customer_id, store_name, store_code, address, contact_person, phone, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            `store_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            id,
            tradeName || companyName || 'Main Store',
            storeCode || null,
            billingAddress || null,
            contactPerson || null,
            phone || null,
            now,
          ],
        });
      }
    }

    return NextResponse.json({ success: true, id, updated_at: now });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await seedDb();
  const db = getDb();

  try {
    const url = new URL(req.url);
    const all = url.searchParams.get('all') === 'true';
    const id = url.searchParams.get('id');

    if (all) {
      await db.batch(
        [
          'DELETE FROM quotation_items',
          'DELETE FROM quotation_sections',
          'DELETE FROM quotations',
          'DELETE FROM product_rates WHERE customer_id IS NOT NULL',
          'DELETE FROM company_folders',
          'DELETE FROM customer_stores',
          'DELETE FROM customers',
        ],
        'write'
      );
      return NextResponse.json({ success: true, message: 'All customers and quotations deleted successfully' });
    }

    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    // When deleting a single customer, cleanly cascade their dependent quotations and stores
    // 1. Find quotations for this customer
    const quoteRows = await db.execute({
      sql: 'SELECT id FROM quotations WHERE customer_id = ?',
      args: [id],
    });

    for (const q of quoteRows.rows) {
      const qId = String(q.id);
      await db.execute({ sql: 'DELETE FROM quotation_items WHERE quotation_id = ?', args: [qId] });
      await db.execute({ sql: 'DELETE FROM quotation_sections WHERE quotation_id = ?', args: [qId] });
      await db.execute({ sql: 'DELETE FROM quotations WHERE id = ?', args: [qId] });
    }

    // 2. Clean product rates customer references
    await db.execute({
      sql: 'DELETE FROM product_rates WHERE customer_id = ?',
      args: [id],
    });

    // 3. Delete stores
    await db.execute({
      sql: 'DELETE FROM customer_stores WHERE customer_id = ?',
      args: [id],
    });

    // 4. Delete the customer
    await db.execute({
      sql: 'DELETE FROM customers WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
