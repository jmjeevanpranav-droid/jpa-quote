const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += ones[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n > 0) {
    if (str !== '') str += 'and ';
    if (n < 20) {
      str += ones[n] + ' ';
    } else {
      const t = tens[Math.floor(n / 10)];
      const rem = n % 10;
      if (rem > 0) {
        str += `${t}-${ones[rem]} `;
      } else {
        str += `${t} `;
      }
    }
  }
  return str.trim();
}

/**
 * Converts Indian Rupee number to words according to the Indian numbering system
 * (Lakhs, Crores) with proper hyphenation
 */
export function amountToWordsIndian(amount: number): string {
  const num = Math.round(Math.abs(amount));
  if (num === 0) return 'Rupees Zero Only';

  let remaining = num;
  const parts: string[] = [];

  // Crores (>= 1,00,00,000)
  if (remaining >= 10000000) {
    const crores = Math.floor(remaining / 10000000);
    parts.push(convertBelowThousand(crores) + ' Crore');
    remaining %= 10000000;
  }

  // Lakhs (>= 1,00,000)
  if (remaining >= 100000) {
    const lakhs = Math.floor(remaining / 100000);
    parts.push(convertBelowThousand(lakhs) + ' Lakh');
    remaining %= 100000;
  }

  // Thousands (>= 1,000)
  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000);
    parts.push(convertBelowThousand(thousands) + ' Thousand');
    remaining %= 1000;
  }

  // Hundreds & units
  if (remaining > 0) {
    parts.push(convertBelowThousand(remaining));
  }

  return 'Rupees ' + parts.join(' ') + ' Only';
}
