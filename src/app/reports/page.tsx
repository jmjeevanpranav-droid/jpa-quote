'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';
import { BarChart3, TrendingUp, FileText, Database, Users2, Loader2 } from 'lucide-react';
import { formatINR } from '@/lib/calculations/financial';

export default function ReportsPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/quotations').then((r) => r.json()),
      fetch('/api/products').then((r) => r.json()),
    ])
      .then(([qData, pData]) => {
        setQuotations(qData.quotations || []);
        setProducts(pData.products || []);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const totalValue = quotations.reduce((acc, q) => acc + (Number(q.grand_total) || 0), 0);
  const totalTaxable = quotations.reduce((acc, q) => acc + (Number(q.subtotal) || 0), 0);
  const totalGst = quotations.reduce((acc, q) => acc + (Number(q.gst_total) || 0), 0);

  const hkCount = products.filter((p) => p.category === 'Housekeeping').length;
  const stCount = products.filter((p) => p.category === 'Stationery').length;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFF]">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AppHeader
          title="Reports & Analytics"
        />

        <main className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
          {/* Key Metric Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-white/80 shadow-xs space-y-2">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider block">
                Total Quoted Volume
              </span>
              <div className="text-3xl font-black text-slate-900 font-mono">
                {formatINR(totalValue)}
              </div>
              <p className="text-sm text-slate-500">
                Gross value across {quotations.length} quotations
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-white/80 shadow-xs space-y-2">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider block">
                Net Taxable Amount
              </span>
              <div className="text-3xl font-black text-blue-700 font-mono">
                {formatINR(totalTaxable)}
              </div>
              <p className="text-sm text-slate-500">
                Pre-tax material supplies value
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-white/80 shadow-xs space-y-2">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider block">
                Total GST Component
              </span>
              <div className="text-3xl font-black text-emerald-700 font-mono">
                {formatINR(totalGst)}
              </div>
              <p className="text-sm text-slate-500">
                Aggregated GST taxes (5%, 12%, 18%, 28%)
              </p>
            </div>
          </div>

          {/* Category & Catalog Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-white/80 shadow-xs space-y-5">
              <h3 className="font-bold text-xl text-slate-900">Rate Memory Catalog Breakdown</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-base font-semibold mb-1.5">
                    <span className="text-slate-700">Housekeeping Materials</span>
                    <span className="text-slate-900 font-bold">{hkCount} items ({Math.round((hkCount / (products.length || 1)) * 100)}%)</span>
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${(hkCount / (products.length || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-base font-semibold mb-1.5">
                    <span className="text-slate-700">Stationery Consumables</span>
                    <span className="text-slate-900 font-bold">{stCount} items ({Math.round((stCount / (products.length || 1)) * 100)}%)</span>
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${(stCount / (products.length || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-white/80 shadow-xs space-y-5">
              <h3 className="font-bold text-xl text-slate-900">Quotation Status Conversion</h3>
              <div className="space-y-3">
                {quotations.map((q) => (
                  <div key={q.id} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-none">
                    <div>
                      <div className="font-bold text-base text-slate-900">{q.customer_name}</div>
                      <div className="text-sm text-slate-500 font-mono mt-0.5">{q.quote_number} • {q.quote_date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-base sm:text-lg text-slate-900">{formatINR(q.grand_total)}</div>
                      <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1 inline-block">
                        {q.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
