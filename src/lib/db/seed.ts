import { getDb, getDbKey } from './client';
import { initDb, resetSchemaCache } from './schema';
import { normalizeItemText } from '../catalog/rate-memory';
import bcrypt from 'bcryptjs';

const seedPromises = new Map<string, Promise<void>>();

export async function resetAndSeedDb() {
  const key = getDbKey();
  seedPromises.delete(key);
  resetSchemaCache();
  await initDb();
  const db = getDb();

  // Wipe previous quotations, products, and customers to cleanly reset
  await db.execute('DELETE FROM quotation_items');
  await db.execute('DELETE FROM quotation_sections');
  await db.execute('DELETE FROM quotations');
  await db.execute('DELETE FROM rate_change_history');
  await db.execute('DELETE FROM product_rates');
  await db.execute('DELETE FROM product_aliases');
  await db.execute('DELETE FROM products');
  await db.execute('DELETE FROM customer_stores');
  await db.execute('DELETE FROM customers');
  await db.execute('DELETE FROM company_profiles');
  await db.execute('DELETE FROM users');

  await seedDb();
}

export async function seedDb() {
  const key = getDbKey();
  const existing = seedPromises.get(key);
  if (existing) {
    return existing;
  }

  const promise = runSeedDb().catch((err) => {
    seedPromises.delete(key);
    throw err;
  });
  seedPromises.set(key, promise);
  return promise;
}

