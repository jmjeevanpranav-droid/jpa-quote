import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';
import { getSession } from '@/lib/auth/session';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await seedDb();
  const db = getDb();
  const session = await getSession();
  const { id } = await params;

  try {
    const quoteRes = await db.execute({
      sql: 'SELECT * FROM quotations WHERE id = ? LIMIT 1',
      args: [id],
    });

    if (quoteRes.rows.length === 0) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const source = quoteRes.rows[0];

    // Get next quote number
    const latestQuote = await db.execute({
      sql: 'SELECT quote_number FROM quotations ORDER BY created_at DESC LIMIT 1'
    });
    let nextNum = 56;
    if (latestQuote.rows.length > 0) {
      const match = String(latestQuote.rows[0].quote_number).match(/(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const newQuoteNumber = `JPA/2026-27/${String(nextNum).padStart(3, '0')}`;
    const newQuoteId = `qte_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // Insert duplicated quotation as draft
    await db.execute({
      sql: `INSERT INTO quotations (
        id, quote_number, company_profile_id, customer_id, customer_name, customer_address, 
        customer_gstin, store_name, quote_date, validity_date, reference_no, status, 
        currency, subtotal, gst_total, round_off, grand_total, tax_type, 
        terms_payment, terms_delivery, terms_validity, terms_transport, terms_gst, 
        notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newQuoteId,
        newQuoteNumber,
        source.company_profile_id,
        source.customer_id,
        source.customer_name,
        source.customer_address,
        source.customer_gstin,
        source.store_name,
        today,
        new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        source.reference_no,
        'draft',
        source.currency || 'INR',
        source.subtotal,
        source.gst_total,
        source.round_off,
        source.grand_total,
        source.tax_type || 'exclusive',
        source.terms_payment,
        source.terms_delivery,
        source.terms_validity,
        source.terms_transport,
        source.terms_gst,
        source.notes ? `Duplicated from ${source.quote_number}. ${source.notes}` : `Duplicated from ${source.quote_number}`,
        session?.name || 'Authorized Staff',
        now,
        now,
      ],
    });

    // Duplicate sections and items
    const sectionsRes = await db.execute({
      sql: 'SELECT * FROM quotation_sections WHERE quotation_id = ? ORDER BY sort_order ASC',
      args: [id],
    });

    for (const sec of sectionsRes.rows) {
      const newSecId = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.execute({
        sql: `INSERT INTO quotation_sections (id, quotation_id, section_name, sort_order, subtotal, gst_total, section_total, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          newSecId,
          newQuoteId,
          sec.section_name,
          sec.sort_order,
          sec.subtotal,
          sec.gst_total,
          sec.section_total,
          now,
        ],
      });

      const itemsRes = await db.execute({
        sql: 'SELECT * FROM quotation_items WHERE quotation_id = ? AND section_id = ? ORDER BY sort_order ASC',
        args: [id, sec.id],
      });

      for (const itm of itemsRes.rows) {
        const newItemId = `itm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.execute({
          sql: `INSERT INTO quotation_items (
            id, quotation_id, section_id, sort_order, store_name, description, specification, 
            pack, quantity, unit, unit_rate, gst_rate, taxable_amount, gst_amount, line_total, 
            product_id, is_rate_autofilled, saved_rate_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            newItemId,
            newQuoteId,
            newSecId,
            itm.sort_order,
            itm.store_name,
            itm.description,
            itm.specification,
            itm.pack,
            itm.quantity,
            itm.unit,
            itm.unit_rate,
            itm.gst_rate,
            itm.taxable_amount,
            itm.gst_amount,
            itm.line_total,
            itm.product_id,
            itm.is_rate_autofilled,
            itm.saved_rate_date,
            now,
          ],
        });
      }
    }

    return NextResponse.json({
      success: true,
      quotationId: newQuoteId,
      quoteNumber: newQuoteNumber,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
