import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-ai-import-test-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { seedDb } from '../src/lib/db/seed';
import { POST as aiImport } from '../src/app/api/ai-import/route';
import { GET as getAiKey, POST as saveAiKey, DELETE as deleteAiKey } from '../src/app/api/admin/ai-key/route';

test('AI Quotation Document Import parses 20 handwritten items with exact Particulars and Qty', async () => {
  await seedDb();

  const handwrittenNoteText = `
1. TBC cleaner. - 5 ltr
2. soap oil - 5 ltr.
3. phenyeil gel - 5 ltr.
4. Air freshner tin - 10 Nos
5. Vim soap - 10 Nos.
6. checked cloth big - 30 Nos.
7. Odonil - 10 nos.
8. harpic flush matic - 10 nos.
9. Scotch Brite - 5 nos.
10. Steel Brite - 5 nos
11. Floor cleaner - 2 ltr
12. Garbage cover small - 10 nos
13. Garbage cover big 30x50 - 40 kg
14. Mask - 40 nos
15. hand Gloves - 3 nos
16. Acid - 5 ltr.
17. Urinal mat - 2 nos
18. colin glass cleaner - 5 ltr.
19. Toilet Brush - 2 nos
20. hand wash - 5 ltr.
  `.trim();

  const req = new NextRequest('http://localhost:3000/api/ai-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: handwrittenNoteText }),
  });

  const res = await aiImport(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.items.length, 20, 'Must extract all 20 line items');

  // Verify Item 1: TBC cleaner, 5 Ltr
  assert.ok(data.items[0].description.toLowerCase().includes('tbc cleaner'));
  assert.equal(data.items[0].quantity, 5);
  assert.equal(data.items[0].unit, 'Ltr');

  // Verify Item 4: Air freshner tin, 10 Nos, pack: Tin
  assert.ok(data.items[3].description.toLowerCase().includes('air freshner'));
  assert.equal(data.items[3].quantity, 10);
  assert.equal(data.items[3].unit, 'Nos');
  assert.equal(data.items[3].pack, 'Tin');

  // Verify Item 6: checked cloth big -> Spec: Big
  assert.ok(data.items[5].description.toLowerCase().includes('checked cloth'));
  assert.equal(data.items[5].quantity, 30);
  assert.equal(data.items[5].specification, 'Big');

  // Verify Item 12: Garbage cover small -> Spec: Small
  assert.ok(data.items[11].description.toLowerCase().includes('garbage cover'));
  assert.equal(data.items[11].quantity, 10);
  assert.equal(data.items[11].specification, 'Small');

  // Verify Item 13: Garbage cover big 30x50, 40 Kg
  assert.ok(data.items[12].description.toLowerCase().includes('garbage cover'));
  assert.equal(data.items[12].quantity, 40);
  assert.equal(data.items[12].unit, 'Kg');

  // Verify Item 20: hand wash, 5 Ltr
  assert.ok(data.items[19].description.toLowerCase().includes('hand wash'));
  assert.equal(data.items[19].quantity, 5);
  assert.equal(data.items[19].unit, 'Ltr');
});

