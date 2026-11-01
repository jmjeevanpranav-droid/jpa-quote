import type { Client } from '@libsql/client';
import { getDb } from '../db/client';
import { normalizeCompanyName } from '../utils/formatters';

export interface RateMatchQuery {
  description: string;
  specification?: string;
  pack?: string;
  unit?: string;
  customerId?: string;
}

export interface RateMatchResult {
  matched: boolean;
  confidence: 'exact' | 'high' | 'none';
  productId?: string;
  description?: string;
  specification?: string;
  pack?: string;
  unit?: string;
  rate?: number;
  gstRate?: number;
  savedRateDate?: string;
  sourceQuoteNumber?: string;
  badgeText?: string;
}

export interface ProductCatalogItem {
  id: string;
  item_code?: string;
  description: string;
  normalized_name: string;
  category: string;
  specification?: string;
  pack?: string;
  unit: string;
  default_rate: number;
  default_gst_rate: number;
  last_verified_date?: string;
  last_verified_source?: string;
  created_at: string;
  updated_at: string;
}

export interface RateHistoryEntry {
  id: string;
  product_id: string;
  old_rate: number;
  new_rate: number;
  change_date: string;
  source_quote_number?: string;
  changed_by?: string;
  notes?: string;
  created_at: string;
}

/**
 * Normalizes text for rate matching
 */
export function normalizeItemText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Automatically resequence all active product item codes to be strictly gapless and consecutive:
 * JPA-001, JPA-002, JPA-003, ...
 * Ensures that deleting an item closes any gaps immediately, and adding an item continues consecutively.
 */
export async function resequenceItemCodes(dbOrClient?: any): Promise<void> {
  const db = dbOrClient || getDb();

  const result = await db.execute(`
    SELECT id, item_code 
    FROM products 
    WHERE is_active = 1
    ORDER BY 
      CASE 
        WHEN item_code LIKE 'JPA-%' THEN CAST(SUBSTR(item_code, 5) AS INTEGER)
        WHEN item_code LIKE '%-%' THEN 900000 + CAST(SUBSTR(item_code, INSTR(item_code, '-') + 1) AS INTEGER)
        ELSE 999999
      END ASC,
      created_at ASC,
      id ASC
  `);

  if (!result.rows || result.rows.length === 0) return;

  const updates: { id: string; targetCode: string }[] = [];
  let hasChanges = false;

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];
    const targetCode = `JPA-${String(i + 1).padStart(3, '0')}`;
    if (String(row.item_code || '').trim() !== targetCode) {
      hasChanges = true;
    }
    updates.push({ id: String(row.id), targetCode });
  }

  if (!hasChanges) return;

  for (const u of updates) {
    await db.execute({
      sql: `UPDATE products SET item_code = ? WHERE id = ?`,
      args: [u.targetCode, u.id],
    });
  }
}

/**
 * Auto-generate consecutive item code in format "JPA-001", "JPA-002", etc.
 */
export async function getNextItemCode(dbOrClient?: any): Promise<string> {
  const db = dbOrClient || getDb();
  await resequenceItemCodes(db);
  const countRes = await db.execute(`SELECT COUNT(*) as cnt FROM products WHERE is_active = 1`);
  const count = Number(countRes.rows[0]?.cnt || 0);
  return `JPA-${String(count + 1).padStart(3, '0')}`;
}

/**
 * Ensure all existing products are strictly resequenced to consecutive JPA-001, JPA-002, etc.
 */
export async function backfillMissingItemCodes(dbOrClient?: any): Promise<void> {
  return resequenceItemCodes(dbOrClient);
}

/**
 * Find matching rate from persistent Rate Memory
 */
