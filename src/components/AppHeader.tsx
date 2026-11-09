'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Plus, Menu } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { AiImportModal } from './AiImportModal';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  onOpenAiImport?: () => void;
}

export function AppHeader({ title, subtitle, onOpenAiImport }: AppHeaderProps) {
  const [fallbackAiModalOpen, setFallbackAiModalOpen] = useState(false);

  const handleToggleMobileMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('jpa:toggle-sidebar'));
  };

  const handleOpenImport = () => {
    if (onOpenAiImport) {
      onOpenAiImport();
    } else {
      setFallbackAiModalOpen(true);
    }
  };

  const isDashboard = !title || title.trim().toLowerCase() === 'dashboard';
  const mobileTitle =
    title && title.startsWith('Rate Library') ? 'Rate Library' : title;

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between min-h-16 sm:min-h-18 md:min-h-20 py-2.5 sm:py-3.5 px-4 sm:px-8 md:px-10 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.04)] select-none transition-all duration-200">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-2">
          {/* Mobile Hamburger Navigation Button */}
          <button
            type="button"
            onClick={handleToggleMobileMenu}
            className="md:hidden flex items-center justify-center w-9.5 h-9.5 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100/90 bg-white/80 border border-slate-200/90 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-92 cursor-pointer shrink-0 shadow-2xs"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>

          {/* Mobile Brand Logo: Full compact wordmark on Dashboard, crisp emblem-only on inner pages so titles never truncate */}
          <div className="md:hidden flex items-center shrink-0">
            {isDashboard ? (
              <BrandLogo variant="compact" showSubtitle={false} />
            ) : (
              <BrandLogo variant="icon-only" showSubtitle={false} />
            )}
          </div>

          {/* Subtle divider when showing both BrandLogo and Title on tablet (sm..md) */}
          {title && isDashboard && (
            <span className="hidden sm:block md:hidden h-5 w-px bg-slate-200 shrink-0" aria-hidden="true" />
          )}

          {/* Page Title & Subtitle */}
          {title && (
            <div
              className={`${
                isDashboard ? 'hidden sm:flex' : 'flex'
              } flex-col min-w-0 justify-center`}
            >
              <h1 className="text-[15px] sm:text-lg md:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 truncate">
                <span className="sm:hidden truncate">{mobileTitle}</span>
                <span className="hidden sm:inline truncate">{title}</span>
              </h1>
              {subtitle && (
                <span className="hidden md:inline-block text-xs sm:text-sm text-slate-500 font-medium truncate mt-0.5">
                  {subtitle}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenImport}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 w-9.5 h-9.5 sm:w-auto sm:h-auto sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-50/90 text-blue-700 hover:bg-blue-100 border border-blue-200/80 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 cursor-pointer shadow-2xs"
            title="Quotation Document Import"
            aria-label="Quotation Document Import"
          >
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="hidden sm:inline">Import</span>
          </button>

          <Link
            href="/quotations/new"
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-600/20 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 cursor-pointer shrink-0 whitespace-nowrap min-h-[38px]"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>New Quote</span>
          </Link>
        </div>
      </header>

      {!onOpenAiImport && (
        <AiImportModal
          isOpen={fallbackAiModalOpen}
          onClose={() => setFallbackAiModalOpen(false)}
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
      )}
    </>
  );
}
