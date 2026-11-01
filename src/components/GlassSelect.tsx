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
  className = '',
  buttonClassName = '',
  menuClassName = '',
  size = 'md',
  ariaLabel,
  placement = 'auto',
}: GlassSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePlacementAndPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // Approximate height needed: ~34px per option + ~12px padding
    const estimatedHeight = Math.min(options.length * 34 + 12, 220);
    const spaceBelowViewport = window.innerHeight - rect.bottom;
    const spaceAboveViewport = rect.top;

    // Determine whether to drop down or up
    let dropUp = false;
    if (placement === 'top') {
      dropUp = true;
    } else if (placement === 'bottom') {
      dropUp = false;
    } else {
      // Auto: prefer bottom unless space below in viewport is tight (< 160px) and above has more room
      dropUp = spaceBelowViewport < estimatedHeight && spaceAboveViewport > spaceBelowViewport;
    }

    setEffectivePlacement(dropUp ? 'top' : 'bottom');

    // Calculate fixed screen coordinates
    const top = dropUp ? rect.top - estimatedHeight - 4 : rect.bottom + 4;
    setDropdownCoords({
      top: Math.max(6, top),
      left: rect.left,
      width: Math.max(rect.width, 80),
    });
  }, [options.length, placement]);

  const selectedOption = options.find((o) => String(o.value) === String(value));

  const toggleDropdown = () => {
    if (!isOpen) {
      calculatePlacementAndPosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      calculatePlacementAndPosition();
      const handleScrollOrResize = () => calculatePlacementAndPosition();
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen, calculatePlacementAndPosition]);

  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1.5 text-xs sm:text-[12pt] rounded-lg'
      : 'px-3 py-2 text-xs sm:text-[12pt] rounded-xl';

  const menuContent = (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={ariaLabel || placeholder}
      style={{
        position: 'fixed',
        top: `${dropdownCoords.top}px`,
        left: `${dropdownCoords.left}px`,
        minWidth: `${dropdownCoords.width}px`,
        zIndex: 99999,
      }}
      className={`rounded-xl border border-slate-300 bg-white shadow-2xl p-1 space-y-0.5 max-h-56 overflow-y-auto animate-in fade-in duration-100 ${
        effectivePlacement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
      } ${menuClassName}`}
    >
      {options.map((opt) => {
        const isSelected = String(opt.value) === String(value);
        return (
          <div
            key={String(opt.value)}
            role="option"
            aria-selected={isSelected}
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs sm:text-[12pt] font-semibold cursor-pointer transition-colors ${
              isSelected
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-800 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            <div className="truncate">
              <span>{opt.label}</span>
              {opt.sublabel && (
                <span
                  className={`block text-[10px] font-normal ${
                    isSelected ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  {opt.sublabel}
                </span>
              )}
            </div>
            {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1.5 text-white" />}
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={`relative inline-block w-full ${isOpen ? 'z-40' : ''} ${className}`}
      ref={containerRef}
    >
      <button
        type="button"
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleDropdown}
        className={`w-full flex items-center justify-between gap-1.5 border text-slate-900 font-bold transition-all duration-150 cursor-pointer text-left ${sizeClasses} ${buttonClassName} ${
          isOpen
            ? 'bg-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
            : 'bg-white hover:bg-slate-50 border-slate-300 hover:border-slate-400 shadow-2xs'
        }`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : <span className="text-slate-400">{placeholder}</span>}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {isOpen && mounted && typeof document !== 'undefined'
        ? createPortal(menuContent, document.body)
        : null}
    </div>
  );
}
