import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedDb } from '../src/lib/db/seed';
import { getDb } from '../src/lib/db/client';
import { normalizeUnit, exactCatalogMatch, parseLocalOcrText, validateExtractedItems, detectCategoryFromContent } from '../src/lib/ai/extractor';

test('Parseur extraction handles screenshot table columns (item_description, unit_of_measure, default GST 18)', async () => {
  await seedDb();
  const catalog = (
    await getDb().execute(
      'SELECT description, specification, pack, default_rate, default_gst_rate, unit, category FROM products WHERE is_active = 1'
    )
  ).rows;

  // The actual JSON Parseur returned for the user's uploaded screenshot of the quote:
  const parseurOutput = {
    items: [
      { item_number: '1', item_description: 'A4 Sheet 80 GSM', quantity: 20.0, unit_of_measure: 'Rims' },
      { item_number: '2', item_description: 'A4 Sheet 75 GSM', quantity: 40.0, unit_of_measure: 'Rims' },
      { item_number: '3', item_description: 'Natraj Classic Use & Throw Ball Pen', quantity: 40.0, unit_of_measure: 'Nos' },
      { item_number: '4', item_description: 'Pencil', quantity: 1.0, unit_of_measure: 'box' },
      { item_number: '5', item_description: 'Whitner', quantity: 2.0, unit_of_measure: 'Qty' },
      { item_number: '6', item_description: 'scissors-small', quantity: 5.0, unit_of_measure: 'Qty' },
      { item_number: '7', item_description: 'scissors-Medium', quantity: 5.0, unit_of_measure: 'Qty' },
      { item_number: '8', item_description: 'Ink pad', quantity: 2.0, unit_of_measure: 'Qty' },
      { item_number: '9', item_description: 'Knife-Cutter', quantity: 10.0, unit_of_measure: 'Qty' },
      { item_number: '10', item_description: 'Permanant Marker', quantity: 10.0, unit_of_measure: 'Qty' }
    ]
  };

  // Test unit normalization for all units mentioned by user:
  // (kgs, nos, packs, pcs, lts, reams, rims, box, qty)
  assert.equal(normalizeUnit('kgs'), 'Kg');
  assert.equal(normalizeUnit('nos'), 'Nos');
  assert.equal(normalizeUnit('packs'), 'Pkt');
  assert.equal(normalizeUnit('pack'), 'Pkt');
  assert.equal(normalizeUnit('pcs'), 'Nos');
  assert.equal(normalizeUnit('lts'), 'Ltr');
  assert.equal(normalizeUnit('lt'), 'Ltr');
  assert.equal(normalizeUnit('reams'), 'Ream');
  assert.equal(normalizeUnit('Rims'), 'Ream');
  assert.equal(normalizeUnit('box'), 'Box');
  assert.equal(normalizeUnit('Qty'), 'Nos');

  // Verify fields are correctly mapped from Parseur output
  const items = parseurOutput.items.map((item: any, idx: number) => {
    const desc = item.item_description || item.description || item.MATERIALS || item.materials || 'Item';
    const spec = item.specification || item.Specification || item.spec || undefined;
    const pack = item.pack || item.Pack || undefined;
    const qty = item.quantity != null ? Number(item.quantity) : null;
    const unit = normalizeUnit(item.unit_of_measure || item.unit);
    let rate = item.rate != null ? Number(item.rate) : null;
    let gst = item.gst_rate != null ? Number(item.gst_rate) : null;

    const product = exactCatalogMatch(catalog, desc, spec, pack, unit);
    if (rate == null && product?.default_rate != null) rate = Number(product.default_rate);
    if (gst == null) {
      gst = product?.default_gst_rate != null ? Number(product.default_gst_rate) : 18;
    }

    const category = (product?.category as any) || detectCategoryFromContent(desc, 'Screenshot.png');

    return {
      id: `ext_test_${idx + 1}`,
      description: desc,
      specification: spec,
      pack: pack,
      quantity: qty,
      unit,
      rate,
      gstRate: gst,
      sourceAmount: null,
      sourcePage: 1,
      confidence: 'high' as const,
      warnings: [],
      suggestedCategory: category,
    };
  });

  const validated = validateExtractedItems(items);
  assert.equal(validated.length, 10);

  // Item 1: A4 Sheet 80 GSM
  assert.equal(validated[0].description, 'A4 Sheet 80 GSM');
  assert.equal(validated[0].quantity, 20);
  assert.equal(validated[0].unit, 'Ream');
  assert.equal(validated[0].gstRate, 18, 'Must default GST to 18% as requested');
  assert.equal(validated[0].suggestedCategory, 'Stationery');

  // Item 2: A4 Sheet 75 GSM
  assert.equal(validated[1].description, 'A4 Sheet 75 GSM');
  assert.equal(validated[1].quantity, 40);
  assert.equal(validated[1].unit, 'Ream');
  assert.equal(validated[1].gstRate, 18);

  // Item 3: Natraj Ball Pen
  assert.equal(validated[2].description, 'Natraj Classic Use & Throw Ball Pen');
  assert.equal(validated[2].quantity, 40);
  assert.equal(validated[2].unit, 'Nos');
  assert.equal(validated[2].gstRate, 18);

  // Item 4: Pencil (unit: box -> Box)
  assert.equal(validated[3].description, 'Pencil');
  assert.equal(validated[3].quantity, 1);
  assert.equal(validated[3].unit, 'Box');
  assert.equal(validated[3].gstRate, 18);

  // Item 5: Whitner (unit: Qty -> Nos)
  assert.equal(validated[4].description, 'Whitner');
  assert.equal(validated[4].quantity, 2);
  assert.equal(validated[4].unit, 'Nos');
  assert.equal(validated[4].gstRate, 18);

  // Item 10: Permanant Marker
  assert.equal(validated[9].description, 'Permanant Marker');
  assert.equal(validated[9].quantity, 10);
  assert.equal(validated[9].unit, 'Nos');
  assert.equal(validated[9].gstRate, 18);
  assert.equal(validated[9].suggestedCategory, 'Stationery');
});

