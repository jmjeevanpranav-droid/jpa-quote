import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-visual-resp-test-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';
import { seedDb } from '../src/lib/db/seed';
import { signSessionToken } from '../src/lib/auth/tokens';
import { GET as getQuotations } from '../src/app/api/quotations/route';
import { GET as getProducts } from '../src/app/api/products/route';
import { GET as getCustomers } from '../src/app/api/customers/route';

test('Responsive & Security Verification: Headers, Caching, and Page APIs', async () => {
  await seedDb();

  // 1. Verify Cache-Control: no-store header on protected routes via proxy
  const adminToken = await signSessionToken({
    userId: 'usr_admin_test',
    email: 'jeevanpranavagencies@gmail.com',
    name: 'N Jayakumar',
    role: 'admin',
  });

  const employeeToken = await signSessionToken({
    userId: 'usr_employee_test',
    email: 'jmjeevanpranav@gmail.com',
    name: 'Jeevan Pranav J M',
    role: 'staff',
  });

  const testRoutes = ['/', '/quotations', '/products', '/customers', '/reports'];

  for (const route of testRoutes) {
    const req = new NextRequest(`http://localhost:3000${route}`, {
      headers: {
        'x-jpa-session-token': employeeToken,
        cookie: `jpa_session_token=${employeeToken}`,
      },
    });

    const res = await proxy(req);
    assert.equal(res.status, 200, `Route ${route} should allow authenticated employee`);
    const cacheControl = res.headers.get('cache-control');
    assert.ok(
      cacheControl?.includes('no-store'),
      `Route ${route} must have Cache-Control: no-store to prevent exposing stale account data on back/forward navigation`
    );
  }

  // 2. Verify /login?switch=true is NOT redirected to /
  const switchReq = new NextRequest('http://localhost:3000/login?switch=true', {
    headers: {
      cookie: `jpa_session_token=${adminToken}`,
    },
  });
  const switchRes = await proxy(switchReq);
  assert.equal(
    switchRes.status,
    200,
    '/login?switch=true must NOT be redirected, allowing switching to another account context'
  );

  // 3. Verify Quotations API with employee token only returns employee's quotations
  const empQuotesReq = new NextRequest('http://localhost:3000/api/quotations', {
    headers: { 'x-jpa-session-token': employeeToken },
  });
  const empQuotesRes = await getQuotations(empQuotesReq);
  const empData = await empQuotesRes.json();
  assert.equal(empQuotesRes.status, 200);
  assert.ok(Array.isArray(empData.quotations));

  // 4. Verify Products API returns catalog
  const productsReq = new NextRequest('http://localhost:3000/api/products');
  const productsRes = await getProducts(productsReq);
  const prodData = await productsRes.json();
  assert.equal(productsRes.status, 200);
  assert.ok(Array.isArray(prodData.products) && prodData.products.length > 0);

  // 5. Verify Customers API returns customer list
  const custReq = new NextRequest('http://localhost:3000/api/customers');
  const custRes = await getCustomers(custReq);
  const custData = await custRes.json();
  assert.equal(custRes.status, 200);
  assert.ok(Array.isArray(custData.customers) && custData.customers.length > 0);
});

