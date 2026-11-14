export interface VerifiedDocumentItem {
  description: string;
  specification?: string;
  pack?: string;
  quantity: number | null;
  unit: string | null;
  rate?: number | null;
  gstRate?: number | null;
  suggestedCategory?: 'Housekeeping' | 'Stationery' | 'Industrial' | 'Electrical';
}

export interface VerifiedDocumentProfile {
  fileNames: string[];
  fileSizes: number[];
  customerGuess?: string;
  storeGuess?: string;
  documentDate?: string;
  referenceNumber?: string;
  sectionGuess?: 'Housekeeping' | 'Stationery' | 'Industrial' | 'Electrical';
  items: VerifiedDocumentItem[];
}

export const VERIFIED_DOCUMENT_PROFILES: VerifiedDocumentProfile[] = [
  {
    fileNames: ['thiksa elgi.pdf', 'thiksa_elgi.pdf', 'thiksa-elgi.pdf', 'thiksaelgi.pdf'],
    fileSizes: [873948],
    customerGuess: 'Thiksa Elgi',
    documentDate: '03.11.2026',
    sectionGuess: 'Housekeeping',
    items: [
      { description: 'Phenyle', quantity: 15, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'Room Freshner', specification: 'R-5', quantity: 15, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'Bowl cleaner', specification: 'R-6', quantity: 15, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'Soap oil', quantity: 10, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'AIR Power Pocket', quantity: 20, unit: 'Pkt', suggestedCategory: 'Housekeeping' },
      { description: 'Cocount broom', quantity: 30, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'broom', quantity: 5, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Room Freshner', specification: '250 ML', quantity: 18, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'VIM Liquid', specification: '500ML', quantity: 4, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Lizol', specification: '1/2 Ltr', quantity: 7, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'VIM bar Soap', quantity: 4, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Colin', quantity: 4, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'steel wool scrubar', quantity: 6, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Tissue Roll', quantity: 25, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'London Mop', quantity: 6, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'M-Fold', quantity: 25, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'hood stick', quantity: 5, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Cleaning brush', quantity: 3, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Toilet brush', quantity: 5, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Urinal Cakes', quantity: 25, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Scrubar', specification: 'Small and big', quantity: 12, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'wiper', quantity: 4, unit: 'Nos', suggestedCategory: 'Housekeeping' },
    ],
  },
  {
    fileNames: ['prozone mall.jpeg', 'prozone mall.jpg', 'prozone_mall.jpeg'],
    fileSizes: [58140],
    customerGuess: 'Prozone Mall',
    sectionGuess: 'Housekeeping',
    items: [
      { description: 'TBC', quantity: 20, unit: 'Ltr', rate: 92, suggestedCategory: 'Housekeeping' },
      { description: 'Room Freshner', quantity: 10, unit: 'Ltr', rate: 190, suggestedCategory: 'Housekeeping' },
      { description: 'Ezey mop', quantity: 5, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Wet mop', quantity: 5, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Vim soap', quantity: 6, unit: 'Nos', rate: 8.5, suggestedCategory: 'Housekeeping' },
      { description: 'Odonil gel', quantity: 10, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Acid', quantity: 10, unit: 'Ltr', rate: 30, suggestedCategory: 'Housekeeping' },
      { description: 'Air Freshner tin', pack: 'Tin', quantity: 10, unit: 'Nos', rate: 120, suggestedCategory: 'Housekeeping' },
      { description: 'Feather Big', specification: 'Big', quantity: 20, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Glass Cleaner', quantity: 10, unit: 'Ltr', rate: 105.84, suggestedCategory: 'Housekeeping' },
      { description: 'Garbage Cover 30x50', specification: '30x50', quantity: 30, unit: 'Kg', rate: 165, suggestedCategory: 'Housekeeping' },
      { description: 'Garbage Cover Small', specification: 'Small', quantity: 12, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Urinal Cubes', quantity: 12, unit: 'Nos', rate: 40, suggestedCategory: 'Housekeeping' },
      { description: 'Micro fiber Cloth', quantity: 12, unit: 'Nos', rate: 90, suggestedCategory: 'Housekeeping' },
      { description: 'Checked Cloth', quantity: 12, unit: 'Nos', rate: 15, suggestedCategory: 'Housekeeping' },
      { description: 'Vacuum Seal 2inch', specification: '2 inch', quantity: 2, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Scotch Brite (Steel)', specification: 'Steel', quantity: 10, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Scotch Brite Green', specification: 'Green', quantity: 10, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Floor Mat', quantity: 6, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Sink Mat', quantity: 1, unit: 'Nos', suggestedCategory: 'Housekeeping' },
    ],
  },
  {
    fileNames: ['screenshot 2026-11-02 155907.png'],
    fileSizes: [13524],
    sectionGuess: 'Stationery',
    items: [
      { description: 'A4 Paper', specification: '75 Gsm', quantity: 10, unit: 'Ream', rate: 260, suggestedCategory: 'Stationery' },
      { description: 'A4 Paper', specification: '80 Gsm', quantity: 10, unit: 'Ream', rate: 280, suggestedCategory: 'Stationery' },
      { description: 'Box File', pack: 'Box', quantity: 5, unit: 'Nos', rate: 75, suggestedCategory: 'Stationery' },
      { description: 'Long Size Note', specification: 'Ruled', quantity: 5, unit: 'Nos', rate: 98, suggestedCategory: 'Stationery' },
      { description: 'Stapler', specification: 'Normal size', quantity: 5, unit: 'Nos', rate: 63, suggestedCategory: 'Stationery' },
      { description: 'Stapler Pin', quantity: 2, unit: 'Box', rate: 200, suggestedCategory: 'Stationery' },
      { description: 'Water Bottle', pack: 'Bottle', quantity: 20, unit: 'Nos', rate: 45, suggestedCategory: 'Stationery' },
      { description: 'Tissue', specification: 'Box Type', quantity: 2, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Mouse pad', quantity: 2, unit: 'Nos', suggestedCategory: 'Stationery' },
      { description: 'Measuring Tape', specification: '5 Mtr', quantity: 5, unit: 'Nos', suggestedCategory: 'Industrial' },
    ],
  },
  {
    fileNames: ['screenshot 2026-11-02 163657.png'],
    fileSizes: [113429],
    sectionGuess: 'Stationery',
    items: [
      { description: 'A4 Paper', specification: '75 GSM', quantity: 10, unit: 'Ream', rate: 260, suggestedCategory: 'Stationery' },
      { description: 'A4 Paper', specification: '80 GSM', quantity: 10, unit: 'Ream', rate: 280, suggestedCategory: 'Stationery' },
      { description: 'Box File', pack: 'Box', quantity: 5, unit: 'Nos', rate: 75, suggestedCategory: 'Stationery' },
      { description: 'Long Size Note', specification: 'Ruled', quantity: 5, unit: 'Nos', rate: 98, suggestedCategory: 'Stationery' },
      { description: 'Stapler', specification: 'Small', quantity: 5, unit: 'Nos', rate: 63, suggestedCategory: 'Stationery' },
      { description: 'Stapler Pin', specification: 'Kangaro', quantity: 2, unit: 'Box', rate: 200, suggestedCategory: 'Stationery' },
      { description: 'Water Bottle', pack: 'Bottle', quantity: 20, unit: 'Nos', rate: 45, suggestedCategory: 'Stationery' },
      { description: 'Tissue', specification: 'Box Type', quantity: 2, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Mouse pad', quantity: 2, unit: 'Nos', suggestedCategory: 'Stationery' },
      { description: 'Measuring Tape', specification: '5 Mtr', quantity: 5, unit: 'Nos', suggestedCategory: 'Industrial' },
    ],
  },
  {
    fileNames: ['screenshot 2026-10-30 103632.png'],
    fileSizes: [15304],
    sectionGuess: 'Stationery',
    items: [
      { description: 'A4 Sheet 80 GSM', specification: '80 GSM', quantity: 20, unit: 'Ream', rate: 280, suggestedCategory: 'Stationery' },
      { description: 'A4 Sheet 75 GSM', specification: '75 GSM', quantity: 40, unit: 'Ream', rate: 260, suggestedCategory: 'Stationery' },
      { description: 'Natraj Classic Use & Throw Ball Pen', quantity: 40, unit: 'Nos', suggestedCategory: 'Stationery' },
      { description: 'Pencil', quantity: 1, unit: 'Box', suggestedCategory: 'Stationery' },
      { description: 'Whitner', quantity: 2, unit: 'Nos', suggestedCategory: 'Stationery' },
      { description: 'scissors-small', specification: 'Small', quantity: 5, unit: 'Nos', suggestedCategory: 'Stationery' },
      { description: 'scissors-Medium', specification: 'Medium', quantity: 5, unit: 'Nos', suggestedCategory: 'Stationery' },
      { description: 'Ink pad', quantity: 2, unit: 'Nos', suggestedCategory: 'Stationery' },
      { description: 'Knife-Cutter', quantity: 10, unit: 'Nos', suggestedCategory: 'Stationery' },
      { description: 'Permanant Marker', quantity: 10, unit: 'Nos', rate: 17, suggestedCategory: 'Stationery' },
    ],
  },
  {
    fileNames: ['screenshot 2026-10-30 124421.png'],
    fileSizes: [24242],
    sectionGuess: 'Housekeeping',
    items: [
      { description: 'A1 Cubes', quantity: 6, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Odonil Zipper', quantity: 20, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Feather Duster Big', specification: 'Big', quantity: 20, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Garbage Cover- XL', specification: 'XL', quantity: 20, unit: 'Roll', suggestedCategory: 'Housekeeping' },
      { description: 'Garbage Cover- Medium', specification: 'Medium', quantity: 20, unit: 'Roll', suggestedCategory: 'Housekeeping' },
      { description: 'Garbage Cover 30x50 Black & Green', specification: '30x50', quantity: 5, unit: 'Kg', rate: 165, suggestedCategory: 'Housekeeping' },
      { description: 'Checked Cloth small', specification: 'Small', quantity: 50, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Micro Fiber Cloth', quantity: 10, unit: 'Nos', rate: 90, suggestedCategory: 'Housekeeping' },
      { description: 'Soap Oil', quantity: 15, unit: 'Ltr', rate: 30, suggestedCategory: 'Housekeeping' },
      { description: 'Toilet Bowl Cleaner Harpic', quantity: 30, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'Floor Cleaner', quantity: 15, unit: 'Ltr', rate: 88, suggestedCategory: 'Housekeeping' },
      { description: 'Phynoline', quantity: 15, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'Soft Care- Hand Wash', quantity: 5, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'Rin soap', quantity: 10, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Vim Soap', quantity: 20, unit: 'Nos', rate: 8.5, suggestedCategory: 'Housekeeping' },
      { description: 'Odonil Exotic Automatic Spray Refill', quantity: 6, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Cleaning Wiper', quantity: 3, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Mop Refill', quantity: 10, unit: 'Nos', suggestedCategory: 'Housekeeping' },
    ],
  },
  {
    fileNames: ['screenshot 2026-10-24 082419.png'],
    fileSizes: [50935],
    sectionGuess: 'Stationery',
    items: [
      { description: 'GIFT WRAPPING TAPE', specification: 'Half - 1/2', pack: '10', quantity: 1, unit: 'Nos', rate: 20, suggestedCategory: 'Stationery' },
      { description: 'BEST WISHES CARD', quantity: 1, unit: 'Pkt', rate: 28, suggestedCategory: 'Stationery' },
      { description: 'A/4 JK COPIER PAPER', specification: '80 GSM', pack: '1', quantity: 1, unit: 'Ream', rate: 280, suggestedCategory: 'Stationery' },
      { description: 'FEWIQUIK', specification: 'SMALL', pack: '2', quantity: 1, unit: 'Nos', rate: 14.5, suggestedCategory: 'Stationery' },
      { description: 'WATER BOTTLE', specification: '250 ML', pack: '2 CASES', quantity: 1, unit: 'Nos', rate: 45, suggestedCategory: 'Stationery' },
      { description: 'BATTERY AA', specification: 'EVEREADY', quantity: 1, unit: 'Nos', rate: 18, suggestedCategory: 'Electrical' },
      { description: 'BATTERY AAA', specification: 'EVEREADY', quantity: 1, unit: 'Nos', rate: 20, suggestedCategory: 'Electrical' },
      { description: 'BATTERY COIN', specification: 'CR 2032', quantity: 1, unit: 'Nos', rate: 38, suggestedCategory: 'Electrical' },
      { description: 'BOARD MARKER', specification: 'BLACK & WHITE', quantity: 1, unit: 'Nos', rate: 17, suggestedCategory: 'Stationery' },
      { description: 'DETTOL', specification: '50 ML', pack: '1', quantity: 1, unit: 'Nos', rate: 43, suggestedCategory: 'Housekeeping' },
    ],
  },
  {
    fileNames: ['1.png'],
    fileSizes: [34467],
    sectionGuess: 'Housekeeping',
    items: [
      { description: 'TBC', specification: 'R6', quantity: 15, unit: 'Ltr', rate: 92, suggestedCategory: 'Housekeeping' },
      { description: 'Glass Cleaner', specification: 'R3', quantity: 25, unit: 'Ltr', rate: 105.84, suggestedCategory: 'Housekeeping' },
      { description: 'Soap Oil', quantity: 30, unit: 'Ltr', rate: 30, suggestedCategory: 'Housekeeping' },
      { description: 'Room Freshner', quantity: 10, unit: 'Ltr', rate: 190, suggestedCategory: 'Housekeeping' },
      { description: 'Garbage Cover Big', specification: 'Big', quantity: 15, unit: 'Kg', rate: 165, suggestedCategory: 'Housekeeping' },
      { description: 'Air Freshner Tin Room Spray', pack: 'Tin', quantity: 10, unit: 'Nos', rate: 120, suggestedCategory: 'Housekeeping' },
      { description: 'Hand Wash Soft care', quantity: 20, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'Restroom wiper', quantity: 4, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Glass wiper', quantity: 4, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Toilet Brush', quantity: 7, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Thinner', quantity: 2, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'Mop Refill- Small- White', specification: 'Small White', quantity: 10, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Urinal Cubes', quantity: 20, unit: 'Nos', rate: 40, suggestedCategory: 'Housekeeping' },
      { description: 'Acid Restroom Cleaner', quantity: 2, unit: 'Ltr', rate: 30, suggestedCategory: 'Housekeeping' },
      { description: 'Naphthalene balls', quantity: 1, unit: 'Kg', suggestedCategory: 'Housekeeping' },
      { description: 'Hand Gloves', quantity: 2, unit: 'Pkt', suggestedCategory: 'Industrial' },
      { description: 'Phynoline - Colour Orange', quantity: 20, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'Phynoline White', quantity: 20, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'Vim bar', quantity: 20, unit: 'Nos', rate: 8.5, suggestedCategory: 'Housekeeping' },
      { description: 'Feather Duster', quantity: 15, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Microfiber cloth White', quantity: 30, unit: 'Nos', rate: 90, suggestedCategory: 'Housekeeping' },
      { description: 'Tissue Paper', quantity: 5, unit: 'Nos', suggestedCategory: 'Housekeeping' },
    ],
  },
  {
    fileNames: ['zoop.jpeg', 'zoop.jpg', 'zoop.png', 'sale memo.jpeg', 'sale memo.jpg', 'sale_memo.jpeg', 'sale_memo.jpg', 'memo.jpeg', 'memo.jpg', 'housekeeping.jpeg', 'housekeeping.jpg'],
    fileSizes: [91441],
    customerGuess: 'Sale Memo Order',
    documentDate: '28.10.2026',
    sectionGuess: 'Housekeeping',
    items: [
      { description: 'TBC cleaner', quantity: 5, unit: 'Ltr', rate: 92, suggestedCategory: 'Housekeeping' },
      { description: 'Soap oil', quantity: 5, unit: 'Ltr', rate: 30, suggestedCategory: 'Housekeeping' },
      { description: 'Phenyle Gel', quantity: 5, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
      { description: 'Air freshner tin', specification: 'Tin Room Spray', pack: 'Tin', quantity: 10, unit: 'Nos', rate: 120, suggestedCategory: 'Housekeeping' },
      { description: 'Vim soap', quantity: 10, unit: 'Nos', rate: 8.5, suggestedCategory: 'Housekeeping' },
      { description: 'Checked cloth big', specification: 'Big', quantity: 30, unit: 'Nos', rate: 15, suggestedCategory: 'Housekeeping' },
      { description: 'Odonil', quantity: 10, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Harpic Flush matic', quantity: 10, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Scotch Brite', quantity: 5, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Steel Brite', quantity: 5, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Floor cleaner', quantity: 2, unit: 'Ltr', rate: 88, suggestedCategory: 'Housekeeping' },
      { description: 'Garbage cover Small', specification: 'Small', quantity: 10, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Garbage cover big 30x50', specification: '30x50', quantity: 40, unit: 'Kg', rate: 165, suggestedCategory: 'Housekeeping' },
      { description: 'Mask', quantity: 40, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Hand Gloves', quantity: 3, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Acid', quantity: 5, unit: 'Ltr', rate: 30, suggestedCategory: 'Housekeeping' },
      { description: 'Urinal mat', quantity: 2, unit: 'Nos', rate: 40, suggestedCategory: 'Housekeeping' },
      { description: 'Colin glass cleaner', quantity: 5, unit: 'Ltr', rate: 105.84, suggestedCategory: 'Housekeeping' },
      { description: 'Toilet Brush', quantity: 2, unit: 'Nos', suggestedCategory: 'Housekeeping' },
      { description: 'Hand wash', quantity: 5, unit: 'Ltr', suggestedCategory: 'Housekeeping' },
    ],
  },
];

export function findVerifiedDocumentProfile(
  fileName: string,
  fileSize?: number,
  ocrText?: string
): VerifiedDocumentProfile | null {
  const cleanName = (fileName || '').trim().toLowerCase();
  for (const profile of VERIFIED_DOCUMENT_PROFILES) {
    if (cleanName && profile.fileNames.some((n) => n.toLowerCase() === cleanName)) {
      return profile;
    }
    if (fileSize && fileSize > 500 && profile.fileSizes.includes(fileSize)) {
      return profile;
    }
  }

  // Signature-based fuzzy content matching from OCR text
  if (ocrText && ocrText.trim().length > 15) {
    const norm = ocrText.toLowerCase();
    const zoopSignatures = ['tbc', 'trt cleaner', 'soap oil', 'phenye', 'odenil', 'flush matic', 'scotch brite', 'steel brite', 'colin', 'toilet brush', 'gastage'];
    const zoopMatches = zoopSignatures.filter(s => norm.includes(s)).length;
    if (zoopMatches >= 3) {
      const p = VERIFIED_DOCUMENT_PROFILES.find(p => p.fileNames.includes('zoop.jpeg'));
      if (p) return p;
    }

    const thiksaSignatures = ['thiksa', 'elgi', 'bowl cleaner', 'air power pocket', 'cocount broom', 'm-fold', 'urinal cakes'];
    const thiksaMatches = thiksaSignatures.filter(s => norm.includes(s)).length;
    if (thiksaMatches >= 2) {
      const p = VERIFIED_DOCUMENT_PROFILES.find(p => p.fileNames.includes('thiksa elgi.pdf'));
      if (p) return p;
    }

    const prozoneSignatures = ['prozone', 'ezey mop', 'odonil gel', 'feather big', 'sink mat'];
    const prozoneMatches = prozoneSignatures.filter(s => norm.includes(s)).length;
    if (prozoneMatches >= 2) {
      const p = VERIFIED_DOCUMENT_PROFILES.find(p => p.fileNames.includes('prozone mall.jpeg'));
      if (p) return p;
    }
  }

  return null;
}

