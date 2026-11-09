import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-profile-avatar-test-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { seedDb } from '../src/lib/db/seed';
import { getDb } from '../src/lib/db/client';
import { SESSION_COOKIE_NAME, signSessionToken } from '../src/lib/auth/tokens';
import { POST as registerUser } from '../src/app/api/auth/register/route';
import { POST as setAvatar, DELETE as removeAvatar } from '../src/app/api/user/avatar/route';
import { GET as getMe } from '../src/app/api/auth/me/route';
import { GET as getAdminUsers } from '../src/app/api/admin/users/route';

test('Profile Photo Setter & Manual Tracer API Verification', async () => {
  await seedDb();
  const db = getDb();

  // 1. Employee registers
  const regReq = new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ravi Kumar',
      contact: '9840123456',
      email: 'ravikumar@gmail.com',
      password: 'password123',
    }),
  });

  const regRes = await registerUser(regReq);
  const regData = await regRes.json();
  assert.equal(regRes.status, 200);
  const employeeToken = regData.token;
  const employeeId = regData.user.id;

  // 2. Admin token
  const adminToken = await signSessionToken({
    userId: 'usr_admin_1',
    name: 'N Jayakumar',
    email: 'jeevanpranavagencies@gmail.com',
    role: 'admin',
  });

  // Simulated 512x512 high-resolution cropped WebP data URL
  const sampleAvatarDataUrl = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

  // 3. Employee updates their own avatar
  const empAvatarReq = new NextRequest('http://localhost:3000/api/user/avatar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${employeeToken}`,
      cookie: `${SESSION_COOKIE_NAME}=${employeeToken}`,
    },
    body: JSON.stringify({
      avatarUrl: sampleAvatarDataUrl,
    }),
  });

  const empAvatarRes = await setAvatar(empAvatarReq);
  assert.equal(empAvatarRes.status, 200);
  const empAvatarData = await empAvatarRes.json();
  assert.equal(empAvatarData.success, true);
  assert.equal(empAvatarData.avatarUrl, sampleAvatarDataUrl);

  // 4. Verify GET /api/auth/me returns the updated avatar
  const meReq = new NextRequest('http://localhost:3000/api/auth/me', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${employeeToken}`,
      cookie: `${SESSION_COOKIE_NAME}=${employeeToken}`,
    },
  });
  const meRes = await getMe(meReq);
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.user.avatarUrl, sampleAvatarDataUrl);

  // 5. Admin updates Administrator profile photo (N Jayakumar)
  const adminAvatarDataUrl = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/ADMIN=';
  const adminAvatarReq = new NextRequest('http://localhost:3000/api/user/avatar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${adminToken}`,
      cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
    },
    body: JSON.stringify({
      avatarUrl: adminAvatarDataUrl,
      userId: 'usr_admin_1',
    }),
  });

  const adminAvatarRes = await setAvatar(adminAvatarReq);
  assert.equal(adminAvatarRes.status, 200);
  const adminAvatarData = await adminAvatarRes.json();
  assert.equal(adminAvatarData.success, true);

  // 6. Admin updates employee's photo on their behalf
  const newEmpPhoto = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/BYADMIN=';
  const adminSetEmpAvatarReq = new NextRequest('http://localhost:3000/api/user/avatar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${adminToken}`,
      cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
    },
    body: JSON.stringify({
      avatarUrl: newEmpPhoto,
      userId: employeeId,
    }),
  });

  const adminSetEmpAvatarRes = await setAvatar(adminSetEmpAvatarReq);
  assert.equal(adminSetEmpAvatarRes.status, 200);

  // 7. Verify GET /api/admin/users lists employee with new photo
  const adminUsersReq = new NextRequest('http://localhost:3000/api/admin/users', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${adminToken}`,
      cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
    },
  });
  const adminUsersRes = await getAdminUsers(adminUsersReq);
  assert.equal(adminUsersRes.status, 200);
  const adminUsersData = await adminUsersRes.json();
  const empInList = adminUsersData.users.find((u: any) => u.id === employeeId);
  assert.ok(empInList, 'Employee must exist in admin users list');
  assert.equal(empInList.avatar_url, newEmpPhoto, 'Employee in admin list must have updated avatar');

  // 8. Delete / Remove Avatar
  const delReq = new NextRequest(`http://localhost:3000/api/user/avatar?userId=${employeeId}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${adminToken}`,
      cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
    },
  });
  const delRes = await removeAvatar(delReq);
  assert.equal(delRes.status, 200);

  const empAfterDelete = await db.execute({
    sql: 'SELECT avatar_url FROM users WHERE id = ?',
    args: [employeeId],
  });
  assert.equal(empAfterDelete.rows[0].avatar_url, null, 'Avatar must be null after removal');
});

