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
