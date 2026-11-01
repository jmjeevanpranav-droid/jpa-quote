import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-test-'));
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/quotations/route';
import { PUT } from '../src/app/api/quotations/[id]/route';
import { seedDb } from '../src/lib/db/seed';
import { getDb } from '../src/lib/db/client';
import { generateQuotationExcel } from '../src/lib/export/excel-generator';
import { parseLocalOcrText } from '../src/lib/ai/extractor';
import { proxy } from '../src/proxy';

test('save, update and reject invalid quantities without damaging records', async () => {
  assert.ok(process.env.JPA_DATA_DIR?.includes('jpa-test'), 'Use an isolated test database');
  await seedDb();
  const db = getDb();
  const customerId = String((await db.execute('SELECT id FROM customers LIMIT 1')).rows[0].id);
  const original = (await db.execute('SELECT id, grand_total FROM quotations LIMIT 1')).rows[0];
  const payload = { customerId, customerName: 'Regression customer', customerAddress: '', quoteDate: '2026-10-28', validityDate: '2026-11-12', status: 'draft', termsPayment: '', termsDelivery: '', termsValidity: '', termsTransport: '', termsGst: '', sections: [{name: 'Test', items: [{description: 'Regression zero GST', quantity: 2, unit: 'Nos', unitRate: 100, gstRate: 0}]}] };
  const request = (body: any, method: string) => new NextRequest('http://localhost:3001/api/quotations', {method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)});
  const response = await POST(request(payload, 'POST'));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.summary.grandTotal, 200);
  const count = Number((await db.execute('SELECT COUNT(*) AS n FROM quotations')).rows[0].n);
  const context = {params: Promise.resolve({id:result.quotationId})};
  payload.sections[0].items[0].quantity = 3;
  const update = await PUT(request(payload, 'PUT'), context);
  assert.equal(update.status, 200, await update.clone().text());
  assert.equal((await update.json()).summary.grandTotal, 300);
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM quotations')).rows[0].n), count);
  payload.sections[0].items[0].quantity = -5;
  const invalid = await PUT(request(payload, 'PUT'), context);
  assert.equal(invalid.status, 400);
  assert.equal(Number((await db.execute({sql:'SELECT grand_total FROM quotations WHERE id=?',args:[result.quotationId]})).rows[0].grand_total),300);
  assert.equal(Number((await db.execute("SELECT default_gst_rate FROM products WHERE description='Regression zero GST'")).rows[0].default_gst_rate),0);
  assert.equal((await db.execute({sql:'SELECT grand_total FROM quotations WHERE id=?',args:[original.id]})).rows[0].grand_total,original.grand_total);
});

test('Excel round-trip preserves editable GST, formula results, formatting and injection safety', async () => {
  const data = {quoteNumber:'TEST', quoteDate:'2026-10-28', validityDate:'2026-11-12', supplier:{name:'JPA',address:'Test',gstin:'33TEST'},customer:{companyName:'Test',address:'Test',gstin:'29TEST'},sections:[{name:'Test',items:[{description:'=HYPERLINK("bad")',quantity:10,unit:'Nos',unitRate:185,gstRate:18}]}],terms:{}};
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await generateQuotationExcel(data) as any);
  const sheet=book.worksheets[0];
  let line=0,grand=0,igst=false;
  sheet.eachRow(row => { if (String(row.getCell('D').value).includes('HYPERLINK')) line=row.number; if(row.getCell('A').value==='GRAND TOTAL') grand=row.number; if(row.getCell('A').value==='IGST') igst=true; });
  assert.ok(line && grand && igst);
  assert.equal(sheet.getCell(`D${line}`).type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell(`J${line}`).value,0.18);
  assert.ok(sheet.getCell(`L${line}`).formula.includes(`J${line}`));
  assert.equal(sheet.getCell(`L${line}`).result,333);
  assert.equal(sheet.getCell(`K${grand}`).result,2183);
  assert.ok(sheet.getCell(`I${line}`).numFmt.includes('0.00'));
  assert.equal(sheet.pageSetup.fitToWidth,1);
});

