import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-section-import-test-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { seedDb } from '../src/lib/db/seed';
import { POST as aiImport } from '../src/app/api/ai-import/route';

test('AI Document Import accurately detects Stationery section, customer, store and reference from filename', async () => {
  await seedDb();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');

  // Table header
  ws.addRow(['Particulars', 'Specification', 'Pack', 'Qty', 'Unit', 'Rate', 'GST %']);
  ws.addRow(['GIFT WRAPPING TAPE', 'Half - 1/2', '10', 120, 'NOS', 20.00, 18]);
  ws.addRow(['A/4 JK COPIER PAPER', '80 GSM', '1', 10, 'Ream', 280.00, 18]);
  ws.addRow(['FEWIQUIK', 'SMALL', '2', 20, 'NOS', 14.50, 18]);

  const buffer = await wb.xlsx.writeBuffer();
  const formData = new FormData();
  const file = new File(
    [buffer],
    'Life Sty madurai Stationery quote01.11.26.xls',
    { type: 'application/vnd.ms-excel' }
  );
  formData.append('file', file);

  const req = new NextRequest('http://localhost:3000/api/ai-import', {
    method: 'POST',
    body: formData,
  });

  const res = await aiImport(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.items.length, 3);

  // Metadata should intelligently deduce section, customer, store and reference from filename
  assert.equal(data.metadata.sectionGuess, 'Stationery', 'Must detect Stationery section from filename');
  assert.equal(data.metadata.customerGuess, 'Life Style International', 'Must detect Life Style from filename');
  assert.equal(data.metadata.storeGuess, 'Madurai', 'Must detect Madurai from filename');
  assert.ok(data.metadata.referenceNumber.includes('01.11.26'), 'Must detect quote reference 01.11.26');

  // Line items should have suggestedCategory = Stationery
  for (const item of data.items) {
    assert.equal(item.suggestedCategory, 'Stationery', 'Extracted item must be assigned to Stationery section');
  }
});

