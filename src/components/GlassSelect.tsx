'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface GlassSelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface GlassSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: GlassSelectOption[];
  placeholder?: string;
  prefixLabel?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'pill';
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  placement?: 'bottom' | 'top' | 'auto';
}

export function GlassSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  prefixLabel,
  icon,
  variant = 'default',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  size = 'md',
  ariaLabel,
  placement = 'auto',
}: GlassSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState<number>(-1);
  const [effectivePlacement, setEffectivePlacement] = useState<'bottom' | 'top'>(
    placement === 'top' ? 'top' : 'bottom'
  );
  const [dropdownCoords, setDropdownCoords] = useState<{
    top: number;
    left: number;
    width: number;
  }>({ top: 0, left: 0, width: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasSublabels = options.some((o) => Boolean(o.sublabel));

  const calculatePlacementAndPosition = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    const rect = containerRef.current.getBoundingClientRect();

    const rowHeight = hasSublabels ? 50 : 38;
    const estimatedHeight = Math.min(options.length * rowHeight + 16, 268);
    const spaceBelowViewport = window.innerHeight - rect.bottom;
    const spaceAboveViewport = rect.top;

    let dropUp = false;
    if (placement === 'top') {
      dropUp = true;
    } else if (placement === 'bottom') {
      dropUp = false;
    } else {
      dropUp = spaceBelowViewport < estimatedHeight && spaceAboveViewport > spaceBelowViewport;
    }

    setEffectivePlacement(dropUp ? 'top' : 'bottom');

    const viewportWidth = window.innerWidth;
    const minMenuWidth = hasSublabels ? Math.max(rect.width, 236) : Math.max(rect.width, 156);
    const clampedWidth = Math.min(minMenuWidth, viewportWidth - 20);
    const clampedLeft = Math.max(10, Math.min(rect.left, viewportWidth - clampedWidth - 10));
    const actualMenuHeight = menuRef.current?.offsetHeight || estimatedHeight;
    const top = dropUp ? Math.max(8, rect.top - actualMenuHeight - 6) : rect.bottom + 6;

    setDropdownCoords({
      top,
      left: clampedLeft,
      width: clampedWidth,
    });
  }, [options.length, placement, hasSublabels]);

  const selectedIndex = options.findIndex((o) => String(o.value) === String(value));
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  // Two-stage mount & GPU spring enter/exit transition
  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    let raf1: number | null = null;
    let raf2: number | null = null;

    if (isOpen) {
      calculatePlacementAndPosition();
      setShouldRender(true);
      raf1 = requestAnimationFrame(() => {
        calculatePlacementAndPosition();
        raf2 = requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      closeTimer = setTimeout(() => {
        setShouldRender(false);
      }, 150);
    }

    return () => {
      if (closeTimer) clearTimeout(closeTimer);
      if (raf1 !== null) cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [isOpen, calculatePlacementAndPosition]);

  const toggleDropdown = () => {
    if (!isOpen) {
      calculatePlacementAndPosition();
      setHighlightedIdx(selectedIndex >= 0 ? selectedIndex : 0);
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIdx((prev) => (prev + 1) % Math.max(options.length, 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIdx((prev) => (prev - 1 + options.length) % Math.max(options.length, 1));
      } else if (event.key === 'Enter' && highlightedIdx >= 0 && highlightedIdx < options.length) {
        event.preventDefault();
        onChange(options[highlightedIdx].value);
        setIsOpen(false);
      }
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
  }, [isOpen, highlightedIdx, options, onChange]);

  // Smooth 60fps rAF position tracking during scroll/resize
  useEffect(() => {
    if (!shouldRender) return;
    const scheduleReposition = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        calculatePlacementAndPosition();
      });
    };
    window.addEventListener('resize', scheduleReposition, { passive: true });
    window.addEventListener('scroll', scheduleReposition, true);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', scheduleReposition);
      window.removeEventListener('scroll', scheduleReposition, true);
    };
  }, [shouldRender, calculatePlacementAndPosition]);

  // Keep keyboard-highlighted item scrolled into view smoothly
  useEffect(() => {
    if (!isOpen || highlightedIdx < 0 || !menuRef.current) return;
    const optionEl = menuRef.current.children[highlightedIdx] as HTMLElement | undefined;
    if (optionEl && typeof optionEl.scrollIntoView === 'function') {
      optionEl.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, highlightedIdx]);

  const sizeClasses =
    variant === 'pill'
      ? size === 'sm'
        ? 'px-3 py-1.5 text-xs rounded-full min-h-[34px]'
        : 'px-3.5 py-2 text-xs sm:text-[11.5pt] rounded-full min-h-[38px]'
      : size === 'sm'
      ? 'px-2.5 py-1.5 text-xs sm:text-[11.5pt] rounded-xl min-h-[34px]'
      : 'px-3 py-2 text-xs sm:text-[11.5pt] rounded-xl min-h-[38px]';

  const surfaceClasses =
    variant === 'pill'
      ? isOpen
        ? 'glass-select-pill glass-select-trigger-open'
        : 'glass-select-pill'
      : isOpen
      ? 'glass-select-trigger glass-select-trigger-open'
      : 'glass-select-trigger';

  const originClass = effectivePlacement === 'top' ? 'origin-bottom' : 'origin-top';
  const closedOffsetClass =
    effectivePlacement === 'top'
      ? 'opacity-0 scale-[0.96] translate-y-1.5 pointer-events-none'
      : 'opacity-0 scale-[0.96] -translate-y-1.5 pointer-events-none';
  const openStateClass = 'opacity-100 scale-100 translate-y-0';

  const menuContent = (
    <div
      ref={menuRef}
      role="listbox"
      data-state={isVisible ? 'open' : 'closed'}
      aria-label={ariaLabel || prefixLabel || placeholder}
      style={{
        position: 'fixed',
        top: `${dropdownCoords.top}px`,
        left: `${dropdownCoords.left}px`,
        minWidth: `${dropdownCoords.width}px`,
        maxWidth: 'calc(100vw - 20px)',
        zIndex: 99999,
      }}
      className={`glass-select-menu glass-dropdown-motion ${originClass} bg-white/90 border border-slate-300/70 rounded-2xl p-1.5 space-y-0.5 max-h-68 overflow-y-auto ${
        effectivePlacement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
      } ${isVisible ? openStateClass : closedOffsetClass} ${menuClassName}`}
    >
      {options.map((opt, idx) => {
        const isSelected = String(opt.value) === String(value);
        const isHighlighted = idx === highlightedIdx;
        return (
          <div
            key={String(opt.value)}
            role="option"
            aria-selected={isSelected}
            onMouseEnter={() => setHighlightedIdx(idx)}
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
            className={`flex items-center justify-between gap-2.5 px-3 py-2.5 sm:py-2 rounded-xl text-xs sm:text-[11pt] cursor-pointer transition-all duration-150 select-none active:scale-[0.99] ${
              isSelected
                ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-sm font-bold'
                : isHighlighted
                ? 'bg-blue-50/90 text-blue-900 font-semibold'
                : 'text-slate-800 hover:bg-white/85 font-semibold'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate">{opt.label}</span>
                {opt.badge && (
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold tracking-wide uppercase ${
                      isSelected
                        ? 'bg-white/20 text-white border border-white/25'
                        : 'bg-blue-100/80 text-blue-700 border border-blue-200/70'
                    }`}
                  >
                    {opt.badge}
                  </span>
                )}
              </div>
              {opt.sublabel && (
                <span
                  className={`block text-[10.5px] font-normal truncate mt-0.5 ${
                    isSelected ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  {opt.sublabel}
                </span>
              )}
            </div>
            {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={`relative inline-block ${variant === 'pill' ? 'w-auto max-w-full' : 'w-full'} ${
        isOpen ? 'z-40' : ''
      } ${className}`}
      ref={containerRef}
    >
      <button
        type="button"
        aria-label={ariaLabel || prefixLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleDropdown}
        className={`w-full flex items-center justify-between gap-2 text-slate-900 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer text-left select-none active:scale-[0.985] ${sizeClasses} ${surfaceClasses} ${buttonClassName}`}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          {icon && <span className="shrink-0 text-blue-600 flex items-center">{icon}</span>}
          {prefixLabel && (
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">
              {prefixLabel}
            </span>
          )}
          <span className="font-bold text-slate-900 truncate">
            {selectedOption ? selectedOption.label : <span className="text-slate-400">{placeholder}</span>}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {shouldRender && mounted && typeof document !== 'undefined'
        ? createPortal(menuContent, document.body)
        : null}
    </div>
  );
}