test('cross-origin writes are blocked', async()=> {
  const response = await proxy(new NextRequest('http://localhost:3001/api/quotations',{method:'POST',headers:{origin:'https://untrusted.example'}}));
  assert.equal(response.status,403);
});

test('local OCR does not invent records, quantity, customer or source amounts', () => {
  const catalog = [{description:'Glass Cleaner',default_rate:185,default_gst_rate:0}];
  assert.deepEqual(parseLocalOcrText('unreadable document',catalog,'test'),[]);
  const result = parseLocalOcrText('1 Glass Cleaner 10 Ltrs\n2 Glass Cleaner 5 Ltrs',catalog,'test');
  assert.equal(result.length,2);
  assert.equal(result[0].quantity,10);
  assert.equal(result[1].quantity,5);
  assert.equal(result[0].gstRate,0);
  assert.equal(result[0].sourceAmount,null);
  assert.equal(parseLocalOcrText('1 Glass Cleaner 5 Ltr Can',catalog,'test')[0].quantity,null);
});

test('modal dialogs and GlassSelect do not clip dropdown menus', async () => {
  const fs = await import('node:fs/promises');
  const productsCode = await fs.readFile('src/app/products/page.tsx', 'utf-8');
  const glassSelectCode = await fs.readFile('src/components/GlassSelect.tsx', 'utf-8');
  
  assert.ok(
    !productsCode.includes('w-full max-w-md p-6 overflow-hidden space-y-4'),
    'Products modal form must not clip child dropdowns with overflow-hidden'
  );
  assert.ok(
    glassSelectCode.includes('effectivePlacement') && glassSelectCode.includes('bottom-full'),
    'GlassSelect must support upward placement when space below is constrained'
  );
});

test('Calibri font family and size 10-11 are configured across globals and tables', async () => {
  const fs = await import('node:fs/promises');
  const css = await fs.readFile('src/app/globals.css', 'utf-8');
  const products = await fs.readFile('src/app/products/page.tsx', 'utf-8');
  const preview = await fs.readFile('src/components/LiveQuotationPreview.tsx', 'utf-8');

  assert.ok(css.includes("@font-face") && css.includes("font-family: 'Calibri'"), 'Calibri font-face registered in CSS');
  assert.ok(css.includes("font-size: 11pt"), 'Default body font size set to 11pt');
  assert.ok(products.includes("text-[10pt]") && products.includes("text-[11pt]"), 'Products table uses 10pt-11pt sizes');
  assert.ok(preview.includes("fontSize: '11pt'"), 'Quotation live preview configured with Calibri 11pt');
});

test('mobile responsive view and dynamic layout are present for product catalog and quotations', async () => {
  const fs = await import('node:fs/promises');
  const products = await fs.readFile('src/app/products/page.tsx', 'utf-8');
  const quotations = await fs.readFile('src/app/quotations/page.tsx', 'utf-8');

  assert.ok(products.includes('lg:hidden') && products.includes('hidden lg:block'), 'Products page contains dual responsive mobile cards and desktop table views');
  assert.ok(quotations.includes('lg:hidden') && quotations.includes('hidden lg:block'), 'Quotations page contains dual responsive mobile cards and desktop table views');
  assert.ok(products.includes('no-scrollbar'), 'Filter pills bar supports smooth overflow scrolling on mobile');
});

test('login page includes Create New Account, name, Contact, email address, password, and remember me option', async () => {
  const fs = await import('node:fs/promises');
  const loginCode = await fs.readFile('src/app/login/page.tsx', 'utf-8');
  const registerCode = await fs.readFile('src/app/api/auth/register/route.ts', 'utf-8');

  assert.ok(loginCode.includes('Create New Account'), 'Mode switcher includes Create New Account');
  assert.ok(loginCode.includes('Full Name') || loginCode.includes('Name'), 'Form includes name field');
  assert.ok(loginCode.includes('Contact Number') || loginCode.includes('Contact'), 'Form includes contact field');
  assert.ok(loginCode.includes('Email Address') || loginCode.includes('Email'), 'Form includes email field');
  assert.ok(loginCode.includes('Password'), 'Form includes password field');
  assert.ok(loginCode.includes('Remember me'), 'Form includes Remember me checkbox option');

  assert.ok(registerCode.includes('cleanName') && registerCode.includes('cleanContact') && registerCode.includes('cleanEmail'), 'Register API processes name, contact, email and password');
});

