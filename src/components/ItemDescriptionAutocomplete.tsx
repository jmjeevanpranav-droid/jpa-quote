'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load products from API
  const loadProducts = async () => {
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (e) {
      // Graceful fallback
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Filter products based on current input value (matches description, spec, category, item_code, pack)
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

  // Limit suggestions to top 8 items for a clean dropdown
  const visibleProducts = filteredProducts.slice(0, 8);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (product: CatalogProduct) => {
    onSelectProduct(product);
    setIsOpen(false);
    setSelectedIndex(-1);

    // Automatically focus the Quantity field in the same table row
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
        // If user navigated with arrows, select that item; otherwise auto-select the top match!
        const targetIndex = selectedIndex >= 0 && selectedIndex < visibleProducts.length ? selectedIndex : 0;
        handleSelect(visibleProducts[targetIndex]);
        return;
      }
      // If dropdown is closed or empty, allow Enter to shift focus to Quantity
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
      // Tab accepts top suggestion and moves forward
      if (visibleProducts.length > 0) {
        const targetIndex = selectedIndex >= 0 && selectedIndex < visibleProducts.length ? selectedIndex : 0;
        handleSelect(visibleProducts[targetIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onFocus={() => {
          loadProducts(); // Fresh fetch on focus
          setIsOpen(true);
        }}
        onChange={(e) => {
          onChange(capitalizeInput(e.target.value));
          setIsOpen(true);
          setSelectedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        className={
          className ||
          'glass-input-pure-white w-full px-2.5 py-1.5 text-xs sm:text-[12pt] font-semibold rounded-xl text-slate-900'
        }
      />

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-[340px] sm:w-[440px] max-h-76 overflow-y-auto rounded-2xl bg-white border border-slate-300 shadow-2xl z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/80 rounded-t-xl">
            <span className="flex items-center gap-1.5 text-blue-900 font-bold">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>Rate Library Memory</span>
            </span>
            <span className="text-[10px] text-slate-600 font-semibold font-mono">
              {visibleProducts.length} {visibleProducts.length === 1 ? 'item' : 'items'} found
            </span>
          </div>

          {/* List of matching products */}
          <div className="divide-y divide-slate-100 py-1">
            {visibleProducts.length > 0 ? (
              visibleProducts.map((p, idx) => {
                const isSelected = selectedIndex === idx || (selectedIndex === -1 && idx === 0);
                return (
                  <div
                    key={p.id}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur before click registers
                      handleSelect(p);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-50 text-blue-950 border border-blue-300 ring-1 ring-blue-500/20'
                        : 'hover:bg-slate-50 text-slate-800 border border-transparent'
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
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white shadow-2xs">
                            ↵ Enter
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-600 flex items-center gap-1.5 mt-0.5 truncate">
                        {p.specification && <span className="font-medium text-slate-700">{p.specification}</span>}
                        {p.specification && p.pack && <span>•</span>}
                        {p.pack && <span>Pack: {p.pack}</span>}
                        {(p.specification || p.pack) && <span>•</span>}
                        <span>Unit: <strong className="text-slate-800">{p.unit}</strong></span>
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

          {/* New Item Hint Footer */}
          {query &&
            visibleProducts.length > 0 &&
            !visibleProducts.some((p) => p.description.toLowerCase() === query) && (
              <div className="mt-1 pt-1.5 border-t border-slate-200 px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-600 bg-slate-50 rounded-lg">
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
      )}
    </div>
  );
}