async function runSeedDb() {
  await initDb();
  const db = getDb();

  // 1. Ensure N Jayakumar is seeded/updated as Master Administrator
  const now = new Date().toISOString();

  const adminCheck = await db.execute({
    sql: 'SELECT id, name, role, password_hash FROM users WHERE email = ? LIMIT 1',
    args: ['jeevanpranavagencies@gmail.com'],
  });

  if (adminCheck.rows.length === 0) {
    const adminHash = await bcrypt.hash('jpa@1977', 10);
    // Check if usr_admin_1 exists with old email, update it
    const oldAdminCheck = await db.execute({
      sql: 'SELECT id FROM users WHERE id = ? LIMIT 1',
      args: ['usr_admin_1'],
    });

    if (oldAdminCheck.rows.length > 0) {
      await db.execute({
        sql: `UPDATE users SET email = 'jeevanpranavagencies@gmail.com', name = 'N Jayakumar', role = 'admin', password_hash = ? WHERE id = 'usr_admin_1'`,
        args: [adminHash],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, 'admin', ?, ?)`,
        args: ['usr_admin_1', 'jeevanpranavagencies@gmail.com', 'N Jayakumar', adminHash, now],
      });
    }
  } else {
    const row = adminCheck.rows[0];
    if (row.name !== 'N Jayakumar' || row.role !== 'admin' || !row.password_hash) {
      const adminHash = await bcrypt.hash('jpa@1977', 10);
      await db.execute({
        sql: `UPDATE users SET name = 'N Jayakumar', role = 'admin', password_hash = ? WHERE email = 'jeevanpranavagencies@gmail.com'`,
        args: [adminHash],
      });
    }
  }

  // Permanently delete any legacy "JPA Sales & Admin Team" / salesteamjpa@gmail.com records
  await db.execute({
    sql: "DELETE FROM users WHERE email = 'salesteamjpa@gmail.com' OR name = 'JPA Sales & Admin Team'",
  });

  const isTestEnv =
    process.env.NODE_ENV === 'test' ||
    Boolean(
      process.env.JPA_DATA_DIR &&
        (process.env.JPA_DATA_DIR.includes('jpa-test') || process.env.JPA_DATA_DIR.includes('-test-'))
    ) ||
    process.env.JPA_SEED_SAMPLE_QUOTE === 'true';

  if (!isTestEnv) {
    // Always purge any test-polluted PZ-02 / test_cust_* rows
    await db.execute({
      sql: "DELETE FROM customer_stores WHERE store_code = 'PZ-02' OR customer_id IN (SELECT id FROM customers WHERE store_code = 'PZ-02' OR id LIKE 'test_cust_%')",
    });
    await db.execute({
      sql: "DELETE FROM customers WHERE store_code = 'PZ-02' OR id LIKE 'test_cust_%'",
    });
    await db.execute({
      sql: "UPDATE company_profiles SET email = 'jeevanpranavagencies@gmail.com' WHERE email LIKE '%jmjp77@gmail.com%'",
    });

    // Clean production deployment reset (0 Quotations, 0 ₹, 0 Folders, NO existing emails — ONLY Admin email)
    const cleanCheck = await db.execute({
      sql: "SELECT value FROM system_settings WHERE key = 'fly_clean_deploy_v2' LIMIT 1",
    });
    if (cleanCheck.rows.length === 0) {
      await db.execute('DELETE FROM quotation_items');
      await db.execute('DELETE FROM quotation_sections');
      await db.execute('DELETE FROM quotations');
      await db.execute('DELETE FROM company_folders');
      await db.execute('UPDATE customers SET folder_name = NULL, email = NULL');
      await db.execute({
        sql: "DELETE FROM users WHERE LOWER(email) != 'jeevanpranavagencies@gmail.com'",
      });
      await db.execute('DELETE FROM audit_events');
      await db.execute({
        sql: "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('fly_clean_deploy_v2', '1', ?)",
        args: [now],
      });
    }
  }

  // Check if company profile is already seeded
  const existingProfiles = await db.execute('SELECT COUNT(*) as count FROM company_profiles');
  if (Number(existingProfiles.rows[0].count) > 0) {
    return;
  }

  // 2. Seed Verified Supplier Company Profile
  await db.execute({
    sql: `INSERT INTO company_profiles (
      id, name, tagline, gstin, address, phone, email, website, 
      bank_name, account_no, ifsc_code, branch, signatory_name, signatory_designation, 
      logo_url, is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      'cmp_jpa_master',
      'Jeevan Pranav Agencies (JPA)',
      'Industrial & Housekeeping Supplies',
      '33BRGPM1867B1Z1',
      '16-P, Sakthi illam, Gandhi nagar, Mettuthottam, Podanur, Coimbatore-641023.',
      '9790600971',
      'jeevanpranavagencies@gmail.com',
      'https://www.jeevanpranavagencies.com/',
      'HDFC Bank Ltd',
      '50200034981273',
      'HDFC0001867',
      'Podanur Branch, Coimbatore',
      'Mr. N JAYAKUMAR',
      'Proprietor / Authorised Signatory',
      '/jpa-header-logo.png',
      1,
      now,
      now,
    ],
  });

  // 3. Seed Verified Customer: Lifestyle International (Marina Mall)
  await db.execute({
    sql: `INSERT INTO customers (
      id, company_name, trade_name, gstin, pan, billing_address, delivery_address, 
      contact_person, phone, email, state_code, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      'cust_lifestyle_marina',
      'LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)',
      'HOME CENTRE, LANDMARK GROUP',
      '33AAACL1234F1Z9',
      'AAACL1234F',
      '13/1A, EGATTUR, OMR, CHENNAI - 603103.',
      '13/1A, EGATTUR, OMR, CHENNAI - 603103.',
      'PRASANTH P, HOME CENTRE, LANDMARK GROUP',
      '9790600971',
      '',
      '33',
      'Marina Mall Store - Prime Retail Client',
      now,
      now,
    ],
  });

  await db.execute({
    sql: `INSERT INTO customer_stores (id, customer_id, store_name, address, contact_person, phone, created_at) VALUES 
      (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      'store_lifestyle_marina',
      'cust_lifestyle_marina',
      'LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)',
      '13/1A, EGATTUR, OMR, CHENNAI - 603103.',
      'PRASANTH P',
      '9790600971',
      now,
    ],
  });

  // 4. Seed Rate Library (Permanent Product & Rate Memory - The 22 Verified Items)
  const masterItems = [
    { code: 'ST-001', desc: 'GIFT WRAPPING TAPE', norm: 'gift wrapping tape', cat: 'Stationery', spec: 'Half - 1/2', pack: '10', unit: 'NOS', qty: 120, rate: 20.00, gst: 18.0 },
    { code: 'ST-002', desc: 'BEST WISHES CARD', norm: 'best wishes card', cat: 'Stationery', spec: '', pack: '', unit: 'Pkt', qty: 10, rate: 28.00, gst: 18.0 },
    { code: 'ST-003', desc: 'A/4 JK COPIER PAPER', norm: 'a/4 jk copier paper', cat: 'Stationery', spec: '80 GSM', pack: '1', unit: 'Ream', qty: 10, rate: 280.00, gst: 18.0 },
    { code: 'ST-004', desc: 'FEWIQUIK', norm: 'fewiquik', cat: 'Stationery', spec: 'SMALL', pack: '2', unit: 'NOS', qty: 20, rate: 14.50, gst: 18.0 },
    { code: 'HK-001', desc: 'WATER BOTTLE', norm: 'water bottle', cat: 'Housekeeping', spec: '250 ML', pack: '2 CASES', unit: 'NOS', qty: 72, rate: 45.00, gst: 18.0 },
    { code: 'EL-001', desc: 'BATTERY AA', norm: 'battery aa', cat: 'Electrical', spec: 'EVEREADY', pack: '', unit: 'NOS', qty: 20, rate: 18.00, gst: 18.0 },
    { code: 'EL-002', desc: 'BATTERY AAA', norm: 'battery aaa', cat: 'Electrical', spec: 'EVEREADY', pack: '', unit: 'NOS', qty: 10, rate: 20.00, gst: 18.0 },
    { code: 'EL-003', desc: 'BATTERY COIN', norm: 'battery coin', cat: 'Electrical', spec: 'CR 2032', pack: '', unit: 'NOS', qty: 20, rate: 38.00, gst: 18.0 },
    { code: 'ST-005', desc: 'BOARD MARKER', norm: 'board marker', cat: 'Stationery', spec: 'BLACK & WHITE', pack: '', unit: 'NOS', qty: 10, rate: 17.00, gst: 18.0 },
    { code: 'HK-002', desc: 'DETTOL', norm: 'dettol', cat: 'Housekeeping', spec: '50 ML', pack: '1', unit: 'NOS', qty: 1, rate: 43.00, gst: 5.0 },
    { code: 'HK-003', desc: 'COTTON', norm: 'cotton', cat: 'Housekeeping', spec: '1 ROLE', pack: '1', unit: 'Kg', qty: 1, rate: 380.00, gst: 18.0 },
    { code: 'HK-004', desc: 'BAND-AID', norm: 'band-aid', cat: 'Housekeeping', spec: '', pack: '', unit: 'NOS', qty: 30, rate: 2.00, gst: 18.0 },
    { code: 'HK-005', desc: 'VOLINE SPARY', norm: 'voline spary', cat: 'Housekeeping', spec: '42 ML', pack: '1', unit: 'NOS', qty: 1, rate: 189.00, gst: 5.0 },
    { code: 'ST-006', desc: 'BROWN MARKER', norm: 'brown marker', cat: 'Stationery', spec: '', pack: '', unit: 'NOS', qty: 3, rate: 17.00, gst: 18.0 },
    { code: 'ST-007', desc: 'WHITNER', norm: 'whitner', cat: 'Stationery', spec: 'PACKET', pack: '1', unit: 'NOS', qty: 1, rate: 24.00, gst: 18.0 },
    { code: 'ST-008', desc: 'FEVISTICK', norm: 'fevistick', cat: 'Stationery', spec: 'SMALL', pack: '2', unit: 'NOS', qty: 2, rate: 25.00, gst: 18.0 },
    { code: 'ST-009', desc: 'ATTENDENCE NOTE', norm: 'attendence note', cat: 'Stationery', spec: '192 PAGE', pack: '2', unit: 'NOS', qty: 2, rate: 118.00, gst: 18.0 },
    { code: 'IN-001', desc: 'ANABOND', norm: 'anabond', cat: 'Industrial', spec: '', pack: '10', unit: 'NOS', qty: 10, rate: 42.00, gst: 18.0 },
    { code: 'IN-002', desc: 'ARALDITE', norm: 'araldite', cat: 'Industrial', spec: 'MEDIUM', pack: '2', unit: 'NOS', qty: 2, rate: 59.00, gst: 18.0 },
    { code: 'ST-010', desc: 'A4 LAMINATION SHEET', norm: 'a4 lamination sheet', cat: 'Stationery', spec: 'TRANSPARENT - 50 PCS', pack: '1', unit: 'PKT', qty: 1, rate: 650.00, gst: 18.0 },
    { code: 'ST-011', desc: 'A5 LAMINATION SHEET', norm: 'a5 lamination sheet', cat: 'Stationery', spec: '', pack: '1', unit: 'PKT', qty: 1, rate: 580.00, gst: 18.0 },
    { code: 'OT-001', desc: 'TRANSPORT CHARGES', norm: 'transport charges', cat: 'Other', spec: '', pack: '6', unit: 'NOS', qty: 6, rate: 240.00, gst: 18.0 },
  ];

  for (const p of masterItems) {
    const prodId = `prod_${p.code.toLowerCase().replace('-', '_')}`;
    await db.execute({
      sql: `INSERT INTO products (
        id, item_code, description, normalized_name, category, specification, pack, 
        unit, default_rate, default_gst_rate, is_active, last_verified_date, 
        last_verified_source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        prodId, p.code, p.desc, normalizeItemText(p.desc), p.cat, p.spec, p.pack, p.unit, p.rate, p.gst,
        1, '2026-10-15', 'Rate Card JPA-74 - Marina Mall', now, now,
      ],
    });

    await db.execute({
      sql: `INSERT INTO rate_change_history (
        id, product_id, old_rate, new_rate, change_date, source_quote_number, changed_by, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `hist_${prodId}_init`,
        prodId,
        p.rate,
        p.rate,
        '2026-10-15',
        'JPA-74',
        'JPA Administrator',
        'Quoted for Lifestyle Marina Mall',
        now,
      ],
    });

    await db.execute({
      sql: `INSERT INTO product_rates (
        id, product_id, customer_id, rate, effective_from, source_quote_number, change_reason, updated_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `rate_${prodId}_lifestyle`,
        prodId,
        'cust_lifestyle_marina',
        p.rate,
        '2026-10-15',
        'JPA-74',
        'Approved Rate Card JPA-74',
        'JPA Administrator',
        now,
      ],
    });
  }

  // 5. Seed Historical Quotation: JPA-74 (Only in automated test environments)
  if (!isTestEnv) {
    return;
  }

  const quoteId = 'qte_jpa_74';
  const quoteNumber = 'JPA-74';
  const quoteDate = '2026-10-15';
  const validityDate = '2026-10-30';

  // Financial summary
  const subtotal = 14741.00;
  const gst5Amount = 11.60;
  const gst18Amount = 2611.62;
  const gstTotal = 2623.22;
  const roundOff = 0.38;
  const grandTotal = 17353.00;

  await db.execute({
    sql: `INSERT INTO quotations (
      id, quote_number, company_profile_id, customer_id, customer_name, customer_address, 
      customer_gstin, store_name, quote_date, validity_date, reference_no, status, 
      currency, subtotal, gst_total, round_off, grand_total, tax_type, 
      terms_payment, terms_delivery, terms_validity, terms_transport, terms_gst, 
      notes, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      quoteId,
      quoteNumber,
      'cmp_jpa_master',
      'cust_lifestyle_marina',
      'LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)',
      '13/1A, EGATTUR, OMR, CHENNAI - 603103.',
      '33AAACL1234F1Z9',
      'LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)',
      quoteDate,
      validityDate,
      'PRASANTH P, HOME CENTRE, LANDMARK GROUP',
      'approved',
      'INR',
      subtotal,
      gstTotal,
      roundOff,
      grandTotal,
      'exclusive',
      'As agreed.',
      'Immediate.',
      '15 days from quotation date.',
      'Extra, if applicable.',
      'Extra as Applicable',
      'RATE CARD RC Number: JPA-74 for Lifestyle Marina Mall',
      'usr_admin_1',
      now,
      now,
    ],
  });

  const sectionId = 'sec_jpa_74_stationary';
  await db.execute({
    sql: `INSERT INTO quotation_sections (id, quotation_id, section_name, sort_order, subtotal, gst_total, section_total, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [sectionId, quoteId, 'Stationary', 1, subtotal, gstTotal, grandTotal, now],
  });

  let sortOrder = 1;
  for (const item of masterItems) {
    const prodId = `prod_${item.code.toLowerCase().replace('-', '_')}`;
    const amount = Number((item.qty * item.rate).toFixed(2));
    const gstAmt = Number((amount * (item.gst / 100)).toFixed(2));
    const total = Number((amount + gstAmt).toFixed(2));

    await db.execute({
      sql: `INSERT INTO quotation_items (
        id, quotation_id, section_id, sort_order, store_name, description, 
        specification, pack, quantity, unit, unit_rate, gst_rate, 
        taxable_amount, gst_amount, line_total, product_id, is_rate_autofilled, 
        saved_rate_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `item_jpa_74_${sortOrder}`,
        quoteId,
        sectionId,
        sortOrder,
        'LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)',
        item.desc,
        item.spec,
        item.pack,
        item.qty,
        item.unit,
        item.rate,
        item.gst,
        amount,
        gstAmt,
        total,
        prodId,
        1,
        '2026-10-15',
        now,
      ],
    });
    sortOrder++;
  }
}