test('OCR pipe table parser handles screenshot rows with units and 18% GST', () => {
  const pipeTable = `
| S.NO | MATERIALS | Description | QTY | Kg/Ltr/ Nos |
| 1 | A4 Sheet 80 GSM | | 20 | Rims |
| 2 | A4 Sheet 75 GSM | | 40 | Rims |
| 3 | Natraj Classic Use & Throw Ball Pen | | 40 | Nos |
| 4 | Pencil | | 1 | box |
| 5 | Whitner | | 2 | Qty |
| 6 | scissors-small | | 5 | Qty |
| 7 | scissors-Medium | | 5 | Qty |
| 8 | Ink pad | | 2 | Qty |
| 9 | Knife-Cutter | | 10 | Qty |
| 10 | Permanant Marker | | 10 | Qty |
  `.trim();

  const ocrItems = parseLocalOcrText(pipeTable, [], 'test_ocr');
  assert.equal(ocrItems.length, 10, 'Must extract all 10 items from pipe table');
  assert.equal(ocrItems[0].description, 'A4 Sheet 80 GSM');
  assert.equal(ocrItems[0].quantity, 20);
  assert.equal(ocrItems[0].unit, 'Ream');
  assert.equal(ocrItems[0].suggestedCategory, 'Stationery');

  assert.equal(ocrItems[3].description, 'Pencil');
  assert.equal(ocrItems[3].quantity, 1);
  assert.equal(ocrItems[3].unit, 'Box');

  assert.equal(ocrItems[4].description, 'Whitner');
  assert.equal(ocrItems[4].quantity, 2);
  assert.equal(ocrItems[4].unit, 'Nos');

  assert.equal(ocrItems[9].description, 'Permanant Marker');
  assert.equal(ocrItems[9].quantity, 10);
  assert.equal(ocrItems[9].unit, 'Nos');
  assert.equal(ocrItems[9].suggestedCategory, 'Stationery');
});


