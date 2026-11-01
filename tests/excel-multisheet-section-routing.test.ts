import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { seedDb } from '../src/lib/db/seed';
import { getDb } from '../src/lib/db/client';
import { parseExcelSpreadsheet, extractQuotationDocument } from '../src/lib/ai/extractor';

test('Multi-Sheet Excel Extraction: detects multiple sheets, extracts exact Particulars & Quantity & Rates quoted, and groups into multiple sections', async () => {
  await seedDb();
  const catalog = (
    await getDb().execute(
      'SELECT description, specification, pack, default_rate, default_gst_rate, unit, category FROM products WHERE is_active = 1'
    )
  ).rows;

  // 1. Create a 2-sheet workbook in 1 XLSX file
  const wb = XLSX.utils.book_new();

  // Sheet 1: Housekeeping Materials
  const sheet1Data = [
    ['Quote To: Lifestyle International P Ltd.'],
    ['Store / Location: Madurai'],
    ['Quote Ref: JPA-HK-001'],
    [],
    ['S.NO', 'PARTICULARS', 'SPECIFICATION', 'PACK', 'QUANTITY', 'UNIT', 'RATE QUOTED', 'GST %'],
    [1, 'TBC Cleaner R6', 'Heavy Duty Formula', '1 Ltr', 15, 'Ltr', 92.00, 18],
    [2, 'Glass Cleaner R3', 'Streak-Free', '500ml', 8, 'Nos', 105.84, 18],
    [3, 'Air Freshner Tin', 'Lavender Bloom', 'Pouch', 25, 'Nos', 120.00, 18],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  XLSX.utils.book_append_sheet(wb, ws1, 'Housekeeping');

  // Sheet 2: Stationery Supplies
  const sheet2Data = [
    ['Customer: Lifestyle International P Ltd.'],
    ['Store: Madurai'],
    [],
    ['S.NO', 'PARTICULARS', 'SPECIFICATION', 'PACK', 'QUANTITY', 'UNIT', 'RATE QUOTED', 'GST %'],
    [1, 'A4 Sheet 80 GSM', 'JK Copier Bright White', '500 Sheets', 50, 'Ream', 295.00, 18],
    [2, 'Natraj Classic Pen', 'Blue Ballpoint', 'Pack of 10', 10, 'Pkt', 65.00, 18],
    [3, 'Permanent Marker', 'Black Chisel Tip', 'Nos', 12, 'Nos', 25.00, 18],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  XLSX.utils.book_append_sheet(wb, ws2, 'Stationery');

  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  assert.ok(xlsxBuffer.length > 0);

  // Parse multi-sheet spreadsheet
  const result = await parseExcelSpreadsheet(
    xlsxBuffer,
    'Lifestyle_Madurai_MultiSheet_Quote.xlsx',
    catalog,
    'job_multisheet_test'
  );

  // 2. Validate Multi-sheet Analysis & Metadata
  assert.equal(result.provider, 'excel-parser');
  assert.equal(result.metadata.hasMultipleSections, true, 'AI must detect that multiple sheets exist');
  assert.deepEqual(result.metadata.sections, ['Housekeeping', 'Stationery'], 'AI must identify exact sheet section names');
  assert.equal(result.items.length, 6, 'Must extract all items across both sheets');

  // 3. Validate Sheet 1 items: exact Particulars, Quantity, and Quoted Rates
  const hkItems = result.items.filter((i) => i.sectionName === 'Housekeeping');
  assert.equal(hkItems.length, 3, 'Must have 3 Housekeeping items');
  
  assert.equal(hkItems[0].description, 'TBC Cleaner R6');
  assert.equal(hkItems[0].quantity, 15);
  assert.equal(hkItems[0].unit, 'Ltr');
  assert.equal(hkItems[0].rate, 92.00, 'Must preserve exact rate quoted in Sheet 1');
  assert.equal(hkItems[0].sectionName, 'Housekeeping');

  assert.equal(hkItems[1].description, 'Glass Cleaner R3');
  assert.equal(hkItems[1].quantity, 8);
  assert.equal(hkItems[1].rate, 105.84, 'Must preserve exact rate quoted in Sheet 1');
  assert.equal(hkItems[1].sectionName, 'Housekeeping');

  assert.equal(hkItems[2].description, 'Air Freshner Tin');
  assert.equal(hkItems[2].quantity, 25);
  assert.equal(hkItems[2].rate, 120.00);

  // 4. Validate Sheet 2 items: exact Particulars, Quantity, and Quoted Rates
  const statItems = result.items.filter((i) => i.sectionName === 'Stationery');
  assert.equal(statItems.length, 3, 'Must have 3 Stationery items');

  assert.equal(statItems[0].description, 'A4 Sheet 80 GSM');
  assert.equal(statItems[0].quantity, 50);
  assert.equal(statItems[0].unit, 'Ream');
  assert.equal(statItems[0].rate, 295.00, 'Must preserve exact rate quoted in Sheet 2');
  assert.equal(statItems[0].sectionName, 'Stationery');

  assert.equal(statItems[1].description, 'Natraj Classic Pen');
  assert.equal(statItems[1].quantity, 10);
  assert.equal(statItems[1].unit, 'Pkt');
  assert.equal(statItems[1].rate, 65.00);
  assert.equal(statItems[1].sectionName, 'Stationery');

  assert.equal(statItems[2].description, 'Permanent Marker');
  assert.equal(statItems[2].quantity, 12);
  assert.equal(statItems[2].unit, 'Nos');
  assert.equal(statItems[2].rate, 25.00);
  assert.equal(statItems[2].sectionName, 'Stationery');

  // 5. End-to-end extractQuotationDocument verification
  const e2eResult = await extractQuotationDocument(
    xlsxBuffer,
    'Client_RFQ_MultiSheet.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  assert.equal(e2eResult.metadata.hasMultipleSections, true);
  assert.deepEqual(e2eResult.metadata.sections, ['Housekeeping', 'Stationery']);
  assert.equal(e2eResult.items.length, 6);
});

test('Customer RFQ with "Unit Rate" column and "HK" sheet: auto-detects Housekeeping and assigns rates properly', async () => {
  await seedDb();
  const catalog = (
    await getDb().execute(
      'SELECT description, specification, pack, default_rate, default_gst_rate, unit, category FROM products WHERE is_active = 1'
    )
  ).rows;

  const wb = XLSX.utils.book_new();

  // Sheet with "HK" and columns: Particulars, Spec, Pack, Qty, Unit, Unit Rate, GST %
  const hkSheetData = [
    ['Quote To: Lifestyle International'],
    ['Store: Forum Mall'],
    [],
    ['S.No', 'Particulars', 'Spec', 'Pack', 'Qty', 'Unit', 'Unit Rate', 'GST %'],
    [1, 'Glass Cleaner', 'R3', 'Pack', 1, 'Ltr', 105.84, 18],
    [2, 'Room Freshner', 'R2', 'Pack', 1, 'Ltr', 190.00, 18],
    [3, 'Floor Cleaner', 'R1', 'Pack', 1, 'Ltr', 105.84, 18],
  ];
  const ws = XLSX.utils.aoa_to_sheet(hkSheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'HK');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const result = await parseExcelSpreadsheet(buf, 'Lifestyle Forum Mall - 21 Oct 26 (HK & Stationery).xlsx', catalog, 'job_hk_test');

  assert.equal(result.items.length, 3);
  // Auto-detection of HK sheet name to Housekeeping
  assert.equal(result.items[0].sectionName, 'Housekeeping', 'HK sheet must accurately auto-detect to Housekeeping section');
  assert.equal(result.items[0].description, 'Glass Cleaner');
  assert.equal(result.items[0].unit, 'Ltr', 'Unit must be Ltr, NOT 105.84');
  assert.equal(result.items[0].rate, 105.84, 'Unit Rate must be in rate field (105.84)');

  assert.equal(result.items[1].description, 'Room Freshner');
  assert.equal(result.items[1].rate, 190.00, 'Room Freshner rate must be 190.00');
  assert.equal(result.items[1].unit, 'Ltr');

  assert.equal(result.items[2].description, 'Floor Cleaner');
  assert.equal(result.items[2].rate, 105.84);
});

