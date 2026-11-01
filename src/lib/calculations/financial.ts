export interface CalculationItem {
  quantity: number;
  unitRate: number;
  gstRate: number; // 0, 5, 12, 18, 28, etc.
}

export interface CalculatedItemResult {
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
}

export interface GSTGroupBreakdown {
  rate: number;
  taxableAmount: number;
  gstAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
}

export interface QuotationFinancialSummary {
  subtotal: number;
  gstTotal: number;
  roundOff: number;
  grandTotal: number;
  gstByRate: GSTGroupBreakdown[];
  isInterState: boolean;
}

/**
 * Deterministic line item calculation
 */
export function calculateLineItem(
  quantity: number,
  unitRate: number,
  gstRate: number,
  taxType: 'exclusive' | 'inclusive' = 'exclusive'
): CalculatedItemResult {
  const qty = Number(quantity) || 0;
  const rate = Number(unitRate) || 0;
  const tax = Number(gstRate) || 0;

  if (qty <= 0 || rate <= 0) {
    return { taxableAmount: 0, gstAmount: 0, lineTotal: 0 };
  }

  let taxable = 0;
  let gst = 0;

  if (taxType === 'inclusive') {
    // Back-calculate taxable from inclusive price
    const gross = qty * rate;
    taxable = Number((gross / (1 + tax / 100)).toFixed(2));
    gst = Number((gross - taxable).toFixed(2));
  } else {
    // Standard tax-exclusive calculation
    taxable = Number((qty * rate).toFixed(2));
    gst = Number(((taxable * tax) / 100).toFixed(2));
  }

  const lineTotal = Number((taxable + gst).toFixed(2));
  return { taxableAmount: taxable, gstAmount: gst, lineTotal };
}

/**
 * Calculate totals and rate-grouped GST for an entire quotation
 */
export function calculateQuotationSummary(
  items: Array<{
    quantity: number;
    unitRate: number;
    gstRate: number;
    taxableAmount?: number;
    gstAmount?: number;
  }>,
  supplierStateCode: string = '33', // Tamil Nadu
  customerStateCode: string = '33',
  taxType: 'exclusive' | 'inclusive' = 'exclusive',
  explicitRoundOff?: number
): QuotationFinancialSummary {
  const isInterState = supplierStateCode !== customerStateCode;
  let subtotal = 0;
  let gstTotal = 0;

  const rateGroups = new Map<number, { taxable: number; gst: number }>();

  for (const item of items) {
    const calc = calculateLineItem(item.quantity, item.unitRate, item.gstRate, taxType);
    subtotal += calc.taxableAmount;
    gstTotal += calc.gstAmount;

    const rate = Number(item.gstRate) || 0;
    const existing = rateGroups.get(rate) || { taxable: 0, gst: 0 };
    existing.taxable += calc.taxableAmount;
    existing.gst += calc.gstAmount;
    rateGroups.set(rate, existing);
  }

  subtotal = Number(subtotal.toFixed(2));
  gstTotal = Number(gstTotal.toFixed(2));

  const sortedRates = Array.from(rateGroups.keys()).sort((a, b) => a - b);
  const gstByRate: GSTGroupBreakdown[] = sortedRates.map((rate) => {
    const group = rateGroups.get(rate)!;
    const groupTaxable = Number(group.taxable.toFixed(2));
    const groupGST = Number(group.gst.toFixed(2));

    const halfRate = Number((rate / 2).toFixed(2));
    // For intra-state (CGST + SGST), split evenly with rounding reconcile
    const cgstAmount = Number((groupGST / 2).toFixed(2));
    const sgstAmount = Number((groupGST - cgstAmount).toFixed(2));

    return {
      rate,
      taxableAmount: groupTaxable,
      gstAmount: groupGST,
      cgstRate: halfRate,
      cgstAmount,
      sgstRate: halfRate,
      sgstAmount,
      igstRate: rate,
      igstAmount: groupGST,
    };
  });

  const rawGrandTotal = subtotal + gstTotal;
  let roundOff = 0;
  let grandTotal = rawGrandTotal;

  if (explicitRoundOff !== undefined && explicitRoundOff !== null) {
    roundOff = Number(explicitRoundOff.toFixed(2));
    grandTotal = Number((rawGrandTotal + roundOff).toFixed(2));
  } else {
    // Standard standard nearest integer round-off
    const rounded = Math.round(rawGrandTotal);
    roundOff = Number((rounded - rawGrandTotal).toFixed(2));
    grandTotal = rounded;
  }

  return {
    subtotal,
    gstTotal,
    roundOff,
    grandTotal,
    gstByRate,
    isInterState,
  };
}

export function formatINR(val: number): string {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
