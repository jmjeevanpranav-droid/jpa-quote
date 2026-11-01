import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExportQuotationData } from './excel-generator';
import { amountToWordsIndian } from '../calculations/number-to-words';
import { calculateQuotationSummary } from '../calculations/financial';
import path from 'path';
import fs from 'fs';

/**
 * Helper to cleanly format numbers in Indian currency format with 2 decimals
 */
function formatInrNumber(val: number): string {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Extracts a clean short store branch from long customer strings like
 * "LIFESTYLE INTERNATIONAL PVT. LTD. (MARINA MALL)" -> "Marina Mall"
 * and removes embedded storeCode to avoid duplicate text.
 */
function getCleanStoreName(rawStore?: string, customerCompany?: string, storeCode?: string): string {
  if (!rawStore || !rawStore.trim()) return '—';
  let trimmed = rawStore.trim();

  // If contains storeCode, strip it out to avoid duplication
  if (storeCode && storeCode.trim()) {
    const code = storeCode.trim();
    if (trimmed.includes('|')) {
      const parts = trimmed.split('|').map((p) => p.trim()).filter((p) => p && p !== code);
      trimmed = parts.join(' | ');
    } else if (trimmed === code) {
      return customerCompany || '—';
    }
  }

  // If contains parentheses, extract inner text
  const match = trimmed.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    const branch = match[1].trim();
    if (branch === branch.toUpperCase()) {
      return branch
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return branch;
  }

  // If it starts with customer company name, strip it to keep branch concise
  if (customerCompany && trimmed.startsWith(customerCompany)) {
    const remainder = trimmed.replace(customerCompany, '').replace(/^[\s\-–:,|]+/, '').trim();
    if (remainder) return remainder;
  }

  return trimmed;
}

/**
 * Renders a complete, modern, corporate Portrait A4 Rate Card page for a specific quotation section
 * (e.g. Housekeeping on Page 1, Stationary on Page 2) with company header, client card,
 * section item table, financial totals, compulsory terms, and authorized signatory.
 */
function renderSectionPage(
  doc: jsPDF,
  section: ExportQuotationData['sections'][0],
  data: ExportQuotationData,
  isFirstPage: boolean,
  hasCaptureFont: boolean,
  hasCalibriFont: boolean
) {
  if (!isFirstPage) {
    doc.addPage();
  }

  const baseFont = hasCalibriFont ? 'Calibri' : 'helvetica';
  const pageWidth = doc.internal.pageSize.getWidth();   // 210 mm (Portrait A4)
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm (Portrait A4)
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;          // 186 mm
  let currentY = margin;

  // 1. Header: Logo & Supplier Details on Left
  const logoPath = path.join(process.cwd(), 'public', 'logo-clean.png');
  let hasLogo = false;
  try {
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath);
      const base64Logo = `data:image/png;base64,${logoData.toString('base64')}`;
      doc.addImage(base64Logo, 'PNG', margin, currentY, 20, 20);
      hasLogo = true;
    }
  } catch (err) {
    // Continue if logo file not found
  }

  const headerX = hasLogo ? margin + 24 : margin;
  doc.setFont(baseFont, 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(30, 58, 138); // JPA Navy #1E3A8A
  doc.text(data.supplier.name.toUpperCase(), headerX, currentY + 4.5);

  if (data.supplier.tagline) {
    doc.setFont(baseFont, 'italic');
    doc.setFontSize(10.5);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(data.supplier.tagline, headerX, currentY + 9);
  }

  doc.setFont(baseFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.text(data.supplier.address, headerX, currentY + 13.5);
  doc.text(
    `GSTIN: ${data.supplier.gstin}   |   Phone: ${data.supplier.phone || '+91 9790600971'}`,
    headerX,
    currentY + 18
  );
  doc.text(
    `Email: ${data.supplier.email || 'jeevanpranavagencies@gmail.com'}`,
    headerX,
    currentY + 22.5
  );

  // Rate Card badge on Right (aligned to right margin with generous spacing)
  const rightColX = pageWidth - margin;
  if (hasCaptureFont) {
    doc.setFont('CaptureSmallzClean', 'normal');
    doc.setFontSize(21);
  } else {
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(19);
  }
  doc.setTextColor(234, 88, 12); // #EA580C JPA Vibrant Orange
  doc.text('RATE CARD', rightColX, currentY + 5.5, { align: 'right' });

  doc.setFont(baseFont, 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(30, 58, 138); // JPA Navy
  doc.text(`RC Number: ${data.referenceNo || data.quoteNumber}`, rightColX, currentY + 11, { align: 'right' });

  doc.setFont(baseFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.text(`Date: ${data.quoteDate}`, rightColX, currentY + 15.5, { align: 'right' });
  doc.text(`Valid Until: ${data.validityDate}`, rightColX, currentY + 20, { align: 'right' });

  currentY += 26;

  // Modern corporate divider with brand orange accent bar
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // Subtle vibrant orange accent tick (22mm wide) on the left
  doc.setFillColor(234, 88, 12); // JPA Orange #EA580C
  doc.rect(margin, currentY - 0.2, 22, 0.8, 'F');

  currentY += 4;

  // 2. Client Details Card (Auto-Responsive Container)
  const cardPadX = margin + 6;
  const maxTextWidth = contentWidth - 12;

  // Split and sanitize address lines safely to prevent collisions
  const rawAddress = (data.customer.address || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const addressLines: string[] = [];
  if (rawAddress) {
    const rawSegments = rawAddress.split('\n').map((s) => s.trim()).filter(Boolean);
    for (const seg of rawSegments) {
      const wrapped = doc.splitTextToSize(seg, maxTextWidth);
      addressLines.push(...wrapped);
    }
  }

  // Metadata items (GSTIN, Store Code, Store, Contact)
  const clientMetaParts: string[] = [];
  if (data.customer.gstin) {
    clientMetaParts.push(`GSTIN: ${data.customer.gstin.trim()}`);
  }
  if (data.customer.storeCode) {
    clientMetaParts.push(`Store Code: ${data.customer.storeCode.trim()}`);
  }
  if (data.customer.storeName && data.customer.storeName.trim() !== data.customer.companyName.trim()) {
    clientMetaParts.push(`Store / Branch: ${data.customer.storeName.trim()}`);
  }
  if (data.customer.contactPerson) {
    clientMetaParts.push(`Name: ${data.customer.contactPerson.trim()}`);
  }

  const metaText = clientMetaParts.join('     |     ');
  const metaLines: string[] = metaText ? doc.splitTextToSize(metaText, maxTextWidth) : [];

  // Dynamic Card Height with exact line heights
  const padTop = 4.5;
  const padBottom = 4.5;
  const headerHeight = 4.5;
  const nameHeight = 5.2;
  const addressHeight = addressLines.length > 0 ? addressLines.length * 4.6 + 1.2 : 0;
  const metaHeight = metaLines.length > 0 ? metaLines.length * 4.6 : 0;
  const cardHeight = padTop + headerHeight + nameHeight + addressHeight + metaHeight + padBottom;

  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(margin, currentY, contentWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(margin, currentY, contentWidth, cardHeight, 2, 2, 'S');

  // Left vertical accent stripe in JPA Orange #EA580C
  doc.setFillColor(234, 88, 12);
  doc.roundedRect(margin, currentY, 2.5, cardHeight, 1, 1, 'F');

  let cardInnerY = currentY + padTop + 3.2;

  // Row 1: Header Tag
  doc.setFont(baseFont, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 58, 138); // JPA Navy
  doc.text('QUOTATION TO / CLIENT DETAILS:', cardPadX, cardInnerY);
  cardInnerY += headerHeight;

  // Row 2: Customer Name
  doc.setFont(baseFont, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(data.customer.companyName, cardPadX, cardInnerY);
  cardInnerY += nameHeight;

  // Row 3: Address (Line by Line with responsive spacing)
  if (addressLines.length > 0) {
    doc.setFont(baseFont, 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(71, 85, 105); // Slate 600
    for (const line of addressLines) {
      doc.text(line, cardPadX, cardInnerY);
      cardInnerY += 4.6;
    }
    cardInnerY += 1.2;
  }

  // Row 4: Metadata (GSTIN, Store, Contact)
  if (metaLines.length > 0) {
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85); // Slate 700
    for (const line of metaLines) {
      doc.text(line, cardPadX, cardInnerY);
      cardInnerY += 4.6;
    }
  }

  currentY += cardHeight + 5;

  // 3. Section Title Header Banner (Full width 186mm)
  doc.setFillColor(30, 58, 138); // JPA Navy #1E3A8A
  doc.rect(margin, currentY, contentWidth, 7.5, 'F');

  // Subtle orange accent line along bottom of banner
  doc.setFillColor(234, 88, 12); // JPA Orange #EA580C
  doc.rect(margin, currentY + 6.8, contentWidth, 0.7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`SECTION: ${section.name.toUpperCase()} RATE CARD`, margin + 4, currentY + 5.2);

  currentY += 8;

  // 4. Section Items Table (Calibri typography across 186mm A4 width)
  // Dynamically detect presence of Store Code and Store Name for responsive column adjustment
  const hasStoreCode = Boolean(
    data.customer.storeCode || section.items.some((item) => item.storeCode && item.storeCode.trim().length > 0)
  );
  const hasStoreName = Boolean(
    data.customer.storeName || section.items.some((item) => item.storeName && item.storeName.trim().length > 0)
  );

  let tableHeaders: string[];
  let columnStyles: { [key: number]: any };

  if (hasStoreCode && hasStoreName) {
    // 10 columns: exactly 186 mm width matching Portrait A4 printable width
    tableHeaders = [
      '#',
      'Store Code',
      'Store / Branch',
      'Particulars',
      'Specification',
      'Qty',
      'Unit',
      'Unit Price (Rs.)',
      'GST %',
      'Amount (Rs.)',
    ];
    columnStyles = {
      0: { cellWidth: 7, halign: 'center' as const },
      1: { cellWidth: 16, halign: 'center' as const, fontStyle: 'bold' as const },
      2: { cellWidth: 24, halign: 'left' as const, overflow: 'linebreak' as const },
      3: { cellWidth: 45, halign: 'left' as const, fontStyle: 'bold' as const },
      4: { cellWidth: 22, halign: 'left' as const },
      5: { cellWidth: 10, halign: 'center' as const },
      6: { cellWidth: 11, halign: 'center' as const },
      7: { cellWidth: 19, halign: 'right' as const },
      8: { cellWidth: 12, halign: 'center' as const },
      9: { cellWidth: 20, halign: 'right' as const, fontStyle: 'bold' as const, textColor: [30, 58, 138] as [number, number, number] },
    };
  } else if (hasStoreCode && !hasStoreName) {
    // 9 columns: exactly 186 mm
    tableHeaders = [
      '#',
      'Store Code',
      'Particulars',
      'Specification',
      'Qty',
      'Unit',
      'Unit Price (Rs.)',
      'GST %',
      'Amount (Rs.)',
    ];
    columnStyles = {
      0: { cellWidth: 8, halign: 'center' as const },
      1: { cellWidth: 20, halign: 'center' as const, fontStyle: 'bold' as const },
      2: { cellWidth: 58, halign: 'left' as const, fontStyle: 'bold' as const },
      3: { cellWidth: 28, halign: 'left' as const },
      4: { cellWidth: 11, halign: 'center' as const },
      5: { cellWidth: 11, halign: 'center' as const },
      6: { cellWidth: 21, halign: 'right' as const },
      7: { cellWidth: 13, halign: 'center' as const },
      8: { cellWidth: 18, halign: 'right' as const, fontStyle: 'bold' as const, textColor: [30, 58, 138] as [number, number, number] },
    };
  } else if (!hasStoreCode && hasStoreName) {
    // 9 columns: exactly 186 mm
    tableHeaders = [
      '#',
      'Store / Branch',
      'Particulars',
      'Specification',
      'Qty',
      'Unit',
      'Unit Price (Rs.)',
      'GST %',
      'Amount (Rs.)',
    ];
    columnStyles = {
      0: { cellWidth: 8, halign: 'center' as const },
      1: { cellWidth: 28, halign: 'left' as const, overflow: 'linebreak' as const },
      2: { cellWidth: 51, halign: 'left' as const, fontStyle: 'bold' as const },
      3: { cellWidth: 26, halign: 'left' as const },
      4: { cellWidth: 11, halign: 'center' as const },
      5: { cellWidth: 11, halign: 'center' as const },
      6: { cellWidth: 21, halign: 'right' as const },
      7: { cellWidth: 13, halign: 'center' as const },
      8: { cellWidth: 17, halign: 'right' as const, fontStyle: 'bold' as const, textColor: [30, 58, 138] as [number, number, number] },
    };
  } else {
    // 8 columns: exactly 186 mm
    tableHeaders = [
      '#',
      'Particulars',
      'Specification',
      'Qty',
      'Unit',
      'Unit Price (Rs.)',
      'GST %',
      'Amount (Rs.)',
    ];
    columnStyles = {
      0: { cellWidth: 9, halign: 'center' as const },
      1: { cellWidth: 67, halign: 'left' as const, fontStyle: 'bold' as const },
      2: { cellWidth: 32, halign: 'left' as const },
      3: { cellWidth: 12, halign: 'center' as const },
      4: { cellWidth: 12, halign: 'center' as const },
      5: { cellWidth: 23, halign: 'right' as const },
      6: { cellWidth: 13, halign: 'center' as const },
      7: { cellWidth: 18, halign: 'right' as const, fontStyle: 'bold' as const, textColor: [30, 58, 138] as [number, number, number] },
    };
  }

  const tableRows = section.items.map((item, idx) => {
    const taxable = Number((item.quantity * item.unitRate).toFixed(2));
    const specDisplay = [item.specification, item.pack].filter(Boolean).join(' - ') || '—';
    const storeCode = (item.storeCode || data.customer.storeCode || '').trim();
    const storeDisplay = getCleanStoreName(
      item.storeName || data.customer.storeName,
      data.customer.companyName,
      storeCode
    );

    if (hasStoreCode && hasStoreName) {
      return [
        (idx + 1).toString(),
        storeCode || '—',
        storeDisplay,
        item.description,
        specDisplay,
        item.quantity.toString(),
        item.unit,
        formatInrNumber(item.unitRate),
        `${item.gstRate || 0}%`,
        formatInrNumber(taxable),
      ];
    } else if (hasStoreCode && !hasStoreName) {
      return [
        (idx + 1).toString(),
        storeCode || '—',
        item.description,
        specDisplay,
        item.quantity.toString(),
        item.unit,
        formatInrNumber(item.unitRate),
        `${item.gstRate || 0}%`,
        formatInrNumber(taxable),
      ];
    } else if (!hasStoreCode && hasStoreName) {
      return [
        (idx + 1).toString(),
        storeDisplay,
        item.description,
        specDisplay,
        item.quantity.toString(),
        item.unit,
        formatInrNumber(item.unitRate),
        `${item.gstRate || 0}%`,
        formatInrNumber(taxable),
      ];
    } else {
      return [
        (idx + 1).toString(),
        item.description,
        specDisplay,
        item.quantity.toString(),
        item.unit,
        formatInrNumber(item.unitRate),
        `${item.gstRate || 0}%`,
        formatInrNumber(taxable),
      ];
    }
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    showHead: 'everyPage',
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    styles: {
      font: baseFont,
      fontSize: hasStoreCode && hasStoreName ? 9 : 10,
      cellPadding: hasStoreCode && hasStoreName
        ? { top: 2.8, bottom: 2.8, left: 1.6, right: 1.6 }
        : { top: 3.2, bottom: 3.2, left: 2.2, right: 2.2 },
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      font: baseFont,
      fillColor: [251, 232, 215], // #FBE8D7 (User's exact color picker hex)
      textColor: [30, 58, 138],   // JPA Navy #1E3A8A
      fontStyle: 'bold',
      fontSize: hasStoreCode && hasStoreName ? 8.5 : 9.5,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 8,
      overflow: 'linebreak',
      lineWidth: 0.2,
      lineColor: [203, 213, 225],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles,
    didDrawPage: (hookData) => {
      currentY = hookData.cursor?.y || currentY;
    },
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 5. Overflow Check for Financial Summary & Details (Portrait height 297mm)
  if (currentY > pageHeight - 78) {
    doc.addPage();
    currentY = margin + 5;
  }

  // 6. Section Financial Totals (Calibri Size 12)
  const sectionSummary = calculateQuotationSummary(
    section.items,
    data.supplier.gstin.slice(0, 2),
    data.customer.gstin?.slice(0, 2) || data.supplier.gstin.slice(0, 2),
    data.taxType || 'exclusive'
  );

  const summaryBoxWidth = 88;
  const summaryX = pageWidth - margin - summaryBoxWidth;

  // Summary Table on Right
  const summaryRows: Array<[string, string]> = [
    [`Price Subtotal (${section.name})`, `Rs. ${formatInrNumber(sectionSummary.subtotal)}`],
  ];

  const activeGstGroups = sectionSummary.gstByRate ? sectionSummary.gstByRate.filter((g) => g.gstAmount > 0) : [];
  if (activeGstGroups.length > 0) {
    activeGstGroups.forEach((group) => {
      summaryRows.push([`GST ${group.rate}%`, `Rs. ${formatInrNumber(group.gstAmount)}`]);
    });
    // Only show "GST Total Amount" if there are multiple GST rates
    if (activeGstGroups.length > 1) {
      summaryRows.push(['GST Total Amount', `Rs. ${formatInrNumber(sectionSummary.gstTotal)}`]);
    }
  }
  summaryRows.push([
    'Round off',
    `${sectionSummary.roundOff >= 0 ? '+' : '-'}Rs. ${Math.abs(sectionSummary.roundOff).toFixed(2)}`,
  ]);
  summaryRows.push(['GRAND TOTAL', `Rs. ${formatInrNumber(sectionSummary.grandTotal)}`]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: summaryX, right: margin },
    tableWidth: summaryBoxWidth,
    body: summaryRows,
    theme: 'grid',
    styles: {
      font: baseFont,
      fontSize: 10.5,
      cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 },
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (cellData) => {
      if (cellData.row.index === summaryRows.length - 1) {
        cellData.cell.styles.fillColor = [30, 58, 138]; // JPA Navy
        cellData.cell.styles.textColor = [255, 255, 255];
        cellData.cell.styles.fontSize = 11;
        cellData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Left Side: Amount in Words (Calibri Size 10-11)
  let leftY = currentY + 3.5;
  doc.setFont(baseFont, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138);
  doc.text('Amount in Words:', margin, leftY);
  leftY += 5.5;

  doc.setFont(baseFont, 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(71, 85, 105);
  const wordsText = amountToWordsIndian(sectionSummary.grandTotal);
  const splitWords = doc.splitTextToSize(wordsText, summaryX - margin - 8);
  doc.text(splitWords, margin, leftY);
  leftY += splitWords.length * 5;

  // 7. Terms & Conditions and Authorized Signatory
  // @ts-ignore
  const nextSectionY = Math.max((doc as any).lastAutoTable.finalY + 6, leftY + 4);

  let termsY = nextSectionY;
  if (termsY > pageHeight - 45) {
    doc.addPage();
    termsY = margin + 5;
  }

  // Terms & Conditions on Left (Vertical in bold letters)
  doc.setFont(baseFont, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(234, 88, 12); // JPA Orange #EA580C
  doc.text('TERMS & CONDITIONS:', margin, termsY + 3.5);

  const tcList = [
    { label: '1. Payment:', value: data.terms.payment || 'As agreed.' },
    { label: '2. Delivery:', value: data.terms.delivery || 'Immediate.' },
    { label: '3. Validity:', value: data.terms.validity || '15 days from quotation date.' },
    { label: '4. Transportation:', value: data.terms.transport || 'Extra, if applicable.' },
    { label: '5. GST:', value: data.terms.gst || 'Extra as Applicable' },
  ];

  let tcRowY = termsY + 8.5;
  for (const tc of tcList) {
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138); // JPA Navy
    doc.text(tc.label, margin, tcRowY);

    const labelW = doc.getTextWidth(tc.label) + 2.5;
    doc.setFont(baseFont, 'bold');
    doc.setTextColor(51, 65, 85); // Slate 700 bold letters
    doc.text(tc.value, margin + labelW, tcRowY);

    tcRowY += 5.2;
  }

  // Authorized Signatory on Right (Properly sized and aligned)
  const centerX = summaryX + summaryBoxWidth / 2;
  const sigBoxY = termsY;

  doc.setFont(baseFont, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`For ${data.supplier.name}`, centerX, sigBoxY + 3.5, { align: 'center' });

  // Signature image with natural aspect ratio (187 x 113 px -> 1.655 ratio)
  const sigW = 26;
  const sigH = 15.7;
  const sigImgY = sigBoxY + 5.5;
  const sigImgPath = path.join(process.cwd(), 'public', 'signature.png');
  try {
    if (fs.existsSync(sigImgPath)) {
      const sigData = fs.readFileSync(sigImgPath);
      const base64Sig = `data:image/png;base64,${sigData.toString('base64')}`;
      doc.addImage(base64Sig, 'PNG', centerX - sigW / 2, sigImgY, sigW, sigH);
    }
  } catch (err) {
    // Optional visual
  }

  // Crisp signature underline properly positioned right below signature
  const lineY = sigImgY + sigH + 1.2;
  const lineHalfWidth = 24;
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.35);
  doc.line(centerX - lineHalfWidth, lineY, centerX + lineHalfWidth, lineY);

  // Signatory Name
  doc.setFont(baseFont, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(data.supplier.signatoryName || 'Mr. N JAYAKUMAR', centerX, lineY + 4.5, { align: 'center' });

  // Signatory Designation
  doc.setFont(baseFont, 'italic');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    data.supplier.signatoryDesignation || 'Proprietor / Authorised Signatory',
    centerX,
    lineY + 8.5,
    { align: 'center' }
  );
}

/**
 * Generates an elegant, modern Portrait A4 (210mm x 297mm) Rate Card PDF document
 * for Jeevan Pranav Agencies with JPA corporate branding, brand hex accents, generous
 * typography spacing, separate pages per section, and official signatory.
 */
export async function generateQuotationPDF(data: ExportQuotationData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Register Capture Smallz Clean font if available
  let hasCaptureFont = false;
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'capture_smallz', 'Capsmall_clean.ttf');
    if (fs.existsSync(fontPath)) {
      const fontBinary = fs.readFileSync(fontPath).toString('binary');
      doc.addFileToVFS('Capsmall_clean.ttf', fontBinary);
      doc.addFont('Capsmall_clean.ttf', 'CaptureSmallzClean', 'normal');
      hasCaptureFont = true;
    }
  } catch (err) {
    // Graceful fallback to helvetica
  }

  // Register Calibri fonts if available
  let hasCalibriFont = false;
  try {
    const calibriPath = path.join(process.cwd(), 'public', 'fonts', 'calibri', 'calibri.ttf');
    const calibribPath = path.join(process.cwd(), 'public', 'fonts', 'calibri', 'calibrib.ttf');
    const calibriiPath = path.join(process.cwd(), 'public', 'fonts', 'calibri', 'calibrii.ttf');
    if (fs.existsSync(calibriPath)) {
      doc.addFileToVFS('Calibri.ttf', fs.readFileSync(calibriPath).toString('binary'));
      doc.addFont('Calibri.ttf', 'Calibri', 'normal');
      hasCalibriFont = true;
    }
    if (fs.existsSync(calibribPath)) {
      doc.addFileToVFS('Calibri-Bold.ttf', fs.readFileSync(calibribPath).toString('binary'));
      doc.addFont('Calibri-Bold.ttf', 'Calibri', 'bold');
    }
    if (fs.existsSync(calibriiPath)) {
      doc.addFileToVFS('Calibri-Italic.ttf', fs.readFileSync(calibriiPath).toString('binary'));
      doc.addFont('Calibri-Italic.ttf', 'Calibri', 'italic');
    }
  } catch (err) {
    // Graceful fallback to helvetica
  }

  const pageWidth = doc.internal.pageSize.getWidth();   // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm

  // If data.sections has multiple sections, render EACH section on its own separate page!
  const sectionsToRender = data.sections.length > 0
    ? data.sections
    : [{ name: 'Rate Card', items: [] }];

  sectionsToRender.forEach((section, idx) => {
    renderSectionPage(doc, section, data, idx === 0, hasCaptureFont, hasCalibriFont);
  });

  // Running Footer across all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `JPA QUOTE  •  ${data.supplier.name}  •  Corporate Rate Card  •  Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
