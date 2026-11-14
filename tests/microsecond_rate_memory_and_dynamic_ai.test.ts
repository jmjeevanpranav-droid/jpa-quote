import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-micro-rate-test-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { seedDb } from '../src/lib/db/seed';
import { getDb } from '../src/lib/db/client';
import { POST as createQuotation, GET as getQuotations } from '../src/app/api/quotations/route';
import { GET as getProducts, DELETE as deleteProducts } from '../src/app/api/products/route';

test('Quotation items automatically reach Rate Library in microseconds when quoted', async () => {
  await seedDb();
  const db = getDb();

  // 1. Ensure Rate Library is clean to begin with and seed a customer
  await db.execute('DELETE FROM products');
  await db.execute('DELETE FROM product_rates');
  await db.execute('DELETE FROM rate_change_history');

  const custId = 'cust_le_meridien';
  await db.execute({
    sql: "INSERT OR REPLACE INTO customers (id, company_name, trade_name, contact_person, phone, billing_address, created_at, updated_at) VALUES (?, 'Le Meridien Hotel', 'Le Meridien', 'Manager', '9876543210', 'Avinashi Road, Coimbatore', datetime('now'), datetime('now'))",
    args: [custId],
  });

  const initialProds = await db.execute('SELECT COUNT(*) as count FROM products');
  assert.equal(Number(initialProds.rows[0].count), 0, 'Rate Library should be empty initially');

  // 2. An employee creates a quotation quoting two new items:
  // "Floor Polish Liquid" at ₹185, and "Microfiber Duster" at ₹75
  const quoteReq = new NextRequest('http://localhost:3000/api/quotations', {
    method: 'POST',
    body: JSON.stringify({
      customerId: custId,
      customerName: 'Le Meridien Hotel',
      quoteDate: '2026-11-11',
      validityDate: '2026-11-26',
      status: 'draft',
      taxType: 'exclusive',
      sections: [
        {
          name: 'Housekeeping',
          items: [
            {
              description: 'Floor Polish Liquid',
              specification: 'High Gloss',
              quantity: 10,
              unit: 'Ltr',
              unitRate: 185.00,
              gstRate: 18,
            },
            {
              description: 'Microfiber Duster',
              specification: 'Large',
              quantity: 25,
              unit: 'Nos',
              unitRate: 75.00,
              gstRate: 18,
            },
          ],
        },
      ],
    }),
  });

  const quoteRes = await createQuotation(quoteReq);
  assert.equal(quoteRes.status, 200);
  const quoteData = await quoteRes.json();
  assert.equal(quoteData.success, true);

  // 3. Verify Rate Library: Items must have arrived automatically in microseconds!
  const productsRes = await getProducts(new NextRequest('http://localhost:3000/api/products'));
  const prodsData = await productsRes.json();

  assert.equal(prodsData.total, 2, 'Both quoted items must be saved into Rate Library');
  const polish = prodsData.products.find((p: any) => p.description === 'Floor Polish Liquid');
  const duster = prodsData.products.find((p: any) => p.description === 'Microfiber Duster');

  assert.ok(polish, 'Floor Polish Liquid must be created in Rate Library');
  assert.equal(polish.item_code, 'JPA-001', 'Item code must be consecutive JPA-001');
  assert.equal(Number(polish.default_rate), 185.00, 'Rate must match quoted price ₹185');
  assert.equal(polish.unit, 'Ltr');

  assert.ok(duster, 'Microfiber Duster must be created in Rate Library');
  assert.equal(duster.item_code, 'JPA-002', 'Item code must be consecutive JPA-002');
  assert.equal(Number(duster.default_rate), 75.00, 'Rate must match quoted price ₹75');
  assert.equal(duster.unit, 'Nos');

  // 4. Now, employee quotes "Floor Polish Liquid" again in a new quote with an updated price: ₹195
  const quoteReq2 = new NextRequest('http://localhost:3000/api/quotations', {
    method: 'POST',
    body: JSON.stringify({
      customerId: custId,
      customerName: 'Radisson Blu',
      quoteDate: '2026-11-12',
      validityDate: '2026-11-27',
      status: 'draft',
      taxType: 'exclusive',
      sections: [
        {
          name: 'Housekeeping',
          items: [
            {
              description: 'Floor Polish Liquid',
              quantity: 5,
              unit: 'Ltr',
              unitRate: 195.00,
              gstRate: 18,
            },
          ],
        },
      ],
    }),
  });

  const quoteRes2 = await createQuotation(quoteReq2);
  assert.equal(quoteRes2.status, 200);

  // 5. Verify Rate Library: price should be updated immediately and history recorded!
  const productsRes2 = await getProducts(new NextRequest('http://localhost:3000/api/products'));
  const prodsData2 = await productsRes2.json();
  const polishUpdated = prodsData2.products.find((p: any) => p.description === 'Floor Polish Liquid');

  assert.equal(Number(polishUpdated.default_rate), 195.00, 'Rate must be updated to new price ₹195');

  const history = await db.execute({
    sql: 'SELECT * FROM rate_change_history WHERE product_id = ? ORDER BY created_at DESC',
    args: [polishUpdated.id],
  });
  assert.ok(history.rows.length >= 2, 'History must record both price points');
  assert.equal(Number(history.rows[0].new_rate), 195.00);
});
