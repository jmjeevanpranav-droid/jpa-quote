import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-test-spotlight-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, POST } from '../src/app/api/products/route';
import { getDb } from '../src/lib/db/client';
import { seedDb } from '../src/lib/db/seed';

test('Rate Memory Spotlight API: supports sort=latest, limit, and offset', async () => {
  await seedDb();
  const db = getDb();

  // Test GET with sort=latest and limit=5
  const req = new NextRequest('http://localhost:3000/api/products?sort=latest&limit=5');
  const res = await GET(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(Array.isArray(data.products));
  assert.ok(data.products.length <= 5);
  assert.ok(typeof data.total === 'number');
  assert.ok(data.total >= data.products.length);

  // If there are multiple products, verify descending timestamp order
  if (data.products.length > 1) {
    for (let i = 0; i < data.products.length - 1; i++) {
      const t1 = new Date(data.products[i].updated_at || data.products[i].created_at).getTime();
      const t2 = new Date(data.products[i + 1].updated_at || data.products[i + 1].created_at).getTime();
      assert.ok(t1 >= t2, `Item ${i} (${t1}) should be >= item ${i + 1} (${t2})`);
    }
  }

  // Test offset pagination: page 2 should return different items
  const reqPage2 = new NextRequest('http://localhost:3000/api/products?sort=latest&limit=5&offset=5');
  const resPage2 = await GET(reqPage2);
  assert.equal(resPage2.status, 200);
  const dataPage2 = await resPage2.json();
  if (data.total > 5) {
    assert.ok(dataPage2.products.length > 0);
    assert.notEqual(dataPage2.products[0].id, data.products[0].id, 'Offset page should return subsequent items');
  }

  // Test continuous auto-saving: adding a new material rate should make it appear first
  const uniqueDesc = `Continuous Rate Test Material ${Date.now()}`;
  const postReq = new NextRequest('http://localhost:3000/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: uniqueDesc,
      specification: 'Test Spec 1L',
      pack: 'Pack of 1',
      unit: 'Ltr',
      default_rate: 345.50,
      default_gst_rate: 18,
    }),
  });
  const postRes = await POST(postReq);
  assert.equal(postRes.status, 200);
  const postData = await postRes.json();
  assert.ok(postData.success);

  // Fetch with sort=latest again: the new item must appear at index 0!
  const latestReq = new NextRequest('http://localhost:3000/api/products?sort=latest&limit=5');
  const latestRes = await GET(latestReq);
  const latestData = await latestRes.json();

  assert.equal(latestData.products[0].description, uniqueDesc, 'Latest saved rate must appear at the top');
  assert.equal(Number(latestData.products[0].default_rate), 345.50);
  assert.ok(latestData.total >= data.total + 1, 'Total count must increment and retain previously saved records');
});
