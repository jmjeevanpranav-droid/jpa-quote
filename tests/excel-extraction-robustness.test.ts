import fs from 'fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { seedDb } from '../src/lib/db/seed';
import { getDb } from '../src/lib/db/client';
import { parseExcelSpreadsheet, extractQuotationDocument } from '../src/lib/ai/extractor';

test('Excel Extraction: binary .xls and customer spreadsheets extract properly, securely and accurately', async () => {
  await seedDb();
  const catalog = (
    await getDb().execute(
      'SELECT description, specification, pack, default_rate, default_gst_rate, unit, category FROM products WHERE is_active = 1'
    )
  ).rows;

  // 1. Create a binary .xls (BIFF8) workbook matching customer quotation format
  const wb = XLSX.utils.book_new();
  const wsData = [
    [null, null, 'QUOTATION'],
    ['Jeevan Pranav Agencies', null, null, null, 'Date:', '01.11.26'],
    ['Quote To: Lifestyle International P Ltd.'],
    ['Store / Location: Madurai'],
    ['Quote No : JPA-01.11.26'],
    [],
    ['S.NO', 'MATERIALS', 'Description', 'QTY', 'Kg/Ltr/ Nos', 'PRICE', 'GST%'],
    [1, 'A4 Sheet 80 GSM', '', 20, 'Rims', 280, 0.18],
    [2, 'Natraj Classic Use & Throw Ball Pen', 'Blue Ink', 40, 'Nos', 5, 0.18],
    [3, 'Correction Whitner', '', 2, 'Qty', null, null],
    [4, 'Pencil', 'HB 2B', 1, 'box', null, null],
    [],
    ['Terms & Conditions'],
    ['Total Material Value', null, null, null, null, 5800]
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet2');

  // Also add an empty/summary sheet (like user files have) to verify multi-sheet safety
  const emptyWs = XLSX.utils.aoa_to_sheet([['Notes', 'Approved by store manager']]);
  XLSX.utils.book_append_sheet(wb, emptyWs, 'NotesSheet');

  // Write as legacy binary .xls (biff8)
  const xlsBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'biff8' });
  assert.ok(xlsBuffer.length > 0);

  const result = await parseExcelSpreadsheet(
    xlsBuffer,
    'Life Sty madurai Stationery quote01.11.26.xls',
    catalog,
    'test_job_1'
  );

  // Metadata verification
  assert.equal(result.metadata.customerGuess, 'Lifestyle International P Ltd.');
  assert.equal(result.metadata.storeGuess, 'Madurai');
  assert.equal(result.metadata.sectionGuess, 'Stationery');
  assert.ok(result.metadata.referenceNumber?.includes('01.11.26'));
  assert.equal(result.metadata.documentDate, '01.11.26');

  // Line items verification
  assert.equal(result.items.length, 4, 'Must extract all 4 data rows, ignoring non-data and notes sheet');

  // Item 1: A4 Sheet 80 GSM
  assert.equal(result.items[0].description, 'A4 Sheet 80 GSM');
  assert.equal(result.items[0].quantity, 20);
  assert.equal(result.items[0].unit, 'Ream', 'Unit "Rims" must normalize to "Ream"');
  assert.equal(result.items[0].rate, 280);
  assert.equal(result.items[0].gstRate, 18, 'Decimal 0.18 must convert to 18%');
  assert.equal(result.items[0].suggestedCategory, 'Stationery');

  // Item 2: Natraj Ball Pen with separate specification
  assert.equal(result.items[1].description, 'Natraj Classic Use & Throw Ball Pen');
  assert.equal(result.items[1].specification, 'Blue Ink');
  assert.equal(result.items[1].quantity, 40);
  assert.equal(result.items[1].unit, 'Nos');
  assert.equal(result.items[1].rate, 5);
  assert.equal(result.items[1].gstRate, 18);

  // Item 3: Correction Whitner with unit 'Qty' -> normalized to 'Nos' and null rate not fabricated
  assert.equal(result.items[2].description, 'Correction Whitner');
  assert.equal(result.items[2].quantity, 2);
  assert.equal(result.items[2].unit, 'Nos');
  assert.equal(result.items[2].rate, null, 'Must not fabricate rates when missing');
  assert.equal(result.items[2].gstRate, null);

  // Item 4: Pencil with unit 'box' -> normalized to 'Box'
  assert.equal(result.items[3].description, 'Pencil');
  assert.equal(result.items[3].quantity, 1);
  assert.equal(result.items[3].unit, 'Box');

  // 2. Also test actual customer file from Downloads if present
  const userFilePath = 'C:/Users/ADMIN/Downloads/Life Sty madurai Stationery quote01.11.26.xls';
  if (fs.existsSync(userFilePath)) {
    const userBuffer = fs.readFileSync(userFilePath);
    const userResult = await extractQuotationDocument(
      userBuffer,
      'Life Sty madurai Stationery quote01.11.26.xls',
      'application/vnd.ms-excel'
    );
    assert.equal(userResult.provider, 'excel-parser');
    assert.equal(userResult.items.length, 10, 'Must extract all 10 items from real user file');
    assert.equal(userResult.metadata.customerGuess, 'Life Style International');
    assert.equal(userResult.metadata.storeGuess, 'Madurai');
    assert.equal(userResult.metadata.sectionGuess, 'Stationery');
    assert.equal(userResult.items[0].description, 'A4 Sheet 80 GSM');
    assert.equal(userResult.items[0].unit, 'Ream');
    assert.equal(userResult.items[0].quantity, 20);
  }
});