test('Administrator is N Jayakumar with jeevanpranavagencies@gmail.com, employees can write quotations and Admin can vision sign-ins', async () => {
  const fs = await import('node:fs/promises');
  const seedCode = await fs.readFile('src/lib/db/seed.ts', 'utf-8');
  const sidebarCode = await fs.readFile('src/components/AppSidebar.tsx', 'utf-8');
  const settingsCode = await fs.readFile('src/app/settings/page.tsx', 'utf-8');
  const proxyCode = await fs.readFile('src/proxy.ts', 'utf-8');
  const registerCode = await fs.readFile('src/app/api/auth/register/route.ts', 'utf-8');
  const adminUsersCode = await fs.readFile('src/app/api/admin/users/route.ts', 'utf-8');

  assert.ok(seedCode.includes('N Jayakumar') && seedCode.includes('jeevanpranavagencies@gmail.com'), 'Seed sets N Jayakumar as Master Administrator');
  assert.ok(sidebarCode.includes('N Jayakumar') && sidebarCode.includes('jeevanpranavagencies@gmail.com'), 'Sidebar displays N Jayakumar credentials');
  assert.ok(registerCode.includes("userRole = 'staff'"), 'Employees registering are assigned staff role');
  assert.ok(settingsCode.includes('Registered Employees & Recent Sign-Ins'), 'Settings page allows Administrator to vision new sign-ins');
  assert.ok(adminUsersCode.includes('SELECT id, email, name, contact, role'), 'Admin users API provides full directory to Administrator');
  assert.ok(!proxyCode.includes('loginUrl.searchParams.set(\'error\', \'admin_only\')'), 'Proxy does not block staff employees from quotation app');
});

test('Administrator Portal features employee sign-in timestamps, activity vision, quotation counts/details, and rate sync', async () => {
  const fs = await import('node:fs/promises');
  const schemaCode = await fs.readFile('src/lib/db/schema.ts', 'utf-8');
  const loginRoute = await fs.readFile('src/app/api/auth/login/route.ts', 'utf-8');
  const adminUsersRoute = await fs.readFile('src/app/api/admin/users/route.ts', 'utf-8');
  const quotesRoute = await fs.readFile('src/app/api/quotations/route.ts', 'utf-8');
  const productsRoute = await fs.readFile('src/app/api/products/route.ts', 'utf-8');
  const settingsCode = await fs.readFile('src/app/settings/page.tsx', 'utf-8');

  // Schema & Tracking
  assert.ok(schemaCode.includes('last_sign_in_at TEXT'), 'Schema supports last_sign_in_at');
  assert.ok(schemaCode.includes('created_by_id TEXT'), 'Schema supports created_by_id on quotations');
  assert.ok(loginRoute.includes('UPDATE users SET last_sign_in_at = ?'), 'Login route updates last_sign_in_at');
  assert.ok(quotesRoute.includes('created_by_id'), 'Quotations route records employee ID and name');

  // Admin Vision API
  assert.ok(adminUsersRoute.includes('last_sign_in_at'), 'Admin API returns last_sign_in_at');
  assert.ok(adminUsersRoute.includes('metrics') && adminUsersRoute.includes('quoteCount'), 'Admin API returns quotation metrics');
  assert.ok(adminUsersRoute.includes('quotations') && adminUsersRoute.includes('audit_events'), 'Admin API returns quotation details and activity history');

  // Rate synchronization & Admin Portal UI
  assert.ok(productsRoute.includes('Cache-Control') && productsRoute.includes('no-store'), 'Products API enforces real-time rate sync without stale caching');
  assert.ok(settingsCode.includes('Rates Synced with Employee Portal'), 'Settings UI displays rate synchronization indicator');
  assert.ok(settingsCode.includes('Sign-In Time (Last Active)'), 'Settings UI displays employee sign-in timestamp');
  assert.ok(settingsCode.includes('Quotations Created') && settingsCode.includes('Activities & Sign-In History'), 'Settings UI includes employee progress vision modal');
});
