import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-test-'));
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateLineItem, calculateQuotationSummary } from '../src/lib/calculations/financial';
import { amountToWordsIndian } from '../src/lib/calculations/number-to-words';
import { normalizeItemText, findMatchingRate, learnAndUpsertRates } from '../src/lib/catalog/rate-memory';
import { generateQuotationExcel } from '../src/lib/export/excel-generator';
import { generateQuotationPDF } from '../src/lib/export/pdf-generator';
import { getDb } from '../src/lib/db/client';
import { seedDb, resetAndSeedDb } from '../src/lib/db/seed';

describe('1. Deterministic GST & Financial Calculations', () => {
  it('correctly calculates tax-exclusive line items with rounding', () => {
    // 10 Ltrs of Glass Cleaner @ 185, 18% GST
    const res1 = calculateLineItem(10, 185, 18, 'exclusive');
    assert.strictEqual(res1.taxableAmount, 1850.0);
    assert.strictEqual(res1.gstAmount, 333.0);
    assert.strictEqual(res1.lineTotal, 2183.0);

    // 45 Reams of JK 75gsm @ 295, 12% GST
    const res2 = calculateLineItem(45, 295, 12, 'exclusive');
    assert.strictEqual(res2.taxableAmount, 13275.0);
    assert.strictEqual(res2.gstAmount, 1593.0);
    assert.strictEqual(res2.lineTotal, 14868.0);
  });

  it('correctly calculates tax-inclusive back-calculation', () => {
    // ₹1180 inclusive of 18% GST -> taxable: 1000, GST: 180
    const res = calculateLineItem(1, 1180, 18, 'inclusive');
    assert.strictEqual(res.taxableAmount, 1000.0);
    assert.strictEqual(res.gstAmount, 180.0);
    assert.strictEqual(res.lineTotal, 1180.0);
  });

  it('reconciles multi-rate GST groupings (5%, 12%, 18%) and intra-state CGST/SGST split', () => {
    const items = [
      { quantity: 10, unitRate: 185, gstRate: 18 }, // Taxable: 1850, GST: 333
      { quantity: 45, unitRate: 295, gstRate: 12 }, // Taxable: 13275, GST: 1593
      { quantity: 10, unitRate: 22, gstRate: 5 },   // Taxable: 220, GST: 11
    ];

    const summary = calculateQuotationSummary(items, '33', '33', 'exclusive');
    assert.strictEqual(summary.subtotal, 15345.0);
    assert.strictEqual(summary.gstTotal, 1937.0);
    assert.strictEqual(summary.grandTotal, 17282.0);

    // Check rate groupings
    const rate5 = summary.gstByRate.find((g) => g.rate === 5);
    const rate12 = summary.gstByRate.find((g) => g.rate === 12);
    const rate18 = summary.gstByRate.find((g) => g.rate === 18);

    assert.ok(rate5 && rate12 && rate18);
    assert.strictEqual(rate5.taxableAmount, 220.0);
    assert.strictEqual(rate5.gstAmount, 11.0);
    assert.strictEqual(rate5.cgstAmount, 5.5);
    assert.strictEqual(rate5.sgstAmount, 5.5);

    assert.strictEqual(rate12.taxableAmount, 13275.0);
    assert.strictEqual(rate12.gstAmount, 1593.0);
    assert.strictEqual(rate12.cgstAmount, 796.5);
    assert.strictEqual(rate12.sgstAmount, 796.5);

    assert.strictEqual(rate18.taxableAmount, 1850.0);
    assert.strictEqual(rate18.gstAmount, 333.0);
    assert.strictEqual(rate18.cgstAmount, 166.5);
    assert.strictEqual(rate18.sgstAmount, 166.5);
  });

  it('converts Indian Rupee amounts to proper words in Indian numbering system', () => {
    assert.strictEqual(
      amountToWordsIndian(34469),
      'Rupees Thirty-Four Thousand Four Hundred and Sixty-Nine Only'
    );
    assert.strictEqual(
      amountToWordsIndian(1500250),
      'Rupees Fifteen Lakh Two Hundred and Fifty Only'
    );
    assert.strictEqual(amountToWordsIndian(0), 'Rupees Zero Only');
  });
});

