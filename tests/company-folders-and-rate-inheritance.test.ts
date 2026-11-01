import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-test-folder-rates-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/lib/db/client';
import { seedDb } from '../src/lib/db/seed';
import { findMatchingRate, normalizeItemText } from '../src/lib/catalog/rate-memory';
import { normalizeCompanyName } from '../src/lib/utils/formatters';
import { NextRequest } from 'next/server';
import { GET as getCustomers, POST as postCustomer } from '../src/app/api/customers/route';
import { POST as postFolder, GET as getFolders } from '../src/app/api/customers/folders/route';

test('Company Folders & Group Rate Inheritance Workflow', async (t) => {
  await seedDb();
  const db = getDb();

  await t.test('1. Normalization maps diverse unit names to shared Company Folder', () => {
    assert.equal(normalizeCompanyName('Life Style International P Ltd.,(H/C)'), 'Lifestyle International');
    assert.equal(normalizeCompanyName('Lifestyle International Pvt. Ltd'), 'Lifestyle International');
    assert.equal(normalizeCompanyName('Lifestyle International Pvt. Ltd.'), 'Lifestyle International');
    assert.equal(normalizeCompanyName('Landmark Group - Home Centre'), 'Landmark Group');
  });

  await t.test('2. Company Folders API creates and returns folders with units aggregation', async () => {
    const fReq = new NextRequest('http://localhost:3000/api/customers/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Lifestyle International',
        gstin: '33AAACL2937J1ZL',
        billingAddress: 'G-10, Ground Floor, Prozone Mall, Coimbatore',
      }),
    });

    const fRes = await postFolder(fReq);
    assert.equal(fRes.status, 200);

    // Insert 3 units of Lifestyle International
    const now = new Date().toISOString();
    const cust1 = 'cust_ls_homecentre';
    const cust2 = 'cust_ls_madurai';
    const cust3 = 'cust_ls_prozone';

    await db.execute({
      sql: `INSERT INTO customers (id, company_name, trade_name, store_code, folder_name, gstin, billing_address, created_at, updated_at)
            VALUES (?, 'Life Style International P Ltd.,(H/C)', 'Homecentre', 'HC-01', 'Lifestyle International', '33AAACL2937J1ZL', 'Brooke Fields, Coimbatore', ?, ?)`,
      args: [cust1, now, now],
    });

    await db.execute({
      sql: `INSERT INTO customers (id, company_name, trade_name, store_code, folder_name, gstin, billing_address, created_at, updated_at)
            VALUES (?, 'Lifestyle International Pvt. Ltd', 'Madurai', 'MD-01', 'Lifestyle International', '33AAACL2937J1ZL', 'Ponmeni, Madurai', ?, ?)`,
      args: [cust2, now, now],
    });

    await db.execute({
      sql: `INSERT INTO customers (id, company_name, trade_name, store_code, folder_name, gstin, billing_address, created_at, updated_at)
            VALUES (?, 'Lifestyle International Pvt. Ltd', 'Prozone Mall', '1903', 'Lifestyle International', '33AAACL2937J1ZL', 'Prozone Mall, Coimbatore', ?, ?)`,
      args: [cust3, now, now],
    });

    // Check folders aggregation
    const getFoldersReq = new NextRequest('http://localhost:3000/api/customers/folders', { method: 'GET' });
    const getFoldersRes = await getFolders(getFoldersReq);
    const fData = await getFoldersRes.json();

    const lsFolder = fData.folders.find((f: any) => f.name === 'Lifestyle International');
    assert.ok(lsFolder, 'Lifestyle International folder must be present');
    assert.equal(lsFolder.unitsCount >= 3, true, 'Folder must contain all 3 store units');
  });

  await t.test('3. Rate Memory Inheritance: Old/existing rates from one unit are recalled for other units of the company', async () => {
    const cust1 = 'cust_ls_homecentre';
    const cust3 = 'cust_ls_prozone';
    const now = new Date().toISOString();

    // 1. Create a product: Flat Mop Refill
    const prodId = 'prod_mop_refill_1';
    await db.execute({
      sql: `INSERT INTO products (id, item_code, description, normalized_name, category, unit, default_rate, default_gst_rate, is_active, created_at, updated_at)
            VALUES (?, 'JPA-050', 'Flat Mop Refill Premium', 'flat mop refill premium', 'Housekeeping', 'Nos', 150.00, 18, 1, ?, ?)`,
      args: [prodId, now, now],
    });

    // 2. Save a customer rate of Rs 185.00 for cust1 (Homecentre)
    await db.execute({
      sql: `INSERT INTO product_rates (id, product_id, customer_id, rate, effective_from, source_quote_number, change_reason, created_at)
            VALUES ('prate_test_1', ?, ?, 185.00, '2026-09-15', 'JPA-2026-001', 'Quotation Entry', ?)`,
      args: [prodId, cust1, now],
    });

    // 3. Query matching rate for cust3 (Prozone Mall) - which hasn't had a quote yet
    const match = await findMatchingRate({
      description: 'Flat Mop Refill Premium',
      customerId: cust3,
    });

    assert.equal(match.matched, true);
    assert.equal(match.rate, 185.00, 'Existing/old rate from Homecentre must be inherited by Prozone Mall unit');
    assert.equal(match.savedRateDate, '2026-09-15');

    // 4. Test unlisted past quotation item inheritance:
    // Insert a past quotation for Lifestyle International with an unlisted item "Odonil Gel Pocket Rose" @ Rs 62.50
    const quoteId = 'quote_ls_past_1';
    await db.execute({
      sql: `INSERT INTO quotations (id, quote_number, company_profile_id, customer_id, customer_name, customer_address, quote_date, validity_date, status, created_at, updated_at)
            VALUES (?, 'JPA-2026-042', 'cmp_jpa_master', ?, 'Lifestyle International Pvt. Ltd (Homecentre)', 'Coimbatore', '2026-08-10', '2026-08-25', 'approved', ?, ?)`,
      args: [quoteId, cust1, now, now],
    });

    await db.execute({
      sql: `INSERT INTO quotation_sections (id, quotation_id, section_name, created_at) VALUES ('sec_past_1', ?, 'Housekeeping', ?)`,
      args: [quoteId, now],
    });

    await db.execute({
      sql: `INSERT INTO quotation_items (id, quotation_id, section_id, description, quantity, unit, unit_rate, gst_rate, created_at)
            VALUES ('itm_past_1', ?, 'sec_past_1', 'Odonil Gel Pocket Rose', 10, 'Nos', 62.50, 18, ?)`,
      args: [quoteId, now],
    });

    // Query for cust3 (Prozone Mall)
    const matchUnlisted = await findMatchingRate({
      description: 'Odonil Gel Pocket Rose',
      customerId: cust3,
    });

    assert.equal(matchUnlisted.matched, true);
    assert.equal(matchUnlisted.rate, 62.50, 'Existing rate from past quotation must be inherited by all company units');
    assert.equal(matchUnlisted.savedRateDate, '2026-08-10');
  });

  await t.test('4. Verification: Unwanted text and emojis removed, Apple Glassmorphism Grid present', () => {
    const customersPageCode = readFileSync(join(__dirname, '../src/app/customers/page.tsx'), 'utf8');

    // Must NOT contain the unwanted string
    assert.ok(
      !customersPageCode.includes('Directly editable table with microsecond background synchronization'),
      'Must NOT contain unwanted synchronization text'
    );
    assert.ok(
      !customersPageCode.includes('Microsecond auto-save active'),
      'Must NOT contain unwanted auto-save text'
    );

    // Must NOT contain unwanted subtitle or header pills
    assert.ok(
      !customersPageCode.includes('Organized client accounts, company groups, and store branches'),
      'Must NOT contain unwanted subtitle text'
    );
    assert.ok(
      !customersPageCode.includes('{customers.length} Accounts'),
      'Must NOT contain Accounts badge in header'
    );
    assert.ok(
      !customersPageCode.includes('{companyFolderGroups.length} Folders'),
      'Must NOT contain Folders badge in header'
    );

    // STRICTLY ZERO EMOJIS
    const emojiMatch = customersPageCode.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu);
    assert.equal(emojiMatch, null, 'Must contain ZERO emojis');

    // Apple Glassmorphism Grid elements
    assert.ok(customersPageCode.includes('Company Folders'), 'Must contain Company Folders section');
    assert.ok(customersPageCode.includes('New Folder'), 'Must have New Folder button');
    assert.ok(customersPageCode.includes('FolderPlus'), 'Must use FolderPlus icon');
    assert.ok(customersPageCode.includes('backdrop-blur-2xl'), 'Must use Glassmorphism blur');
  });

  await t.test('5. Unit Quotations & Custom Folder DP / Logo Workflow', async () => {
    // Test PUT /api/customers/folders updates folder logo_url
    const { PUT, GET } = await import('../src/app/api/customers/folders/route');
    const sampleLogo = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2wAA';

    const putReq = new Request('http://localhost:3000/api/customers/folders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Lifestyle International',
        logoUrl: sampleLogo,
      }),
    });

    const putRes = await PUT(putReq as any);
    assert.equal(putRes.status, 200);
    const putData = await putRes.json();
    assert.equal(putData.success, true);
    assert.equal(putData.logoUrl, sampleLogo);

    // Verify GET returns logo_url
    const getReq = new Request('http://localhost:3000/api/customers/folders');
    const getRes = await GET(getReq as any);
    const getData = await getRes.json();
    const lsFolder = getData.folders.find((f: any) => f.name.toLowerCase() === 'lifestyle international');
    assert.ok(lsFolder, 'Lifestyle International folder must exist');
    assert.equal(lsFolder.logo_url, sampleLogo, 'Folder must have the custom DP / logo');

    // Test GET /api/quotations with customerId returns de-duplicated unit quotations
    const { GET: getQuotes } = await import('../src/app/api/quotations/route');
    const quoteReq = new Request('http://localhost:3000/api/quotations?customerId=cust_ls_homecentre');
    const quoteRes = await getQuotes(quoteReq as any);
    assert.equal(quoteRes.status, 200);
    const quoteData = await quoteRes.json();
    assert.ok(Array.isArray(quoteData.quotations));

    // Assert strictly NO DUPLICATES in returned quotations
    const quoteIds = quoteData.quotations.map((q: any) => q.id);
    const uniqueIds = new Set(quoteIds);
    assert.equal(quoteIds.length, uniqueIds.size, 'Quotations must contain ZERO duplicate IDs');

    // Verify UI code contains Unit Quotations Modal, openUnitQuotations, and Camera DP button
    const customersPageCode = readFileSync(join(__dirname, '../src/app/customers/page.tsx'), 'utf8');
    assert.ok(customersPageCode.includes('openUnitQuotations'), 'Must have openUnitQuotations handler');
    assert.ok(customersPageCode.includes('Unit Quotations Modal'), 'Must have Unit Quotations Modal');
    assert.ok(customersPageCode.includes('Customize Folder DP / Logo'), 'Must have Logo / DP customizer');
    assert.ok(customersPageCode.includes('webp, png, jpeg'), 'Must support webp, png, jpeg, avif formats');
  });
});

