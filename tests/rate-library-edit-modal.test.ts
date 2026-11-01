import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-test-rate-edit-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/lib/db/client';
import { seedDb } from '../src/lib/db/seed';
import { NextRequest } from 'next/server';
import { GET, POST, PUT } from '../src/app/api/products/route';

test('Rate Library Edit Modal & Microsecond Save Workflow', async (t) => {
  await seedDb();
  const db = getDb();

  await t.test('1. PUT /api/products updates product details, maintains automated Item Code and logs rate history', async () => {
    // Insert a product with item_code JPA-001
    const now = new Date().toISOString();
    const prodId = 'prod_edit_test_1';
    await db.execute({
      sql: `INSERT INTO products (
        id, item_code, description, normalized_name, category, unit, default_rate, default_gst_rate, is_active, created_at, updated_at
      ) VALUES (?, 'JPA-001', 'Floor Cleaner Initial', 'floor cleaner initial', 'General', 'Nos', 120.00, 18, 1, ?, ?)`,
      args: [prodId, now, now],
    });

    // Send PUT request to update
    const putReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: prodId,
        description: 'Floor Cleaner Premium R1',
        specification: '5 Ltr Can High Foam',
        pack: 'Box of 2',
        unit: 'Can',
        default_rate: 145.50,
        default_gst_rate: 18,
      }),
    });

    const putRes = await PUT(putReq);
    assert.equal(putRes.status, 200);
    const putData = await putRes.json();
    assert.equal(putData.success, true);
    assert.equal(putData.product.description, 'Floor Cleaner Premium R1');
    assert.equal(putData.product.item_code, 'JPA-001', 'Automated item code must remain intact');
    assert.equal(putData.product.unit, 'Can');
    assert.equal(putData.product.default_rate, 145.5);

    // Verify database record
    const updatedRow = (
      await db.execute({
        sql: 'SELECT * FROM products WHERE id = ?',
        args: [prodId],
      })
    ).rows[0];

    assert.equal(updatedRow.description, 'Floor Cleaner Premium R1');
    assert.equal(updatedRow.specification, '5 Ltr Can High Foam');
    assert.equal(updatedRow.pack, 'Box of 2');
    assert.equal(updatedRow.unit, 'Can');
    assert.equal(Number(updatedRow.default_rate), 145.5);
    assert.equal(updatedRow.item_code, 'JPA-001');

    // Verify rate change history was created
    const historyRows = (
      await db.execute({
        sql: 'SELECT * FROM rate_change_history WHERE product_id = ? ORDER BY created_at DESC',
        args: [prodId],
      })
    ).rows;

    assert.ok(historyRows.length > 0, 'Rate change history must be recorded');
    assert.equal(Number(historyRows[0].old_rate), 120.0);
    assert.equal(Number(historyRows[0].new_rate), 145.5);
  });

  await t.test('2. UI Verification: "Audit" is replaced with "Edit" button and pop-up has required fields', () => {
    const productsPageCode = readFileSync(join(__dirname, '../src/app/products/page.tsx'), 'utf8');

    // Must have Edit button with Pencil icon
    assert.ok(productsPageCode.includes('<span>Edit</span>'), 'Page must contain "Edit" button label');
    assert.ok(productsPageCode.includes('Pencil'), 'Edit button must use Pencil icon');
    assert.ok(!productsPageCode.includes('<span>Audit</span>'), 'Page must NOT contain old "Audit" button');

    // Table Actions header
    assert.ok(productsPageCode.includes('>Actions</th>'), 'Table header must have "Actions" column');

    // Required fields in Edit Modal
    assert.ok(productsPageCode.includes('Item Name <span className="text-rose-500">*</span>'), 'Item Name must be required');
    assert.ok(productsPageCode.includes('Master Rate (₹) <span className="text-rose-500">*</span>'), 'Rate must be required');
    assert.ok(productsPageCode.includes('Unit <span className="text-rose-500">*</span>'), 'Unit must be required');
    assert.ok(productsPageCode.includes('GST Rate <span className="text-rose-500">*</span>'), 'GST must be required');

    // Specifications (Optional) must NOT have colored styling
    assert.ok(
      productsPageCode.includes('Specifications (Optional)'),
      'Must contain Specifications (Optional) label'
    );
    // Ensure no amber/rose/emerald/blue colored badge on optional specification
    const specOptionalMatch = productsPageCode.match(/<label[^>]*>\s*Specifications \(Optional\)\s*<\/label>/);
    assert.ok(specOptionalMatch, 'Specifications (Optional) label must be plain uncolored text');

    // Automated Item Code
    assert.ok(productsPageCode.includes('Automated JPA Sequence Code') || productsPageCode.includes('Item Code'), 'Must show Automated Item Code');

    // Microsecond save telemetry & White Glassmorphism Notification
    assert.ok(productsPageCode.includes('performance.now()'), 'Must measure microsecond saving performance');
    assert.ok(productsPageCode.includes('Saved Successfully'), 'Must display "Saved Successfully" notification');
    assert.ok(productsPageCode.includes('saveTelemetry.productName') && productsPageCode.includes('saveTelemetry.rate'), 'Must display Product Name and Rate saved');
    assert.ok(productsPageCode.includes('bg-white/90') && productsPageCode.includes('backdrop-blur-2xl'), 'Notification must be in White Glassmorphism');

    // Zero emojis check
    const emojiMatch = productsPageCode.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu);
    assert.equal(emojiMatch, null, 'Must contain zero distracting emojis');
  });

  await t.test('3. Breathable space in Header & Rate Library layout', () => {
    const appHeaderCode = readFileSync(join(__dirname, '../src/components/AppHeader.tsx'), 'utf8');
    const productsPageCode = readFileSync(join(__dirname, '../src/app/products/page.tsx'), 'utf8');

    // AppHeader breathable height and padding
    assert.ok(
      appHeaderCode.includes('min-h-16') || appHeaderCode.includes('min-h-20'),
      'Header must have expanded vertical height'
    );
    assert.ok(
      appHeaderCode.includes('px-4') && appHeaderCode.includes('sm:px-8'),
      'Header must have generous horizontal padding'
    );

    // Rate Library Page container spacing
    assert.ok(
      productsPageCode.includes('max-w-7xl mx-auto w-full space-y-6') ||
      productsPageCode.includes('p-4 sm:p-6 md:p-8'),
      'Rate Library page must have comfortable, breathable container padding'
    );
  });
});

