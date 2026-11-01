import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-cascade-delete-test-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { seedDb } from '../src/lib/db/seed';
import { getDb } from '../src/lib/db/client';
import { POST as createCustomer, DELETE as deleteCustomer, GET as getCustomers } from '../src/app/api/customers/route';
import { POST as createQuotation, DELETE as deleteAllQuotations } from '../src/app/api/quotations/route';
import { signSessionToken } from '../src/lib/auth/tokens';

test('Customer & Quotation Cascade Deletion without FOREIGN KEY constraint errors', async () => {
  await seedDb();
  const db = getDb();

  const adminToken = await signSessionToken({
    userId: 'usr_admin_1',
    name: 'N Jayakumar',
    email: 'jeevanpranavagencies@gmail.com',
    role: 'admin',
  });

  // 1. Create a customer
  const custReq = new NextRequest('http://localhost:3000/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: 'Cascade Test Corp',
      billingAddress: '100 Test Road, Coimbatore',
    }),
  });
  const custRes = await createCustomer(custReq);
  const custData = await custRes.json();
  assert.equal(custRes.status, 200);
  const custId = custData.id;

  // 2. Create a quotation referencing this customer
  const quoteReq = new NextRequest('http://localhost:3000/api/quotations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      companyProfileId: 'cmp_jpa_master',
      customerId: custId,
      customerName: 'Cascade Test Corp',
      quoteDate: '2026-10-29',
      validityDate: '2026-11-29',
      sections: [
        {
          name: 'Housekeeping',
          items: [
            {
              description: 'Floor Cleaner',
              quantity: 5,
              unit: 'Ltr',
              unitRate: 100,
              gstRate: 18,
            },
          ],
        },
      ],
    }),
  });

  const quoteRes = await createQuotation(quoteReq);
  assert.equal(quoteRes.status, 200);

  // Verify quotation exists referencing customer
  const quotesBefore = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM quotations WHERE customer_id = ?',
    args: [custId],
  });
  assert.equal(quotesBefore.rows[0].count, 1);

  // 3. Delete the customer via DELETE /api/customers?id=...
  // Should cleanly delete customer and cascade quotations without SQLITE_CONSTRAINT error
  const delCustReq = new NextRequest(`http://localhost:3000/api/customers?id=${custId}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });

  const delCustRes = await deleteCustomer(delCustReq);
  assert.equal(delCustRes.status, 200);
  const delCustData = await delCustRes.json();
  assert.equal(delCustData.success, true);

  // Verify customer is gone
  const custCheck = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM customers WHERE id = ?',
    args: [custId],
  });
  assert.equal(custCheck.rows[0].count, 0);

  // Verify quotation is cleanly deleted
  const quotesCheck = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM quotations WHERE customer_id = ?',
    args: [custId],
  });
  assert.equal(quotesCheck.rows[0].count, 0);

  // 4. Test DELETE /api/quotations?all=true
  const delAllQuotesReq = new NextRequest('http://localhost:3000/api/quotations?all=true', {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  const delAllQuotesRes = await deleteAllQuotations(delAllQuotesReq);
  assert.equal(delAllQuotesRes.status, 200);
  const totalQuotes = await db.execute('SELECT COUNT(*) as count FROM quotations');
  assert.equal(totalQuotes.rows[0].count, 0);

  // 5. Test DELETE /api/customers?all=true
  const delAllCustReq = new NextRequest('http://localhost:3000/api/customers?all=true', {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  const delAllCustRes = await deleteCustomer(delAllCustReq);
  assert.equal(delAllCustRes.status, 200);
  const totalCusts = await db.execute('SELECT COUNT(*) as count FROM customers');
  assert.equal(totalCusts.rows[0].count, 0);
});

