'use client';

import React, { useState, useEffect, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';
import { LiveQuotationPreview } from '@/components/LiveQuotationPreview';
import { DownloadDropdown } from '@/components/DownloadDropdown';
import { ArrowLeft, Edit3, Copy, Printer, CheckCircle2, Loader2, Menu } from 'lucide-react';
import { calculateQuotationSummary } from '@/lib/calculations/financial';

function QuotationViewContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/quotations/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setData(res);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/quotations/${id}/duplicate`, { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        router.push(`/quotations/${result.quotationId}`);
      } else {
        alert(result.error);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDuplicating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFF]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data || !data.quotation) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFF]">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Quotation not found</p>
          <Link href="/quotations" className="text-blue-600 font-bold hover:underline">
            Back to Quotations
          </Link>
        </div>
      </div>
    );
  }

  const { quotation, supplier, customer, sections } = data;
  const allItems = sections.flatMap((s: any) => s.items || []);
  const summary = calculateQuotationSummary(allItems.map((i: any) => ({ quantity: Number(i.quantity), unitRate: Number(i.unit_rate), gstRate: Number(i.gst_rate) })), supplier?.gstin?.slice(0, 2) || '33', quotation.customer_gstin?.slice(0, 2) || supplier?.gstin?.slice(0, 2) || '33', quotation.tax_type || 'exclusive');

  const previewData = {
    taxType: quotation.tax_type,
    quoteNumber: quotation.quote_number,
    quoteDate: quotation.quote_date,
    validityDate: quotation.validity_date,
    referenceNo: quotation.reference_no,
    supplier: supplier || {
      name: 'Jeevan Pranav Agencies (JPA)',
      address: '16-P, Sakthi Illam, Podanur, Coimbatore - 641023',
      gstin: '33BRGPM1867B1Z1',
    },
    customer: {
      companyName: quotation.customer_name,
      address: quotation.customer_address,
      gstin: quotation.customer_gstin,
      storeName: quotation.store_name,
    },
    sections: sections.map((s: any) => ({
      name: s.section_name,
      items: (s.items || []).map((i: any) => ({
        storeName: i.store_name,
        description: i.description,
        specification: i.specification,
        pack: i.pack,
        quantity: i.quantity,
        unit: i.unit,
        unitRate: i.unit_rate,
        gstRate: i.gst_rate,
      })),
    })),
    summary,
    terms: {
      payment: quotation.terms_payment,
      delivery: quotation.terms_delivery,
      validity: quotation.terms_validity,
      transport: quotation.terms_transport,
      gst: quotation.terms_gst,
    },
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F8FAFF]">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden smooth-scroll-pane">
        <header className="sticky top-0 z-20 flex flex-wrap gap-2 items-center justify-between min-h-14 py-2.5 px-3 sm:px-6 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-2xs shrink-0 no-print">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('jpa:toggle-sidebar'));
              }}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-slate-200 transition-all duration-150 active:scale-90 cursor-pointer shrink-0 shadow-2xs"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              href="/quotations"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all active:scale-90 shrink-0"
              title="Back to All Quotations"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight font-mono truncate">
                  {quotation.quote_number}
                </h1>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                    quotation.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {quotation.status}
                </span>
              </div>
              <p className="hidden sm:block text-xs text-slate-500 truncate">
                {quotation.customer_name} • Dated {quotation.quote_date}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 ml-auto">
            <Link
              href={`/quotations/${id}/edit`}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 shadow-2xs transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="sm:hidden">Edit</span>
              <span className="hidden sm:inline">Edit Quotation</span>
            </Link>

            <button
              type="button"
              onClick={handleDuplicate}
              disabled={duplicating}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 shadow-2xs transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Duplicate</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 shadow-2xs transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <DownloadDropdown
              quotationId={quotation.id}
              quoteNumber={quotation.quote_number}
            />
          </div>
        </header>

        <main className="py-2.5 sm:py-4 px-2 sm:px-4 md:px-6 w-full max-w-[1240px] mx-auto overflow-x-auto transition-all">
          <LiveQuotationPreview data={previewData} />
        </main>
      </div>
    </div>
  );
}

export default function QuotationViewPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F8FAFF]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <QuotationViewContent {...props} />
    </Suspense>
  );
}
