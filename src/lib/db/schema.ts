import { getDb, getDbKey } from './client';

const initPromises = new Map<string, Promise<void>>();

export function resetSchemaCache() {
  initPromises.delete(getDbKey());
}

export async function initDb() {
  const key = getDbKey();
  const existing = initPromises.get(key);
  if (existing) {
    return existing;
  }

  const promise = runInitDb().catch((err) => {
    initPromises.delete(key);
    throw err;
  });
  initPromises.set(key, promise);
  return promise;
}

async function runInitDb() {
  const db = getDb();

  try {
    await db.execute('PRAGMA journal_mode = WAL');
    await db.execute('PRAGMA busy_timeout = 10000');
  } catch {}

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      contact TEXT,
      role TEXT NOT NULL DEFAULT 'staff',
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      last_sign_in_at TEXT,
      last_active_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS company_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT,
      gstin TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      website TEXT,
      bank_name TEXT,
      account_no TEXT,
      ifsc_code TEXT,
      branch TEXT,
      signatory_name TEXT,
      signatory_designation TEXT,
      logo_url TEXT,
      is_default INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      trade_name TEXT,
      store_code TEXT,
      folder_name TEXT,
      gstin TEXT,
      pan TEXT,
      billing_address TEXT NOT NULL,
      delivery_address TEXT,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      state_code TEXT DEFAULT '33',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS company_folders (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      gstin TEXT,
      billing_address TEXT,
      notes TEXT,
      logo_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_stores (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      store_code TEXT,
      address TEXT,
      contact_person TEXT,
      phone TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      item_code TEXT,
      description TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Housekeeping',
      specification TEXT,
      pack TEXT,
      unit TEXT NOT NULL,
      default_rate REAL NOT NULL DEFAULT 0.0,
      default_gst_rate REAL NOT NULL DEFAULT 18.0,
      is_active INTEGER DEFAULT 1,
      last_verified_date TEXT,
      last_verified_source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_normalized ON products(normalized_name);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

    CREATE TABLE IF NOT EXISTS product_aliases (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      alias_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_rates (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      customer_id TEXT,
      rate REAL NOT NULL,
      effective_from TEXT NOT NULL,
      source_quote_number TEXT,
      change_reason TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rate_change_history (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      old_rate REAL NOT NULL,
      new_rate REAL NOT NULL,
      change_date TEXT NOT NULL,
      source_quote_number TEXT,
      changed_by TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_rate_history_prod ON rate_change_history(product_id);

    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      quote_number TEXT UNIQUE NOT NULL,
      company_profile_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      customer_gstin TEXT,
      store_name TEXT,
      store_code TEXT,
      quote_date TEXT NOT NULL,
      validity_date TEXT NOT NULL,
      reference_no TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      currency TEXT NOT NULL DEFAULT 'INR',
      subtotal REAL NOT NULL DEFAULT 0.0,
      gst_total REAL NOT NULL DEFAULT 0.0,
      round_off REAL NOT NULL DEFAULT 0.0,
      grand_total REAL NOT NULL DEFAULT 0.0,
      tax_type TEXT NOT NULL DEFAULT 'exclusive',
      terms_payment TEXT,
      terms_delivery TEXT,
      terms_validity TEXT,
      terms_transport TEXT,
      terms_gst TEXT,
      notes TEXT,
      created_by TEXT,
      created_by_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_profile_id) REFERENCES company_profiles(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
    CREATE INDEX IF NOT EXISTS idx_quotations_date ON quotations(quote_date);

    CREATE TABLE IF NOT EXISTS quotation_sections (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      section_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0.0,
      gst_total REAL NOT NULL DEFAULT 0.0,
      section_total REAL NOT NULL DEFAULT 0.0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      section_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      store_name TEXT,
      description TEXT NOT NULL,
      specification TEXT,
      pack TEXT,
      quantity REAL NOT NULL DEFAULT 1.0,
      unit TEXT NOT NULL,
      unit_rate REAL NOT NULL DEFAULT 0.0,
      gst_rate REAL NOT NULL DEFAULT 18.0,
      taxable_amount REAL NOT NULL DEFAULT 0.0,
      gst_amount REAL NOT NULL DEFAULT 0.0,
      line_total REAL NOT NULL DEFAULT 0.0,
      product_id TEXT,
      is_rate_autofilled INTEGER DEFAULT 0,
      saved_rate_date TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES quotation_sections(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quote_items ON quotation_items(quotation_id);

    CREATE TABLE IF NOT EXISTS ai_extraction_jobs (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      extracted_json TEXT,
      review_json TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Non-destructive schema migrations
  try {
    await db.execute('ALTER TABLE users ADD COLUMN contact TEXT');
  } catch {
    // Column already exists or table was just created with column
  }

  try {
    await db.execute('ALTER TABLE users ADD COLUMN last_sign_in_at TEXT');
  } catch {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE quotations ADD COLUMN created_by_id TEXT');
  } catch {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE users ADD COLUMN last_active_at TEXT');
  } catch {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE users ADD COLUMN avatar_url TEXT');
  } catch {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE customers ADD COLUMN store_code TEXT');
  } catch {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE customer_stores ADD COLUMN store_code TEXT');
  } catch {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE quotations ADD COLUMN store_code TEXT');
  } catch {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE customers ADD COLUMN folder_name TEXT');
  } catch {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE company_folders ADD COLUMN description TEXT');
  } catch {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE company_folders ADD COLUMN logo_url TEXT');
  } catch {
    // Column already exists
  }
}
