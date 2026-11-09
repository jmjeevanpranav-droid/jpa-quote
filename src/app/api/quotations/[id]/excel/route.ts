import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';
import { generateQuotationExcel, ExportQuotationData } from '@/lib/export/excel-generator';

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
      return new NextResponse('Quotation not found', { status: 404 });
    }

    const quotation = quoteRes.rows[0];

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
    const supplier = supplierRes.rows[0] || {};

    const sectionsRes = await db.execute({
      sql: 'SELECT * FROM quotation_sections WHERE quotation_id = ? ORDER BY sort_order ASC',
      args: [id],
    });

    const itemsRes = await db.execute({
      sql: 'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC',
      args: [id],
    });

    let customer: any = {};
    if (quotation.customer_id) {
      const customerRes = await db.execute({
        sql: 'SELECT * FROM customers WHERE id = ? LIMIT 1',
        args: [quotation.customer_id],
      });
      if (customerRes.rows.length > 0) {
        customer = customerRes.rows[0];
      }
    }
    if (!customer.id && quotation.customer_name) {
      const customerRes = await db.execute({
        sql: 'SELECT * FROM customers WHERE company_name = ? OR trade_name = ? LIMIT 1',
        args: [quotation.customer_name, quotation.customer_name],
      });
      if (customerRes.rows.length > 0) {
        customer = customerRes.rows[0];
      }
    }

    let contactPersonText: string | undefined = undefined;
    let storeCodeVal: string | undefined = quotation.store_code ? String(quotation.store_code) : undefined;
    if (quotation.store_name) {
      const storeRes = await db.execute({
        sql: 'SELECT * FROM customer_stores WHERE (customer_id = ? OR store_name = ?) LIMIT 1',
        args: [quotation.customer_id || customer.id || '', quotation.store_name],
      });
      if (storeRes.rows.length > 0) {
        const store = storeRes.rows[0];
        if (!storeCodeVal && store.store_code) {
          storeCodeVal = String(store.store_code);
        }
        if (store.contact_person) {
          contactPersonText = String(store.contact_person);
          if (store.phone) {
            contactPersonText += ` | Ph: ${store.phone}`;
          }
        }
      }
    }
    if (!storeCodeVal && customer.store_code) {
      storeCodeVal = String(customer.store_code);
    }
    if (!contactPersonText && customer.contact_person) {
      contactPersonText = String(customer.contact_person);
      if (customer.phone) {
        contactPersonText += ` | Ph: ${customer.phone}`;
      }
    }

    const sections = sectionsRes.rows.map((sec) => {
      const items = itemsRes.rows
        .filter((itm) => itm.section_id === sec.id)
        .map((itm) => ({
          storeName: itm.store_name ? String(itm.store_name) : undefined,
          storeCode: itm.store_code ? String(itm.store_code) : storeCodeVal,
          description: String(itm.description),
          specification: itm.specification ? String(itm.specification) : undefined,
          pack: itm.pack ? String(itm.pack) : undefined,
          quantity: Number(itm.quantity),
          unit: String(itm.unit),
          unitRate: Number(itm.unit_rate),
          gstRate: Number(itm.gst_rate),
        }));

      return {
        name: String(sec.section_name),
        items,
      };
    });

    const exportData: ExportQuotationData = {
      taxType: quotation.tax_type === 'inclusive' ? 'inclusive' : 'exclusive',
      quoteNumber: String(quotation.quote_number),
      quoteDate: String(quotation.quote_date),
      validityDate: String(quotation.validity_date),
      referenceNo: quotation.reference_no ? String(quotation.reference_no) : undefined,
      supplier: {
        name: String(supplier.name || 'Jeevan Pranav Agencies (JPA)'),
        tagline: supplier.tagline ? String(supplier.tagline) : 'Industrial & Housekeeping Supplies',
        address: String(supplier.address || '16-P, Sakthi Illam, Gandhi Nagar, Mettuthottam, Podanur, Coimbatore - 641023'),
        gstin: String(supplier.gstin || '33BRGPM1867B1Z1'),
        phone: supplier.phone ? String(supplier.phone) : '9790600971',
        email: supplier.email ? String(supplier.email) : 'jeevanpranavagencies@gmail.com',
        website: supplier.website ? String(supplier.website) : 'https://www.jeevanpranavagencies.com/',
        signatoryName: supplier.signatory_name ? String(supplier.signatory_name) : 'Mr. N JAYAKUMAR',
        signatoryDesignation: supplier.signatory_designation ? String(supplier.signatory_designation) : 'Proprietor / Authorised Signatory',
      },
      customer: {
        companyName: String(quotation.customer_name),
        tradeName: customer.trade_name ? String(customer.trade_name) : undefined,
        address: String(quotation.customer_address),
        gstin: quotation.customer_gstin ? String(quotation.customer_gstin) : undefined,
        storeName: quotation.store_name ? String(quotation.store_name) : undefined,
        storeCode: storeCodeVal,
        contactPerson: contactPersonText,
      },
      sections,
      terms: {
        payment: quotation.terms_payment ? String(quotation.terms_payment) : 'As agreed.',
        delivery: quotation.terms_delivery ? String(quotation.terms_delivery) : 'Immediate.',
        validity: quotation.terms_validity ? String(quotation.terms_validity) : '15 days from quotation date.',
        transport: quotation.terms_transport ? String(quotation.terms_transport) : 'Extra, if applicable.',
        gst: quotation.terms_gst ? String(quotation.terms_gst) : 'Extra as Applicable',
      },
      notes: quotation.notes ? String(quotation.notes) : undefined,
    };

    const excelBuffer = await generateQuotationExcel(exportData);

    const safeQuoteNum = String(quotation.quote_number).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeCustName = String(quotation.customer_name).split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
    const filename = `JPA_${safeCustName}_${safeQuoteNum}_${quotation.quote_date}.xlsx`;

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (err: any) {
    console.error('Excel export error:', err);
    return new NextResponse('Unable to export quotation', { status: 500 });
  }
}