test('Self-service employee avatar resolves canonical identity via case-insensitive email and heals unlinked records', async () => {
  await seedDb();
  const db = getDb();

  // Create an employee in DB with lowercase email
  const userId = 'usr_emp_legacy_1';
  await db.execute({
    sql: `INSERT INTO users (id, name, email, password_hash, role, created_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    args: [userId, 'Anitha S', 'anitha.s@jpa.com', 'dummyhash', 'employee'],
  });

  // Employee signs in, but session token has uppercase/mixed-case email 'Anitha.S@JPA.COM'
  const employeeMixedCaseToken = await signSessionToken({
    userId: userId,
    name: 'Anitha S',
    email: 'Anitha.S@JPA.COM',
    role: 'staff',
  });

  const photoDataUrl = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/ANITHA=';

  // Self-service avatar update without supplying userId in request body
  const updateReq = new NextRequest('http://localhost:3000/api/user/avatar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${employeeMixedCaseToken}`,
      cookie: `${SESSION_COOKIE_NAME}=${employeeMixedCaseToken}`,
    },
    body: JSON.stringify({
      avatarUrl: photoDataUrl,
    }),
  });

  const updateRes = await setAvatar(updateReq);
  const updateData = await updateRes.json();
  assert.equal(updateRes.status, 200, 'Self-service avatar update must succeed with 200 OK');
  assert.equal(updateData.success, true);
  assert.equal(updateData.avatarUrl, photoDataUrl);

  // Verify DB record was updated
  const userInDb = await db.execute({
    sql: 'SELECT avatar_url FROM users WHERE id = ?',
    args: [userId],
  });
  assert.equal(userInDb.rows[0].avatar_url, photoDataUrl);

  // Now simulate an unlinked session (e.g. after a DB migration or reset where session exists with legacy quotations)
  const legacySessionToken = await signSessionToken({
    userId: 'usr_unlinked_legacy',
    name: 'Karthik Raja',
    email: 'karthik.raja@jpa.com',
    role: 'staff',
  });

  // Insert a quotation authored by Karthik Raja to establish legitimate quotation activity
  const compRow = (await db.execute('SELECT id FROM company_profiles LIMIT 1')).rows[0];
  const custRow = (await db.execute('SELECT id, company_name, billing_address FROM customers LIMIT 1')).rows[0];
  const companyId = String(compRow?.id || 'cmp_jpa_master');
  const customerId = String(custRow?.id || 'cust_1');
  const customerName = String(custRow?.company_name || 'Test Customer');
  const customerAddress = String(custRow?.billing_address || 'Address');

  await db.execute({
    sql: `INSERT INTO quotations (id, quote_number, company_profile_id, customer_id, customer_name, customer_address, quote_date, validity_date, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'draft', 'Karthik Raja', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [`q_legacy_${Date.now()}`, `JPA-LEG-${Date.now()}`, companyId, customerId, customerName, customerAddress],
  });

  const healPhotoUrl = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/KARTHIK=';
  const healReq = new NextRequest('http://localhost:3000/api/user/avatar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${legacySessionToken}`,
      cookie: `${SESSION_COOKIE_NAME}=${legacySessionToken}`,
    },
    body: JSON.stringify({
      avatarUrl: healPhotoUrl,
    }),
  });

  const healRes = await setAvatar(healReq);
  assert.equal(healRes.status, 200, 'Legacy account should be healed safely without returning 404');
  const healData = await healRes.json();
  assert.equal(healData.success, true);
  assert.equal(healData.avatarUrl, healPhotoUrl);
});
