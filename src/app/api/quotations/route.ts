import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';
import { calculateLineItem, calculateQuotationSummary } from '@/lib/calculations/financial';
import { learnAndUpsertRates } from '@/lib/catalog/rate-memory';
import { getSession } from '@/lib/auth/session';
import { normalizeCompanyName } from '@/lib/utils/formatters';

export async function GET(req: NextRequest) {
  await seedDb();
  const db = getDb();
  const session = await getSession(req);

  const url = new URL(req.url);
  const status = url.searchParams.get('status')?.trim() || '';
  const search = url.searchParams.get('q')?.trim() || '';
  const customerId = url.searchParams.get('customerId')?.trim() || '';

  let sql = `
    SELECT q.*, 
           (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id) as item_count,
           (SELECT COUNT(*) FROM quotation_sections qs WHERE qs.quotation_id = q.id) as section_count
    FROM quotations q
    WHERE 1=1
  `;
  const args: any[] = [];

  // Enforce server-side permissions: Employees (staff) can only view quotations they created
  if (session && session.role === 'staff') {
    sql += ' AND (q.created_by_id = ? OR q.created_by = ? OR q.created_by = ?)';
    args.push(session.userId, session.name, session.email);
  }

  if (status && status !== 'all') {
    sql += ' AND q.status = ?';
    args.push(status);
  }

  if (customerId) {
    // Parameterized lookup of unit to also resolve quotes matched by store_code or trade_name
    const custRes = await db.execute({
      sql: 'SELECT id, company_name, trade_name, store_code FROM customers WHERE id = ?',
      args: [customerId],
    });
    if (custRes.rows.length > 0) {
      const c = custRes.rows[0];
      const storeCode = (c.store_code as string)?.trim();
      const tradeName = (c.trade_name as string)?.trim();
      const compName = (c.company_name as string)?.trim();

      if (storeCode && compName) {
        sql += ' AND (q.customer_id = ? OR (q.store_code = ? AND (q.customer_name LIKE ? OR q.customer_name LIKE ?)))';
        args.push(customerId, storeCode, `%${compName}%`, `%${normalizeCompanyName(compName)}%`);
      } else if (tradeName && compName) {
        sql += ' AND (q.customer_id = ? OR (q.store_name = ? AND (q.customer_name LIKE ? OR q.customer_name LIKE ?)))';
        args.push(customerId, tradeName, `%${compName}%`, `%${normalizeCompanyName(compName)}%`);
      } else {
        sql += ' AND q.customer_id = ?';
        args.push(customerId);
      }
    } else {
      sql += ' AND q.customer_id = ?';
      args.push(customerId);
    }
  }

  if (search) {
    const numSearch = search.replace(/[^0-9.]/g, '');
    sql += ` AND (
      q.quote_number LIKE ? 
      OR q.customer_name LIKE ? 
      OR q.store_name LIKE ? 
      OR q.store_code LIKE ?
      OR q.quote_date LIKE ?
      OR q.validity_date LIKE ?
      OR q.reference_no LIKE ?
      OR q.status LIKE ?
      OR CAST(q.grand_total AS TEXT) LIKE ?
      ${numSearch ? 'OR CAST(ROUND(q.grand_total) AS TEXT) LIKE ?' : ''}
    )`;
    args.push(
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`
    );
    if (numSearch) {
      args.push(`%${numSearch}%`);
    }
  }

  // Strict grouping by quotation ID to guarantee NO DUPLICATES
  sql += ' GROUP BY q.id ORDER BY q.quote_date DESC, q.created_at DESC';

  const result = await db.execute({ sql, args });

  // Secondary layer de-duplication: Map by quotation id
  const uniqueQuotations = Array.from(
    new Map((result.rows as any[]).map((row) => [row.id, row])).values()
  );

  return NextResponse.json({ quotations: uniqueQuotations });
}

export async function POST(req: NextRequest) {
  await seedDb();
  const db = getDb();
  const session = await getSession(req);

  let transaction: Awaited<ReturnType<typeof db.transaction>> | undefined;
  try {
    const body = await req.json();
    if (!body || typeof body.customerName !== 'string' || !body.customerName.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.quoteDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(body.validityDate || '') || body.validityDate < body.quoteDate ||
        !['draft', 'approved'].includes(body.status || 'draft') || !['exclusive', 'inclusive'].includes(body.taxType || 'exclusive') ||
        !Array.isArray(body.sections) || !body.sections.length || body.sections.length > 100 ||
        !body.sections.some((s: any) => Array.isArray(s.items) && s.items.length) ||
        body.sections.some((s: any) => !Array.isArray(s.items) || s.items.length > 1000 || s.items.some((i: any) =>
          typeof i.description !== 'string' || !i.description.trim() ||
          !Number.isFinite(Number(i.quantity)) || Number(i.quantity) <= 0 ||
          !Number.isFinite(Number(i.unitRate)) || Number(i.unitRate) < 0 ||
          !Number.isFinite(Number(i.gstRate)) || Number(i.gstRate) < 0 || Number(i.gstRate) > 100))) {
      return NextResponse.json({ error: 'Invalid quotation: check customer, dates, items, quantities, rates and GST.' }, { status: 400 });
    }

    const {
      companyProfileId,
      customerId,
      customerName,
      customerAddress,
      customerGstin,
      storeName,
      quoteDate = new Date().toISOString().split('T')[0],
      validityDate,
      referenceNo,
      status = 'draft',
      taxType = 'exclusive',
      termsPayment,
      termsDelivery,
      termsValidity,
      termsTransport,
      termsGst,
      notes,
      sections = [],
    } = body;

    if (!customerName || !sections || sections.length === 0) {
      return NextResponse.json({ error: 'Customer and at least one section are required' }, { status: 400 });
    }

    if (!body.customerId || !(await db.execute({ sql: 'SELECT id FROM customers WHERE id = ?', args: [body.customerId] })).rows.length) return NextResponse.json({ error: 'Select a saved customer' }, { status: 400 });
    transaction = await db.transaction('write');
    const tx = transaction;
    // Generate unique Quotation / Rate Card Number (e.g. JPA-79 as per Ref/PO No.)
    let quoteNumber = referenceNo ? String(referenceNo).trim() : '';
    if (!quoteNumber) {
      const latestQuote = await tx.execute({
        sql: `SELECT quote_number FROM quotations ORDER BY created_at DESC LIMIT 1`
      });

      let nextNumber = 75;
      if (latestQuote.rows.length > 0) {
        const match = String(latestQuote.rows[0].quote_number).match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      quoteNumber = `JPA-${nextNumber}`;
    }

    const quoteId = `qte_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    // Flatten all items to compute deterministic summary
    const allItems: any[] = [];
    for (const sec of sections) {
      for (const itm of sec.items || []) {
        allItems.push({
          quantity: Number(itm.quantity) || 0,
          unitRate: Number(itm.unitRate) || 0,
          gstRate: Number(itm.gstRate) || 0,
        });
      }
    }

    const summary = calculateQuotationSummary(allItems, '33', customerGstin?.slice(0, 2) || '33', taxType);

    const creatorName = session?.name || (typeof body.createdBy === 'string' && body.createdBy.trim()) || 'Authorized Staff';
    const creatorId = session?.userId || (typeof body.createdById === 'string' && body.createdById.trim()) || null;

    let finalStoreCode: string | null = body.storeCode ? String(body.storeCode).trim() : null;
    if (!finalStoreCode && customerId) {
      const custRow = await tx.execute({ sql: 'SELECT store_code FROM customers WHERE id = ?', args: [customerId] });
      if (custRow.rows.length > 0 && custRow.rows[0].store_code) {
        finalStoreCode = String(custRow.rows[0].store_code);
      }
    }

    // Insert Quotation Master
    await tx.execute({
      sql: `INSERT INTO quotations (
        id, quote_number, company_profile_id, customer_id, customer_name, customer_address, 
        customer_gstin, store_name, store_code, quote_date, validity_date, reference_no, status, 
        currency, subtotal, gst_total, round_off, grand_total, tax_type, 
        terms_payment, terms_delivery, terms_validity, terms_transport, terms_gst, 
        notes, created_by, created_by_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        quoteId,
        quoteNumber,
        companyProfileId || 'cmp_jpa_master',
        customerId,
        customerName,
        customerAddress || '',
        customerGstin || null,
        storeName || null,
        finalStoreCode || null,
        quoteDate,
        validityDate || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        referenceNo || null,
        status,
        'INR',
        summary.subtotal,
        summary.gstTotal,
        summary.roundOff,
        summary.grandTotal,
        taxType,
        termsPayment || 'As agreed.',
        termsDelivery || 'Immediate.',
        termsValidity || '15 days from quotation date.',
        termsTransport || 'Extra, if applicable.',
        termsGst || 'Extra as Applicable',
        notes || null,
        creatorName,
        creatorId,
        now,
        now,
      ],
    });

    // Insert Sections and Items
    const itemsForMemory: any[] = [];

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx];
      const secId = `sec_${Date.now()}_${sIdx}_${Math.random().toString(36).substring(2, 6)}`;

      const sectionSummary = calculateQuotationSummary(sec.items || [], '33', '33', taxType);
      const secSub = sectionSummary.subtotal;
      const secGst = sectionSummary.gstTotal;

      await tx.execute({
        sql: `INSERT INTO quotation_sections (id, quotation_id, section_name, sort_order, subtotal, gst_total, section_total, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          secId,
          quoteId,
          sec.name || `SECTION ${sIdx + 1}`,
          sIdx,
          Number(secSub.toFixed(2)),
          Number(secGst.toFixed(2)),
          Number((secSub + secGst).toFixed(2)),
          now,
        ],
      });

      for (let iIdx = 0; iIdx < (sec.items || []).length; iIdx++) {
        const item = sec.items[iIdx];
        const qty = Number(item.quantity) || 0;
        const rate = Number(item.unitRate) || 0;
        const gst = Number(item.gstRate) || 0;
        const { taxableAmount: taxable, gstAmount: gstAmt, lineTotal: lineTot } = calculateLineItem(qty, rate, gst, taxType);



        const itmId = `itm_${Date.now()}_${sIdx}_${iIdx}`;
        await tx.execute({
          sql: `INSERT INTO quotation_items (
            id, quotation_id, section_id, sort_order, store_name, description, specification, 
            pack, quantity, unit, unit_rate, gst_rate, taxable_amount, gst_amount, line_total, 
            product_id, is_rate_autofilled, saved_rate_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            itmId,
            quoteId,
            secId,
            iIdx + 1,
            item.storeName || storeName || null,
            item.description,
            item.specification || null,
            item.pack || null,
            qty,
            item.unit || 'Nos',
            rate,
            gst,
            taxable,
            gstAmt,
            lineTot,
            item.productId || null,
            item.isRateAutofilled ? 1 : 0,
            item.savedRateDate || null,
            now,
          ],
        });

        itemsForMemory.push({
          description: item.description,
          specification: item.specification,
          pack: item.pack,
          unit: item.unit || 'Nos',
          unitRate: rate,
          gstRate: gst,
          productId: item.productId,
        });
      }


    }

    // AUTOMATIC PERSISTENT RATE MEMORY LEARNING:
    // Update Product & Rate Library silently with new verified rates!


    // Audit log
    await tx.execute({
      sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        creatorId || 'usr_staff_1',
        'CREATE_QUOTATION',
        'QUOTATION',
        quoteId,
        JSON.stringify({ quoteNumber, customerName, grandTotal: summary.grandTotal, employeeName: creatorName }),
        now,
      ],
    });

    // Update creator's last active timestamp
    if (creatorId) {
      await tx.execute({
        sql: 'UPDATE users SET last_active_at = ? WHERE id = ?',
        args: [now, creatorId],
      });
    } else if (creatorName && creatorName !== 'Authorized Staff') {
      await tx.execute({
        sql: 'UPDATE users SET last_active_at = ? WHERE name = ?',
        args: [now, creatorName],
      });
    }

    await learnAndUpsertRates(
      itemsForMemory,
      quoteNumber,
      quoteDate,
      customerId,
      session?.name || 'Authorized Staff',
      tx
    );
    await tx.commit();
    transaction = undefined;
    return NextResponse.json({
      success: true,
      quotationId: quoteId,
      quoteNumber,
      summary,
    });
  } catch (err: any) {
    await transaction?.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await seedDb();
  const db = getDb();
  const session = await getSession(req);

  try {
    const url = new URL(req.url);
    const all = url.searchParams.get('all') === 'true';

    if (all) {
      if (session && session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Only administrator can delete all quotations' }, { status: 403 });
      }

      await db.execute('DELETE FROM quotation_items');
      await db.execute('DELETE FROM quotation_sections');
      await db.execute('DELETE FROM quotations');

      return NextResponse.json({ success: true, message: 'All quotations deleted successfully' });
    }

    return NextResponse.json({ error: 'Specify ?all=true to delete all quotations' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
