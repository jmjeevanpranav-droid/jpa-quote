import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('Quotation section headers use "Particulars" and default GST to 18%', () => {
  const newPage = readFileSync(path.join(process.cwd(), 'src/app/quotations/new/page.tsx'), 'utf-8');
  const editPage = readFileSync(path.join(process.cwd(), 'src/app/quotations/[id]/edit/page.tsx'), 'utf-8');
  const preview = readFileSync(path.join(process.cwd(), 'src/components/LiveQuotationPreview.tsx'), 'utf-8');

  // 1. Check Particulars header
  assert.ok(newPage.includes('>Particulars</th>'), 'New page must have Particulars header');
  assert.ok(editPage.includes('>Particulars</th>'), 'Edit page must have Particulars header');
  assert.ok(preview.includes('<th className="py-2.5 px-3">Particulars</th>'), 'Preview must have Particulars header');

  // 2. Check "Clear All" button exists in section header & footer
  assert.ok(newPage.includes('<span>Clear All</span>'), 'New page must have Clear All button');
  assert.ok(editPage.includes('<span>Clear All</span>'), 'Edit page must have Clear All button');

  // 3. Check "AI Import Items" button exists near each section
  assert.ok(newPage.includes('<span>AI Import Items</span>'), 'New page must have AI Import Items button near section');
  assert.ok(editPage.includes('<span>AI Import Items</span>'), 'Edit page must have AI Import Items button near section');

  // 4. Check GST defaults to 18% when adding section or item
  assert.ok(newPage.includes('gstRate: 18'), 'New page must default gstRate to 18');
  assert.ok(editPage.includes('gstRate: 18'), 'Edit page must default gstRate to 18');
});

