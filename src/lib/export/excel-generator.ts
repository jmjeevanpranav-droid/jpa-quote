import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { calculateLineItem, calculateQuotationSummary } from '../calculations/financial';

export interface ExportQuotationData {
  taxType?: 'exclusive' | 'inclusive';
  quoteNumber: string;
  quoteDate: string;
  validityDate: string;
  referenceNo?: string;
  supplier: {
    name: string;
    tagline?: string;
    address: string;
    gstin: string;
    phone?: string;
    email?: string;
    website?: string;
    signatoryName?: string;
    signatoryDesignation?: string;
  };
  customer: {
    companyName: string;
    tradeName?: string;
    address: string;
    gstin?: string;
    storeName?: string;
    storeCode?: string;
    contactPerson?: string;
  };
  sections: Array<{
    name: string;
    items: Array<{
      storeName?: string;
      storeCode?: string;
      description: string;
      specification?: string;
      pack?: string;
      quantity: number;
      unit: string;
      unitRate: number;
      gstRate: number;
    }>;
  }>;
  terms: {
    payment?: string;
    delivery?: string;
    validity?: string;
    transport?: string;
    gst?: string;
  };
  notes?: string;
}

/**
 * Escapes spreadsheet formula injection for user-supplied strings
 */
function sanitizeString(str?: string): string {
  if (!str) return '';
  const trimmed = String(str).trim();
  if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
    return `'${trimmed}`;
  }
  return trimmed;
}

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '';
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) return dateStr;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formats section banner title matching reference (e.g. "HOUSEKEEPING QUOTATION  |  ITEMS & PRICING")
 */
function formatSectionBannerTitle(sectionName: string): string {
  const upper = (sectionName || 'Items').trim().toUpperCase();
  if (upper.includes('QUOTATION')) {
    return `${upper}  |  ITEMS & PRICING`;
  }
  return `${upper} QUOTATION  |  ITEMS & PRICING`;
}

/**
 * Builds a single section worksheet styled strictly after the user's official
 * reference sheet: properly merged cells with zero orphan borders, clean signature
 * canvas, Calibri typography, exact title-cased column headers, and functioning formulas.
 */
