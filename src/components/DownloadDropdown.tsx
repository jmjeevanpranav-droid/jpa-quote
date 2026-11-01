'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown, Loader2 } from 'lucide-react';

interface DownloadDropdownProps {
  quotationId: string;
  quoteNumber?: string;
  onBeforeDownload?: () => Promise<boolean | string> | boolean | string;
}

export function DownloadDropdown({
  quotationId,
  quoteNumber,
  onBeforeDownload,
}: DownloadDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<'pdf' | 'excel' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDownload = async (type: 'pdf' | 'excel') => {
    setIsOpen(false);
    if (loadingType) return;
    setLoadingType(type);
    try {
      let exportId = quotationId;
      if (onBeforeDownload) {
        const result = await onBeforeDownload();
        if (!result) return;
        if (typeof result === 'string') exportId = result;
      }
      if (!exportId) throw new Error('Save the quotation before downloading.');
      const url = `/api/quotations/${encodeURIComponent(exportId)}/${type}?t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to download ${type.toUpperCase()}`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;

      // Extract filename from header or fallback
      const disposition = res.headers.get('Content-Disposition');
      let filename = `JPA_Quote_${type}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
    } catch (err) {
      console.error(err);
      alert(`Download error: ${(err as Error).message}`);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loadingType !== null}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
      >
        {loadingType ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>Download</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-80" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white/80 backdrop-blur-xl shadow-2xl shadow-blue-900/10 border border-white/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50/80 hover:text-blue-700 transition-colors cursor-pointer text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200/60 shadow-2xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900">Download as PDF</div>
              <div className="text-[10px] text-slate-500">Portrait A4 Rate Card (.pdf)</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleDownload('excel')}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50/80 hover:text-emerald-700 transition-colors cursor-pointer text-left border-t border-slate-100/80"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/60 shadow-2xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900">Download as Excel</div>
              <div className="text-[10px] text-slate-500">With live formulas (.xlsx)</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
