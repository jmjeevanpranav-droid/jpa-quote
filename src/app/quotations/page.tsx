'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Download,
  Copy,
  Trash2,
  ExternalLink,
  Loader2,
  ChevronRight,
  X,
} from 'lucide-react';
import { formatINR } from '@/lib/calculations/financial';

export default function AllQuotationsPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchQuotations = () => {
    setLoading(true);
    let url = '/api/quotations?';
    if (statusFilter !== 'all') url += `status=${statusFilter}&`;
    if (searchTerm) url += `q=${encodeURIComponent(searchTerm)}&`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => setQuotations(data.quotations || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuotations();
    }, 250);
    return () => clearTimeout(timer);
  }, [statusFilter, searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQuotations();
  };

  const handleDelete = async (id: string, quoteNumber: string) => {
    if (!confirm(`Are you sure you want to delete quotation ${quoteNumber}?`)) return;
    try {
      const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setQuotations(quotations.filter((q) => q.id !== id));
      } else {
        alert('Failed to delete quotation');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL quotations? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/quotations?all=true', { method: 'DELETE' });
      if (res.ok) {
        setQuotations([]);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to delete all quotations');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/quotations/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        fetchQuotations();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F8FAFF]">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto smooth-scroll-pane">
        <AppHeader
          title="All Quotations"
        />

        <main className="p-3.5 sm:p-5 md:p-8 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
          {/* Controls Bar: Search & Status Filters */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 transition-all">
            <form onSubmit={handleSearchSubmit} className="relative w-full lg:max-w-md">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search quote #, customer, store..."
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

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full lg:w-auto">
              <div className="relative grid grid-cols-3 items-center rounded-xl bg-slate-200/65 backdrop-blur-md p-1 text-xs sm:text-sm border border-white/85 shadow-inner min-w-[230px] sm:min-w-[260px]">
                <div
                  aria-hidden="true"
                  style={{
                    transform:
                      statusFilter === 'all'
                        ? 'translate3d(0%, 0, 0)'
                        : statusFilter === 'approved'
                        ? 'translate3d(100%, 0, 0)'
                        : 'translate3d(200%, 0, 0)',
                  }}
                  className="glass-segmented-thumb pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] rounded-lg bg-white shadow-xs border border-slate-200/70"
                />
                {['all', 'approved', 'draft'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`relative z-10 px-2.5 sm:px-3.5 py-1.5 rounded-lg font-bold capitalize transition-colors duration-200 cursor-pointer whitespace-nowrap min-h-[36px] select-none ${
                      statusFilter === st
                        ? 'text-blue-700'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {quotations.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm shadow-2xs transition-all duration-150 cursor-pointer shrink-0 active:scale-95 min-h-[42px]"
                  title="Delete all quotations"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Delete All</span>
                </button>
              )}

              <Link
                href="/quotations/new"
                className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-all duration-150 cursor-pointer shrink-0 active:scale-95 min-h-[42px]"
              >
                <Plus className="w-4.5 h-4.5" />
                <span>New Quotation</span>
              </Link>
            </div>
          </div>

          {/* Quotations List & Table Container */}
          <div className="glass-panel rounded-2xl border border-white/80 overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
                <span className="text-sm text-slate-500 font-medium">Loading quotations...</span>
              </div>
            ) : quotations.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No quotations found matching your criteria.
              </div>
            ) : (
              <>
                {/* 1. Mobile & Tablet Touch-Optimized Cards View (< 1024px) */}
                <div className="lg:hidden divide-y divide-slate-100/90">
                  {quotations.map((q) => (
                    <div
                      key={q.id}
                      className="p-4 hover:bg-slate-50/80 transition-all duration-150 active:bg-blue-50/30 space-y-3 animate-in fade-in duration-200"
                    >
                      {/* Top Row: Quote # & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/quotations/${q.id}`}
                          className="font-bold text-blue-700 text-base hover:underline"
                        >
                          {q.quote_number}
                        </Link>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            q.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {q.status}
                        </span>
                      </div>

                      {/* Middle: Customer & Store */}
                      <div>
                        <div className="font-bold text-slate-900 text-base leading-tight">
                          {q.customer_name}
                        </div>
                        {q.store_name && (
                          <div className="text-sm text-slate-600 mt-1">
                            Store: {q.store_name}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1.5">
                          <span>Issued: <strong>{q.quote_date}</strong></span>
                          <span>•</span>
                          <span>Valid: <strong>{q.validity_date}</strong></span>
                        </div>
                      </div>

                      {/* Bottom Row: Total & Actions */}
                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider">Grand Total</span>
                          <span className="text-xl font-black text-slate-900 leading-none">
                            {formatINR(q.grand_total)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            href={`/quotations/${q.id}`}
                            className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-all active:scale-95 min-h-[38px] inline-flex items-center"
                          >
                            View
                          </Link>
                          <a
                            href={`/api/quotations/${q.id}/pdf`}
                            title="Download PDF"
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-95 min-h-[38px] min-w-[38px] inline-flex items-center justify-center border border-transparent hover:border-rose-200"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(q.id)}
                            title="Duplicate quote"
                            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 cursor-pointer min-h-[38px] min-w-[38px] inline-flex items-center justify-center border border-transparent hover:border-blue-200"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(q.id, q.quote_number)}
                            title="Delete quote"
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-95 cursor-pointer min-h-[38px] min-w-[38px] inline-flex items-center justify-center border border-transparent hover:border-rose-200"
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
                        <th className="py-4 px-4">Quotation #</th>
                        <th className="py-4 px-4">Customer & Store</th>
                        <th className="py-4 px-4">Date</th>
                        <th className="py-4 px-4">Validity</th>
                        <th className="py-4 px-4 text-center">Items</th>
                        <th className="py-4 px-4 text-right">Grand Total (₹)</th>
                        <th className="py-4 px-4 text-center">Status</th>
                        <th className="py-4 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-base">
                      {quotations.map((q) => (
                        <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-4 font-bold text-blue-700 text-base">
                            <Link href={`/quotations/${q.id}`} className="hover:underline">
                              {q.quote_number}
                            </Link>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-bold text-slate-900 text-base">{q.customer_name}</div>
                            {q.store_name && (
                              <div className="text-sm text-slate-500 mt-0.5">{q.store_name}</div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-slate-700 text-base">{q.quote_date}</td>
                          <td className="py-4 px-4 text-slate-700 text-base">{q.validity_date}</td>
                          <td className="py-4 px-4 text-center text-slate-700 text-base">
                            {q.item_count || '—'}
                          </td>
                          <td className="py-4 px-4 text-right font-black text-slate-900 text-base sm:text-lg font-mono">
                            {formatINR(q.grand_total)}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                q.status === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {q.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/quotations/${q.id}`}
                                className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs min-h-[36px] inline-flex items-center"
                              >
                                View
                              </Link>
                              <a
                                href={`/api/quotations/${q.id}/pdf`}
                                title="Download PDF"
                                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 min-h-[36px] min-w-[36px] inline-flex items-center justify-center transition-colors"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDuplicate(q.id)}
                                title="Duplicate quote"
                                className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 min-h-[36px] min-w-[36px] inline-flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(q.id, q.quote_number)}
                                title="Delete quote"
                                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 min-h-[36px] min-w-[36px] inline-flex items-center justify-center transition-colors cursor-pointer"
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
    </div>
  );
}
