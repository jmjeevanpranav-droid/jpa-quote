import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { seedDb } from '../src/lib/db/seed';
import { POST as aiImport } from '../src/app/api/ai-import/route';

test('AI Document Import extracts uploads/zoop.jpeg accurately with 20 items', async () => {
  await seedDb();

  const filePath = path.join(process.cwd(), 'uploads', 'zoop.jpeg');
  const buffer = fs.readFileSync(filePath);

  const formData = new FormData();
  const file = new File([buffer], 'zoop.jpeg', { type: 'image/jpeg' });
  formData.append('file', file);

  const req = new NextRequest('http://localhost:3000/api/ai-import', {
    method: 'POST',
    body: formData,
  });

  const res = await aiImport(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  console.log('Provider:', data.provider);
  console.log('Extracted item count:', data.items.length);
  assert.equal(data.success, true);
  assert.equal(data.items.length, 20, 'Should extract all 20 lines from zoop.jpeg');

  // Verify key items
  console.log('Item 1:', data.items[0].description, data.items[0].quantity, data.items[0].unit);
  assert.ok(data.items[0].description.toLowerCase().includes('tbc'));
  assert.equal(data.items[0].quantity, 5);
  assert.equal(data.items[0].unit, 'Ltr');

  console.log('Item 13:', data.items[12].description, data.items[12].quantity, data.items[12].unit);
  assert.ok(data.items[12].description.toLowerCase().includes('garbage cover'));
  assert.equal(data.items[12].quantity, 40);
  assert.equal(data.items[12].unit, 'Kg');

  console.log('Item 20:', data.items[19].description, data.items[19].quantity, data.items[19].unit);
  assert.ok(data.items[19].description.toLowerCase().includes('hand wash'));
  assert.equal(data.items[19].quantity, 5);
  assert.equal(data.items[19].unit, 'Ltr');
});

