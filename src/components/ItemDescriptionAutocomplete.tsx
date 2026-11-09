'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Database } from 'lucide-react';
import { capitalizeInput } from '@/lib/utils/formatters';

export interface CatalogProduct {
  id: string;
  item_code?: string;
  description: string;
  normalized_name?: string;
  category?: string;
  specification?: string;
  pack?: string;
  unit: string;
  default_rate: number;
  default_gst_rate: number;
  last_verified_date?: string;
}

interface ItemDescriptionAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelectProduct: (product: CatalogProduct) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function ItemDescriptionAutocomplete({
  value,
  onChange,
  onSelectProduct,
  placeholder = 'Type material name...',
  className = '',
  autoFocus = false,
}: ItemDescriptionAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 360,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const query = (value || '').trim().toLowerCase();
  const filteredProducts = products.filter((p) => {
    if (!query) return true;
    const desc = (p.description || '').toLowerCase();
    const spec = (p.specification || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const code = (p.item_code || '').toLowerCase();
    const pack = (p.pack || '').toLowerCase();
    return (
      desc.includes(query) ||
      spec.includes(query) ||
      cat.includes(query) ||
      code.includes(query) ||
      pack.includes(query)
    );
  });

  const visibleProducts = filteredProducts.slice(0, 8);

  const updateCoords = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    const rect = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const desiredWidth = Math.min(Math.max(rect.width, vw < 640 ? 310 : 420), vw - 20);
    const clampedLeft = Math.max(10, Math.min(rect.left, vw - desiredWidth - 10));
    const estimatedHeight = menuRef.current?.offsetHeight || 280;
    const dropUp = vh - rect.bottom < 220 && rect.top > vh - rect.bottom;
    setPlacement(dropUp ? 'top' : 'bottom');
    setCoords({
      top: dropUp ? Math.max(8, rect.top - estimatedHeight - 6) : rect.bottom + 6,
      left: clampedLeft,
      width: desiredWidth,
    });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let raf1: number | null = null;
    let raf2: number | null = null;

    if (isOpen) {
      updateCoords();
      setShouldRender(true);
      raf1 = requestAnimationFrame(() => {
        updateCoords();
        raf2 = requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      timer = setTimeout(() => setShouldRender(false), 145);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (raf1 !== null) cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [isOpen, updateCoords]);

  useEffect(() => {
    if (!shouldRender) return;
    const onScrollOrResize = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateCoords);
    };
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [shouldRender, updateCoords]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (product: CatalogProduct) => {
    onSelectProduct(product);
    setIsOpen(false);
    setSelectedIndex(-1);

    setTimeout(() => {
      if (containerRef.current) {
        const tr = containerRef.current.closest('tr');
        if (tr) {
          const qtyInput = tr.querySelector(
            'input[aria-label="Quantity"], input[type="number"]'
          ) as HTMLInputElement | null;
          if (qtyInput) {
            qtyInput.focus();
            qtyInput.select();
          }
        }
      }
    }, 60);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'Enter') {
      if (isOpen && visibleProducts.length > 0) {
        e.preventDefault();
        const targetIndex =
          selectedIndex >= 0 && selectedIndex < visibleProducts.length ? selectedIndex : 0;
        handleSelect(visibleProducts[targetIndex]);
        return;
      }
      const tr = containerRef.current?.closest('tr');
      const qtyInput = tr?.querySelector(
        'input[aria-label="Quantity"], input[type="number"]'
      ) as HTMLInputElement | null;
      if (qtyInput) {
        e.preventDefault();
        qtyInput.focus();
        qtyInput.select();
      }
      return;
    }

    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < visibleProducts.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : visibleProducts.length - 1));
    } else if (e.key === 'Tab') {
      if (visibleProducts.length > 0) {
        const targetIndex =
          selectedIndex >= 0 && selectedIndex < visibleProducts.length ? selectedIndex : 0;
        handleSelect(visibleProducts[targetIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const dropdownPortal = (
    <div
      ref={menuRef}
      data-state={isVisible ? 'open' : 'closed'}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        maxWidth: 'calc(100vw - 20px)',
        zIndex: 99999,
      }}
      className={`glass-select-menu glass-dropdown-motion ${
        placement === 'top' ? 'origin-bottom' : 'origin-top'
      } max-h-76 overflow-y-auto rounded-2xl p-1.5 ${
        isVisible
          ? 'opacity-100 scale-100 translate-y-0'
          : placement === 'top'
          ? 'opacity-0 scale-[0.96] translate-y-1.5 pointer-events-none'
          : 'opacity-0 scale-[0.96] -translate-y-1.5 pointer-events-none'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-slate-200/80 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/80 rounded-t-xl">
        <span className="flex items-center gap-1.5 text-blue-900 font-bold">
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span>Rate Library Memory</span>
        </span>
        <span className="text-[10px] text-slate-600 font-semibold font-mono">
          {visibleProducts.length} {visibleProducts.length === 1 ? 'item' : 'items'} found
        </span>
      </div>

      {/* List of matching products */}
      <div className="divide-y divide-slate-100/80 py-1">
        {visibleProducts.length > 0 ? (
          visibleProducts.map((p, idx) => {
            const isSelected = selectedIndex === idx || (selectedIndex === -1 && idx === 0);
            return (
              <div
                key={p.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(p);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-50/95 text-blue-950 border border-blue-300/90 ring-1 ring-blue-500/20'
                    : 'hover:bg-white/80 text-slate-800 border border-transparent'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs truncate flex items-center gap-1.5">
                    {p.item_code && (
                      <span className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                        {p.item_code}
                      </span>
                    )}
                    <span className="truncate text-slate-900">{p.description}</span>
                    {p.category && (
                      <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {p.category}
                      </span>
                    )}
                    {isSelected && (
                      <span className="hidden sm:inline-block shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white shadow-2xs">
                        ↵ Enter
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-600 flex items-center gap-1.5 mt-0.5 truncate">
                    {p.specification && (
                      <span className="font-medium text-slate-700">{p.specification}</span>
                    )}
                    {p.specification && p.pack && <span>•</span>}
                    {p.pack && <span>Pack: {p.pack}</span>}
                    {(p.specification || p.pack) && <span>•</span>}
                    <span>
                      Unit: <strong className="text-slate-800">{p.unit}</strong>
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-extrabold text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    ₹{Number(p.default_rate || 0).toFixed(2)}
                  </div>
                  <div className="text-[9px] font-bold text-slate-500 mt-0.5">
                    {p.default_gst_rate || 18}% GST
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-3 py-4 text-center">
            <p className="text-xs font-bold text-slate-800">
              {query ? `"${query}" is not in Rate Memory yet` : 'No products in Rate Memory'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Type your item name, spec, and rate — it will be automatically learned and quoted in Rate Memory for future quotations!
            </p>
          </div>
        )}
      </div>

      {query &&
        visibleProducts.length > 0 &&
        !visibleProducts.some((p) => p.description.toLowerCase() === query) && (
          <div className="mt-1 pt-1.5 border-t border-slate-200/80 px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-600 bg-slate-50/90 rounded-lg">
            <span className="flex items-center gap-1 truncate">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">
                Or enter new: <strong className="text-slate-900">&quot;{value}&quot;</strong>
              </span>
            </span>
            <span className="text-[9px] text-blue-700 font-bold shrink-0">Auto-learns on save</span>
          </div>
        )}
    </div>
  );

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-30' : 'z-10'}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onFocus={() => {
          loadProducts();
          updateCoords();
          setIsOpen(true);
        }}
        onChange={(e) => {
          onChange(capitalizeInput(e.target.value));
          updateCoords();
          setIsOpen(true);
          setSelectedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        className={
          className ||
          'glass-input-pure-white w-full px-2.5 py-1.5 text-xs sm:text-[12pt] font-semibold rounded-xl text-slate-900'
        }
      />

      {shouldRender && mounted && typeof document !== 'undefined'
        ? createPortal(dropdownPortal, document.body)
        : null}
    </div>
  );
}
