exports.id=4123,exports.ids=[4123],exports.modules={30497:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.d(b,{X:()=>g});var e=c(48769),f=a([e]);e=(f.then?(await f)():f)[0];let i=new Map;async function g(){let a=(0,e.y)(),b=i.get(a);if(b)return b;let c=h().catch(b=>{throw i.delete(a),b});return i.set(a,c),c}async function h(){let a=(0,e.L)();try{await a.execute("PRAGMA journal_mode = WAL"),await a.execute("PRAGMA busy_timeout = 10000")}catch{}await a.executeMultiple(`
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

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_contact ON users(contact);

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
  `);try{await a.execute("ALTER TABLE users ADD COLUMN contact TEXT")}catch{}try{await a.execute("ALTER TABLE users ADD COLUMN last_sign_in_at TEXT")}catch{}try{await a.execute("ALTER TABLE quotations ADD COLUMN created_by_id TEXT")}catch{}try{await a.execute("ALTER TABLE users ADD COLUMN last_active_at TEXT")}catch{}try{await a.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")}catch{}try{await a.execute("ALTER TABLE customers ADD COLUMN store_code TEXT")}catch{}try{await a.execute("ALTER TABLE customer_stores ADD COLUMN store_code TEXT")}catch{}try{await a.execute("ALTER TABLE quotations ADD COLUMN store_code TEXT")}catch{}try{await a.execute("ALTER TABLE customers ADD COLUMN folder_name TEXT")}catch{}try{await a.execute("ALTER TABLE company_folders ADD COLUMN description TEXT")}catch{}try{await a.execute("ALTER TABLE company_folders ADD COLUMN logo_url TEXT")}catch{}}d()}catch(a){d(a)}})},32783:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.d(b,{m:()=>j});var e=c(48769),f=c(30497),g=c(41643),h=c(34013),i=a([e,f,g]);[e,f,g]=i.then?(await i)():i;let l=new Map;async function j(){let a=(0,e.y)(),b=l.get(a);if(b)return b;let c=k().catch(b=>{throw l.delete(a),b});return l.set(a,c),c}async function k(){await (0,f.X)();let a=(0,e.L)(),b=new Date().toISOString(),c=await a.execute({sql:"SELECT id, name, role, password_hash FROM users WHERE email = ? LIMIT 1",args:["jeevanpranavagencies@gmail.com"]});if(0===c.rows.length){let c=await h.Ay.hash("jpa@1977",10);(await a.execute({sql:"SELECT id FROM users WHERE id = ? LIMIT 1",args:["usr_admin_1"]})).rows.length>0?await a.execute({sql:"UPDATE users SET email = 'jeevanpranavagencies@gmail.com', name = 'N Jayakumar', contact = '+91 9790600971', role = 'admin', password_hash = ? WHERE id = 'usr_admin_1'",args:[c]}):await a.execute({sql:"INSERT INTO users (id, email, name, contact, role, password_hash, created_at) VALUES (?, ?, ?, ?, 'admin', ?, ?)",args:["usr_admin_1","jeevanpranavagencies@gmail.com","N Jayakumar","+91 9790600971",c,b]})}else{let b=c.rows[0];if("N Jayakumar"!==b.name||"admin"!==b.role||!b.password_hash||!b.contact){let b=await h.Ay.hash("jpa@1977",10);await a.execute({sql:"UPDATE users SET name = 'N Jayakumar', contact = '+91 9790600971', role = 'admin', password_hash = ? WHERE email = 'jeevanpranavagencies@gmail.com'",args:[b]})}}await a.execute({sql:"DELETE FROM users WHERE email = 'salesteamjpa@gmail.com' OR name = 'JPA Sales & Admin Team'"});let d=!!(process.env.JPA_DATA_DIR&&(process.env.JPA_DATA_DIR.includes("jpa-test")||process.env.JPA_DATA_DIR.includes("-test-")))||"true"===process.env.JPA_SEED_SAMPLE_QUOTE;d||(await a.execute({sql:"DELETE FROM customer_stores WHERE store_code = 'PZ-02' OR customer_id IN (SELECT id FROM customers WHERE store_code = 'PZ-02' OR id LIKE 'test_cust_%')"}),await a.execute({sql:"DELETE FROM customers WHERE store_code = 'PZ-02' OR id LIKE 'test_cust_%'"}),await a.execute({sql:"UPDATE company_profiles SET email = 'jeevanpranavagencies@gmail.com' WHERE email LIKE '%jmjp77@gmail.com%'"}),0===(await a.execute({sql:"SELECT value FROM system_settings WHERE key = 'fly_clean_deploy_v2' LIMIT 1"})).rows.length&&(await a.execute("DELETE FROM quotation_items"),await a.execute("DELETE FROM quotation_sections"),await a.execute("DELETE FROM quotations"),await a.execute("DELETE FROM company_folders"),await a.execute("UPDATE customers SET folder_name = NULL, email = NULL"),await a.execute({sql:"DELETE FROM users WHERE LOWER(email) != 'jeevanpranavagencies@gmail.com'"}),await a.execute("DELETE FROM audit_events"),await a.execute({sql:"INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('fly_clean_deploy_v2', '1', ?)",args:[b]}))),0===Number((await a.execute("SELECT COUNT(*) as count FROM company_profiles")).rows[0].count)&&await a.execute({sql:`INSERT INTO company_profiles (
        id, name, tagline, gstin, address, phone, email, website, 
        bank_name, account_no, ifsc_code, branch, signatory_name, signatory_designation, 
        logo_url, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,args:["cmp_jpa_master","Jeevan Pranav Agencies (JPA)","Industrial & Housekeeping Supplies","33BRGPM1867B1Z1","16-P, Sakthi illam, Gandhi nagar, Mettuthottam, Podanur, Coimbatore-641023.","9790600971","jeevanpranavagencies@gmail.com","https://www.jeevanpranavagencies.com/","HDFC Bank Ltd","50200034981273","HDFC0001867","Podanur Branch, Coimbatore","Mr. N JAYAKUMAR","Proprietor / Authorised Signatory","/jpa-header-logo.png",1,b,b]}),d&&0===(await a.execute({sql:"SELECT id FROM customers WHERE id = 'cust_lifestyle_marina' LIMIT 1"})).rows.length&&(await a.execute({sql:`INSERT INTO customers (
          id, company_name, trade_name, gstin, pan, billing_address, delivery_address, 
          contact_person, phone, email, state_code, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,args:["cust_lifestyle_marina","LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)","HOME CENTRE, LANDMARK GROUP","33AAACL1234F1Z9","AAACL1234F","13/1A, EGATTUR, OMR, CHENNAI - 603103.","13/1A, EGATTUR, OMR, CHENNAI - 603103.","PRASANTH P, HOME CENTRE, LANDMARK GROUP","9790600971","","33","Marina Mall Store - Prime Retail Client",b,b]}),await a.execute({sql:`INSERT INTO customer_stores (id, customer_id, store_name, address, contact_person, phone, created_at) VALUES 
          (?, ?, ?, ?, ?, ?, ?)`,args:["store_lifestyle_marina","cust_lifestyle_marina","LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)","13/1A, EGATTUR, OMR, CHENNAI - 603103.","PRASANTH P","9790600971",b]}));let i=await a.execute("SELECT value FROM system_settings WHERE key = 'rate_library_cleared' LIMIT 1");if(i.rows.length>0&&"1"===i.rows[0].value||Number((await a.execute("SELECT COUNT(*) as count FROM products")).rows[0].count)>0)return;let j=[{code:"ST-001",desc:"GIFT WRAPPING TAPE",norm:"gift wrapping tape",cat:"Stationery",spec:"Half - 1/2",pack:"10",unit:"NOS",qty:120,rate:20,gst:18},{code:"ST-002",desc:"BEST WISHES CARD",norm:"best wishes card",cat:"Stationery",spec:"",pack:"",unit:"Pkt",qty:10,rate:28,gst:18},{code:"ST-003",desc:"A/4 JK COPIER PAPER",norm:"a/4 jk copier paper",cat:"Stationery",spec:"80 GSM",pack:"1",unit:"Ream",qty:10,rate:280,gst:18},{code:"ST-004",desc:"FEWIQUIK",norm:"fewiquik",cat:"Stationery",spec:"SMALL",pack:"2",unit:"NOS",qty:20,rate:14.5,gst:18},{code:"HK-001",desc:"WATER BOTTLE",norm:"water bottle",cat:"Housekeeping",spec:"250 ML",pack:"2 CASES",unit:"NOS",qty:72,rate:45,gst:18},{code:"EL-001",desc:"BATTERY AA",norm:"battery aa",cat:"Electrical",spec:"EVEREADY",pack:"",unit:"NOS",qty:20,rate:18,gst:18},{code:"EL-002",desc:"BATTERY AAA",norm:"battery aaa",cat:"Electrical",spec:"EVEREADY",pack:"",unit:"NOS",qty:10,rate:20,gst:18},{code:"EL-003",desc:"BATTERY COIN",norm:"battery coin",cat:"Electrical",spec:"CR 2032",pack:"",unit:"NOS",qty:20,rate:38,gst:18},{code:"ST-005",desc:"BOARD MARKER",norm:"board marker",cat:"Stationery",spec:"BLACK & WHITE",pack:"",unit:"NOS",qty:10,rate:17,gst:18},{code:"HK-002",desc:"DETTOL",norm:"dettol",cat:"Housekeeping",spec:"50 ML",pack:"1",unit:"NOS",qty:1,rate:43,gst:5},{code:"HK-003",desc:"COTTON",norm:"cotton",cat:"Housekeeping",spec:"1 ROLE",pack:"1",unit:"Kg",qty:1,rate:380,gst:18},{code:"HK-004",desc:"BAND-AID",norm:"band-aid",cat:"Housekeeping",spec:"",pack:"",unit:"NOS",qty:30,rate:2,gst:18},{code:"HK-005",desc:"VOLINE SPARY",norm:"voline spary",cat:"Housekeeping",spec:"42 ML",pack:"1",unit:"NOS",qty:1,rate:189,gst:5},{code:"ST-006",desc:"BROWN MARKER",norm:"brown marker",cat:"Stationery",spec:"",pack:"",unit:"NOS",qty:3,rate:17,gst:18},{code:"ST-007",desc:"WHITNER",norm:"whitner",cat:"Stationery",spec:"PACKET",pack:"1",unit:"NOS",qty:1,rate:24,gst:18},{code:"ST-008",desc:"FEVISTICK",norm:"fevistick",cat:"Stationery",spec:"SMALL",pack:"2",unit:"NOS",qty:2,rate:25,gst:18},{code:"ST-009",desc:"ATTENDENCE NOTE",norm:"attendence note",cat:"Stationery",spec:"192 PAGE",pack:"2",unit:"NOS",qty:2,rate:118,gst:18},{code:"IN-001",desc:"ANABOND",norm:"anabond",cat:"Industrial",spec:"",pack:"10",unit:"NOS",qty:10,rate:42,gst:18},{code:"IN-002",desc:"ARALDITE",norm:"araldite",cat:"Industrial",spec:"MEDIUM",pack:"2",unit:"NOS",qty:2,rate:59,gst:18},{code:"ST-010",desc:"A4 LAMINATION SHEET",norm:"a4 lamination sheet",cat:"Stationery",spec:"TRANSPARENT - 50 PCS",pack:"1",unit:"PKT",qty:1,rate:650,gst:18},{code:"ST-011",desc:"A5 LAMINATION SHEET",norm:"a5 lamination sheet",cat:"Stationery",spec:"",pack:"1",unit:"PKT",qty:1,rate:580,gst:18},{code:"OT-001",desc:"TRANSPORT CHARGES",norm:"transport charges",cat:"Other",spec:"",pack:"6",unit:"NOS",qty:6,rate:240,gst:18}];for(let c of j){let e=`prod_${c.code.toLowerCase().replace("-","_")}`;await a.execute({sql:`INSERT OR IGNORE INTO products (
        id, item_code, description, normalized_name, category, specification, pack, 
        unit, default_rate, default_gst_rate, is_active, last_verified_date, 
        last_verified_source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,args:[e,c.code,c.desc,(0,g.o1)(c.desc),c.cat,c.spec,c.pack,c.unit,c.rate,c.gst,1,"2026-10-15","Rate Card JPA-74 - Marina Mall",b,b]}),await a.execute({sql:`INSERT OR IGNORE INTO rate_change_history (
        id, product_id, old_rate, new_rate, change_date, source_quote_number, changed_by, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,args:[`hist_${e}_init`,e,c.rate,c.rate,"2026-10-15","JPA-74","JPA Administrator","Quoted for Lifestyle Marina Mall",b]}),d&&await a.execute({sql:`INSERT OR IGNORE INTO product_rates (
          id, product_id, customer_id, rate, effective_from, source_quote_number, change_reason, updated_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,args:[`rate_${e}_lifestyle`,e,"cust_lifestyle_marina",c.rate,"2026-10-15","JPA-74","Approved Rate Card JPA-74","JPA Administrator",b]})}if(!d)return;let k="qte_jpa_74";await a.execute({sql:`INSERT INTO quotations (
      id, quote_number, company_profile_id, customer_id, customer_name, customer_address, 
      customer_gstin, store_name, quote_date, validity_date, reference_no, status, 
      currency, subtotal, gst_total, round_off, grand_total, tax_type, 
      terms_payment, terms_delivery, terms_validity, terms_transport, terms_gst, 
      notes, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,args:[k,"JPA-74","cmp_jpa_master","cust_lifestyle_marina","LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)","13/1A, EGATTUR, OMR, CHENNAI - 603103.","33AAACL1234F1Z9","LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)","2026-10-15","2026-10-30","PRASANTH P, HOME CENTRE, LANDMARK GROUP","approved","INR",14741,2623.22,.38,17353,"exclusive","As agreed.","Immediate.","15 days from quotation date.","Extra, if applicable.","Extra as Applicable","RATE CARD RC Number: JPA-74 for Lifestyle Marina Mall","usr_admin_1",b,b]});let l="sec_jpa_74_stationary";await a.execute({sql:`INSERT INTO quotation_sections (id, quotation_id, section_name, sort_order, subtotal, gst_total, section_total, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,args:[l,k,"Stationary",1,14741,2623.22,17353,b]});let m=1;for(let c of j){let d=`prod_${c.code.toLowerCase().replace("-","_")}`,e=Number((c.qty*c.rate).toFixed(2)),f=Number((e*(c.gst/100)).toFixed(2)),g=Number((e+f).toFixed(2));await a.execute({sql:`INSERT INTO quotation_items (
        id, quotation_id, section_id, sort_order, store_name, description, 
        specification, pack, quantity, unit, unit_rate, gst_rate, 
        taxable_amount, gst_amount, line_total, product_id, is_rate_autofilled, 
        saved_rate_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,args:[`item_jpa_74_${m}`,k,l,m,"LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)",c.desc,c.spec,c.pack,c.qty,c.unit,c.rate,c.gst,e,f,g,d,1,"2026-10-15",b]}),m++}}d()}catch(a){d(a)}})},41643:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.d(b,{BR:()=>k,EJ:()=>l,GQ:()=>j,Wq:()=>i,o1:()=>h});var e=c(48769),f=c(48936),g=a([e]);function h(a){return a?a.toLowerCase().replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim():""}async function i(a){let b=a||(0,e.L)(),c=await b.execute(`
    SELECT id, item_code 
    FROM products 
    WHERE is_active = 1
    ORDER BY 
      CASE 
        WHEN item_code LIKE 'JPA-%' THEN CAST(SUBSTR(item_code, 5) AS INTEGER)
        WHEN item_code LIKE '%-%' THEN 900000 + CAST(SUBSTR(item_code, INSTR(item_code, '-') + 1) AS INTEGER)
        ELSE 999999
      END ASC,
      created_at ASC,
      id ASC
  `);if(!c.rows||0===c.rows.length)return;let d=[];for(let a=0;a<c.rows.length;a++){let b=c.rows[a],e=`JPA-${String(a+1).padStart(3,"0")}`;String(b.item_code||"").trim()!==e&&d.push({id:String(b.id),targetCode:e})}if(0!==d.length)for(let a of d)await b.execute({sql:"UPDATE products SET item_code = ? WHERE id = ?",args:[a.targetCode,a.id]})}async function j(a){let b=a||(0,e.L)();await i(b);let c=await b.execute("SELECT COUNT(*) as cnt FROM products WHERE is_active = 1"),d=Number(c.rows[0]?.cnt||0);return`JPA-${String(d+1).padStart(3,"0")}`}async function k(a){let b=h(a.description);if(!b||b.length<2)return{matched:!1,confidence:"none"};let c=(0,e.L)(),d=await c.execute({sql:"SELECT * FROM products WHERE normalized_name = ? AND is_active = 1 LIMIT 1",args:[b]});if(0===d.rows.length&&(d=await c.execute({sql:`SELECT p.* FROM products p 
            INNER JOIN product_aliases a ON p.id = a.product_id 
            WHERE LOWER(a.alias_text) = ? AND p.is_active = 1 LIMIT 1`,args:[b]})),0===d.rows.length&&(d=await c.execute({sql:`SELECT * FROM products 
            WHERE is_active = 1 AND (normalized_name LIKE ? OR ? LIKE ('%' || normalized_name || '%'))
            ORDER BY LENGTH(normalized_name) DESC LIMIT 1`,args:[`%${b}%`,b]})),0===d.rows.length){if(a.customerId)try{let d=await c.execute({sql:"SELECT id, company_name, folder_name FROM customers WHERE id = ?",args:[a.customerId]}),e=[a.customerId],g="";if(d.rows.length>0){let b=d.rows[0],h=b.folder_name?String(b.folder_name).trim():"",i=String(b.company_name||"");if(g=h||(0,f.mY)(i)){let b=await c.execute({sql:`SELECT id FROM customers 
                    WHERE id = ? 
                       OR (folder_name IS NOT NULL AND LOWER(folder_name) = LOWER(?))
                       OR LOWER(company_name) LIKE ?`,args:[a.customerId,g,`%${g.toLowerCase()}%`]});e=Array.from(new Set([a.customerId,...b.rows.map(a=>String(a.id))]))}}let h=e.map(()=>"?").join(","),i=await c.execute({sql:`SELECT qi.description, qi.specification, qi.pack, qi.unit, qi.unit_rate, qi.gst_rate, q.quote_date, q.quote_number
                FROM quotation_items qi
                JOIN quotations q ON qi.quotation_id = q.id
                WHERE (
                  q.customer_id IN (${h})
                  ${g?"OR LOWER(q.customer_name) LIKE ?":""}
                )
                AND (
                  LOWER(qi.description) = ?
                  OR LOWER(qi.description) LIKE ?
                  OR ? LIKE ('%' || LOWER(qi.description) || '%')
                )
                AND qi.unit_rate > 0
                ORDER BY q.quote_date DESC, q.created_at DESC LIMIT 1`,args:g?[...e,`%${g.toLowerCase()}%`,b,`%${b}%`,b]:[...e,b,`%${b}%`,b]});if(i.rows.length>0){let a=i.rows[0],b=String(a.quote_date||""),c=String(a.quote_number||""),d=b?`Saved rate (${g||"Client"}) \xb7 ${b}`:"Saved rate";return{matched:!0,confidence:"high",description:String(a.description),specification:a.specification?String(a.specification):void 0,pack:a.pack?String(a.pack):void 0,unit:String(a.unit||"Nos"),rate:Number(a.unit_rate),gstRate:Number(a.gst_rate||18),savedRateDate:b,sourceQuoteNumber:c,badgeText:d}}}catch(a){console.error("Error finding unlisted company rate:",a)}return{matched:!1,confidence:"none"}}let g=d.rows[0],i=String(g.id),j=Number(g.default_rate),k=g.last_verified_source?String(g.last_verified_source):void 0,l=g.last_verified_date?String(g.last_verified_date):void 0;if(a.customerId)try{let d=await c.execute({sql:"SELECT id, company_name, folder_name FROM customers WHERE id = ?",args:[a.customerId]}),e=[a.customerId],g="";if(d.rows.length>0){let b=d.rows[0],h=b.folder_name?String(b.folder_name).trim():"",i=String(b.company_name||"");if(g=h||(0,f.mY)(i)){let b=await c.execute({sql:`SELECT id FROM customers 
                  WHERE id = ? 
                     OR (folder_name IS NOT NULL AND LOWER(folder_name) = LOWER(?))
                     OR LOWER(company_name) LIKE ?`,args:[a.customerId,g,`%${g.toLowerCase()}%`]});e=Array.from(new Set([a.customerId,...b.rows.map(a=>String(a.id))]))}}let h=e.map(()=>"?").join(","),m=await c.execute({sql:`SELECT rate, effective_from, source_quote_number FROM product_rates 
              WHERE product_id = ? AND customer_id IN (${h})
              ORDER BY effective_from DESC, created_at DESC LIMIT 1`,args:[i,...e]});if(m.rows.length>0)j=Number(m.rows[0].rate),l=String(m.rows[0].effective_from),k=m.rows[0].source_quote_number?String(m.rows[0].source_quote_number):k;else{let a=await c.execute({sql:`SELECT qi.unit_rate, qi.gst_rate, q.quote_date, q.quote_number, q.customer_name
                FROM quotation_items qi
                JOIN quotations q ON qi.quotation_id = q.id
                WHERE (
                  q.customer_id IN (${h})
                  ${g?"OR LOWER(q.customer_name) LIKE ?":""}
                )
                AND (
                  LOWER(qi.description) = ?
                  OR qi.product_id = ?
                  OR LOWER(qi.description) LIKE ?
                )
                AND qi.unit_rate > 0
                ORDER BY q.quote_date DESC, q.created_at DESC LIMIT 1`,args:g?[...e,`%${g.toLowerCase()}%`,b,i,`%${b}%`]:[...e,b,i,`%${b}%`]});a.rows.length>0&&(j=Number(a.rows[0].unit_rate),l=String(a.rows[0].quote_date),k=String(a.rows[0].quote_number))}}catch(a){console.error("Error matching company rates:",a)}let m=l?`Saved rate \xb7 ${l}`:"Saved rate";return{matched:!0,confidence:g.normalized_name===b?"exact":"high",productId:i,description:String(g.description),specification:g.specification?String(g.specification):void 0,pack:g.pack?String(g.pack):void 0,unit:String(g.unit),rate:j,gstRate:Number(g.default_gst_rate),savedRateDate:l,sourceQuoteNumber:k,badgeText:m}}async function l(a,b,c,d,f="Staff",g){let j=g||(0,e.L)(),k=new Date().toISOString(),m=await j.execute("SELECT COUNT(*) as cnt FROM products WHERE is_active = 1"),n=Number(m.rows[0]?.cnt||0)+1;for(let e of a){let a=e.description?.trim(),g=Number(e.unitRate)||0,i=Number(e.gstRate??18),l=e.unit?.trim()||"Nos";if(!a||g<=0)continue;let m=h(a),o=await j.execute({sql:"SELECT id, default_rate, default_gst_rate FROM products WHERE normalized_name = ? LIMIT 1",args:[m]});if(o.rows.length>0){let a=String(o.rows[0].id),h=Number(o.rows[0].default_rate);d&&await j.execute({sql:`INSERT INTO product_rates (id, product_id, customer_id, rate, effective_from, source_quote_number, change_reason, updated_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,args:[`prate_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,a,d,g,c,b,"Quotation Rate Entry",f,k]}),Math.abs(h-g)>.001||Number(o.rows[0].default_gst_rate)!==i?(await j.execute({sql:`INSERT INTO rate_change_history (
            id, product_id, old_rate, new_rate, change_date, source_quote_number, changed_by, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,args:[`hist_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,a,h,g,c,b,f,`Rate updated via Quotation ${b}`,k]}),await j.execute({sql:`UPDATE products SET 
                default_rate = ?, 
                default_gst_rate = ?, 
                specification = COALESCE(?, specification),
                pack = COALESCE(?, pack),
                unit = COALESCE(?, unit),
                last_verified_date = ?, 
                last_verified_source = ?, 
                updated_at = ? 
                WHERE id = ?`,args:[g,i,e.specification?.trim()||null,e.pack?.trim()||null,l?.trim()||null,c,b,k,a]})):(e.specification||e.pack||e.unit)&&await j.execute({sql:`UPDATE products SET 
                specification = COALESCE(?, specification),
                pack = COALESCE(?, pack),
                unit = COALESCE(?, unit),
                updated_at = ? 
                WHERE id = ?`,args:[e.specification?.trim()||null,e.pack?.trim()||null,l?.trim()||null,k,a]})}else{let d=`prod_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,h=`JPA-${String(n++).padStart(3,"0")}`,o=a.toLowerCase().includes("paper")||a.toLowerCase().includes("pen")||a.toLowerCase().includes("stapler")?"Stationery":"Housekeeping";await j.execute({sql:`INSERT INTO products (
          id, item_code, description, normalized_name, category, specification, pack, unit, 
          default_rate, default_gst_rate, is_active, last_verified_date, 
          last_verified_source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,args:[d,h,a,m,o,e.specification?.trim()||null,e.pack?.trim()||null,l,g,i,c,b,k,k]}),await j.execute({sql:`INSERT INTO rate_change_history (
          id, product_id, old_rate, new_rate, change_date, source_quote_number, changed_by, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,args:[`hist_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,d,g,g,c,b,f,`Initial product and verified rate learned from Quotation ${b}`,k]})}}await i(j)}e=(g.then?(await g)():g)[0],d()}catch(a){d(a)}})},48769:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.d(b,{L:()=>l,y:()=>k});var e=c(28855),f=c(33873),g=c.n(f),h=c(29021),i=c.n(h),j=a([e]);e=(j.then?(await j)():j)[0];let m=null,n=null;function k(){return process.env.JPA_DATA_DIR?g().resolve(process.env.JPA_DATA_DIR):process.env.VERCEL?"/tmp/jpa-data":g().resolve(g().join(process.cwd(),"data"))}function l(){if(process.env.TURSO_DATABASE_URL||process.env.LIBSQL_URL){let a=process.env.TURSO_DATABASE_URL||process.env.LIBSQL_URL,b=process.env.TURSO_AUTH_TOKEN||process.env.LIBSQL_AUTH_TOKEN;return m&&n===a||(m=(0,e.createClient)({url:a,authToken:b}),n=a),m}let a=k();if(m&&n===a)return m;i().existsSync(a)||i().mkdirSync(a,{recursive:!0});let b=g().join(a,"jpa_quote.db");return m=(0,e.createClient)({url:`file:${b.replace(/\\/g,"/")}`}),n=a,m}d()}catch(a){d(a)}})},48936:(a,b,c)=>{"use strict";function d(a){if(!a)return"";let b=a.trim();return(b=(b=b.replace(/\s*-\s*.*$/i,"").trim()).replace(/\s*pvt\.?\s*ltd\.?/gi,"").replace(/\s*p\s*ltd\.?/gi,"").replace(/\s*private\s*limited/gi,"").replace(/\s*limited/gi,"").replace(/\(h\/c\)/gi,"").replace(/[.,/()_-]+$/g,"").trim(),/^life\s*style/i.test(b))?"Lifestyle International":b}function e(a){if(!a)return"";let b=String(a).replace(/\D/g,"");return 12===b.length&&b.startsWith("91")?b.slice(2):11===b.length&&b.startsWith("0")?b.slice(1):b}function f(a){if(!a)return"";let b=e(a);return 10===b.length?`+91 ${b}`:String(a).trim()}c.d(b,{h2:()=>e,mY:()=>d,n4:()=>f})},78335:()=>{},96487:()=>{}};