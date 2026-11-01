import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-auth-test-'));
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { seedDb } from '../src/lib/db/seed';
import { getDb } from '../src/lib/db/client';
import { signSessionToken, verifySessionToken } from '../src/lib/auth/tokens';
import { getSession } from '../src/lib/auth/session';
import { GET as getQuotations, POST as createQuotation } from '../src/app/api/quotations/route';
import { GET as getQuotationById, PUT as updateQuotationById, DELETE as deleteQuotationById } from '../src/app/api/quotations/[id]/route';

test('Simultaneous Multi-Account Contexts & RBAC Isolation', async () => {
  await seedDb();
  const db = getDb();

  // 1. Setup two distinct user identities: Admin and Employee
  const adminUser = {
    userId: 'usr_admin_test_1',
    name: 'N Jayakumar',
    email: 'jeevanpranavagencies@gmail.com',
    role: 'admin' as const,
  };

  const employeeUser = {
    userId: 'usr_employee_test_2',
    name: 'Jeevan Pranav J M',
    email: 'jmjeevanpranav@gmail.com',
    role: 'staff' as const,
  };

  const otherEmployeeUser = {
    userId: 'usr_employee_test_3',
    name: 'Priya Sharma',
    email: 'priya_quote@jpa.com',
    role: 'staff' as const,
  };

  // Generate cryptographic session tokens for each user simultaneously
  const adminToken = await signSessionToken(adminUser);
  const employeeToken = await signSessionToken(employeeUser);
  const otherEmployeeToken = await signSessionToken(otherEmployeeUser);

  assert.ok(adminToken && employeeToken && otherEmployeeToken);
  assert.notEqual(adminToken, employeeToken);

  // 2. Verify both tokens decode independently without leaking or overwriting
  const verifiedAdmin = await verifySessionToken(adminToken);
  const verifiedEmployee = await verifySessionToken(employeeToken);

  assert.equal(verifiedAdmin?.email, 'jeevanpranavagencies@gmail.com');
  assert.equal(verifiedAdmin?.role, 'admin');
  assert.equal(verifiedEmployee?.email, 'jmjeevanpranav@gmail.com');
  assert.equal(verifiedEmployee?.role, 'staff');

  // 3. Verify getSession extracts x-jpa-session-token correctly from request headers
  const reqAdmin = new NextRequest('http://localhost:3000/api/quotations', {
    headers: { 'x-jpa-session-token': adminToken },
  });
  const reqEmployee = new NextRequest('http://localhost:3000/api/quotations', {
    headers: { 'x-jpa-session-token': employeeToken },
  });

  const sessionAdmin = await getSession(reqAdmin);
  const sessionEmployee = await getSession(reqEmployee);

  assert.equal(sessionAdmin?.userId, adminUser.userId);
  assert.equal(sessionAdmin?.role, 'admin');
  assert.equal(sessionEmployee?.userId, employeeUser.userId);
  assert.equal(sessionEmployee?.role, 'staff');

  // 4. Employee creates a quotation
  const custRes = await db.execute('SELECT id FROM customers LIMIT 1');
  const customerId = String(custRes.rows[0].id);

  const quotePayload = {
    customerId,
    customerName: 'Lifestyle International',
    quoteDate: '2026-10-29',
    validityDate: '2026-11-29',
    status: 'draft',
    sections: [
      {
        name: 'Housekeeping',
        items: [
          { description: 'Floor Duster', quantity: 10, unit: 'Nos', unitRate: 50, gstRate: 18 },
        ],
      },
    ],
  };

  const createReq = new NextRequest('http://localhost:3000/api/quotations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-jpa-session-token': employeeToken,
    },
    body: JSON.stringify(quotePayload),
  });

  const createRes = await createQuotation(createReq);
  const createData = await createRes.json();
  assert.equal(createRes.status, 200);
  const employeeQuoteId = createData.quotationId;
  assert.ok(employeeQuoteId);

  // 5. RBAC Quotation Ownership Permissions Enforcement:
  // (a) Employee who created it CAN view it
  const viewOwnReq = new NextRequest(`http://localhost:3000/api/quotations/${employeeQuoteId}`, {
    headers: { 'x-jpa-session-token': employeeToken },
  });
  const viewOwnRes = await getQuotationById(viewOwnReq, { params: Promise.resolve({ id: employeeQuoteId }) });
  assert.equal(viewOwnRes.status, 200, 'Employee should view their own quote');

  // (b) Another employee CANNOT view it (403 Forbidden)
  const viewOtherReq = new NextRequest(`http://localhost:3000/api/quotations/${employeeQuoteId}`, {
    headers: { 'x-jpa-session-token': otherEmployeeToken },
  });
  const viewOtherRes = await getQuotationById(viewOtherReq, { params: Promise.resolve({ id: employeeQuoteId }) });
  assert.equal(viewOtherRes.status, 403, 'Other employee must receive 403 Forbidden');

  // (c) Administrator CAN view it
  const viewAdminReq = new NextRequest(`http://localhost:3000/api/quotations/${employeeQuoteId}`, {
    headers: { 'x-jpa-session-token': adminToken },
  });
  const viewAdminRes = await getQuotationById(viewAdminReq, { params: Promise.resolve({ id: employeeQuoteId }) });
  assert.equal(viewAdminRes.status, 200, 'Admin can view any quote');

  // (d) Another employee CANNOT edit it (403 Forbidden)
  const editOtherReq = new NextRequest(`http://localhost:3000/api/quotations/${employeeQuoteId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-jpa-session-token': otherEmployeeToken,
    },
    body: JSON.stringify(quotePayload),
  });
  const editOtherRes = await updateQuotationById(editOtherReq, { params: Promise.resolve({ id: employeeQuoteId }) });
  assert.equal(editOtherRes.status, 403, 'Other employee cannot edit another user quote');

  // (e) Another employee CANNOT delete it (403 Forbidden)
  const deleteOtherReq = new NextRequest(`http://localhost:3000/api/quotations/${employeeQuoteId}`, {
    method: 'DELETE',
    headers: { 'x-jpa-session-token': otherEmployeeToken },
  });
  const deleteOtherRes = await deleteQuotationById(deleteOtherReq, { params: Promise.resolve({ id: employeeQuoteId }) });
  assert.equal(deleteOtherRes.status, 403, 'Other employee cannot delete another user quote');

  // (f) Employee who created it CAN delete it
  const deleteOwnReq = new NextRequest(`http://localhost:3000/api/quotations/${employeeQuoteId}`, {
    method: 'DELETE',
    headers: { 'x-jpa-session-token': employeeToken },
  });
  const deleteOwnRes = await deleteQuotationById(deleteOwnReq, { params: Promise.resolve({ id: employeeQuoteId }) });
  assert.equal(deleteOwnRes.status, 200, 'Employee can delete their own quote');
});

