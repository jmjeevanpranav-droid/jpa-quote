/**
 * Automatically capitalizes text input according to JPA typography conventions:
 * 1. The first letter entered is capitalized by default.
 * 2. Letters after whitespace (spaces, tabs, newlines) are capitalized.
 * 3. Letters after full stops (.) are capitalized.
 * 4. Letters after opening brackets or separators (e.g. '(', '/', '-') are capitalized.
 * 5. Other characters and existing uppercase acronyms (e.g. JPA, PVC, 5L) are preserved.
 */
export function capitalizeInput(val: string): string {
  if (!val) return val;
  return val.replace(/(^|[\s.(-/]+)([a-z])/g, (_, prefix, letter) => {
    return prefix + letter.toUpperCase();
  });
}

/**
 * Normalizes company / group names to group branches and stores under a shared Company Folder:
 * Examples:
 * - "Life Style International P Ltd.,(H/C)" -> "Lifestyle International"
 * - "Lifestyle International Pvt. Ltd" -> "Lifestyle International"
 * - "Landmark Group - Home Centre" -> "Landmark Group"
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  let clean = name.trim();
  // Strip branch / store suffixes after dash (e.g. "Landmark Group - Home Centre" -> "Landmark Group")
  clean = clean.replace(/\s*-\s*.*$/i, '').trim();
  // Strip legal suffixes and branch annotations
  clean = clean
    .replace(/\s*pvt\.?\s*ltd\.?/gi, '')
    .replace(/\s*p\s*ltd\.?/gi, '')
    .replace(/\s*private\s*limited/gi, '')
    .replace(/\s*limited/gi, '')
    .replace(/\(h\/c\)/gi, '')
    .replace(/[.,/()_-]+$/g, '')
    .trim();
  // Standardize common company variations
  if (/^life\s*style/i.test(clean)) {
    return 'Lifestyle International';
  }
  return clean;
}

/**
 * Normalizes a phone number to extract its core 10 digits for flexible matching.
 * Examples:
 * - "+91 9790600971" -> "9790600971"
 * - "+919790600971"  -> "9790600971"
 * - "09790600971"    -> "9790600971"
 * - "97906 00971"    -> "9790600971"
 * - "9790600971"     -> "9790600971"
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Standardizes a phone number to Indian display format: "+91 XXXXXXXXXX"
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const norm = normalizePhoneNumber(phone);
  if (norm.length === 10) {
    return `+91 ${norm}`;
  }
  return String(phone).trim();
}


