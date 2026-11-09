'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';
import { AiImportModal } from '@/components/AiImportModal';
import {
  FilePlus2,
  Sparkles,
  FileText,
  Database,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  TrendingUp,
  Download,
  Building2,
  ChevronRight,
  Zap,
  Plus,
} from 'lucide-react';
import { formatINR } from '@/lib/calculations/financial';

export default function DashboardPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Rate Memory Spotlight state - displays the 5 latest saved or updated material rates
  const [spotlightRates, setSpotlightRates] = useState<any[]>([]);
  const [totalRates, setTotalRates] = useState<number>(0);

  const SPOTLIGHT_LIMIT = 5;

  const loadData = () => {
    Promise.all([
      fetch('/api/quotations').then((r) => r.json()),
      fetch('/api/products').then((r) => r.json()),
    ])
      .then(([qData, pData]) => {
        setQuotations(qData.quotations || []);
        setProducts(pData.products || []);
      })
      .catch((err) => console.error('Dashboard load error:', err))
      .finally(() => setLoading(false));
  };

  const fetchLatestSpotlight = async (silent = false) => {
    try {
      const res = await fetch(`/api/products?sort=latest&limit=${SPOTLIGHT_LIMIT}&offset=0`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.products && Array.isArray(data.products)) {
        setSpotlightRates(data.products.slice(0, SPOTLIGHT_LIMIT));
        if (typeof data.total === 'number') {
          setTotalRates(data.total);
        }
        try {
          localStorage.setItem('jpa_spotlight_rates', JSON.stringify(data.products.slice(0, SPOTLIGHT_LIMIT)));
          if (typeof data.total === 'number') {
            localStorage.setItem('jpa_spotlight_total', String(data.total));
          }
        } catch (_) {}
      }
    } catch (err) {
      if (!silent) console.error('Error fetching spotlight rates:', err);
    }
  };

  useEffect(() => {
    // 1. Instant hydration from localStorage across page reloads / sessions
    try {
      const cached = localStorage.getItem('jpa_spotlight_rates');
      const cachedTotal = localStorage.getItem('jpa_spotlight_total');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSpotlightRates(parsed.slice(0, SPOTLIGHT_LIMIT));
        }
      }
      if (cachedTotal) {
        setTotalRates(Number(cachedTotal) || 0);
      }
    } catch (_) {}

    // 2. Initial fetch
    loadData();
    fetchLatestSpotlight();

    // 3. Continuous polling every 4 seconds to pick up new rates automatically
    const pollInterval = setInterval(() => {
      fetchLatestSpotlight(true);
    }, 4000);

    // 4. Focus, visibility, storage, and custom event listeners
    const handleRefresh = () => {
      loadData();
      fetchLatestSpotlight(true);
    };

    window.addEventListener('focus', handleRefresh);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleRefresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleRefresh);
    window.addEventListener('jpa-rate-saved', handleRefresh);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleRefresh);
      window.removeEventListener('jpa-rate-saved', handleRefresh);
    };
  }, []);

  const totalValue = quotations.reduce((acc, q) => acc + (Number(q.grand_total) || 0), 0);
  const approvedQuotes = quotations.filter((q) => q.status === 'approved');
  const draftQuotes = quotations.filter((q) => q.status === 'draft');

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F8FAFF]">
      {/* Translucent Glass Sidebar */}
      <AppSidebar />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden smooth-scroll-pane">
        <AppHeader
          title="Dashboard"
          subtitle="JPA Rate Card Organiser"
          onOpenAiImport={() => setIsAiModalOpen(true)}
        />

        <main className="p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6 md:space-y-8">
          {/* Welcome Banner */}
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-5 sm:p-7 md:p-8 shadow-xl">
            {/* Geometric watermark accent in refined grayscale origami depth */}
            <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-20 pointer-events-none w-52 h-52 sm:w-80 sm:h-80">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="285 94 850 862" className="w-full h-full">
                <path fill="#CBD5E1" opacity="0.6" d="M 1015,488 L 731,883 L 739,852 L 837,557 L 722,461 L 721,896 L 1075,612 Z" />
                <path fill="#94A3B8" opacity="0.75" d="M 485,398 L 405,453 L 670,839 L 528,570 L 528,567 L 553,541 Z" />
                <path fill="#64748B" opacity="0.85" d="M 921,379 L 891,449 L 857,540 L 883,562 L 884,565 L 826,686 L 752,849 L 823,730 L 1006,440 Z" />
                <path fill="#475569" opacity="0.95" d="M 607,256 L 494,364 L 624,687 L 709,890 L 690,869 L 604,758 L 399,502 L 345,631 L 711,894 Z" />
                <path fill="#FFFFFF" opacity="0.9" d="M 718,154 L 720,337 L 650,395 L 659,457 L 719,415 L 720,421 L 845,528 L 919,299 Z" />
              </svg>
            </div>

            <div className="relative z-10 max-w-2xl space-y-3 sm:space-y-3.5">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
                Welcome to JPA QUOTE
              </h1>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
                <Link
                  href="/quotations/new"
                  className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4.5 py-2.5 rounded-xl bg-white text-blue-900 font-bold text-xs sm:text-sm shadow-md hover:bg-blue-50 active:scale-95 transition-all duration-200 cursor-pointer min-h-[42px] whitespace-nowrap"
                >
                  <FilePlus2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-blue-600 shrink-0" />
                  <span>Create Rate Card</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4.5 py-2.5 rounded-xl bg-blue-700/80 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm border border-blue-400/40 backdrop-blur-md active:scale-95 transition-all duration-200 cursor-pointer min-h-[42px] whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-300 shrink-0" />
                  <span>Import</span>
                </button>
              </div>
            </div>
          </div>

          {/* Metric Cards Bento Grid (2x2 on Mobile, 4-Column on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {/* Metric 1 */}
            <div className="glass-panel glass-panel-hover rounded-2xl p-3.5 sm:p-5 md:p-6 border border-white/80 flex flex-col justify-between min-w-0">
              <div className="flex items-start sm:items-center justify-between gap-2 text-slate-500 text-[10.5px] sm:text-xs font-bold uppercase tracking-wider mb-2">
                <span className="leading-tight">Total Quotations</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-slate-900 tracking-tight">
                {quotations.length}
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] sm:text-sm text-slate-500 mt-1.5 sm:mt-2 font-medium">
                <span className="text-emerald-600 font-bold">{approvedQuotes.length} approved</span>
                <span>• {draftQuotes.length} drafts</span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="glass-panel glass-panel-hover rounded-2xl p-3.5 sm:p-5 md:p-6 border border-white/80 flex flex-col justify-between min-w-0">
              <div className="flex items-start sm:items-center justify-between gap-2 text-slate-500 text-[10.5px] sm:text-xs font-bold uppercase tracking-wider mb-2">
                <span className="leading-tight">Quoted Value</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl xl:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
                {formatINR(totalValue)}
              </div>
              <div className="text-[11px] sm:text-sm text-slate-500 mt-1.5 sm:mt-2 font-medium truncate">
                Consolidated portfolio
              </div>
            </div>

            {/* Metric 3 */}
            <div className="glass-panel glass-panel-hover rounded-2xl p-3.5 sm:p-5 md:p-6 border border-white/80 flex flex-col justify-between min-w-0">
              <div className="flex items-start sm:items-center justify-between gap-2 text-slate-500 text-[10.5px] sm:text-xs font-bold uppercase tracking-wider mb-2">
                <span className="leading-tight">Rate Memory</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
                {totalRates || products.length} Items
              </div>
              <div className="flex items-center gap-1 text-[11px] sm:text-sm text-emerald-600 font-semibold mt-1.5 sm:mt-2 truncate">
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Auto-reuse active</span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="glass-panel glass-panel-hover rounded-2xl p-3.5 sm:p-5 md:p-6 border border-white/80 flex flex-col justify-between min-w-0">
              <div className="flex items-start sm:items-center justify-between gap-2 text-slate-500 text-[10.5px] sm:text-xs font-bold uppercase tracking-wider mb-2">
                <span className="leading-tight">Supplier Profile</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="text-sm sm:text-base font-bold text-slate-900 truncate">
                Jeevan Pranav Agencies
              </div>
              <div className="text-[11px] sm:text-sm text-slate-500 mt-1.5 sm:mt-2 font-medium truncate">
                GSTIN: 33BRGPM1867B1Z1
              </div>
            </div>
          </div>

          {/* Quotations & Rate Memory Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
            {/* Recent Quotations (Left 7 Cols) */}
            <div className="lg:col-span-7 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Recent Quotations
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 truncate">
                    Manage, edit, export, and duplicate JPA client quotations
                  </p>
                </div>
                <Link
                  href="/quotations"
                  className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 shrink-0"
                >
                  <span>View All</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="glass-panel rounded-2xl border border-white/80 overflow-hidden shadow-xs">
                {quotations.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No quotations found. Click &quot;Create Rate Card&quot; to begin.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {quotations.slice(0, 5).map((q) => (
                      <div
                        key={q.id}
                        className="p-3.5 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-xs sm:text-sm text-blue-700 font-mono">
                              {q.quote_number}
                            </span>
                            <span
                              className={`text-[10.5px] sm:text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                q.status === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {q.status}
                            </span>
                          </div>
                          <div className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            {q.customer_name}
                          </div>
                          {q.store_name && (
                            <div className="text-xs sm:text-sm text-slate-600 truncate">
                              Store: {q.store_name}
                            </div>
                          )}
                          <div className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            Dated: {q.quote_date} • {q.item_count || 6} items
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100/80">
                          <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
                            {formatINR(q.grand_total)}
                          </div>
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/quotations/${q.id}`}
                              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs min-h-[36px] inline-flex items-center"
                            >
                              View / Edit
                            </Link>
                            <a
                              href={`/api/quotations/${q.id}/pdf`}
                              title="Download PDF"
                              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 active:scale-95 transition-all min-h-[36px] min-w-[36px] inline-flex items-center justify-center border border-slate-200/70 sm:border-transparent hover:border-blue-200"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rate Library Spotlight (Right 5 Cols) */}
            <div className="lg:col-span-5 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Rate Memory Spotlight
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 truncate">
                    Verified catalog rates remembered across quotations
                  </p>
                </div>
                <Link
                  href="/products"
                  className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 shrink-0"
                >
                  <span>Rate Library</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="glass-panel rounded-2xl border border-white/80 p-4 sm:p-5 shadow-xs">
                <div className="divide-y divide-slate-100">
                  {spotlightRates.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">
                      No saved material rates yet. Rates added or quoted will appear here automatically.
                    </div>
                  ) : (
                    spotlightRates.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        className="py-2.5 sm:py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 px-1.5 rounded-xl transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-bold text-slate-800 truncate">
                            {p.description}
                          </div>
                          <div className="text-xs sm:text-sm text-slate-500 truncate">
                            {p.specification ? `${p.specification} • ` : ''}
                            {p.pack ? `${p.pack} • ` : ''}
                            {p.unit}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm sm:text-lg font-black text-blue-700 font-mono">
                            ₹{Number(p.default_rate).toFixed(2)}
                          </div>
                          <div className="text-[11px] sm:text-xs text-slate-500 font-medium">
                            GST {p.default_gst_rate}%
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* AI Import Modal */}
      <AiImportModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        availableSections={['Stationery', 'Housekeeping', 'Industrial', 'Electrical']}
        onAcceptItems={(items, targetSection, metadata) => {
          try {
            sessionStorage.setItem(
              'jpa_pending_ai_import',
              JSON.stringify({ items, targetSection, metadata })
            );
          } catch (e) {
            console.error('Failed to stash AI import in sessionStorage:', e);
          }
          window.location.href = '/quotations/new';
        }}
      />
    </div>
  );
}
