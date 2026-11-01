import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parseLocalOcrText, parseExcelSpreadsheet } from '../src/lib/ai/extractor';

test('source names are not replaced by similar catalog products', () => {
  const rows = parseLocalOcrText('Colin glass cleaner - 5 ltr\nTBC cleaner - 25 ltr', [
    {description:'Glass Cleaner',specification:'R3',unit:'Ltr',default_rate:105},
    {description:'TBC',specification:'R6',unit:'Ltr',default_rate:92},
  ], 'names');
  assert.equal(rows[0].description, 'Colin glass cleaner');
  assert.equal(rows[0].specification, undefined);
  assert.equal(rows[0].rate, null);
  assert.equal(rows[1].quantity, 25);
  assert.equal(rows[1].rate, null);
});
test('no sample quantities, units or rows are invented', () => {
  const rows = parseLocalOcrText('Vim soap\nMask\nGarbage Cover 30x50', [], 'missing');
  assert.equal(rows.length,3);
  rows.forEach(row => {assert.equal(row.quantity,null);assert.equal(row.unit,null);});
  assert.equal(parseLocalOcrText('', [], 'empty').length,0);
});
test('new eleven-row document preserves different quantities and duplicate rows', () => {
  const text = '1. Toilet Bowl - 25 Ltr\n2. Floor cleaner - 15 ltr\n3. Room Freshner - 20 ltr\n4. Soft care - 15 ltr\n5. Garbage Cover (Jumbo) - 30 Nos\n6. Garbage Cover (Small) - 20 Nos\n7. Odonil Air Freshner - 20 Nos\n8. Scotch Brite - 30 Nos\n9. Green Scrubber - 30 Nos\n10. D-Klog Drain Cleaner - 20 Nos\n11. Bucket - 6 Nos';
  const rows = parseLocalOcrText(text, [], 'eleven');
  assert.deepEqual(rows.map(r => r.quantity),[25,15,20,15,30,20,20,30,30,20,6]);
  assert.equal(parseLocalOcrText('Mask - 5 Nos\nMask - 10 Nos', [], 'dup').length,2);
});
test('Excel maps reordered columns, cached formula, zero price and missing units safely', async () => {
  const wb = new ExcelJS.Workbook(); const sheet=wb.addWorksheet('Supplies');
  sheet.addRow(['Unit','Qty','Particulars','Rate']);
  sheet.addRow(['Ltr',{formula:'5*3',result:15},'Colin glass cleaner',0]);
  sheet.addRow(['','1,200','3M Scrubber','']);
  const result=await parseExcelSpreadsheet(Buffer.from(await wb.xlsx.writeBuffer()),'test.xlsx',[], 'sheet');
  assert.equal(result.items[0].quantity,15);
  assert.equal(result.items[0].rate,0);
  assert.equal(result.items[1].quantity,1200);
  assert.equal(result.items[1].description,'3M Scrubber');
  assert.equal(result.items[1].unit,null);
  assert.equal(result.items[1].gstRate,null);
});
test('unidentified spreadsheet columns fail rather than silently mapping wrong fields', async () => {
  const wb = new ExcelJS.Workbook(); wb.addWorksheet('Unknown').addRow(['Soap',5]);
  await assert.rejects(parseExcelSpreadsheet(Buffer.from(await wb.xlsx.writeBuffer()), 'unknown.xlsx', [], 'unknown'), /Cannot identify/);
});
