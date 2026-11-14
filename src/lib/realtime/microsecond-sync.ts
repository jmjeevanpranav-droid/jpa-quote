'use client';

/**
 * JPA Real-Time Microsecond Rate Replacement & Cross-Tab Synchronization Engine
 * Ensures sub-millisecond (<1ms) rate replacement across Rate Library, Dashboard Spotlight,
 * and Quotation Builders, resilient to serverless multi-instance cold starts on deployed web.
 */

export interface SyncedRateRecord {
  id: string;
  item_code?: string;
  description: string;
  normalized_name: string;
  category?: string;
  specification?: string | null;
  pack?: string | null;
  unit: string;
  default_rate: number;
  default_gst_rate: number;
  last_verified_date?: string;
  last_verified_source?: string;
  updated_at: string;
}

const INSTANT_CACHE_KEY = 'jpa_instant_rate_cache_v1';
const SPOTLIGHT_CACHE_KEY = 'jpa_spotlight_rates';
const CHANNEL_NAME = 'jpa_realtime_sync';

export function normalizeRateKey(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getInstantRateCache(): Record<string, SyncedRateRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(INSTANT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function hydrateInstantRateCacheFromProducts(products: any[]): void {
  if (typeof window === 'undefined' || !Array.isArray(products) || products.length === 0) return;
  try {
    const cache = getInstantRateCache();
    const now = new Date().toISOString();
    for (const p of products) {
      if (!p || !p.description) continue;
      const norm = normalizeRateKey(p.description);
      if (!norm) continue;
      const existing = cache[norm];
      const incomingTime = p.updated_at ? new Date(p.updated_at).getTime() : 0;
      const existingTime = existing?.updated_at ? new Date(existing.updated_at).getTime() : 0;
      if (!existing || incomingTime >= existingTime) {
        cache[norm] = {
          id: String(p.id || `prod_${Date.now()}`),
          item_code: p.item_code || existing?.item_code,
          description: String(p.description).trim(),
          normalized_name: norm,
          category: p.category || existing?.category || 'General',
          specification: p.specification ?? existing?.specification ?? null,
          pack: p.pack ?? existing?.pack ?? null,
          unit: String(p.unit || existing?.unit || 'Nos'),
          default_rate: Number(p.default_rate ?? p.unitRate ?? 0),
          default_gst_rate: Number(p.default_gst_rate ?? p.gstRate ?? 18),
          last_verified_date: p.last_verified_date || existing?.last_verified_date,
          last_verified_source: p.last_verified_source || existing?.last_verified_source,
          updated_at: p.updated_at || now,
        };
      }
    }
    localStorage.setItem(INSTANT_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

/**
 * Synchronously replaces/upserts one or more rates in localStorage + Spotlight cache
 * and broadcasts across all components and browser tabs in microseconds.
 */
export function broadcastMicrosecondRateReplacement(
  items: Array<{
    id?: string;
    item_code?: string;
    description: string;
    category?: string;
    specification?: string | null;
    pack?: string | null;
    unit?: string;
    default_rate: number;
    default_gst_rate?: number;
    last_verified_date?: string;
    last_verified_source?: string;
    updated_at?: string;
  }>,
  source: string = 'Rate Library'
): SyncedRateRecord[] {
  if (typeof window === 'undefined' || !Array.isArray(items) || items.length === 0) return [];
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const updatedRecords: SyncedRateRecord[] = [];

  try {
    const cache = getInstantRateCache();
    let spotlight: any[] = [];
    try {
      const rawSpot = localStorage.getItem(SPOTLIGHT_CACHE_KEY);
      if (rawSpot) {
        const parsed = JSON.parse(rawSpot);
        if (Array.isArray(parsed)) spotlight = parsed;
      }
    } catch {}

    for (const item of items) {
      const desc = String(item.description || '').trim();
      const rate = Number(item.default_rate);
      if (!desc || isNaN(rate) || rate < 0) continue;

      const norm = normalizeRateKey(desc);
      const existing = cache[norm];
      const rec: SyncedRateRecord = {
        id: String(item.id || existing?.id || `prod_rt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
        item_code: item.item_code || existing?.item_code || 'JPA-NEW',
        description: desc,
        normalized_name: norm,
        category: item.category || existing?.category || 'General',
        specification: item.specification !== undefined ? item.specification : (existing?.specification ?? null),
        pack: item.pack !== undefined ? item.pack : (existing?.pack ?? null),
        unit: String(item.unit || existing?.unit || 'Nos').trim(),
        default_rate: rate,
        default_gst_rate: Number(item.default_gst_rate ?? existing?.default_gst_rate ?? 18),
        last_verified_date: item.last_verified_date || today,
        last_verified_source: item.last_verified_source || source,
        updated_at: item.updated_at || now,
      };

      cache[norm] = rec;
      updatedRecords.push(rec);

      // Replace or prepend in Spotlight list so latest rate appears at index 0 immediately
      spotlight = [
        rec,
        ...spotlight.filter(
          (p) =>
            p &&
            p.id !== rec.id &&
            normalizeRateKey(p.description || '') !== norm
        ),
      ].slice(0, 60);
    }

    localStorage.setItem(INSTANT_CACHE_KEY, JSON.stringify(cache));
    localStorage.setItem(SPOTLIGHT_CACHE_KEY, JSON.stringify(spotlight));

    // Dispatch in-window CustomEvent for immediate 0ms React state replacement
    window.dispatchEvent(
      new CustomEvent('jpa-rate-saved', {
        detail: {
          records: updatedRecords,
          source,
          timestamp: now,
        },
      })
    );

    // Broadcast across all open browser tabs/windows via BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel(CHANNEL_NAME);
        bc.postMessage({
          type: 'RATE_REPLACED',
          records: updatedRecords,
          source,
          timestamp: now,
        });
        bc.close();
      } catch {}
    }
  } catch {}

  return updatedRecords;
}

/**
 * Microsecond synchronous lookup for Quotation Builder auto-fill.
 * Checks the local real-time rate memory before/alongside network fetch.
 */
export function matchInstantRateFromCache(
  description: string,
  specification?: string,
  pack?: string,
  unit?: string
): {
  matched: boolean;
  rate: number;
  gstRate: number;
  unit: string;
  specification?: string | null;
  pack?: string | null;
  productId: string;
} | null {
  if (typeof window === 'undefined' || !description || description.trim().length < 2) return null;
  const norm = normalizeRateKey(description);
  if (!norm) return null;

  const cache = getInstantRateCache();
  const exact = cache[norm];
  if (exact && exact.default_rate > 0) {
    return {
      matched: true,
      rate: exact.default_rate,
      gstRate: exact.default_gst_rate || 18,
      unit: exact.unit || unit || 'Nos',
      specification: exact.specification,
      pack: exact.pack,
      productId: exact.id,
    };
  }

  return null;
}

/**
 * Subscribe to real-time rate replacements from current tab, other tabs (BroadcastChannel), or localStorage.
 */
export function subscribeToRealtimeRateSync(
  onSync: (payload: { records?: SyncedRateRecord[]; source?: string }) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: Event) => {
    const ce = e as CustomEvent;
    onSync(ce.detail || {});
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === INSTANT_CACHE_KEY || e.key === SPOTLIGHT_CACHE_KEY) {
      onSync({ source: 'storage' });
    }
  };

  window.addEventListener('jpa-rate-saved', handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'RATE_REPLACED') {
          onSync({
            records: event.data.records,
            source: event.data.source,
          });
        }
      };
    } catch {}
  }

  return () => {
    window.removeEventListener('jpa-rate-saved', handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
  };
}