describe('2. Persistent Product & Rate Memory', () => {
  it('normalizes item text cleanly for search and match', () => {
    assert.strictEqual(normalizeItemText('Floor Cleaner (R1) - 5 Ltr Can'), 'floor cleaner r1 5 ltr can');
    assert.strictEqual(normalizeItemText('  A 4   Paper   JK 75gsm '), 'a 4 paper jk 75gsm');
  });

  it('silently auto-populates verified saved rates without duplicate warnings', async () => {
    await resetAndSeedDb();

    // Query for A/4 JK COPIER PAPER (verified master rate: 280)
    const match = await findMatchingRate({ description: 'A/4 JK COPIER PAPER' });
    assert.strictEqual(match.matched, true);
    assert.strictEqual(match.rate, 280.0);
    assert.strictEqual(match.unit, 'Ream');
    assert.ok(match.badgeText?.includes('Saved rate'));

    // Query for WATER BOTTLE (verified master rate: 45)
    const match2 = await findMatchingRate({ description: 'water bottle' });
    assert.strictEqual(match2.matched, true);
    assert.strictEqual(match2.rate, 45.0);

    // Unknown product returns matched = false, never guesses price
    const unknown = await findMatchingRate({ description: 'NonExistentProduct XYZ 999' });
    assert.strictEqual(unknown.matched, false);
  });

  it('learns newly verified item rates and appends to price history without altering past quotes', async () => {
    const db = getDb();

    const initialQuote = await db.execute({
      sql: 'SELECT grand_total FROM quotations WHERE quote_number = ?',
      args: ['JPA-74']
    });
    const originalQuoteTotal = initialQuote.rows[0].grand_total;
    assert.strictEqual(originalQuoteTotal, 17353.00);

    // Simulate saving a new quote with new verified material
    const uniqueDesc = `Special Floor Wax ${Date.now()}`;
    await learnAndUpsertRates(
      [{
        description: uniqueDesc,
        specification: 'Premium Polish',
        pack: '5 Ltr Can',
        unit: 'Ltrs',
        unitRate: 420.0,
        gstRate: 18.0,
      }],
      'JPA-99',
      '2026-10-28',
      undefined,
      'Test Suite'
    );

    // Verify rate was saved in catalog permanently
    const learnedMatch = await findMatchingRate({ description: uniqueDesc });
    assert.strictEqual(learnedMatch.matched, true);
    assert.strictEqual(learnedMatch.rate, 420.0);

    // Verify price history recorded initial verified rate
    const history = await db.execute({
      sql: 'SELECT * FROM rate_change_history WHERE source_quote_number = ?',
      args: ['JPA-99']
    });
    assert.ok(history.rows.length > 0);
    assert.strictEqual(Number(history.rows[0].new_rate), 420.0);

    // Critical requirement: original quotation total must NOT be retroactively changed!
    const quoteAfter = await db.execute({
      sql: 'SELECT grand_total FROM quotations WHERE quote_number = ?',
      args: ['JPA-74']
    });
    assert.strictEqual(quoteAfter.rows[0].grand_total, originalQuoteTotal);
  });
});

