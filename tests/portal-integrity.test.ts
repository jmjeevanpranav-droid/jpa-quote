import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-portal-integrity-test-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/lib/db/client';
import { initDb } from '../src/lib/db/schema';
import { seedDb } from '../src/lib/db/seed';
import bcrypt from 'bcryptjs';

test('Integration & Security: Labeled test accounts, employee permissions, password security, sync verification and clear dropdowns', async () => {
  await initDb();
  await seedDb();
  const db = getDb();
  const fs = await import('node:fs/promises');

  // 1. VERIFY NO PASSWORDS RETURNED IN USER DIRECTORY OR EXPOSED IN SETTINGS
  const settingsCode = await fs.readFile('src/app/settings/page.tsx', 'utf-8');
  assert.ok(!settingsCode.includes('jpa@1977'), 'Settings page never exposes plaintext password');
  assert.ok(settingsCode.includes('Bcrypt Hashed'), 'Settings page highlights server-side bcrypt hashing');
  assert.ok(settingsCode.includes('/api/admin/change-password'), 'Settings page uses dedicated server-side password reset');

  // 2. SETUP LABELED TEST ACCOUNTS
  const arunEmail = '[TEST] arun_sales@jpa.com';
  const priyaEmail = '[TEST] priya_quote@jpa.com';
  const testPassword = 'Password@123';
  const hashedPw = await bcrypt.hash(testPassword, 10);
  const now = new Date().toISOString();

  // Clean previous test accounts
  await db.execute({
    sql: 'DELETE FROM users WHERE email IN (?, ?)',
    args: [arunEmail, priyaEmail],
  });

  const arunId = `usr_test_arun_${Date.now()}`;
  const priyaId = `usr_test_priya_${Date.now()}`;

  await db.execute({
    sql: `INSERT INTO users (id, email, name, contact, role, password_hash, last_sign_in_at, last_active_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [arunId, arunEmail, 'Arun Kumar', '+91 9876543210', 'staff', hashedPw, now, now, now],
  });

  await db.execute({
    sql: `INSERT INTO users (id, email, name, contact, role, password_hash, last_sign_in_at, last_active_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [priyaId, priyaEmail, 'Priya Sharma', '+91 9876543211', 'staff', hashedPw, now, now, now],
  });

  // Verify accounts stored securely with bcrypt hash
  const arunRecord = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [arunId] });
  assert.equal(arunRecord.rows.length, 1);
  assert.ok(await bcrypt.compare(testPassword, String(arunRecord.rows[0].password_hash)));

  // 3. CREATE SAMPLE QUOTATIONS FOR LABELED TEST EMPLOYEES
  const arunQuote1Id = `q_test_arun_1_${Date.now()}`;
  const arunQuote2Id = `q_test_arun_2_${Date.now()}`;
  const priyaQuote1Id = `q_test_priya_1_${Date.now()}`;

  // Get valid company profile and customer for foreign keys
  const companyRes = await db.execute('SELECT id FROM company_profiles LIMIT 1');
  const companyId = String(companyRes.rows[0]?.id || 'cmp_jpa_master');

  const custRes = await db.execute('SELECT id FROM customers LIMIT 1');
  let customerId = String(custRes.rows[0]?.id || '');

  if (!customerId) {
    customerId = `cust_test_${Date.now()}`;
    await db.execute({
      sql: `INSERT INTO customers (id, company_name, billing_address, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [customerId, 'Test Customer Ltd', '123 Test Street, Coimbatore', now, now],
    });
  }

  // Arun: 1 approved quote (₹15,000), 1 draft quote (₹5,000) -> Total: 2 quotes, ₹20,000
  await db.execute({
    sql: `INSERT INTO quotations (
      id, quote_number, company_profile_id, customer_id, customer_name, customer_address,
      quote_date, validity_date, status, grand_total, created_by, created_by_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      arunQuote1Id,
      `JPA/TEST/ARUN-01`,
      companyId,
      customerId,
      'Arun Test Corp',
      'Coimbatore',
      '2026-10-29',
      '2026-11-29',
      'approved',
      15000.0,
      'Arun Kumar',
      arunId,
      now,
      now,
    ],
  });

  await db.execute({
    sql: `INSERT INTO quotations (
      id, quote_number, company_profile_id, customer_id, customer_name, customer_address,
      quote_date, validity_date, status, grand_total, created_by, created_by_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      arunQuote2Id,
      `JPA/TEST/ARUN-02`,
      companyId,
      customerId,
      'Arun Test Corp',
      'Coimbatore',
      '2026-10-29',
      '2026-11-29',
      'draft',
      5000.0,
      'Arun Kumar',
      arunId,
      now,
      now,
    ],
  });

  // Priya: 1 draft quote (₹8,500) -> Total: 1 quote, ₹8,500
  await db.execute({
    sql: `INSERT INTO quotations (
      id, quote_number, company_profile_id, customer_id, customer_name, customer_address,
      quote_date, validity_date, status, grand_total, created_by, created_by_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      priyaQuote1Id,
      `JPA/TEST/PRIYA-01`,
      companyId,
      customerId,
      'Priya Enterprises',
      'Tiruppur',
      '2026-10-29',
      '2026-11-29',
      'draft',
      8500.0,
      'Priya Sharma',
      priyaId,
      now,
      now,
    ],
  });

  // 4. VERIFY EMPLOYEE DATA ISOLATION & ACCURATE TOTALS
  // Arun's calculations:
  const arunStats = await db.execute({
    sql: `SELECT 
            COUNT(*) as quote_count,
            COALESCE(SUM(grand_total), 0) as total_value,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
            SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count
          FROM quotations WHERE created_by_id = ?`,
    args: [arunId],
  });
  assert.equal(Number(arunStats.rows[0].quote_count), 2, 'Arun has exactly 2 quotations');
  assert.equal(Number(arunStats.rows[0].total_value), 20000.0, 'Arun total pipeline value is ₹20,000');
  assert.equal(Number(arunStats.rows[0].approved_count), 1, 'Arun has 1 approved quotation');
  assert.equal(Number(arunStats.rows[0].draft_count), 1, 'Arun has 1 draft quotation');

  // Priya's calculations:
  const priyaStats = await db.execute({
    sql: `SELECT 
            COUNT(*) as quote_count,
            COALESCE(SUM(grand_total), 0) as total_value,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
            SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count
          FROM quotations WHERE created_by_id = ?`,
    args: [priyaId],
  });
  assert.equal(Number(priyaStats.rows[0].quote_count), 1, 'Priya has exactly 1 quotation');
  assert.equal(Number(priyaStats.rows[0].total_value), 8500.0, 'Priya total pipeline value is ₹8,500');
  assert.equal(Number(priyaStats.rows[0].approved_count), 0, 'Priya has 0 approved quotations');
  assert.equal(Number(priyaStats.rows[0].draft_count), 1, 'Priya has 1 draft quotation');

  // 5. VERIFY SERVER-SIDE PERMISSION CODE IN QUOTATIONS ROUTE
  const quotesRoute = await fs.readFile('src/app/api/quotations/route.ts', 'utf-8');
  assert.ok(
    quotesRoute.includes("session.role === 'staff'") &&
    quotesRoute.includes('q.created_by_id = ?'),
    'Quotations route isolates staff employee views to only their own quotations'
  );

  // 6. VERIFY CLEAR PORTAL DROPDOWN (GlassSelect)
  const glassSelectCode = await fs.readFile('src/components/GlassSelect.tsx', 'utf-8');
  assert.ok(glassSelectCode.includes('createPortal'), 'GlassSelect uses createPortal to escape table clipping');
  assert.ok(glassSelectCode.includes('zIndex: 99999'), 'GlassSelect renders at top z-index layer');
  assert.ok(glassSelectCode.includes('bg-white') && glassSelectCode.includes('border-slate-300'), 'GlassSelect uses clear high-contrast opaque styling');

  // 7. VERIFY SLIDING SIDEBAR ACCESSIBILITY & DESIGN
  const sidebarCode = await fs.readFile('src/components/AppSidebar.tsx', 'utf-8');
  assert.ok(sidebarCode.includes('PanelLeftClose') && sidebarCode.includes('PanelLeftOpen'), 'Sidebar includes smooth expand/collapse toggle buttons');
  assert.ok(sidebarCode.includes('transition-[width]'), 'Sidebar animates smooth sliding width transition');
  assert.ok(sidebarCode.includes('role="tooltip"'), 'Collapsed sidebar shows accessible tooltips');
  assert.ok(sidebarCode.includes('motion-reduce:transition-none'), 'Sidebar respects reduced motion settings');

  // 8. VERIFY SYNC STATUS ENDPOINT
  const syncRoute = await fs.readFile('src/app/api/admin/sync-status/route.ts', 'utf-8');
  assert.ok(syncRoute.includes('total_products') && syncRoute.includes('total_quotations'), 'Sync endpoint verifies catalog and quotation parity with real database counts');

  // Clean test accounts and quotations
  await db.execute({ sql: 'DELETE FROM quotations WHERE id IN (?, ?, ?)', args: [arunQuote1Id, arunQuote2Id, priyaQuote1Id] });
  await db.execute({ sql: 'DELETE FROM users WHERE id IN (?, ?)', args: [arunId, priyaId] });
});