test('Varying Future Items: dynamic extraction adapts to arbitrary future items across Housekeeping, Industrial, Electrical & custom headers', () => {
  // Test diverse varying items that may be uploaded in future quotes
  const futureVaryingRows = [
    // Housekeeping chemicals & consumables
    { 'Material Description': 'Floor Cleaner Concentrate 5 Ltr Can', 'Order Qty': 10, 'Packaging': 'Cans' },
    { 'Item Name': 'Lizol Surface Disinfectant Floral', 'Quantity': 25, 'UOM': 'Bottles', 'Tax Rate': 18 },
    { 'Particulars': 'Garbage Bags Heavy Duty 36x48 Black', 'Qty': 50, 'Unit': 'kgs' },
    { 'Description': 'Urinal Screen Mat Ocean Fragrance', 'Quantity': 20, 'Unit of Measure': 'Nos' },
    
    // Industrial safety & packing supplies
    { 'Product Title': 'Karam Safety Shoes Steel Toe Size 9', 'Order Quantity': 15, 'Unit': 'pairs' },
    { 'Article': 'Industrial Cotton Waste White', 'Volume': 100, 'Measure': 'kgs' },
    { 'Nomenclature': 'Stretch Film Roll Manual 500mm', 'Count': 12, 'Units': 'rolls' },
    
    // Electrical & maintenance
    { 'Goods Description': 'Philips LED Tube Light 20W Cool White', 'Req Qty': 40, 'Unit': 'pcs' },
    { 'Product': 'Anchor Modular Switch 6A 1 Way', 'Quantity': 50, 'UOM': 'Nos' },
    { 'Item Details': 'Steel Grip PVC Electrical Insulation Tape', 'Qty': 30, 'Unit': 'rolls' },
  ];

  const parsed = futureVaryingRows.map((row, idx) => {
    const { extractDynamicRowFields } = require('../src/lib/ai/extractor');
    const fields = extractDynamicRowFields(row);
    return {
      id: `ext_future_${idx + 1}`,
      description: fields.description,
      specification: fields.specification,
      pack: fields.pack,
      quantity: fields.quantity,
      unit: fields.unit,
      rate: fields.rate,
      gstRate: fields.gstRate ?? 18,
      sourceAmount: fields.sourceAmount,
      sourcePage: 1,
      confidence: 'high' as const,
      warnings: [],
      suggestedCategory: detectCategoryFromContent(fields.description),
    };
  });

  const validated = validateExtractedItems(parsed);
  assert.equal(validated.length, 10, 'All 10 diverse future items must be extracted');

  // Verify Housekeeping items
  assert.equal(validated[0].description, 'Floor Cleaner Concentrate 5 Ltr Can');
  assert.equal(validated[0].quantity, 10);
  assert.equal(validated[0].unit, 'Can');
  assert.equal(validated[0].suggestedCategory, 'Housekeeping');

  assert.equal(validated[2].description, 'Garbage Bags Heavy Duty 36x48 Black');
  assert.equal(validated[2].quantity, 50);
  assert.equal(validated[2].unit, 'Kg');
  assert.equal(validated[2].suggestedCategory, 'Housekeeping');

  // Verify Industrial items
  assert.equal(validated[4].description, 'Karam Safety Shoes Steel Toe Size 9');
  assert.equal(validated[4].quantity, 15);
  assert.equal(validated[4].unit, 'Pair');
  assert.equal(validated[4].suggestedCategory, 'Industrial');

  assert.equal(validated[6].description, 'Stretch Film Roll Manual 500mm');
  assert.equal(validated[6].quantity, 12);
  assert.equal(validated[6].unit, 'Roll');
  assert.equal(validated[6].suggestedCategory, 'Industrial');

  // Verify Electrical items
  assert.equal(validated[7].description, 'Philips LED Tube Light 20W Cool White');
  assert.equal(validated[7].quantity, 40);
  assert.equal(validated[7].unit, 'Nos');
  assert.equal(validated[7].suggestedCategory, 'Electrical');

  // Verify All have default 18% GST
  for (const item of validated) {
    assert.equal(item.gstRate, 18, 'Must default GST to 18%');
  }
});

test('Universal OCR Table: handles multi-space, tab and pipe delimited text with varying items', () => {
  const multiSpaceTable = `
S.No    Particulars                     Qty     Unit
1       Floor Duster Cloth 24x24        50      Nos
2       Bleaching Powder ISI            25      Kgs
3       Hand Wash Liquid Rose 5 Ltr     4       Cans
4       Wet Floor Caution Sign Board    6       Nos
  `.trim();

  const ocrItems = parseLocalOcrText(multiSpaceTable, [], 'test_universal');
  assert.equal(ocrItems.length, 4, 'Must parse 4 multi-space table rows');
  assert.equal(ocrItems[0].description, 'Floor Duster Cloth 24x24');
  assert.equal(ocrItems[0].quantity, 50);
  assert.equal(ocrItems[0].unit, 'Nos');
  assert.equal(ocrItems[0].suggestedCategory, 'Housekeeping');

  assert.equal(ocrItems[1].description, 'Bleaching Powder ISI');
  assert.equal(ocrItems[1].quantity, 25);
  assert.equal(ocrItems[1].unit, 'Kg');

  assert.equal(ocrItems[2].description, 'Hand Wash Liquid Rose 5 Ltr');
  assert.equal(ocrItems[2].quantity, 4);
  assert.equal(ocrItems[2].unit, 'Can');
});
