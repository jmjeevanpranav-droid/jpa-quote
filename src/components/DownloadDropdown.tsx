'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loadingType, setLoadingType] = useState<'pdf' | 'excel' | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 244,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateCoords = useCallback(() => {
    if (!dropdownRef.current || typeof window === 'undefined') return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const menuWidth = Math.min(248, window.innerWidth - 20);
    const preferredLeft = rect.right - menuWidth;
    const clampedLeft = Math.max(10, Math.min(preferredLeft, window.innerWidth - menuWidth - 10));
    setCoords({
      top: rect.bottom + 8,
      left: clampedLeft,
      width: menuWidth,
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
      timer = setTimeout(() => setShouldRender(false), 150);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (raf1 !== null) cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [isOpen, updateCoords]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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

  const menuNode = (
    <div
      ref={menuRef}
      data-state={isVisible ? 'open' : 'closed'}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        zIndex: 99999,
      }}
      className={`glass-select-menu glass-dropdown-motion origin-top-right rounded-2xl p-1.5 space-y-1 ${
        isVisible
          ? 'opacity-100 scale-100 translate-y-0'
          : 'opacity-0 scale-[0.96] -translate-y-1.5 pointer-events-none'
      }`}
    >
      <button
        type="button"
        onClick={() => handleDownload('pdf')}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-blue-50/90 hover:text-blue-700 active:scale-[0.99] transition-all duration-150 cursor-pointer text-left"
      >
        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200/70 shadow-2xs">
          <FileText className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-900">Download as PDF</div>
          <div className="text-[10.5px] text-slate-500">Portrait A4 Rate Card (.pdf)</div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => handleDownload('excel')}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-emerald-50/90 hover:text-emerald-700 active:scale-[0.99] transition-all duration-150 cursor-pointer text-left"
      >
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/70 shadow-2xs">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-900">Download as Excel</div>
          <div className="text-[10.5px] text-slate-500">With live formulas (.xlsx)</div>
        </div>
      </button>
    </div>
  );

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={loadingType !== null}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:opacity-70 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
      >
        {loadingType ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          <Download className="w-4 h-4 shrink-0" />
        )}
        <span className="hidden xs:inline sm:inline">Download</span>
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-85 transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {shouldRender && mounted && typeof document !== 'undefined'
        ? createPortal(menuNode, document.body)
        : null}
    </div>
  );
}
