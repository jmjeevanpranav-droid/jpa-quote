import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-test-reseq-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/lib/db/client';
import { seedDb } from '../src/lib/db/seed';
import { resequenceItemCodes, getNextItemCode } from '../src/lib/catalog/rate-memory';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../src/app/api/products/route';

test('Item Code Resequencing: automatically rearranges consecutively on delete and add without gaps', async () => {
  await seedDb();
  const db = getDb();

  // Clear products to have a clean, predictable slate
  await db.execute('DELETE FROM products');

  // Insert 5 test products with intentional gaps: JPA-001, JPA-002, JPA-005, JPA-007, JPA-009
  const now = new Date().toISOString();
  const rawCodes = ['JPA-001', 'JPA-002', 'JPA-005', 'JPA-007', 'JPA-009'];
  for (let i = 0; i < rawCodes.length; i++) {
    await db.execute({
      sql: `INSERT INTO products (
        id, item_code, description, normalized_name, category, unit, default_rate, default_gst_rate, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'General', 'Nos', 100, 18, 1, ?, ?)`,
      args: [`prod_test_${i + 1}`, rawCodes[i], `Item ${i + 1}`, `item ${i + 1}`, now, now],
    });
  }

  // 1. Calling resequenceItemCodes should immediately close the gaps
  await resequenceItemCodes(db);
  const productsAfterReseq = (
    await db.execute('SELECT id, item_code, description FROM products WHERE is_active = 1 ORDER BY item_code ASC')
  ).rows;

  assert.equal(productsAfterReseq.length, 5);
  assert.equal(productsAfterReseq[0].item_code, 'JPA-001');
  assert.equal(productsAfterReseq[1].item_code, 'JPA-002');
  assert.equal(productsAfterReseq[2].item_code, 'JPA-003', 'JPA-005 must be rearranged to JPA-003');
  assert.equal(productsAfterReseq[3].item_code, 'JPA-004', 'JPA-007 must be rearranged to JPA-004');
  assert.equal(productsAfterReseq[4].item_code, 'JPA-005', 'JPA-009 must be rearranged to JPA-005');

  // 2. getNextItemCode should return JPA-006
  const nextCode = await getNextItemCode(db);
  assert.equal(nextCode, 'JPA-006', 'Next item code must be consecutive JPA-006');

  // 3. Delete an item in the middle (prod_test_2 which is JPA-002) via DELETE API
  const delReq = new NextRequest('http://localhost:3000/api/products?id=prod_test_2', { method: 'DELETE' });
  const delRes = await DELETE(delReq);
  assert.equal(delRes.status, 200);

  // Remaining items must immediately be rearranged to JPA-001, JPA-002, JPA-003, JPA-004
  const getReq = new NextRequest('http://localhost:3000/api/products', { method: 'GET' });
  const getRes = await GET(getReq);
  const data = await getRes.json();

  assert.equal(data.products.length, 4);
  assert.equal(data.products[0].item_code, 'JPA-001');
  assert.equal(data.products[1].item_code, 'JPA-002', 'prod_test_3 should shift from JPA-003 to JPA-002');
  assert.equal(data.products[2].item_code, 'JPA-003', 'prod_test_4 should shift from JPA-004 to JPA-003');
  assert.equal(data.products[3].item_code, 'JPA-004', 'prod_test_5 should shift from JPA-005 to JPA-004');

  // 4. Add a new item via POST API
  const postReq = new NextRequest('http://localhost:3000/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Newly Added Material',
      unit: 'Nos',
      default_rate: 50,
      default_gst_rate: 18,
    }),
  });
  const postRes = await POST(postReq);
  const postData = await postRes.json();
  assert.equal(postRes.status, 200);
  assert.equal(postData.item_code, 'JPA-005', 'Newly added item must get consecutive JPA-005');

  // 5. Query all products again and verify strictly consecutive 1..5
  const verifyRes = await GET(getReq);
  const verifyData = await verifyRes.json();
  assert.equal(verifyData.products.length, 5);
  for (let i = 0; i < 5; i++) {
    const expected = `JPA-${String(i + 1).padStart(3, '0')}`;
    assert.equal(
      verifyData.products[i].item_code,
      expected,
      `Product index ${i} must have consecutive item code ${expected}`
    );
  }
});