describe('3. Genuine Excel (.xlsx) Export with Real Formulas', () => {
  it('generates genuine .xlsx buffer with functioning Excel formulas', async () => {
    const exportData = {
      quoteNumber: 'JPA/2026-27/TEST-001',
      quoteDate: '2026-10-28',
      validityDate: '2026-11-12',
      supplier: {
        name: 'Jeevan Pranav Agencies (JPA)',
        address: '16-P, Sakthi Illam, Podanur, Coimbatore - 641023',
        gstin: '33BRGPM1867B1Z1',
      },
      customer: {
        companyName: 'Lifestyle International Pvt. Ltd.',
        address: 'Nexus Vijaya Mall, Chennai',
      },
      sections: [
        {
          name: 'HOUSEKEEPING QUOTATION',
          items: [
            { description: 'Floor Cleaner', quantity: 15, unit: 'Ltrs', unitRate: 140, gstRate: 18 },
            { description: 'Glass Cleaner', quantity: 10, unit: 'Ltrs', unitRate: 185, gstRate: 18 },
          ]
        }
      ],
      terms: { payment: '30 days', delivery: 'Immediate' },
    };

    const buffer = await generateQuotationExcel(exportData);
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 2000, 'Excel buffer size should be valid');

    // Verify PK zip header of .xlsx file
    assert.strictEqual(buffer[0], 0x50); // P
    assert.strictEqual(buffer[1], 0x4B); // K

    // Verify cell formulas in Excel workbook
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    const labels = new Map<string, number>();
    ws.eachRow(row => { if (typeof row.getCell('A').value === 'string') labels.set(String(row.getCell('A').value), row.number); });
    assert.ok(ws.getCell(`K${labels.get('PRICE SUBTOTAL')}`).formula.includes('SUM(K24:K25)'));
    assert.ok(ws.getCell(`K${labels.get('GST 5%')}`).formula.includes('SUMIF'));
    assert.ok(ws.getCell(`K${labels.get('GST 18%')}`).formula.includes('SUMIF'));
    const expected = calculateQuotationSummary(exportData.sections.flatMap(s => s.items));
    assert.equal(labels.has('GST TOTAL'), false, 'GST TOTAL row is removed from xlsx export as requested');
    assert.equal(ws.getCell(`K${labels.get('GRAND TOTAL')}`).result, expected.grandTotal);
  });

  it('creates separate worksheets for each section in multi-section quotations (e.g. Housekeeping & Stationary)', async () => {
    const multiSectionData = {
      quoteNumber: 'JPA-79',
      quoteDate: '2026-10-27',
      validityDate: '2026-11-15',
      supplier: {
        name: 'Jeevan Pranav Agencies (JPA)',
        address: 'Coimbatore',
        gstin: '33BRGPM1867B1Z1',
      },
      customer: {
        companyName: 'LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)',
        address: 'Chennai',
      },
      sections: [
        {
          name: 'Housekeeping',
          items: [{ description: 'Tissue Paper', quantity: 100, unit: 'Roll', unitRate: 90, gstRate: 18 }],
        },
        {
          name: 'Stationary',
          items: [{ description: 'Pen', quantity: 50, unit: 'Nos', unitRate: 5, gstRate: 18 }],
        },
      ],
      terms: {
        payment: 'As agreed.',
        delivery: 'Immediate.',
        validity: '15 days from quotation date.',
        transport: 'Extra, if applicable.',
        gst: 'Extra as Applicable',
      },
    };

    const buffer = await generateQuotationExcel(multiSectionData as any);
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    assert.strictEqual(wb.worksheets.length, 2, 'Must generate 2 separate worksheets');
    assert.strictEqual(wb.worksheets[0].name, 'Housekeeping', 'First sheet must be Housekeeping');
    assert.strictEqual(wb.worksheets[1].name, 'Stationary', 'Second sheet must be Stationary');

    // Both sheets have real rows and functioning formulas
    assert.ok(wb.worksheets[0].rowCount >= 30, 'Housekeeping sheet has complete layout');
    assert.ok(wb.worksheets[1].rowCount >= 30, 'Stationary sheet has complete layout');
  });

  it('does not include hardcoded contact persons (e.g. PRASANTH P or Vijay) when customer has no contact person', async () => {
    const data = {
      quoteNumber: 'JPA-TEST-CONTACT',
      quoteDate: '2026-10-30',
      validityDate: '2026-11-15',
      supplier: { name: 'JPA', address: 'Coimbatore', gstin: '33BRGPM1867B1Z1' },
      customer: { companyName: 'Any Customer Ltd', address: 'Any Address' },
      sections: [{ name: 'Items', items: [{ description: 'Item 1', quantity: 1, unit: 'Nos', unitRate: 100, gstRate: 18 }] }],
      terms: {},
    };
    const buffer = await generateQuotationExcel(data as any);
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    const cellA15 = ws.getCell('A15').value;
    assert.ok(!String(cellA15 || '').includes('PRASANTH'), 'Must not contain PRASANTH P');
    assert.ok(!String(cellA15 || '').includes('Vijay'), 'Must not contain Vijay');
    assert.strictEqual(cellA15 || '', '', 'Row 15 must be empty when contact person is not provided');

  });
});

