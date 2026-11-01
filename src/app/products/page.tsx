'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';
import {
  Database,
  Search,
  Plus,
  History,
  TrendingUp,
  ShieldCheck,
  X,
  Loader2,
  Calendar,
  Sparkles,
  RotateCcw,
  Trash2,
  Pencil,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { formatINR } from '@/lib/calculations/financial';
import { GlassSelect } from '@/components/GlassSelect';
import { capitalizeInput } from '@/lib/utils/formatters';

export default function RateLibraryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Price History Modal state
  const [activeHistoryProduct, setActiveHistoryProduct] = useState<any | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // New Product Modal state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newItemCode, setNewItemCode] = useState('JPA-001');
  const [newDesc, setNewDesc] = useState('');
  const [newSpec, setNewSpec] = useState('');
  const [newPack, setNewPack] = useState('');
  const [newUnit, setNewUnit] = useState('Nos');
  const [newRate, setNewRate] = useState('');
  const [newGst, setNewGst] = useState('18');
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Edit Product Modal state
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editSpec, setEditSpec] = useState('');
  const [editPack, setEditPack] = useState('');
  const [editUnit, setEditUnit] = useState('Nos');
  const [editRate, setEditRate] = useState('');
  const [editGst, setEditGst] = useState('18');
  const [saveTelemetry, setSaveTelemetry] = useState<{
    durationMs?: number;
    productName: string;
    rate: number;
    savedAt?: Date;
  } | null>(null);

  useEffect(() => {
    if (saveTelemetry) {
      const t = setTimeout(() => setSaveTelemetry(null), 4000);
      return () => clearTimeout(t);
    }
  }, [saveTelemetry]);

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setEditDesc(product.description || '');
    setEditSpec(product.specification || '');
    setEditPack(product.pack || '');
    setEditUnit(product.unit || 'Nos');
    setEditRate(
      product.default_rate !== undefined && product.default_rate !== null
        ? String(product.default_rate)
        : ''
    );
    setEditGst(String(product.default_gst_rate ?? 18));
    setIsEditModalOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const t0 = performance.now();
    const updatedRate = parseFloat(editRate) || 0;
    const updatedGst = parseFloat(editGst) || 18;
    const updatedFields = {
      description: editDesc.trim(),
      specification: editSpec.trim() || null,
      pack: editPack.trim() || null,
      unit: editUnit.trim() || 'Nos',
      default_rate: updatedRate,
      default_gst_rate: updatedGst,
      last_verified_source: 'Direct Catalog Edit',
      last_verified_date: new Date().toISOString().split('T')[0],
    };

    // 1. Instant 0ms Optimistic UI Update in React state
    setProducts((prev) =>
      prev.map((p) => (p.id === editingProduct.id ? { ...p, ...updatedFields } : p))
    );

    const elapsedMs = performance.now() - t0;
    setSaveTelemetry({
      durationMs: elapsedMs,
      productName: editDesc.trim(),
      rate: updatedRate,
      savedAt: new Date(),
    });

    // Instantly close modal
    setIsEditModalOpen(false);
    const targetProd = editingProduct;
    setEditingProduct(null);

    // 2. Non-blocking Background API Persistence
    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetProd.id,
          ...updatedFields,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('Failed to persist edit in background:', err);
        fetchProducts();
      }
    } catch (err) {
      console.error('Error persisting product edit:', err);
      fetchProducts();
    }
  };

  const computeNextItemCode = () => {
    let maxNum = 0;
    for (const p of products) {
      const match = (p.item_code || '').match(/^JPA-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    const nextNum = Math.max(maxNum, products.length) + 1;
    return `JPA-${String(nextNum).padStart(3, '0')}`;
  };

  const handleOpenAddModal = () => {
    setNewItemCode(computeNextItemCode());
    setIsNewModalOpen(true);
  };

  const handleResetAllRates = async () => {
    if (!window.confirm('Are you sure you want to reset all product rate memory to 0?')) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/products/reset-rates', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'All product rate memory reset to 0.');
        fetchProducts();
      } else {
        alert(data.error || 'Failed to reset rates.');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Are you sure you want to permanently delete all products and clear Rate Memory completely?')) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/products?all=true', { method: 'DELETE' });
      if (res.ok) {
        alert('All products and rate memory successfully cleared.');
        fetchProducts();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete products.');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteProduct = async (prodId: string, desc: string) => {
    if (!window.confirm(`Delete "${desc}" from Rate Memory?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(prodId)}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProducts();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete product.');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const fetchProducts = () => {
    setLoading(true);
    let url = '/api/products?';
    if (searchTerm) url += `q=${encodeURIComponent(searchTerm)}&`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => setProducts(data.products || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const openHistory = async (product: any) => {
    setActiveHistoryProduct(product);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/products/${product.id}/history`);
      const data = await res.json();
      setHistoryList(data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_code: newItemCode,
          description: newDesc,
          category: 'General',
          specification: newSpec,
          pack: newPack,
          unit: newUnit,
          default_rate: Number(newRate),
          default_gst_rate: Number(newGst),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add product');
      }

      const data = await res.json();
      setIsNewModalOpen(false);
      setNewDesc('');
      setNewSpec('');
      setNewPack('');
      setNewRate('');
      fetchProducts();
      alert('Product saved permanently with consecutive item code ' + (data.item_code || newItemCode));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFF]">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AppHeader
          title="Rate Library & Product Memory"
          subtitle="Master catalog, verified pricing rates & automated rate memory"
        />

        <main className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">
          {/* Mobile Page Header Bar */}
          <div className="sm:hidden flex items-center justify-between px-1">
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Rate Library</h1>
              <p className="text-xs text-slate-500">Verified material rates & memory</p>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200/60 shadow-2xs">
              {products.length} {products.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          {/* Controls Bar: Search & Actions */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/80 shadow-xs">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:max-w-md">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search material, code, alias..."
                  className="w-full pl-10 pr-9 py-2.5 text-base rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </form>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  disabled={resetting}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm shadow-2xs transition-all duration-150 cursor-pointer disabled:opacity-50 active:scale-95 min-h-[42px]"
                  title="Permanently delete all products and clear Rate Memory"
                >
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Delete All</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-all duration-150 cursor-pointer active:scale-95 min-h-[42px]"
                >
                  <Plus className="w-4.5 h-4.5" />
                  <span>Add Product</span>
                </button>
              </div>
            </div>
          </div>

          {/* Rate Library List & Table Container */}
          <div className="glass-panel rounded-2xl border border-white/80 overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
                <span className="text-sm text-slate-500 font-medium">Searching Rate Memory...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No items found in Rate Library matching your search.
              </div>
            ) : (
              <>
                {/* 1. Mobile & Tablet Touch-Optimized Cards View (< 1024px) */}
                <div className="lg:hidden divide-y divide-slate-100/90">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 hover:bg-slate-50/80 transition-all duration-150 active:bg-blue-50/30 space-y-3 animate-in fade-in duration-200"
                    >
                      {/* Top Row: Item Code (Left), Price & GST (Right) */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.item_code ? (
                            <span className="font-bold text-sm text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/80">
                              {p.item_code}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-black text-xl text-blue-700 leading-none">
                            ₹{Number(p.default_rate).toFixed(2)}
                          </div>
                          <div className="text-sm text-slate-500 font-semibold mt-1">
                            {p.default_gst_rate}% GST
                          </div>
                        </div>
                      </div>

                      {/* Middle: Material Description */}
                      <div>
                        <h4 className="font-bold text-slate-900 text-base leading-snug">
                          {p.description}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1 flex-wrap">
                          {p.specification && (
                            <span>Spec: <strong className="text-slate-700">{p.specification}</strong></span>
                          )}
                          {p.specification && p.pack && <span>•</span>}
                          {p.pack && (
                            <span>Pack: <strong className="text-slate-700">{p.pack}</strong></span>
                          )}
                          {(p.specification || p.pack) && <span>•</span>}
                          <span>Unit: <strong className="text-slate-700">{p.unit}</strong></span>
                        </div>
                      </div>

                      {/* Bottom Row: Source Metadata & Quick Action Buttons */}
                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 flex-wrap gap-2">
                        <div className="truncate max-w-[200px]">
                          <span className="truncate block font-medium text-slate-700 text-sm">
                            {p.last_verified_source || 'Quotation Entry'}
                          </span>
                          <span className="text-xs text-slate-400">{p.last_verified_date}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            title="Edit Material Rate & Details"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 shadow-2xs transition-all active:scale-95 cursor-pointer min-h-[38px]"
                          >
                            <Pencil className="w-4 h-4 text-blue-600" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id, p.description)}
                            title="Delete from Rate Memory"
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-95 cursor-pointer min-h-[38px] min-w-[38px] inline-flex items-center justify-center border border-transparent hover:border-rose-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 2. Desktop Full Table View (>= 1024px) */}
                <div className="hidden lg:block overflow-x-auto no-scrollbar">
                  <table className="w-full text-left font-sans">
                    <thead className="bg-slate-50 text-slate-600 text-sm font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-4 px-4">Item Code</th>
                        <th className="py-4 px-4">Material Description</th>
                        <th className="py-4 px-4">Specifications</th>
                        <th className="py-4 px-4">Pack</th>
                        <th className="py-4 px-4 text-center">Unit</th>
                        <th className="py-4 px-4 text-right">Master Rate (₹)</th>
                        <th className="py-4 px-4 text-center">GST %</th>
                        <th className="py-4 px-4">Last Verified Source</th>
                        <th className="py-4 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-base text-[11pt]">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-4 text-base font-bold text-blue-700 text-[10.5pt]">
                            {p.item_code || '—'}
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-900 text-base text-[11pt]">
                            {p.description}
                          </td>
                          <td className="py-4 px-4 text-slate-700 text-base text-[10.5pt]">
                            {p.specification || '—'}
                          </td>
                          <td className="py-4 px-4 text-slate-700 text-base text-[10.5pt]">
                            {p.pack || '—'}
                          </td>
                          <td className="py-4 px-4 text-center font-medium text-slate-700 text-base text-[10.5pt]">
                            {p.unit}
                          </td>
                          <td className="py-4 px-4 text-right font-black text-blue-700 text-base sm:text-lg text-[11pt]">
                            ₹{Number(p.default_rate).toFixed(2)}
                          </td>
                          <td className="py-4 px-4 text-center font-semibold text-slate-700 text-base text-[10.5pt]">
                            {p.default_gst_rate}%
                          </td>
                          <td className="py-4 px-4 text-slate-600 text-sm text-[10pt]">
                            <div>{p.last_verified_source || 'Quotation Entry'}</div>
                            <div className="text-xs text-slate-400 text-[9.5pt]">{p.last_verified_date}</div>
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(p)}
                                title="Edit Material Rate & Details"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 shadow-2xs transition-all active:scale-95 cursor-pointer min-h-[36px]"
                              >
                                <Pencil className="w-4 h-4 text-blue-600" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p.id, p.description)}
                                title="Delete from Rate Memory"
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer min-h-[36px] min-w-[36px] inline-flex items-center justify-center border border-transparent hover:border-rose-200"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Price Change History Audit Modal */}
      {activeHistoryProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-4 sm:p-6 max-h-[90dvh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Price History: {activeHistoryProduct.description}
                </h3>
              </div>
              <button
                onClick={() => setActiveHistoryProduct(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {historyLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
              </div>
            ) : historyList.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No historical revisions recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {historyList.map((h) => (
                  <div key={h.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-slate-800">
                        ₹{Number(h.old_rate).toFixed(2)} →{' '}
                        <span className="text-blue-700">₹{Number(h.new_rate).toFixed(2)}</span>
                      </span>
                      <span className="font-mono text-slate-500 text-[11px]">{h.change_date}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Source: {h.source_quote_number || 'Direct Entry'} • Changed by: {h.changed_by || 'Staff'}
                    </div>
                    {h.notes && <div className="text-[10px] text-slate-400 italic mt-0.5">{h.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateProduct}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-4 sm:p-6 space-y-3.5 sm:space-y-4 max-h-[92dvh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-900">Add Material to Rate Memory</h3>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Item Code
                </label>
                <input
                  type="text"
                  value={newItemCode}
                  readOnly
                  title="Consecutive JPA Item Code (Auto-generated)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-blue-200 bg-blue-50/70 font-mono font-bold text-blue-700 cursor-not-allowed"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Item Description *
                </label>
                <input
                  type="text"
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(capitalizeInput(e.target.value))}
                  placeholder="e.g. Floor Cleaner R1"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Specification
                </label>
                <input
                  type="text"
                  value={newSpec}
                  onChange={(e) => setNewSpec(capitalizeInput(e.target.value))}
                  placeholder="e.g. R1 / 75 gsm"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Pack
                </label>
                <input
                  type="text"
                  value={newPack}
                  onChange={(e) => setNewPack(capitalizeInput(e.target.value))}
                  placeholder="e.g. 5 Ltr Can"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Unit *
                </label>
                <input
                  type="text"
                  required
                  value={newUnit}
                  onChange={(e) => setNewUnit(capitalizeInput(e.target.value))}
                  placeholder="Nos / Ltrs"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Master Rate (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  GST Rate
                </label>
                <GlassSelect
                  value={newGst}
                  onChange={(val) => setNewGst(String(val))}
                  options={[
                    { value: '18', label: '18% GST' },
                    { value: '5', label: '5% GST' },
                    { value: '0', label: '0% (Exempt)' },
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {creating ? 'Saving...' : 'Save to Rate Library'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Product Glassmorphism Modal */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white/90 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_24px_60px_-12px_rgba(30,58,138,0.25)] p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Ambient glass top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/80 shadow-2xs">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                    Edit Material Rate
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Microsecond persistent memory sync
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingProduct(null);
                }}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              {/* Row 1: Item Code (Automated) + Item Name (Required) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Item Code
                    </label>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200/60">
                      Auto
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editingProduct.item_code || '—'}
                    readOnly
                    title="Automated JPA Sequence Code"
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold text-blue-700 bg-blue-50/70 border border-blue-200/80 rounded-xl cursor-not-allowed select-none shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.03)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Item Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editDesc}
                    onChange={(e) => setEditDesc(capitalizeInput(e.target.value))}
                    placeholder="e.g. Floor Cleaner R1"
                    className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white/75 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.03)] focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/80 focus:bg-white transition-all duration-200"
                  />
                </div>
              </div>

              {/* Row 2: Specifications (Optional) + Pack (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Specifications (Optional)
                  </label>
                  <input
                    type="text"
                    value={editSpec}
                    onChange={(e) => setEditSpec(capitalizeInput(e.target.value))}
                    placeholder="e.g. R1 / 75 gsm"
                    className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white/75 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.03)] focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/80 focus:bg-white transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Pack (Optional)
                  </label>
                  <input
                    type="text"
                    value={editPack}
                    onChange={(e) => setEditPack(capitalizeInput(e.target.value))}
                    placeholder="e.g. 5 Ltr Can"
                    className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white/75 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.03)] focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/80 focus:bg-white transition-all duration-200"
                  />
                </div>
              </div>

              {/* Row 3: Unit (Required) + Rate (Required) + GST (Required) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Unit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editUnit}
                    onChange={(e) => setEditUnit(capitalizeInput(e.target.value))}
                    placeholder="Nos / Ltrs / Box"
                    className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white/75 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.03)] focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/80 focus:bg-white transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Master Rate (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold text-slate-800 bg-white/75 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.03)] focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/80 focus:bg-white transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    GST Rate <span className="text-rose-500">*</span>
                  </label>
                  <GlassSelect
                    value={editGst}
                    onChange={(val) => setEditGst(String(val))}
                    options={[
                      { value: '18', label: '18% GST' },
                      { value: '12', label: '12% GST' },
                      { value: '5', label: '5% GST' },
                      { value: '0', label: '0% (Exempt)' },
                    ]}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200/80">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Zap className="w-3.5 h-3.5 text-blue-600" />
                  <span>Microsecond Save</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingProduct(null);
                    }}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Save Notification in White Glassmorphism */}
      {saveTelemetry && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-[0_12px_36px_rgba(30,58,138,0.16)] text-slate-800 animate-in slide-in-from-bottom-5 duration-200">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/80 shadow-2xs shrink-0">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <div className="text-xs min-w-0 pr-1">
            <div className="font-extrabold text-slate-900 leading-tight">
              Saved Successfully
            </div>
            <div className="text-slate-600 font-semibold text-[11px] truncate max-w-[260px] mt-0.5">
              {saveTelemetry.productName} • ₹{Number(saveTelemetry.rate).toFixed(2)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSaveTelemetry(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