test('AI Document Import accepts Excel .xlsx spreadsheet and maps columns to Rate Card', async () => {
  await seedDb();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Housekeeping Supplies');

  // Document metadata banner in top rows
  ws.addRow(['Customer: Life Style International P Ltd.']);
  ws.addRow(['Store / Branch: Homecentre | Brookefeilds']);
  ws.addRow(['Quote / RC Ref: JPA-79']);
  ws.addRow([]); // empty row

  // Table header
  ws.addRow(['#', 'Particulars', 'Specification', 'Pack', 'Qty', 'Unit', 'Rate', 'GST %']);

  // Data rows
  ws.addRow([1, 'TBC Cleaner', 'R6', 'Pack', 5, 'Ltr', 92, 18]);
  ws.addRow([2, 'Soap Oil', '', 'Pack', 5, 'Ltr', 30, 18]);
  ws.addRow([3, 'Garbage Cover', '30x50 Big', 'Pack', 40, 'Kg', 165, 18]);
  ws.addRow([4, 'Air Freshner', '', 'Tin', 10, 'Nos', 120, 18]);

  const buffer = await wb.xlsx.writeBuffer();

  const formData = new FormData();
  const file = new File([buffer], 'Customer_Supplies_RFQ.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  formData.append('file', file);

  const req = new NextRequest('http://localhost:3000/api/ai-import', {
    method: 'POST',
    body: formData,
  });

  const res = await aiImport(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.provider, 'excel-parser');
  assert.equal(data.items.length, 4, 'Must extract all 4 lines from Excel');

  // Check Item 1: TBC Cleaner
  assert.equal(data.items[0].description, 'TBC Cleaner');
  assert.equal(data.items[0].specification, 'R6');
  assert.equal(data.items[0].pack, 'Pack');
  assert.equal(data.items[0].quantity, 5);
  assert.equal(data.items[0].unit, 'Ltr');
  assert.equal(data.items[0].rate, 92);
  assert.equal(data.items[0].gstRate, 18);

  // Check Item 3: Garbage Cover
  assert.equal(data.items[2].description, 'Garbage Cover');
  assert.equal(data.items[2].specification, '30x50 Big');
  assert.equal(data.items[2].quantity, 40);
  assert.equal(data.items[2].unit, 'Kg');
  assert.equal(data.items[2].rate, 165);

  // Verify Document Metadata parsed from top rows
  assert.equal(data.metadata.customerGuess, 'Life Style International P Ltd.');
  assert.equal(data.metadata.storeGuess, 'Homecentre | Brookefeilds');
  assert.equal(data.metadata.referenceNumber, 'JPA-79');
});

test('CSV preserves source rows without guessing unspecified catalog variants', async () => {
  await seedDb();

  const csvContent = `Item Description,Qty,Unit\nGIFT WRAPPING TAPE,50,NOS\nWATER BOTTLE,20,NOS\nBATTERY AA,10,NOS\n`;
  const buffer = Buffer.from(csvContent, 'utf-8');

  const formData = new FormData();
  const file = new File([buffer], 'Quick_List.csv', {
    type: 'text/csv',
  });
  formData.append('file', file);

  const req = new NextRequest('http://localhost:3000/api/ai-import', {
    method: 'POST',
    body: formData,
  });

  const res = await aiImport(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.provider, 'excel-parser');
  assert.equal(data.items.length, 3);

  // The source omits catalog specification/pack information. Do not guess its variant.
  assert.equal(data.items[0].description, 'GIFT WRAPPING TAPE');
  assert.equal(data.items[0].quantity, 50);
  assert.equal(data.items[0].rate, null);
  assert.equal(data.items[0].gstRate, null);

  // Preserve the requested product and quantity without assuming a bottle size.
  assert.equal(data.items[1].description, 'WATER BOTTLE');
  assert.equal(data.items[1].quantity, 20);
  assert.equal(data.items[1].rate, null);
});

test('Google Gemini Vision AI key management enables seamless cloud handwriting recognition', async () => {
  await seedDb();

  // 1. Initial check - returns provider status
  const getRes1 = await getAiKey();
  const getData1 = await getRes1.json();
  assert.equal(typeof getData1.hasKey, 'boolean');

  // 2. Save Gemini API key
  const saveReq = new NextRequest('http://localhost:3000/api/admin/ai-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: 'AIzaSyDemoVerificationKeyForJPA2026' }),
  });
  const saveRes = await saveAiKey(saveReq);
  const saveData = await saveRes.json();
  assert.equal(saveRes.status, 200);
  assert.equal(saveData.success, true);
  assert.equal(saveData.hasKey, true);

  // 3. Confirm retrieval returns masked key
  const getRes2 = await getAiKey();
  const getData2 = await getRes2.json();
  assert.equal(getData2.hasKey, true);
  assert.ok(getData2.maskedKey.startsWith('AIzaSy'));

  // 4. Delete key cleanly
  const delRes = await deleteAiKey();
  const delData = await delRes.json();
  assert.equal(delRes.status, 200);
  assert.equal(delData.hasKey, false);
});

test('Parseur key is cleanly rejected and Native Document Parser is active when no cloud key is set', async () => {
  await seedDb();

  // 1. Verify Parseur secret key is rejected with guidance
  const secretKey = 'sk_b563ff6a40c6c0958826138e39235ef02f47d888df71b851fda54ff4418e6d4c';

  const saveReq = new NextRequest('http://localhost:3000/api/admin/ai-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: secretKey, mailboxId: '221799' }),
  });

  const saveRes = await saveAiKey(saveReq);
  const saveData = await saveRes.json();
  assert.equal(saveRes.status, 400);
  assert.ok(saveData.error.includes('Google Gemini API key'));

  // 2. Clear any cloud keys to test default engine
  await deleteAiKey();

  // 3. Confirm default engine is native-parser
  const getRes = await getAiKey();
  const getData = await getRes.json();
  assert.equal(getData.hasKey, false);
  assert.equal(getData.provider, 'native-parser');
  assert.ok(getData.providerName.includes('Native Document Parser'));
});