describe('4. Genuine A4 PDF Generation', () => {
  it('generates genuine PDF buffer matching A4 dimensions', async () => {
    const exportData = {
      quoteNumber: 'JPA/2026-27/TEST-001',
      quoteDate: '2026-10-28',
      validityDate: '2026-11-12',
      supplier: {
        name: 'Jeevan Pranav Agencies (JPA)',
        address: '16-P, Sakthi Illam, Podanur, Coimbatore - 641023',
        gstin: '33BRGPM1867B1Z1',
      },
      customer: {
        companyName: 'Lifestyle International Pvt. Ltd.',
        address: 'Nexus Vijaya Mall, Chennai',
      },
      sections: [
        {
          name: 'HOUSEKEEPING QUOTATION',
          items: [
            { description: 'Floor Cleaner', quantity: 15, unit: 'Ltrs', unitRate: 140, gstRate: 18 },
          ]
        }
      ],
      terms: { payment: 'As agreed.' },
    };

    const buffer = await generateQuotationPDF(exportData);
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 1000, 'PDF buffer size should be valid');

    // Verify %PDF header of .pdf file
    const header = buffer.subarray(0, 4).toString('utf-8');
    assert.strictEqual(header, '%PDF');

    // Verify Portrait A4 orientation (210mm x 297mm -> 595.28pt x 841.89pt)
    const pdfContent = buffer.toString('latin1');
    const mediaBoxMatch = pdfContent.match(/\/MediaBox\s*\[\s*0\s*0\s*([0-9.]+)\s*([0-9.]+)\s*\]/);
    assert.ok(mediaBoxMatch, 'PDF should define MediaBox');
    const widthPt = parseFloat(mediaBoxMatch[1]);
    const heightPt = parseFloat(mediaBoxMatch[2]);
    assert.ok(heightPt > widthPt, 'Height must exceed width for Portrait A4 orientation');
    assert.ok(Math.abs(widthPt - 595.28) < 1.0, 'Width should match A4 portrait ~595.28 pt');
    assert.ok(Math.abs(heightPt - 841.89) < 1.0, 'Height should match A4 portrait ~841.89 pt');

    // Verify single-line unified GST breakdown (no split CGST/SGST)
    assert.ok(!pdfContent.includes('CGST'), 'Should not contain split CGST');
    assert.ok(!pdfContent.includes('SGST'), 'Should not contain split SGST');
  });

  it('generates separate Portrait A4 pages for each section (e.g. Housekeeping on Page 1, Stationary on Page 2)', async () => {
    const multiData = {
      quoteNumber: 'JPA-79',
      quoteDate: '2026-10-27',
      validityDate: '2026-11-15',
      supplier: {
        name: 'Jeevan Pranav Agencies (JPA)',
        address: 'Coimbatore',
        gstin: '33BRGPM1867B1Z1',
      },
      customer: {
        companyName: 'LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)',
        address: 'Chennai',
      },
      sections: [
        {
          name: 'Housekeeping',
          items: [{ description: 'Tissue Paper', quantity: 100, unit: 'Roll', unitRate: 90, gstRate: 18 }],
        },
        {
          name: 'Stationary',
          items: [{ description: 'Pen', quantity: 50, unit: 'Nos', unitRate: 5, gstRate: 18 }],
        },
      ],
      terms: {
        payment: 'As agreed.',
        delivery: 'Immediate.',
        validity: '15 days from quotation date.',
        transport: 'Extra, if applicable.',
        gst: 'Extra as Applicable',
      },
    };

    const buffer = await generateQuotationPDF(multiData as any);
    const pdfContent = buffer.toString('latin1');
    assert.ok(pdfContent.includes('SECTION: HOUSEKEEPING RATE CARD'));
    assert.ok(pdfContent.includes('SECTION: STATIONARY RATE CARD'));
    assert.ok(pdfContent.includes('Page 1 of 2'));
    assert.ok(pdfContent.includes('Page 2 of 2'));
  });
});