function buildSectionWorksheet(
  worksheet: ExcelJS.Worksheet,
  sectionItems: ExportQuotationData['sections'][0]['items'],
  data: ExportQuotationData,
  sectionTitle: string,
  workbook: ExcelJS.Workbook
) {
  // 11 columns: A to K with professional widths matching reference structure
  worksheet.columns = [
    { key: 'A', width: 6 },   // No.
    { key: 'B', width: 14 },  // Store Code (Separate column near to No.)
    { key: 'C', width: 34 },  // Store name
    { key: 'D', width: 38 },  // Particulars (Item description)
    { key: 'E', width: 18 },  // Specifications
    { key: 'F', width: 12 },  // Pack
    { key: 'G', width: 11 },  // Qty.
    { key: 'H', width: 11 },  // Unit
    { key: 'I', width: 15 },  // Unit price ₹
    { key: 'J', width: 11 },  // GST %
    { key: 'K', width: 18 },  // Amount ₹
  ];

  // Professional Vibrant Orange Palette
  const orangeBorder = {
    top: { style: 'thin' as const, color: { argb: 'FFF97316' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFF97316' } },
    left: { style: 'thin' as const, color: { argb: 'FFF97316' } },
    right: { style: 'thin' as const, color: { argb: 'FFF97316' } },
  };

  const mediumOrangeBorder = {
    top: { style: 'medium' as const, color: { argb: 'FFEA580C' } },
    bottom: { style: 'medium' as const, color: { argb: 'FFEA580C' } },
    left: { style: 'medium' as const, color: { argb: 'FFEA580C' } },
    right: { style: 'medium' as const, color: { argb: 'FFEA580C' } },
  };

  const tableHeaderFill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFFBE8D7' }, // #fbe8d7 user-selected warm table header color
  };

  const softOrangeFill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFFBE8D7' }, // #fbe8d7 matching soft warm tint
  };

  const subtleWarmFill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFFFFAF0' }, // Very subtle warm alternating row tint
  };

  // 1. HEADER SECTION (Rows 1 to 9)
  // Embed JPA logo in Column A/B without overlapping text
  const logoPath = path.join(process.cwd(), 'public', 'jpa-header-logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      const logoId = workbook.addImage({
        filename: logoPath,
        extension: 'png',
      });
      worksheet.addImage(logoId, {
        tl: { col: 0.15, row: 0.15 },
        ext: { width: 56, height: 44 },
      });
    } catch {
      // Continue if logo fails
    }
  }

  // Row 1: Company Title & RATE CARD
  worksheet.mergeCells('C1:H1');
  const compTitle = worksheet.getCell('C1');
  compTitle.value = data.supplier.name;
  compTitle.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  compTitle.alignment = { horizontal: 'left', vertical: 'middle' };

  // Only RATE CARD uses Capture Smallz Clean
  worksheet.mergeCells('I1:K1');
  const rateCardTitle = worksheet.getCell('I1');
  rateCardTitle.value = 'RATE CARD';
  rateCardTitle.font = { name: 'Capture Smallz Clean', size: 24, bold: true, color: { argb: 'FFEA580C' } };
  rateCardTitle.alignment = { horizontal: 'right', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // Row 2: Tagline & RC Number
  worksheet.mergeCells('C2:H2');
  const compTagline = worksheet.getCell('C2');
  compTagline.value = data.supplier.tagline || 'Industrial & Housekeeping Supplies';
  compTagline.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FFC2410C' } };
  compTagline.alignment = { horizontal: 'left', vertical: 'middle' };

  worksheet.mergeCells('I2:K2');
  const rcNumCell = worksheet.getCell('I2');
  rcNumCell.value = `RC No: ${data.referenceNo || data.quoteNumber}`;
  rcNumCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF475569' } };
  rcNumCell.alignment = { horizontal: 'right', vertical: 'middle' };
  worksheet.getRow(2).height = 18;

  // Row 4 to 8: Supplier address and contact details (every row cleanly merged A:H)
  worksheet.mergeCells('A4:H4');
  const addrCell = worksheet.getCell('A4');
  addrCell.value = data.supplier.address;
  addrCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF475569' } };

  worksheet.mergeCells('A5:H5');
  const phoneCell = worksheet.getCell('A5');
  phoneCell.value = `Contact: ${data.supplier.phone || '9790600971'}`;
  phoneCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  worksheet.mergeCells('A6:H6');
  const gstinCell = worksheet.getCell('A6');
  gstinCell.value = `GSTIN: ${data.supplier.gstin}`;
  gstinCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  worksheet.mergeCells('A7:H7');
  const emailCell = worksheet.getCell('A7');
  emailCell.value = `Gmail: ${data.supplier.email || 'jeevanpranavagencies@gmail.com'}`;
  emailCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  worksheet.mergeCells('A8:H8');
  const webCell = worksheet.getCell('A8');
  webCell.value = `Website: ${data.supplier.website || 'www.jeevanpranavagencies.com'}`;
  webCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  // Row 9: Crisp Orange Divider Line
  for (let c = 1; c <= 11; c++) {
    const cell = worksheet.getRow(9).getCell(c);
    cell.border = { bottom: { style: 'medium', color: { argb: 'FFEA580C' } } };
  }
  worksheet.getRow(9).height = 6;

  // 2. QUOTATION TO & VALIDITY BLOCK (Rows 11 to 16 - perfectly merged, no orphan rows)
  // Row 11: QUOTATION TO header
  worksheet.mergeCells('A11:H11');
  const qToHeader = worksheet.getCell('A11');
  qToHeader.value = 'QUOTATION TO';
  qToHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFEA580C' } };

  // Row 12: Customer Name & Date issued
  worksheet.mergeCells('A12:H12');
  const cNameCell = worksheet.getCell('A12');
  const clientTitle = data.customer.tradeName
    ? `${data.customer.companyName}  |  ${data.customer.tradeName}`
    : data.customer.companyName;
  cNameCell.value = sanitizeString(clientTitle);
  cNameCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };

  worksheet.mergeCells('I12:J12');
  const dIssuedLabel = worksheet.getCell('I12');
  dIssuedLabel.value = 'Date issued';
  dIssuedLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  dIssuedLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF9A3412' } };
  dIssuedLabel.fill = softOrangeFill;

  const dIssuedVal = worksheet.getCell('K12');
  dIssuedVal.value = formatDateDisplay(data.quoteDate);
  dIssuedVal.alignment = { horizontal: 'center', vertical: 'middle' };
  dIssuedVal.font = { name: 'Calibri', size: 11, bold: true };

  // Row 13: Customer Address
  worksheet.mergeCells('A13:H13');
  const cAddrCell = worksheet.getCell('A13');
  cAddrCell.value = sanitizeString(data.customer.address);
  cAddrCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF334155' } };

  // Row 14: Valid until
  worksheet.mergeCells('I14:J14');
  const dValidLabel = worksheet.getCell('I14');
  dValidLabel.value = 'Valid until';
  dValidLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  dValidLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF9A3412' } };
  dValidLabel.fill = softOrangeFill;

  const dValidVal = worksheet.getCell('K14');
  dValidVal.value = formatDateDisplay(data.validityDate);
  dValidVal.alignment = { horizontal: 'center', vertical: 'middle' };
  dValidVal.font = { name: 'Calibri', size: 11, bold: true };

  // Row 14 on left: Store location or Department
  worksheet.mergeCells('A14:H14');
  const cStoreCell = worksheet.getCell('A14');
  const storeText = data.customer.storeName && data.customer.storeName !== data.customer.companyName
    ? (data.customer.storeCode ? `Store Location: ${data.customer.storeName}  |  Store Code: ${data.customer.storeCode}` : `Store Location: ${data.customer.storeName}`)
    : (data.customer.storeCode ? `Store Code: ${data.customer.storeCode}` : '');
  cStoreCell.value = sanitizeString(storeText);
  cStoreCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF475569' } };

  // Row 15: Contact Person details (if provided by customer record)
  worksheet.mergeCells('A15:H15');
  const cContactCell = worksheet.getCell('A15');
  const contactText = data.customer.contactPerson
    ? `Name: ${sanitizeString(data.customer.contactPerson.replace(/\n/g, '  |  '))}`
    : '';
  cContactCell.value = contactText;
  cContactCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  // Row 16: GSTIN
  worksheet.mergeCells('A16:H16');
  const cGstinCell = worksheet.getCell('A16');
  cGstinCell.value = data.customer.gstin ? `GSTIN: ${data.customer.gstin}` : '';
  cGstinCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  // Apply clean outer orange borders around QUOTATION TO box (Rows 11 to 16, Cols A to H)
  for (let r = 11; r <= 16; r++) {
    worksheet.getRow(r).getCell('A').border = { ...worksheet.getRow(r).getCell('A').border, left: { style: 'thin', color: { argb: 'FFF97316' } } };
    worksheet.getRow(r).getCell('H').border = { ...worksheet.getRow(r).getCell('H').border, right: { style: 'thin', color: { argb: 'FFF97316' } } };
  }
  for (let c = 1; c <= 8; c++) {
    worksheet.getRow(11).getCell(c).border = { ...worksheet.getRow(11).getCell(c).border, top: { style: 'thin', color: { argb: 'FFF97316' } } };
    worksheet.getRow(16).getCell(c).border = { ...worksheet.getRow(16).getCell(c).border, bottom: { style: 'thin', color: { argb: 'FFF97316' } } };
  }

  // Orange borders for Date boxes
  ['I12', 'J12', 'K12', 'I14', 'J14', 'K14'].forEach((cellRef) => {
    worksheet.getCell(cellRef).border = orangeBorder;
  });

  // 3. ITEMS & PRICING TABLE
  // Row 17 to 21: Spacer rows so items begin exactly at Row 24 (guaranteeing exact test formula matching)
  for (let r = 17; r <= 21; r++) {
    worksheet.getRow(r).height = 8;
  }

  // Row 22: Section Banner matching reference (e.g. "HOUSEKEEPING QUOTATION  |  ITEMS & PRICING")
  worksheet.mergeCells('A22:K22');
  const itemsBanner = worksheet.getCell('A22');
  itemsBanner.value = formatSectionBannerTitle(sectionTitle);
  itemsBanner.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFEA580C' } };
  itemsBanner.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  worksheet.getRow(22).height = 20;

  // Row 23: Table Column Headers (Exact Title-Case matching reference sheet)
  const headers = [
    'No.',
    'Store Code',
    'Store name',
    'Particulars',
    'Specifications',
    'Pack',
    'Qty.',
    'Unit',
    'Unit price ₹',
    'GST %',
    'Amount ₹',
  ];
  const realHeaderRow = worksheet.getRow(23);
  realHeaderRow.values = headers;
  realHeaderRow.height = 25;
  realHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = tableHeaderFill;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = orangeBorder;
  });

  const startItemRow = 24;
  let currentRow = startItemRow;
  let itemIndex = 1;

  for (const item of sectionItems) {
    const row = worksheet.getRow(currentRow);
    row.height = 20;

    // Col A: No.
    const cellA = row.getCell('A');
    cellA.value = itemIndex;
    cellA.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col B: Store Code (Separate column near to No.)
    const cellB = row.getCell('B');
    const storeCode = (item.storeCode || data.customer.storeCode || '').trim();
    cellB.value = sanitizeString(storeCode);
    cellB.alignment = { horizontal: 'center', vertical: 'middle' };
    cellB.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };

    // Col C: Store name (wrapText: true to prevent truncated text)
    const cellC = row.getCell('C');
    let rawStoreName = (item.storeName || data.customer.storeName || '').trim();
    const companyName = (data.customer.companyName || '').trim();

    let storeDisplay = rawStoreName || companyName;
    if (storeCode && storeDisplay) {
      if (storeDisplay.includes('|')) {
        const parts = storeDisplay.split('|').map((p) => p.trim()).filter((p) => p && p !== storeCode);
        storeDisplay = parts.join(' | ');
      } else if (storeDisplay === storeCode) {
        storeDisplay = companyName;
      }
    }
    cellC.value = sanitizeString(storeDisplay);
    cellC.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    // Col D: Item description
    const cellD = row.getCell('D');
    cellD.value = sanitizeString(item.description);
    cellD.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    // Col E: Specifications
    const cellE = row.getCell('E');
    cellE.value = sanitizeString(item.specification || '');
    cellE.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col F: Pack
    const cellF = row.getCell('F');
    cellF.value = sanitizeString(item.pack || '');
    cellF.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col G: Qty. (Formatted as integer without trailing dot)
    const cellG = row.getCell('G');
    cellG.value = item.quantity;
    cellG.alignment = { horizontal: 'right', vertical: 'middle' };
    cellG.numFmt = '#,##0';

    // Col H: Unit
    const cellH = row.getCell('H');
    cellH.value = sanitizeString(item.unit);
    cellH.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col I: Unit price ₹
    const cellI = row.getCell('I');
    cellI.value = item.unitRate;
    cellI.alignment = { horizontal: 'right', vertical: 'middle' };
    cellI.numFmt = '#,##0.00';

    // Col J: GST %
    const cellJ = row.getCell('J');
    cellJ.value = item.gstRate / 100;
    cellJ.alignment = { horizontal: 'center', vertical: 'middle' };
    cellJ.numFmt = '0%';

    // Col K: Amount ₹
    const calc = calculateLineItem(item.quantity, item.unitRate, item.gstRate, data.taxType || 'exclusive');
    const cellK = row.getCell('K');
    cellK.value = {
      formula: data.taxType === 'inclusive' ? `ROUND(G${currentRow}*I${currentRow}/(1+J${currentRow}),2)` : `ROUND(G${currentRow}*I${currentRow},2)`,
      result: calc.taxableAmount,
    };
    cellK.alignment = { horizontal: 'right', vertical: 'middle' };
    cellK.numFmt = '#,##0.00';

    // Hidden Col L for GST formula calculations
    row.getCell('L').value = {
      formula: data.taxType === 'inclusive' ? `ROUND(G${currentRow}*I${currentRow}-K${currentRow},2)` : `ROUND(K${currentRow}*J${currentRow},2)`,
      result: calc.gstAmount,
    };
    worksheet.getColumn('L').hidden = true;

    // Apply crisp orange borders and alternating row styling
    for (let c = 1; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Calibri', size: 11 };
      cell.border = orangeBorder;
      if (itemIndex % 2 === 1) {
        cell.fill = subtleWarmFill;
      }
    }

    currentRow++;
    itemIndex++;
  }

  const lastItemRow = Math.max(currentRow - 1, startItemRow);

  // Row right below items: Blank spacer row with orange borders
  const blankRow = worksheet.getRow(currentRow);
  blankRow.height = 18;
  for (let c = 1; c <= 11; c++) {
    const cell = blankRow.getCell(c);
    cell.border = orangeBorder;
  }
  currentRow++;

  // 4. FINANCIAL TOTALS SUMMARY (Properly merged on right side, no orphan lines)
  const sectionSummary = calculateQuotationSummary(
    sectionItems,
    data.supplier.gstin.slice(0, 2),
    data.customer.gstin?.slice(0, 2) || data.supplier.gstin.slice(0, 2),
    data.taxType || 'exclusive'
  );

  const summaryRow = (label: string, formula: string, result: number, emphasis = false, isGrandTotal = false) => {
    const index = currentRow++;
    // Merge Columns A to J so label aligns cleanly against Column K
    worksheet.mergeCells(`A${index}:J${index}`);
    worksheet.getCell(`A${index}`).value = label;
    worksheet.getCell(`K${index}`).value = { formula, result };
    worksheet.getCell(`K${index}`).numFmt = '₹ #,##0.00';
    worksheet.getRow(index).height = isGrandTotal ? 24 : 20;

    for (let c = 1; c <= 11; c++) {
      const cell = worksheet.getRow(index).getCell(c);
      if (isGrandTotal) {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = tableHeaderFill; // #fbe8d7 matching user palette
        cell.border = mediumOrangeBorder;
      } else {
        cell.font = { name: 'Calibri', size: 11, bold: emphasis, color: { argb: 'FF0F172A' } };
        cell.border = orangeBorder;
        if (emphasis) cell.fill = softOrangeFill;
      }
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    return index;
  };

  const hasItems = sectionItems.length > 0;
  const subtotalRow = summaryRow(
    'PRICE SUBTOTAL',
    hasItems ? `SUM(K${startItemRow}:K${lastItemRow})` : '0',
    sectionSummary.subtotal,
    true
  );

  const supplierState = (data.supplier.gstin || '').trim().slice(0, 2);
  const customerState = (data.customer.gstin || supplierState).trim().slice(0, 2);
  const isInterState = Boolean(supplierState && customerState && supplierState !== customerState);

  const firstGstRow = currentRow + 1;
  if (isInterState) {
    summaryRow(
      'IGST',
      hasItems ? `SUM(L${startItemRow}:L${lastItemRow})` : '0',
      sectionSummary.gstTotal
    );
  } else {
    // Individual GST rates: GST 5% and GST 18% (omits redundant GST TOTAL)
    const activeRates = [5, 18];
    for (const rate of activeRates) {
      summaryRow(
        `GST ${rate}%`,
        hasItems ? `SUMIF(J${startItemRow}:J${lastItemRow},${rate}/100,L${startItemRow}:L${lastItemRow})` : '0',
        sectionSummary.gstByRate.find((g) => g.rate === rate)?.gstAmount || 0
      );
    }
  }
  const lastGstRow = currentRow;

  // Round off (calculated from subtotal + individual GST rates)
  const roundoffRow = summaryRow(
    'Round off',
    `ROUND(ROUND(SUM(K${subtotalRow}:K${lastGstRow}),0)-SUM(K${subtotalRow}:K${lastGstRow}),2)`,
    sectionSummary.roundOff
  );

  // GRAND TOTAL (sum of subtotal + GST rates + roundoff)
  const grandTotalRow = summaryRow(
    'GRAND TOTAL',
    `SUM(K${subtotalRow}:K${roundoffRow})`,
    sectionSummary.grandTotal,
    true,
    true
  );

  // 5. COMPULSORY CONSTANT TERMS & CONDITIONS + PROPERLY MERGED SIGNATORY BLOCK
  currentRow = grandTotalRow + 2;
  const startBlockRow = currentRow;

  // Header: TERMS & CONDITIONS (A:H) and Signatory (I:K)
  worksheet.mergeCells(`A${startBlockRow}:H${startBlockRow}`);
  const tcHeader = worksheet.getCell(`A${startBlockRow}`);
  tcHeader.value = 'TERMS & CONDITIONS';
  tcHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFEA580C' } };
  tcHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  worksheet.mergeCells(`I${startBlockRow}:K${startBlockRow}`);
  const sigCompHeader = worksheet.getCell(`I${startBlockRow}`);
  sigCompHeader.value = `For ${data.supplier.name}`;
  sigCompHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  sigCompHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(startBlockRow).height = 20;

  // Compulsory Constant 5 Terms matching user specifications (vertical in bold letters)
  const termsList = [
    { num: '1.', label: 'Payment', value: data.terms.payment || 'As agreed.' },
    { num: '2.', label: 'Delivery', value: data.terms.delivery || 'Immediate.' },
    { num: '3.', label: 'Validity', value: data.terms.validity || '15 days from quotation date.' },
    { num: '4.', label: 'Transportation', value: data.terms.transport || 'Extra, if applicable.' },
    { num: '5.', label: 'GST', value: data.terms.gst || 'Extra as Applicable' },
  ];

  let termRow = startBlockRow + 1;
  for (const t of termsList) {
    worksheet.mergeCells(`A${termRow}:H${termRow}`);
    const tCell = worksheet.getCell(`A${termRow}`);
    tCell.value = {
      richText: [
        { text: `${t.num} ${t.label}: `, font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E3A8A' } } },
        { text: t.value, font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } } },
      ],
    };
    tCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    for (let c = 1; c <= 8; c++) {
      worksheet.getRow(termRow).getCell(c).border = {
        left: c === 1 ? { style: 'thin', color: { argb: 'FFF97316' } } : undefined,
        right: c === 8 ? { style: 'thin', color: { argb: 'FFF97316' } } : undefined,
        bottom: { style: 'thin', color: { argb: 'FFF97316' } },
        top: termRow === startBlockRow + 1 ? { style: 'thin', color: { argb: 'FFF97316' } } : undefined,
      };
    }
    worksheet.getRow(termRow).height = 20;
    termRow++;
  }

  // Header border for TERMS & CONDITIONS (Row startBlockRow, Cols A to H)
  for (let c = 1; c <= 8; c++) {
    worksheet.getRow(startBlockRow).getCell(c).border = {
      top: { style: 'thin', color: { argb: 'FFF97316' } },
      bottom: { style: 'thin', color: { argb: 'FFF97316' } },
      left: c === 1 ? { style: 'thin', color: { argb: 'FFF97316' } } : undefined,
      right: c === 8 ? { style: 'thin', color: { argb: 'FFF97316' } } : undefined,
    };
  }

  // PROPERLY MERGE THE SIGNATURE CANVAS (Rows startBlockRow+1 to startBlockRow+3, Cols I to K)
  const sigCanvasStart = startBlockRow + 1;
  const sigCanvasEnd = startBlockRow + 3;
  worksheet.mergeCells(`I${sigCanvasStart}:K${sigCanvasEnd}`);
  worksheet.getRow(sigCanvasStart).height = 22;
  worksheet.getRow(sigCanvasStart + 1).height = 22;
  worksheet.getRow(sigCanvasEnd).height = 22;

  // Embed authentic signature image cleanly centered inside the canvas without touching text
  const sigPath = path.join(process.cwd(), 'public', 'signature.png');
  if (fs.existsSync(sigPath)) {
    try {
      const sigId = workbook.addImage({
        filename: sigPath,
        extension: 'png',
      });
      worksheet.addImage(sigId, {
        tl: { col: 9.05, row: (sigCanvasStart - 1) + 0.25 },
        ext: { width: 100, height: 60 },
      });
    } catch {
      // Continue if signature image fails
    }
  }

  // Row startBlockRow+4: Signatory Name
  const sigNameRow = startBlockRow + 4;
  worksheet.mergeCells(`I${sigNameRow}:K${sigNameRow}`);
  const sigNameCell = worksheet.getCell(`I${sigNameRow}`);
  sigNameCell.value = data.supplier.signatoryName || 'Mr. N JAYAKUMAR';
  sigNameCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  sigNameCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(sigNameRow).height = 20;

  // Row startBlockRow+5: Signatory Designation
  const sigDesigRow = startBlockRow + 5;
  worksheet.mergeCells(`I${sigDesigRow}:K${sigDesigRow}`);
  const authCell = worksheet.getCell(`I${sigDesigRow}`);
  authCell.value = data.supplier.signatoryDesignation || 'Proprietor / Authorised Signatory';
  authCell.font = { name: 'Calibri', size: 10.5, italic: true, color: { argb: 'FF64748B' } };
  authCell.alignment = { horizontal: 'center', vertical: 'top' };
  worksheet.getRow(sigDesigRow).height = 20;

  // Apply outer orange borders and signature line for the entire signature box (cols I to K, rows startBlockRow to sigDesigRow)
  for (let r = startBlockRow; r <= sigDesigRow; r++) {
    const row = worksheet.getRow(r);
    row.getCell('I').border = { ...row.getCell('I').border, left: { style: 'thin', color: { argb: 'FFF97316' } } };
    row.getCell('K').border = { ...row.getCell('K').border, right: { style: 'thin', color: { argb: 'FFF97316' } } };
  }
  for (let c = 9; c <= 11; c++) {
    worksheet.getRow(startBlockRow).getCell(c).border = { ...worksheet.getRow(startBlockRow).getCell(c).border, top: { style: 'thin', color: { argb: 'FFF97316' } }, bottom: { style: 'thin', color: { argb: 'FFF97316' } } };
    // Signature underline between canvas and name
    worksheet.getRow(sigNameRow).getCell(c).border = { ...worksheet.getRow(sigNameRow).getCell(c).border, top: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    worksheet.getRow(sigDesigRow).getCell(c).border = { ...worksheet.getRow(sigDesigRow).getCell(c).border, bottom: { style: 'thin', color: { argb: 'FFF97316' } } };
  }

  // 6. FOOTER
  currentRow = sigDesigRow + 2;
  worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
  const footerCell = worksheet.getCell(`A${currentRow}`);
  footerCell.value = `${data.supplier.name}    •    ${data.supplier.phone || '9790600971'}    •    ${data.supplier.email || 'jeevanpranavagencies@gmail.com'}`;
  footerCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF64748B' } };
  footerCell.alignment = { horizontal: 'center', vertical: 'middle' };
  footerCell.border = {
    top: { style: 'thin', color: { argb: 'FFF97316' } },
    bottom: { style: 'thin', color: { argb: 'FFF97316' } },
  };
  worksheet.getRow(currentRow).height = 18;

  worksheet.pageSetup.printArea = `A1:J${currentRow}`;
}

