import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';
import { calculateLineItem, calculateQuotationSummary } from '@/lib/calculations/financial';
import { learnAndUpsertRates } from '@/lib/catalog/rate-memory';
import { getSession } from '@/lib/auth/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await seedDb();
  const db = getDb();
  const { id } = await params;

  try {
    const quoteRes = await db.execute({
      sql: 'SELECT * FROM quotations WHERE id = ? LIMIT 1',
      args: [id],
    });

    if (quoteRes.rows.length === 0) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const quotation = quoteRes.rows[0];

    // Enforce quotation ownership: Employees can only view quotations they created
    const session = await getSession(req);
    if (session && session.role === 'staff') {
      const isOwner =
        quotation.created_by_id === session.userId ||
        quotation.created_by === session.name ||
        quotation.created_by === session.email;
      if (!isOwner) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to view this quotation' }, { status: 403 });
      }
    }

    // Fetch supplier details
    let supplierRes = await db.execute({
      sql: 'SELECT * FROM company_profiles WHERE id = ? LIMIT 1',
      args: [quotation.company_profile_id],
    });
    if (supplierRes.rows.length === 0) {
      supplierRes = await db.execute('SELECT * FROM company_profiles WHERE is_default = 1 LIMIT 1');
    }
    if (supplierRes.rows.length === 0) {
      supplierRes = await db.execute('SELECT * FROM company_profiles LIMIT 1');
    }

    // Fetch customer details
    const customerRes = await db.execute({
      sql: 'SELECT * FROM customers WHERE id = ? LIMIT 1',
      args: [quotation.customer_id],
    });

    // Fetch sections
    const sectionsRes = await db.execute({
      sql: 'SELECT * FROM quotation_sections WHERE quotation_id = ? ORDER BY sort_order ASC',
      args: [id],
    });

    // Fetch items
    const itemsRes = await db.execute({
      sql: 'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC',
      args: [id],
    });

    // Group items by section
    const sections = sectionsRes.rows.map((sec) => {
      const items = itemsRes.rows.filter((itm) => itm.section_id === sec.id);
      return {
        ...sec,
        items,
      };
    });

    return NextResponse.json({
      quotation,
      supplier: supplierRes.rows[0] || null,
      customer: customerRes.rows[0] || null,
      sections,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await seedDb();
  const db = getDb();
  const session = await getSession(req);
  const { id } = await params;

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
      customerName,
      customerAddress,
      customerGstin,
      storeName,
      quoteDate,
      validityDate,
      referenceNo,
      status,
      taxType = 'exclusive',
      termsPayment,
      termsDelivery,
      termsValidity,
      termsTransport,
      termsGst,
      notes,
      sections = [],
    } = body;

    // Check existing
    const existing = await db.execute({
      sql: 'SELECT quote_number, customer_id, created_by_id, created_by FROM quotations WHERE id = ? LIMIT 1',
      args: [id],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    if (session && session.role === 'staff') {
      const isOwner =
        existing.rows[0].created_by_id === session.userId ||
        existing.rows[0].created_by === session.name ||
        existing.rows[0].created_by === session.email;
      if (!isOwner) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to modify this quotation' }, { status: 403 });
      }
    }

    const quoteNumber = String(existing.rows[0].quote_number);
    const customerId = String(existing.rows[0].customer_id);
    const now = new Date().toISOString();

    // Flatten items and compute totals
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

    transaction = await db.transaction('write');
    const tx = transaction;
    let finalStoreCode: string | null = body.storeCode !== undefined ? (body.storeCode ? String(body.storeCode).trim() : null) : null;
    if (finalStoreCode === null && customerId) {
      const custRow = await tx.execute({ sql: 'SELECT store_code FROM customers WHERE id = ?', args: [customerId] });
      if (custRow.rows.length > 0 && custRow.rows[0].store_code) {
        finalStoreCode = String(custRow.rows[0].store_code);
      }
    }

    // Update Quotation Master
    await tx.execute({
      sql: `UPDATE quotations SET 
            customer_name = ?, customer_address = ?, customer_gstin = ?, store_name = ?, store_code = COALESCE(?, store_code),
            quote_date = ?, validity_date = ?, reference_no = ?, status = ?, tax_type = ?,
            subtotal = ?, gst_total = ?, round_off = ?, grand_total = ?,
            terms_payment = ?, terms_delivery = ?, terms_validity = ?, terms_transport = ?, terms_gst = ?,
            notes = ?, updated_at = ?
            WHERE id = ?`,
      args: [
        customerName,
        customerAddress,
        customerGstin || null,
        storeName || null,
        finalStoreCode,
        quoteDate,
        validityDate,
        referenceNo || null,
        status || 'draft',
        taxType,
        summary.subtotal,
        summary.gstTotal,
        summary.roundOff,
        summary.grandTotal,
        termsPayment || 'As agreed.',
        termsDelivery || 'Immediate.',
        termsValidity || '15 days from quotation date.',
        termsTransport || 'Extra, if applicable.',
        termsGst || 'Extra as Applicable',
        notes || null,
        now,
        id,
      ],
    });

    // Delete existing sections & items, then re-insert cleanly
    await tx.execute({ sql: 'DELETE FROM quotation_items WHERE quotation_id = ?', args: [id] });
    await tx.execute({ sql: 'DELETE FROM quotation_sections WHERE quotation_id = ?', args: [id] });

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
          id,
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
            id,
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

    // Rate Library learning


    // Audit Event
    await tx.execute({
      sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        session?.userId || 'usr_staff_1',
        'UPDATE_QUOTATION',
        'QUOTATION',
        id,
        JSON.stringify({ quoteNumber, grandTotal: summary.grandTotal, status, employeeName: session?.name || 'Staff' }),
        now,
      ],
    });

    // Update user last active timestamp
    if (session?.userId) {
      await tx.execute({
        sql: 'UPDATE users SET last_active_at = ? WHERE id = ?',
        args: [now, session.userId],
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
    return NextResponse.json({ success: true, summary });
  } catch (err: any) {
    await transaction?.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await seedDb();
  const db = getDb();
  const session = await getSession(req);
  const { id } = await params;

  try {
    const existing = await db.execute({
      sql: 'SELECT quote_number, created_by_id, created_by FROM quotations WHERE id = ? LIMIT 1',
      args: [id],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    if (session && session.role === 'staff') {
      const isOwner =
        existing.rows[0].created_by_id === session.userId ||
        existing.rows[0].created_by === session.name ||
        existing.rows[0].created_by === session.email;
      if (!isOwner) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to delete this quotation' }, { status: 403 });
      }
    }

    await db.execute({ sql: 'DELETE FROM quotation_items WHERE quotation_id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM quotation_sections WHERE quotation_id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM quotations WHERE id = ?', args: [id] });

    await db.execute({
      sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `aud_${Date.now()}`,
        session?.userId || 'usr_staff_1',
        'DELETE_QUOTATION',
        'QUOTATION',
        id,
        JSON.stringify({ id }),
        new Date().toISOString(),
      ],
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
