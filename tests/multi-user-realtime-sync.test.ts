import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-realtime-sync-test-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { seedDb } from '../src/lib/db/seed';
import { getDb } from '../src/lib/db/client';
import { signSessionToken } from '../src/lib/auth/tokens';
import { POST as registerUser } from '../src/app/api/auth/register/route';
import { POST as createQuotation } from '../src/app/api/quotations/route';
import { GET as getAdminUsers } from '../src/app/api/admin/users/route';
import { GET as getAdminSyncStatus } from '../src/app/api/admin/sync-status/route';

test('Multi-User Real-Time Data Synchronization & Vision Panel Integration', async () => {
  await seedDb();
  const db = getDb();

  // 1. Employee registers a new account
  const regReq = new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Jeevan Pranav J M',
      contact: '9361312325',
      email: 'jmjeevanpranav@gmail.com',
      password: 'password123',
    }),
  });

  const regRes = await registerUser(regReq);
  const regData = await regRes.json();
  assert.equal(regRes.status, 200);
  assert.ok(regData.token, 'Registration must yield session token');
  const employeeToken = regData.token;
  const employeeId = regData.user.id;

  // Verify employee record has immediate last_sign_in_at and last_active_at set on registration
  const empDb = await db.execute({
    sql: 'SELECT last_sign_in_at, last_active_at FROM users WHERE id = ?',
    args: [employeeId],
  });
  assert.ok(empDb.rows[0].last_sign_in_at, 'Employee must have last_sign_in_at recorded immediately on registration');
  assert.ok(empDb.rows[0].last_active_at, 'Employee must have last_active_at recorded immediately on registration');

  // 2. Administrator credentials and token
  const adminToken = await signSessionToken({
    userId: 'usr_admin_1',
    name: 'N Jayakumar',
    email: 'jeevanpranavagencies@gmail.com',
    role: 'admin',
  });

  // 3. Employee creates a quotation in the system
  const custRes = await db.execute('SELECT id FROM customers LIMIT 1');
  const customerId = String(custRes.rows[0].id);

  const quotePayload = {
    companyProfileId: 'cmp_jpa_master',
    customerId,
    customerName: 'Lifestyle International Pvt. Ltd.',
    storeName: 'Marina Mall',
    quoteDate: '2026-10-29',
    validityDate: '2026-11-29',
    status: 'approved',
    sections: [
      {
        name: 'Section 1 Rate Card',
        items: [
          { description: 'Glass Cleaner', specification: 'R3', quantity: 10, unit: 'Ltr', unitRate: 105.84, gstRate: 18 },
          { description: 'TBC', specification: 'R6', quantity: 100, unit: 'Ltr', unitRate: 92.00, gstRate: 18 },
        ],
      },
    ],
    createdBy: 'Jeevan Pranav J M',
    createdById: employeeId,
  };

  const createQuoteReq = new NextRequest('http://localhost:3000/api/quotations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-jpa-session-token': employeeToken,
    },
    body: JSON.stringify(quotePayload),
  });

  const createQuoteRes = await createQuotation(createQuoteReq);
  const createQuoteData = await createQuoteRes.json();
  assert.equal(createQuoteRes.status, 200);
  assert.ok(createQuoteData.quotationId);

  // 4. Administrator checks Employee Directory via GET /api/admin/users
  const adminReq = new NextRequest('http://localhost:3000/api/admin/users', {
    headers: { 'x-jpa-session-token': adminToken },
  });

  const adminUsersRes = await getAdminUsers(adminReq);
  assert.equal(adminUsersRes.status, 200, 'Admin request must be authorized with 200');
  const adminUsersData = await adminUsersRes.json();

  assert.ok(Array.isArray(adminUsersData.users));
  const foundEmp = adminUsersData.users.find((u: any) => u.email === 'jmjeevanpranav@gmail.com');
  assert.ok(foundEmp, 'Jeevan Pranav J M must be present in Administrator Employee directory');

  // Verify real-time metrics are non-zero and accurate
  assert.equal(foundEmp.metrics.quoteCount, 1, 'Employee quote count must reflect 1 created quote');
  assert.ok(foundEmp.metrics.totalValue > 0, 'Total pipeline value must reflect the quote grand total');
  assert.equal(foundEmp.metrics.approvedCount, 1, 'Approved quote count must reflect 1');
  assert.equal(foundEmp.metrics.draftCount, 0);

  // Verify quotations list for employee vision modal
  assert.equal(foundEmp.quotations.length, 1);
  assert.equal(foundEmp.quotations[0].customer_name, 'Lifestyle International Pvt. Ltd.');
  assert.equal(foundEmp.quotations[0].store_name, 'Marina Mall');
  assert.equal(foundEmp.quotations[0].status, 'approved');

  // Verify activities list contains registration and quotation creation events
  assert.ok(foundEmp.activities.length >= 2, 'Employee must have registration and quote creation activity events');
  const quoteAct = foundEmp.activities.find((a: any) => a.action === 'CREATE_QUOTATION');
  assert.ok(quoteAct, 'Quotation creation must be logged in employee activity stream');

  // Verify timestamps are recorded and valid
  assert.ok(foundEmp.last_sign_in_at, 'last_sign_in_at must not be null');
  assert.notEqual(foundEmp.last_sign_in_at, 'Not yet recorded');
  assert.ok(foundEmp.last_active_at, 'last_active_at must be updated');

  // 5. Administrator checks Rate & Quote Synchronization Status
  const syncReq = new NextRequest('http://localhost:3000/api/admin/sync-status', {
    headers: { 'x-jpa-session-token': adminToken },
  });
  const syncRes = await getAdminSyncStatus(syncReq);
  assert.equal(syncRes.status, 200);
  const syncData = await syncRes.json();
  assert.equal(syncData.success, true);
  assert.ok(syncData.quotations.totalQuotations >= 1);
});

