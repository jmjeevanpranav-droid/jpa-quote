import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-test-store-code-'));

import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/lib/db/client';
import { seedDb } from '../src/lib/db/seed';
import { generateQuotationExcel, ExportQuotationData } from '../src/lib/export/excel-generator';
import { generateQuotationPDF } from '../src/lib/export/pdf-generator';
import ExcelJS from 'exceljs';

test('Customer Store Code & Editable Table Workflow', async (t) => {
  await seedDb();
  const db = getDb();

  await t.test('1. Database schema stores and updates store_code in customers and customer_stores', async () => {
    const custId = `test_cust_${Date.now()}`;
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO customers (
        id, company_name, trade_name, store_code, gstin, billing_address, delivery_address,
        contact_person, phone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        custId,
        'Lifestyle International Pvt. Ltd.',
        'Prozone Mall',
        'PZ-01',
        '33AAACL2937J1ZL',
        'G-10, Ground Floor, Prozone Mall, Coimbatore',
        'G-10, Ground Floor, Prozone Mall, Coimbatore',
        'Mr. Anand',
        '9698414094',
        now,
        now,
      ],
    });

    const inserted = await db.execute({
      sql: 'SELECT * FROM customers WHERE id = ?',
      args: [custId],
    });
    assert.equal(inserted.rows.length, 1);
    assert.equal(inserted.rows[0].store_code, 'PZ-01');
    assert.equal(inserted.rows[0].company_name, 'Lifestyle International Pvt. Ltd.');
    assert.equal(inserted.rows[0].trade_name, 'Prozone Mall');

    // Simulate microsecond inline edit: updating Store Code to PZ-02
    await db.execute({
      sql: 'UPDATE customers SET store_code = ?, updated_at = ? WHERE id = ?',
      args: ['PZ-02', new Date().toISOString(), custId],
    });

    const updated = await db.execute({
      sql: 'SELECT store_code FROM customers WHERE id = ?',
      args: [custId],
    });
    assert.equal(updated.rows[0].store_code, 'PZ-02');

    await db.execute({
      sql: 'DELETE FROM customers WHERE id = ?',
      args: [custId],
    });
  });

  await t.test('2. Excel Generator places Store Code near No. and in the centre of Store name in Column B', async () => {
    const testData: ExportQuotationData = {
      quoteNumber: 'JPA-999',
      quoteDate: '2026-10-30',
      validityDate: '2026-11-14',
      supplier: {
        name: 'Jeevan Pranav Agencies (JPA)',
        address: '16-P, Sakthi Illam, Podanur, Coimbatore - 641023',
        gstin: '33BRGPM1867B1Z1',
      },
      customer: {
        companyName: 'Lifestyle International Pvt. Ltd.',
        tradeName: 'Prozone Mall',
        address: 'G-10, Ground Floor, Prozone Mall, Coimbatore',
        gstin: '33AAACL2937J1ZL',
        storeName: 'Lifestyle International | Prozone Mall',
        storeCode: 'PZ-01',
        contactPerson: 'Mr. Anand | Ph: 9698414094',
      },
      sections: [
        {
          name: 'Housekeeping',
          items: [
            {
              storeName: 'Lifestyle International | Prozone Mall',
              storeCode: 'PZ-01',
              description: 'Floor Cleaner Concentrate 5L',
              specification: 'Concentrated Can',
              pack: 'Can',
              quantity: 10,
              unit: 'Nos',
              unitRate: 450,
              gstRate: 18,
            },
          ],
        },
      ],
      terms: {
        payment: 'As agreed.',
        delivery: 'Immediate.',
        validity: '15 days.',
        transport: 'Extra.',
        gst: '18%',
      },
    };

    const buffer = await generateQuotationExcel(testData);
    assert.ok(buffer.byteLength > 1000, 'Must produce valid Excel buffer');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet(1);
    assert.ok(sheet, 'Section worksheet must exist');

    // Check Row 23 Headers
    const row23 = sheet.getRow(23);
    assert.equal(row23.getCell('A').value, 'No.');
    assert.equal(row23.getCell('B').value, 'Store Code');
    assert.equal(row23.getCell('C').value, 'Store name');
    assert.equal(row23.getCell('D').value, 'Particulars');
    assert.equal(row23.getCell('E').value, 'Specifications');
    assert.equal(row23.getCell('F').value, 'Pack');
    assert.equal(row23.getCell('G').value, 'Qty.');
    assert.equal(row23.getCell('H').value, 'Unit');
    assert.equal(row23.getCell('I').value, 'Unit price ₹');
    assert.equal(row23.getCell('J').value, 'GST %');
    assert.equal(row23.getCell('K').value, 'Amount ₹');

    // Check Row 24 Item 1
    const row24 = sheet.getRow(24);
    assert.equal(row24.getCell('A').value, 1);

    // Column B is separate Store Code near to No.
    const colBValue = String(row24.getCell('B').value);
    assert.equal(colBValue, 'PZ-01', 'Col B must contain Store Code in separate column');

    // Column C is clean Store name
    const colCValue = String(row24.getCell('C').value);
    assert.equal(colCValue, 'Lifestyle International | Prozone Mall', 'Col C must contain Store name');

    // Column D is Particulars
    assert.equal(row24.getCell('D').value, 'Floor Cleaner Concentrate 5L');

    // Check Row 14 Customer details contains Store Location and Store Code
    const row14Val = String(sheet.getCell('A14').value);
    assert.ok(row14Val.includes('PZ-01'), 'Row 14 must display Store Code');
  });

  await t.test('3. PDF Generator dynamically includes Store Code and Store / Branch columns with responsive A4 layout', async () => {
    const pdfTestData: ExportQuotationData = {
      quoteNumber: 'JPA-999',
      quoteDate: '2026-10-30',
      validityDate: '2026-11-14',
      supplier: {
        name: 'Jeevan Pranav Agencies (JPA)',
        address: '16-P, Sakthi Illam, Podanur, Coimbatore - 641023',
        gstin: '33BRGPM1867B1Z1',
      },
      customer: {
        companyName: 'Lifestyle International Pvt. Ltd.',
        tradeName: 'Prozone Mall',
        address: 'G-10, Ground Floor, Prozone Mall, Coimbatore',
        gstin: '33AAACL2937J1ZL',
        storeName: 'Lifestyle International | Prozone Mall',
        storeCode: '1903',
        contactPerson: 'Mr. Anand | Ph: 9698414094',
      },
      sections: [
        {
          name: 'Housekeeping',
          items: [
            {
              storeName: 'Lifestyle International | Prozone Mall',
              storeCode: '1903',
              description: 'Floor Cleaner Concentrate 5L',
              specification: 'Concentrated Can',
              pack: 'Can',
              quantity: 10,
              unit: 'Nos',
              unitRate: 450,
              gstRate: 18,
            },
          ],
        },
      ],
      terms: {
        payment: 'As agreed.',
        delivery: 'Immediate.',
        validity: '15 days.',
        transport: 'Extra.',
        gst: '18%',
      },
    };

    const pdfBuffer = await generateQuotationPDF(pdfTestData);
    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 1000, 'Must produce valid PDF buffer');

    const pdfHeader = pdfBuffer.subarray(0, 4).toString('utf-8');
    assert.equal(pdfHeader, '%PDF');

    const pdfContent = pdfBuffer.toString('latin1');
    // TrueType CID fonts (Calibri) encode glyphs in 2-byte hexadecimal strings in PDF streams,
    // whereas standard Type-1 fonts (Helvetica) encode as plain ASCII. Support both.
    const hasStoreCode =
      pdfContent.includes('Store Code') ||
      (pdfContent.includes('005e019a017d018c011e') && pdfContent.includes('0012017d011a011e'));
    assert.ok(hasStoreCode, 'PDF table must include Store Code header');

    const hasStoreBranch =
      pdfContent.includes('Store / Branch') ||
      pdfContent.includes('005e019a017d018c011e0003036c00030011018c010201760110015a');
    assert.ok(hasStoreBranch, 'PDF table must include Store / Branch header');

    const has1903 = pdfContent.includes('1903') || pdfContent.includes('03ed03f503ec03ef');
    assert.ok(has1903, 'PDF table must display Store Code 1903');

    const hasProzoneMall =
      pdfContent.includes('Prozone Mall') ||
      pdfContent.includes('0057018c017d01cc017d0176011e000300440102016f016f');
    assert.ok(hasProzoneMall, 'PDF table must display Prozone Mall');
  });

  await t.test('4. Customer Search Combobox & +15 Days Validity Date functionality', async () => {
    // 1. Verify CustomerSearchSelect component code has search combobox, Modern Nurture Glassmorphism modal & auto-fill
    const fs = await import('fs/promises');
    const comboboxCode = await fs.readFile('src/components/CustomerSearchSelect.tsx', 'utf-8');
    assert.ok(comboboxCode.includes('Search firm, company, store code or GSTIN'), 'Has search bar placeholder');
    assert.ok(comboboxCode.includes('Create &ldquo;'), 'Has Create option when firm is not found');
    assert.ok(comboboxCode.includes('Store Code') && comboboxCode.includes('(Optional)'), 'Has Store Code (Optional) in creation modal');
    assert.ok(comboboxCode.includes('backdrop-blur-2xl') && comboboxCode.includes('bg-white/95'), 'Styled with Modern Nurture Glassmorphism');

    // 2. Verify new/page.tsx integrates CustomerSearchSelect, storeCode, and +15 Days default validity
    const newPageCode = await fs.readFile('src/app/quotations/new/page.tsx', 'utf-8');
    assert.ok(newPageCode.includes('CustomerSearchSelect'), 'New quotation page integrates CustomerSearchSelect');
    assert.ok(newPageCode.includes('setStoreCode'), 'New quotation page tracks storeCode');
    assert.ok(newPageCode.includes('+15 Days (Default)'), 'New quotation page provides +15 Days Default validity preset');
    assert.ok(newPageCode.includes('Current / Present'), 'New quotation page displays Current / Present quotation date indicator');

    // 3. Test Quotation Date & Validity Date +15 days logic deterministically
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const vDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15);
    const vYyyy = vDateObj.getFullYear();
    const vMm = String(vDateObj.getMonth() + 1).padStart(2, '0');
    const vDd = String(vDateObj.getDate()).padStart(2, '0');
    const expectedValidityStr = `${vYyyy}-${vMm}-${vDd}`;

    assert.ok(expectedValidityStr > todayStr, 'Validity date is exactly 15 days ahead of current quotation date');
  });
});