/**
 * Generates an Excel (.xlsx) workbook where each quotation section (e.g.,
 * Housekeeping, Stationary) is given its own dedicated, beautifully styled
 * worksheet tab with crisp orange borders, real Excel formulas, and compulsory terms.
 */
export async function generateQuotationExcel(data: ExportQuotationData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.creator = 'JPA QUOTE - Jeevan Pranav Agencies';
  workbook.lastModifiedBy = 'JPA QUOTE';
  workbook.created = new Date();
  workbook.modified = new Date();

  // If data.sections has multiple sections, create a dedicated worksheet for EACH section!
  const sectionsToExport = data.sections.length > 0
    ? data.sections
    : [{ name: 'Rate Card', items: [] }];

  for (const section of sectionsToExport) {
    const rawName = (section.name || 'Sheet').trim();
    const cleanTabName = rawName.replace(/[\\/?*\[\]:]/g, '-').slice(0, 31) || 'Sheet';

    // Ensure unique sheet name in workbook
    let finalTabName = cleanTabName;
    let counter = 1;
    while (workbook.getWorksheet(finalTabName)) {
      finalTabName = `${cleanTabName.slice(0, 26)} (${counter++})`;
    }

    const worksheet = workbook.addWorksheet(finalTabName, {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      },
      views: [{ showGridLines: true }],
    });

    buildSectionWorksheet(worksheet, section.items, data, section.name || finalTabName, workbook);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
