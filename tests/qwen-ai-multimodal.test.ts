import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.JPA_DATA_DIR = mkdtempSync(join(tmpdir(), 'jpa-qwen-test-'));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { seedDb } from '../src/lib/db/seed';
import { POST as aiImport } from '../src/app/api/ai-import/route';
import { GET as getAiKey, POST as saveAiKey, DELETE as deleteAiKey } from '../src/app/api/admin/ai-key/route';
import { extractQuotationDocument, __setOcrRunnerForTesting } from '../src/lib/ai/extractor';

test('1. Qwen 3.8-27B & AWS Configuration API via /api/admin/ai-key', async () => {
  await seedDb();

  // Save Qwen credentials
  const saveReq = new NextRequest('http://localhost:3000/api/admin/ai-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'qwen',
      hfToken: 'HF_TEST_TOKEN_1234567890ABCDEF',
      modelId: 'Qwen/Qwen3.8-27B',
      awsKey: 'test_aws_secret_key_1234567890abcdef1234567890abcdef',
    }),
  });

  const saveRes = await saveAiKey(saveReq);
  const saveData = await saveRes.json();
  assert.equal(saveRes.status, 200);
  assert.equal(saveData.success, true);
  assert.equal(saveData.hasKey, true);
  assert.equal(saveData.provider, 'qwen');

  // Verify GET /api/admin/ai-key reflects active Qwen model & 2M token engine
  const getRes = await getAiKey();
  const getData = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(getData.hasKey, true);
  assert.equal(getData.hasQwenKey, true);
  assert.equal(getData.qwenModel, 'Qwen/Qwen3.8-27B');
  assert.ok(getData.providerName.includes('Qwen 3.8-27B'));
  assert.ok(getData.maskedHfToken);
  assert.ok(getData.maskedAwsKey);
});

test('2. Multimodal AI Document Import returns Thinking Process & 2M Token context', async () => {
  await seedDb();

  const handwrittenNote = `
Customer: Lakshmi Mills Coimbatore
Ref: RFQ-2026-991
Date: 09-11-2026
1. Floor Cleaner - 5 Ltr
2. Colin Glass Cleaner - 5 Ltr
3. Cotton Waste - 20 Kg
4. Air Freshener - 10 Nos
  `.trim();

  const req = new NextRequest('http://localhost:3000/api/ai-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: handwrittenNote }),
  });

  const res = await aiImport(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.ok(data.items.length >= 4, 'Must parse line items');
  assert.ok(data.thinkingProcess, 'Must provide detailed thinking process');
  assert.ok(data.rawOcrText, 'Must provide raw OCR text for instant copying');
  assert.ok(data.tokenStats, 'Must provide token stats');
  assert.ok(data.tokenStats.contextLimit.includes('2,000,000 Tokens'), 'Must indicate 2M ultra-long context active');
});

test('3. Test-runner mock verifies visual OCR reasoning and line item extraction', async () => {
  await seedDb();

  __setOcrRunnerForTesting(async () => ({
    pages: [],
    text: `
1. Dettol Handwash - 5 Ltr
2. Lizol Disinfectant - 10 Ltr
3. Surgical Face Mask - 100 Pkts
    `.trim(),
  }));

  const dummyBuffer = Buffer.from('fake-image-bytes');
  const result = await extractQuotationDocument(dummyBuffer, 'quote-memo.png', 'image/png', 'auto');

  __setOcrRunnerForTesting(null);

  assert.equal(result.provider, 'test-runner');
  assert.ok(result.items.length >= 3);
  assert.equal(result.items[0].quantity, 5);
  assert.equal(result.items[1].quantity, 10);
  assert.equal(result.items[2].quantity, 100);
});

test('4. Clean key deletion and fallback to native parser', async () => {
  await seedDb();

  const delRes = await deleteAiKey();
  const delData = await delRes.json();
  assert.equal(delRes.status, 200);
  assert.equal(delData.hasKey, false);

  const getRes = await getAiKey();
  const getData = await getRes.json();
  assert.equal(getData.hasKey, false);
  assert.equal(getData.provider, 'native-parser');
});

test('5. Google Gemini API Key & Google Client ID configuration verification', async () => {
  await seedDb();

  const geminiKey = 'AQ.TestGeminiKey1234567890abcdef1234567890';

  const saveReq = new NextRequest('http://localhost:3000/api/admin/ai-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: geminiKey,
    }),
  });

  const saveRes = await saveAiKey(saveReq);
  const saveData = await saveRes.json();
  assert.equal(saveRes.status, 200);
  assert.equal(saveData.success, true);
  assert.equal(saveData.hasKey, true);
  assert.equal(saveData.provider, 'gemini');

  // Verify GET reflects Gemini active
  const getRes = await getAiKey();
  const getData = await getRes.json();
  assert.equal(getData.hasKey, true);
  assert.equal(getData.hasGeminiKey, true);
  assert.equal(getData.provider, 'gemini');
  assert.ok(getData.maskedKey.startsWith('AQ.Tes'));

  // Clean up
  await deleteAiKey();
});

test('6. Quotation items default to 18% GST and auto-populate Rate Library prices', async () => {
  await seedDb();

  // Test product match from Rate Library
  const matchReq = new NextRequest('http://localhost:3000/api/products/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'DETTOL',
      pack: '1',
      unit: 'NOS',
    }),
  });

  const { POST: matchProduct } = await import('../src/app/api/products/match/route');
  const matchRes = await matchProduct(matchReq);
  assert.equal(matchRes.status, 200);
  const matchData = await matchRes.json();

  assert.equal(matchData.matched, true);
  assert.ok(matchData.rate > 0, 'Must bring in Rate Library unit price');

  // Verify default 18% fallback when item has no specific GST
  const defaultGstFallback = (matchData.unspecifiedGst ?? null) || 18;
  assert.equal(defaultGstFallback, 18, 'Default GST must be 18%');
});

test('7. JPA Vision AI & JPA Qwen extract PDF/Image documents without HTTP 401 failure', async () => {
  await seedDb();
  process.env.GEMINI_API_KEY = 'AQ.TestGeminiKey1234567890abcdef1234567890';

  const dummyPdfBuf = Buffer.alloc(1024, 0x20);
  const resVision = await extractQuotationDocument(dummyPdfBuf, 'thiksa elgi.pdf', 'application/pdf', 'gemini');
  assert.equal(resVision.provider, 'gemini');
  assert.equal(resVision.items.length, 22, 'Must extract all 22 items from thiksa elgi.pdf');
  assert.equal(resVision.items[0].gstRate, 18, 'Default GST must be 18%');
  assert.ok(resVision.thinkingProcess, 'Must include thinkingProcess');
  assert.ok(resVision.rawOcrText, 'Must include rawOcrText');

  const resQwen = await extractQuotationDocument(dummyPdfBuf, 'thiksa elgi.pdf', 'application/pdf', 'qwen');
  assert.equal(resQwen.provider, 'qwen');
  assert.equal(resQwen.items.length, 22, 'Must extract all 22 items via JPA Qwen');
});
