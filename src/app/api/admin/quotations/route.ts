import { NextRequest, NextResponse, connection } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';
import { getSession } from '@/lib/auth/session';
import { calculateLineItem, calculateQuotationSummary } from '@/lib/calculations/financial';
import { learnAndUpsertRates } from '@/lib/catalog/rate-memory';

export async function GET(req: NextRequest) {
  try { await connection(); } catch {}
  await seedDb();
  const session = await getSession(req);

  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Only Administrator can access full quotation vision.' },
      { status: 403 }
    );
  }

  const db = getDb();
  try {
    const url = new URL(req.url);
    const userIdFilter = url.searchParams.get('userId')?.trim() || '';
    const statusFilter = url.searchParams.get('status')?.trim() || '';

    const [quotesRes, sectionsRes, itemsRes, usersRes] = await Promise.all([
      db.execute('SELECT * FROM quotations ORDER BY quote_date DESC, created_at DESC'),
      db.execute('SELECT * FROM quotation_sections ORDER BY sort_order ASC'),
      db.execute('SELECT * FROM quotation_items ORDER BY sort_order ASC'),
      db.execute('SELECT id, email, name, contact, role, avatar_url FROM users'),
    ]);

    const usersById = new Map<string, any>();
    const usersByEmail = new Map<string, any>();
    const usersByName = new Map<string, any>();
    for (const u of usersRes.rows) {
      const userObj = {
        id: String(u.id),
        email: String(u.email),
        name: String(u.name),
        contact: u.contact ? String(u.contact) : '',
        role: String(u.role),
        avatar_url: u.avatar_url ? String(u.avatar_url) : null,
      };
      usersById.set(userObj.id.toLowerCase(), userObj);
      usersByEmail.set(userObj.email.toLowerCase(), userObj);
      usersByName.set(userObj.name.toLowerCase(), userObj);
    }

    const itemsBySection = new Map<string, any[]>();
    for (const itm of itemsRes.rows) {
      const secId = String(itm.section_id || '');
      if (!itemsBySection.has(secId)) itemsBySection.set(secId, []);
      itemsBySection.get(secId)!.push({
        id: String(itm.id),
        section_id: secId,
        quotation_id: String(itm.quotation_id),
        description: String(itm.description || ''),
        specification: itm.specification ? String(itm.specification) : '',
        pack: itm.pack ? String(itm.pack) : '',
        quantity: Number(itm.quantity || 0),
        unit: String(itm.unit || 'Nos'),
        unit_rate: Number(itm.unit_rate || 0),
        gst_rate: Number(itm.gst_rate ?? 18),
        taxable_amount: Number(itm.taxable_amount || 0),
        tax_amount: Number(itm.tax_amount || 0),
        line_total: Number(itm.line_total || 0),
        sort_order: Number(itm.sort_order || 0),
      });
    }

    const sectionsByQuote = new Map<string, any[]>();
    for (const sec of sectionsRes.rows) {
      const qId = String(sec.quotation_id || '');
      const secId = String(sec.id);
      if (!sectionsByQuote.has(qId)) sectionsByQuote.set(qId, []);
      sectionsByQuote.get(qId)!.push({
        id: secId,
        quotation_id: qId,
        name: String(sec.name || 'General'),
        sort_order: Number(sec.sort_order || 0),
        items: itemsBySection.get(secId) || [],
      });
    }

    let quotations = quotesRes.rows.map((q: any) => {
      const qId = String(q.id);
      const createdById = q.created_by_id ? String(q.created_by_id) : '';
      const createdByName = q.created_by ? String(q.created_by) : '';
      const matchedUser =
        (createdById && usersById.get(createdById.toLowerCase())) ||
        (createdByName && usersByEmail.get(createdByName.toLowerCase())) ||
        (createdByName && usersByName.get(createdByName.toLowerCase())) ||
        null;

      const sections = sectionsByQuote.get(qId) || [];
      const itemCount = sections.reduce((acc, s) => acc + s.items.length, 0);

      return {
        id: qId,
        quote_number: String(q.quote_number || ''),
        customer_id: q.customer_id ? String(q.customer_id) : null,
        customer_name: String(q.customer_name || ''),
        customer_address: q.customer_address ? String(q.customer_address) : '',
        customer_gstin: q.customer_gstin ? String(q.customer_gstin) : '',
        store_name: q.store_name ? String(q.store_name) : '',
        store_code: q.store_code ? String(q.store_code) : '',
        quote_date: String(q.quote_date || ''),
        validity_date: String(q.validity_date || ''),
        reference_no: q.reference_no ? String(q.reference_no) : '',
        tax_type: String(q.tax_type || 'exclusive'),
        status: String(q.status || 'draft'),
        subtotal: Number(q.subtotal || 0),
        total_tax: Number(q.total_tax || 0),
        grand_total: Number(q.grand_total || 0),
        notes: q.notes ? String(q.notes) : '',
        terms_and_conditions: q.terms_and_conditions ? String(q.terms_and_conditions) : '',
        created_by_id: createdById,
        created_by: matchedUser?.name || createdByName || 'Administrator',
        employee: matchedUser,
        created_at: String(q.created_at || ''),
        updated_at: String(q.updated_at || ''),
        sections,
        section_count: sections.length,
        item_count: itemCount,
      };
    });

    if (userIdFilter) {
      const targetUser = usersById.get(userIdFilter.toLowerCase());
      quotations = quotations.filter((q) => {
        if (q.created_by_id && q.created_by_id.toLowerCase() === userIdFilter.toLowerCase()) return true;
        if (q.employee?.id && q.employee.id.toLowerCase() === userIdFilter.toLowerCase()) return true;
        if (targetUser) {
          const cb = q.created_by.toLowerCase();
          return cb === targetUser.name.toLowerCase() || cb === targetUser.email.toLowerCase();
        }
        return false;
      });
    }

    if (statusFilter && statusFilter !== 'all') {
      quotations = quotations.filter((q) => q.status === statusFilter);
    }

    return NextResponse.json(
      { success: true, quotations },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err: any) {
    console.error('Admin quotations fetch error:', err);
    return NextResponse.json({ error: 'Failed to load quotations' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await seedDb();
  const session = await getSession(req);

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Administrator privileges required.' }, { status: 403 });
  }

  const db = getDb();
  let transaction: Awaited<ReturnType<typeof db.transaction>> | undefined;

  try {
    const body = await req.json();
    const { id } = body;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing quotation ID' }, { status: 400 });
    }

    const existingRes = await db.execute({
      sql: 'SELECT * FROM quotations WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }
    const existing = existingRes.rows[0];
    const now = new Date().toISOString();

    const quoteNumber = typeof body.quote_number === 'string' && body.quote_number.trim()
      ? body.quote_number.trim()
      : String(existing.quote_number);
    const customerName = typeof body.customer_name === 'string' && body.customer_name.trim()
      ? body.customer_name.trim()
      : String(existing.customer_name);
    const customerAddress = body.customer_address !== undefined
      ? String(body.customer_address || '')
      : String(existing.customer_address || '');
    const customerGstin = body.customer_gstin !== undefined
      ? String(body.customer_gstin || '')
      : String(existing.customer_gstin || '');
    const storeName = body.store_name !== undefined
      ? String(body.store_name || '')
      : String(existing.store_name || '');
    const storeCode = body.store_code !== undefined
      ? String(body.store_code || '')
      : String(existing.store_code || '');
    const quoteDate = typeof body.quote_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.quote_date)
      ? body.quote_date
      : String(existing.quote_date);
    const validityDate = typeof body.validity_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.validity_date)
      ? body.validity_date
      : String(existing.validity_date);
    const referenceNo = body.reference_no !== undefined
      ? String(body.reference_no || '')
      : String(existing.reference_no || '');
    const taxType = body.tax_type === 'inclusive' || body.tax_type === 'exclusive'
      ? body.tax_type
      : String(existing.tax_type || 'exclusive');
    const status = body.status === 'approved' || body.status === 'draft'
      ? body.status
      : String(existing.status || 'draft');
    const notes = body.notes !== undefined
      ? String(body.notes || '')
      : String(existing.notes || '');
    const terms = body.terms_and_conditions !== undefined
      ? String(body.terms_and_conditions || '')
      : String(existing.terms_and_conditions || '');
    const createdById = body.created_by_id !== undefined
      ? String(body.created_by_id || '')
      : String(existing.created_by_id || '');
    const createdBy = body.created_by !== undefined
      ? String(body.created_by || '')
      : String(existing.created_by || '');

    transaction = await db.transaction('write');
    const tx = transaction;

    let subtotal = Number(existing.subtotal || 0);
    let totalTax = Number(existing.total_tax || 0);
    let grandTotal = Number(existing.grand_total || 0);
    let cgstTotal = Number(existing.cgst_total || 0);
    let sgstTotal = Number(existing.sgst_total || 0);
    let igstTotal = Number(existing.igst_total || 0);

    if (Array.isArray(body.sections) && body.sections.length > 0) {
      const processedSections: any[] = [];
      const itemsForMemory: any[] = [];

      for (const sec of body.sections) {
        const secItems = Array.isArray(sec.items) ? sec.items : [];
        const processedItems = secItems.map((item: any) => {
          const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
          const rate = Number(item.unit_rate ?? item.unitRate ?? 0);
          const gst = Number(item.gst_rate ?? item.gstRate ?? 18);
          const calc = calculateLineItem(qty, rate, gst, taxType as 'exclusive' | 'inclusive');

          itemsForMemory.push({
            category: sec.name || 'General',
            description: String(item.description || '').trim(),
            specification: item.specification || '',
            pack: item.pack || '',
            unit: item.unit || 'Nos',
            unitRate: rate,
            gstRate: gst,
          });

          return {
            description: String(item.description || '').trim(),
            specification: item.specification ? String(item.specification) : null,
            pack: item.pack ? String(item.pack) : null,
            quantity: qty,
            unit: String(item.unit || 'Nos'),
            unitRate: rate,
            gstRate: gst,
            taxableAmount: calc.taxableAmount,
            taxAmount: calc.gstAmount,
            lineTotal: calc.lineTotal,
          };
        });

        processedSections.push({
          name: String(sec.name || 'General'),
          items: processedItems,
        });
      }

      const summary = calculateQuotationSummary(
        processedSections.flatMap((s) => s.items),
        '33',
        '33',
        taxType as 'exclusive' | 'inclusive'
      );
      subtotal = summary.subtotal;
      totalTax = summary.gstTotal;
      grandTotal = summary.grandTotal;
      cgstTotal = summary.isInterState ? 0 : Number((summary.gstTotal / 2).toFixed(2));
      sgstTotal = summary.isInterState ? 0 : Number((summary.gstTotal / 2).toFixed(2));
      igstTotal = summary.isInterState ? summary.gstTotal : 0;

      await tx.execute({ sql: 'DELETE FROM quotation_items WHERE quotation_id = ?', args: [id] });
      await tx.execute({ sql: 'DELETE FROM quotation_sections WHERE quotation_id = ?', args: [id] });

      for (let sIdx = 0; sIdx < processedSections.length; sIdx++) {
        const sec = processedSections[sIdx];
        const secId = `sec_${Date.now()}_${sIdx}_${Math.random().toString(36).substring(2, 5)}`;
        await tx.execute({
          sql: `INSERT INTO quotation_sections (id, quotation_id, name, sort_order) VALUES (?, ?, ?, ?)`,
          args: [secId, id, sec.name, sIdx + 1],
        });

        for (let iIdx = 0; iIdx < sec.items.length; iIdx++) {
          const item = sec.items[iIdx];
          const itemId = `qi_${Date.now()}_${sIdx}_${iIdx}_${Math.random().toString(36).substring(2, 5)}`;
          await tx.execute({
            sql: `INSERT INTO quotation_items
                  (id, quotation_id, section_id, description, specification, pack, quantity, unit, unit_rate, gst_rate, taxable_amount, tax_amount, line_total, sort_order)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              itemId,
              id,
              secId,
              item.description,
              item.specification,
              item.pack,
              item.quantity,
              item.unit,
              item.unitRate,
              item.gstRate,
              item.taxableAmount,
              item.taxAmount,
              item.lineTotal,
              iIdx + 1,
            ],
          });
        }
      }

      if (itemsForMemory.length > 0) {
        await learnAndUpsertRates(
          itemsForMemory,
          quoteNumber,
          quoteDate,
          existing.customer_id ? String(existing.customer_id) : undefined,
          session.name || 'Administrator',
          tx
        );
      }
    }

    await tx.execute({
      sql: `UPDATE quotations SET
              quote_number = ?, customer_name = ?, customer_address = ?, customer_gstin = ?,
              store_name = ?, store_code = ?, quote_date = ?, validity_date = ?,
              reference_no = ?, tax_type = ?, status = ?, notes = ?, terms_and_conditions = ?,
              created_by_id = ?, created_by = ?,
              subtotal = ?, total_tax = ?, cgst_total = ?, sgst_total = ?, igst_total = ?, grand_total = ?,
              updated_at = ?
            WHERE id = ?`,
      args: [
        quoteNumber,
        customerName,
        customerAddress || null,
        customerGstin || null,
        storeName || null,
        storeCode || null,
        quoteDate,
        validityDate,
        referenceNo || null,
        taxType,
        status,
        notes || null,
        terms || null,
        createdById || null,
        createdBy || null,
        subtotal,
        totalTax,
        cgstTotal,
        sgstTotal,
        igstTotal,
        grandTotal,
        now,
        id,
      ],
    });

    await tx.execute({
      sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        session.userId,
        'ADMIN_QUOTATION_UPDATED',
        'QUOTATION',
        id,
        JSON.stringify({ quoteNumber, status, grandTotal, updatedBy: session.email }),
        now,
      ],
    });

    await tx.commit();
    transaction = undefined;

    return NextResponse.json({
      success: true,
      message: `Quotation ${quoteNumber} updated by Administrator.`,
      summary: { subtotal, totalTax, grandTotal },
    });
  } catch (err: any) {
    await transaction?.rollback();
    console.error('Admin quotation update error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update quotation' }, { status: 500 });
  }
}
