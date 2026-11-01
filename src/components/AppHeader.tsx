'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Plus, Menu } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  onOpenAiImport?: () => void;
}

export function AppHeader({ title, subtitle, onOpenAiImport }: AppHeaderProps) {
  const handleToggleMobileMenu = () => {
    window.dispatchEvent(new CustomEvent('jpa:toggle-sidebar'));
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between min-h-16 sm:min-h-20 md:min-h-22 py-3.5 sm:py-4.5 px-4 sm:px-8 md:px-10 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] select-none transition-all duration-200">
      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
        {/* Mobile Hamburger Navigation Button */}
        <button
          type="button"
          onClick={handleToggleMobileMenu}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all duration-150 active:scale-90 cursor-pointer shrink-0 shadow-2xs"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>

        {/* Mobile Brand Logo */}
        <div className="md:hidden flex items-center shrink-0">
          <BrandLogo variant="compact" showSubtitle={false} />
        </div>

        {/* Page Title & Breadcrumb */}
        {title && (
          <div className="flex flex-col min-w-0 justify-center">
            <h1 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5 truncate">
              <span className="truncate">{title}</span>
            </h1>
            {subtitle && (
              <span className="hidden sm:inline-block text-xs sm:text-sm text-slate-500 font-medium truncate mt-0.5">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
        {onOpenAiImport && (
          <button
            type="button"
            onClick={onOpenAiImport}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs"
            title="Import Document (Image / PDF)"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Import</span>
          </button>
        )}

        <Link
          href="/quotations/new"
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all duration-150 active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Quote</span>
        </Link>
      </div>
    </header>
  );
}