export async function findMatchingRate(query: RateMatchQuery): Promise<RateMatchResult> {
  const norm = normalizeItemText(query.description);
  if (!norm || norm.length < 2) {
    return { matched: false, confidence: 'none' };
  }

  const db = getDb();

  // 1. Try exact normalized name match
  let result = await db.execute({
    sql: `SELECT * FROM products WHERE normalized_name = ? AND is_active = 1 LIMIT 1`,
    args: [norm]
  });

  // 2. If not found, try alias lookup
  if (result.rows.length === 0) {
    result = await db.execute({
      sql: `SELECT p.* FROM products p 
            INNER JOIN product_aliases a ON p.id = a.product_id 
            WHERE LOWER(a.alias_text) = ? AND p.is_active = 1 LIMIT 1`,
      args: [norm]
    });
  }

  // 3. If not found, try fuzzy containment match where product contains query or vice versa
  if (result.rows.length === 0) {
    result = await db.execute({
      sql: `SELECT * FROM products 
            WHERE is_active = 1 AND (normalized_name LIKE ? OR ? LIKE ('%' || normalized_name || '%'))
            ORDER BY LENGTH(normalized_name) DESC LIMIT 1`,
      args: [`%${norm}%`, norm]
    });
  }

  if (result.rows.length === 0) {
    if (query.customerId) {
      try {
        const custRes = await db.execute({
          sql: 'SELECT id, company_name, folder_name FROM customers WHERE id = ?',
          args: [query.customerId],
        });

        let relatedCustomerIds: string[] = [query.customerId];
        let companyGroup = '';

        if (custRes.rows.length > 0) {
          const cRow = custRes.rows[0];
          const cFolder = cRow.folder_name ? String(cRow.folder_name).trim() : '';
          const cCompany = String(cRow.company_name || '');
          companyGroup = cFolder || normalizeCompanyName(cCompany);

          if (companyGroup) {
            const siblingsRes = await db.execute({
              sql: `SELECT id FROM customers 
                    WHERE id = ? 
                       OR (folder_name IS NOT NULL AND LOWER(folder_name) = LOWER(?))
                       OR LOWER(company_name) LIKE ?`,
              args: [query.customerId, companyGroup, `%${companyGroup.toLowerCase()}%`],
            });
            relatedCustomerIds = Array.from(new Set([query.customerId, ...siblingsRes.rows.map((r) => String(r.id))]));
          }
        }

        const placeholders = relatedCustomerIds.map(() => '?').join(',');
        const prevQuoteItem = await db.execute({
          sql: `SELECT qi.description, qi.specification, qi.pack, qi.unit, qi.unit_rate, qi.gst_rate, q.quote_date, q.quote_number
                FROM quotation_items qi
                JOIN quotations q ON qi.quotation_id = q.id
                WHERE (
                  q.customer_id IN (${placeholders})
                  ${companyGroup ? 'OR LOWER(q.customer_name) LIKE ?' : ''}
                )
                AND (
                  LOWER(qi.description) = ?
                  OR LOWER(qi.description) LIKE ?
                  OR ? LIKE ('%' || LOWER(qi.description) || '%')
                )
                AND qi.unit_rate > 0
                ORDER BY q.quote_date DESC, q.created_at DESC LIMIT 1`,
          args: companyGroup
            ? [...relatedCustomerIds, `%${companyGroup.toLowerCase()}%`, norm, `%${norm}%`, norm]
            : [...relatedCustomerIds, norm, `%${norm}%`, norm],
        });

        if (prevQuoteItem.rows.length > 0) {
          const pRow = prevQuoteItem.rows[0];
          const prevDate = String(pRow.quote_date || '');
          const prevQuote = String(pRow.quote_number || '');
          const badgeText = prevDate ? `Saved rate (${companyGroup || 'Client'}) · ${prevDate}` : 'Saved rate';

          return {
            matched: true,
            confidence: 'high',
            description: String(pRow.description),
            specification: pRow.specification ? String(pRow.specification) : undefined,
            pack: pRow.pack ? String(pRow.pack) : undefined,
            unit: String(pRow.unit || 'Nos'),
            rate: Number(pRow.unit_rate),
            gstRate: Number(pRow.gst_rate || 18),
            savedRateDate: prevDate,
            sourceQuoteNumber: prevQuote,
            badgeText,
          };
        }
      } catch (err) {
        console.error('Error finding unlisted company rate:', err);
      }
    }

    return { matched: false, confidence: 'none' };
  }

  const row = result.rows[0];
  const prodId = String(row.id);
  let effectiveRate = Number(row.default_rate);
  let sourceQuote = row.last_verified_source ? String(row.last_verified_source) : undefined;
  let savedDate = row.last_verified_date ? String(row.last_verified_date) : undefined;

  // Check customer and company group rate overrides if customerId is provided
  if (query.customerId) {
    try {
      const custRes = await db.execute({
        sql: 'SELECT id, company_name, folder_name FROM customers WHERE id = ?',
        args: [query.customerId],
      });

      let relatedCustomerIds: string[] = [query.customerId];
      let companyGroup = '';

      if (custRes.rows.length > 0) {
        const cRow = custRes.rows[0];
        const cFolder = cRow.folder_name ? String(cRow.folder_name).trim() : '';
        const cCompany = String(cRow.company_name || '');
        companyGroup = cFolder || normalizeCompanyName(cCompany);

        if (companyGroup) {
          const siblingsRes = await db.execute({
            sql: `SELECT id FROM customers 
                  WHERE id = ? 
                     OR (folder_name IS NOT NULL AND LOWER(folder_name) = LOWER(?))
                     OR LOWER(company_name) LIKE ?`,
            args: [query.customerId, companyGroup, `%${companyGroup.toLowerCase()}%`],
          });
          relatedCustomerIds = Array.from(new Set([query.customerId, ...siblingsRes.rows.map((r) => String(r.id))]));
        }
      }

      const placeholders = relatedCustomerIds.map(() => '?').join(',');
      const custRate = await db.execute({
        sql: `SELECT rate, effective_from, source_quote_number FROM product_rates 
              WHERE product_id = ? AND customer_id IN (${placeholders})
              ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
        args: [prodId, ...relatedCustomerIds],
      });

      if (custRate.rows.length > 0) {
        effectiveRate = Number(custRate.rows[0].rate);
        savedDate = String(custRate.rows[0].effective_from);
        sourceQuote = custRate.rows[0].source_quote_number ? String(custRate.rows[0].source_quote_number) : sourceQuote;
      } else {
        const prevQuoteItem = await db.execute({
          sql: `SELECT qi.unit_rate, qi.gst_rate, q.quote_date, q.quote_number, q.customer_name
                FROM quotation_items qi
                JOIN quotations q ON qi.quotation_id = q.id
                WHERE (
                  q.customer_id IN (${placeholders})
                  ${companyGroup ? 'OR LOWER(q.customer_name) LIKE ?' : ''}
                )
                AND (
                  LOWER(qi.description) = ?
                  OR qi.product_id = ?
                  OR LOWER(qi.description) LIKE ?
                )
                AND qi.unit_rate > 0
                ORDER BY q.quote_date DESC, q.created_at DESC LIMIT 1`,
          args: companyGroup
            ? [...relatedCustomerIds, `%${companyGroup.toLowerCase()}%`, norm, prodId, `%${norm}%`]
            : [...relatedCustomerIds, norm, prodId, `%${norm}%`],
        });

        if (prevQuoteItem.rows.length > 0) {
          effectiveRate = Number(prevQuoteItem.rows[0].unit_rate);
          savedDate = String(prevQuoteItem.rows[0].quote_date);
          sourceQuote = String(prevQuoteItem.rows[0].quote_number);
        }
      }
    } catch (err) {
      console.error('Error matching company rates:', err);
    }
  }

  const badgeText = savedDate ? `Saved rate · ${savedDate}` : 'Saved rate';

  return {
    matched: true,
    confidence: row.normalized_name === norm ? 'exact' : 'high',
    productId: prodId,
    description: String(row.description),
    specification: row.specification ? String(row.specification) : undefined,
    pack: row.pack ? String(row.pack) : undefined,
    unit: String(row.unit),
    rate: effectiveRate,
    gstRate: Number(row.default_gst_rate),
    savedRateDate: savedDate,
    sourceQuoteNumber: sourceQuote,
    badgeText,
  };
}

/**
 * Learn and remember new/updated rates permanently when a quotation is saved or finalized
 */
export async function learnAndUpsertRates(
  items: Array<{
    description: string;
    specification?: string;
    pack?: string;
    unit: string;
    unitRate: number;
    gstRate?: number;
    productId?: string;
  }>,
  quoteNumber: string,
  quoteDate: string,
  customerId?: string,
  changedBy: string = 'Staff',
  executor?: Pick<Client, 'execute'>
) {
  const db = executor || getDb();
  const now = new Date().toISOString();

  for (const item of items) {
    const desc = item.description?.trim();
    const rate = Number(item.unitRate) || 0;
    const gst = Number(item.gstRate ?? 18);
    const unit = item.unit?.trim() || 'Nos';

    if (!desc || rate <= 0) continue;

    const norm = normalizeItemText(desc);

    // Check if product exists
    const existing = await db.execute({
      sql: `SELECT id, default_rate, default_gst_rate FROM products WHERE normalized_name = ? LIMIT 1`,
      args: [norm]
    });

    if (existing.rows.length > 0) {
      const prodId = String(existing.rows[0].id);
      const currentRate = Number(existing.rows[0].default_rate);

      // If customer specific rate requested
      if (customerId) {
        await db.execute({
          sql: `INSERT INTO product_rates (id, product_id, customer_id, rate, effective_from, source_quote_number, change_reason, updated_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            `prate_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            prodId,
            customerId,
            rate,
            quoteDate,
            quoteNumber,
            'Quotation Rate Entry',
            changedBy,
            now
          ]
        });
      }

      // If master rate differs, update master rate and append to price change history
      if (Math.abs(currentRate - rate) > 0.001 || Number(existing.rows[0].default_gst_rate) !== gst) {
        await db.execute({
          sql: `INSERT INTO rate_change_history (
            id, product_id, old_rate, new_rate, change_date, source_quote_number, changed_by, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            prodId,
            currentRate,
            rate,
            quoteDate,
            quoteNumber,
            changedBy,
            `Rate updated via Quotation ${quoteNumber}`,
            now
          ]
        });

        await db.execute({
          sql: `UPDATE products SET 
                default_rate = ?, 
                default_gst_rate = ?, 
                specification = COALESCE(?, specification),
                pack = COALESCE(?, pack),
                unit = COALESCE(?, unit),
                last_verified_date = ?, 
                last_verified_source = ?, 
                updated_at = ? 
                WHERE id = ?`,
          args: [
            rate,
            gst,
            item.specification?.trim() || null,
            item.pack?.trim() || null,
            unit?.trim() || null,
            quoteDate,
            quoteNumber,
            now,
            prodId,
          ],
        });
      } else if (item.specification || item.pack || item.unit) {
        await db.execute({
          sql: `UPDATE products SET 
                specification = COALESCE(?, specification),
                pack = COALESCE(?, pack),
                unit = COALESCE(?, unit),
                updated_at = ? 
                WHERE id = ?`,
          args: [
            item.specification?.trim() || null,
            item.pack?.trim() || null,
            unit?.trim() || null,
            now,
            prodId,
          ],
        });
      }
    } else {
      // Create brand new product in central catalog with consecutive JPA Item Code!
      const newProdId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nextItemCode = await getNextItemCode(db);
      const cat = desc.toLowerCase().includes('paper') || desc.toLowerCase().includes('pen') || desc.toLowerCase().includes('stapler')
        ? 'Stationery'
        : 'Housekeeping';

      await db.execute({
        sql: `INSERT INTO products (
          id, item_code, description, normalized_name, category, specification, pack, unit, 
          default_rate, default_gst_rate, is_active, last_verified_date, 
          last_verified_source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        args: [
          newProdId,
          nextItemCode,
          desc,
          norm,
          cat,
          item.specification?.trim() || null,
          item.pack?.trim() || null,
          unit,
          rate,
          gst,
          quoteDate,
          quoteNumber,
          now,
          now
        ]
      });

      // Record initial history
      await db.execute({
        sql: `INSERT INTO rate_change_history (
          id, product_id, old_rate, new_rate, change_date, source_quote_number, changed_by, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          newProdId,
          rate,
          rate,
          quoteDate,
          quoteNumber,
          changedBy,
          `Initial product and verified rate learned from Quotation ${quoteNumber}`,
          now
        ]
      });
    }
  }

  // Ensure all active products maintain strictly gapless, consecutive JPA Item Codes
  await resequenceItemCodes(db);
}
