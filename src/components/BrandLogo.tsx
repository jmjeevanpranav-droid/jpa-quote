import React from 'react';
import Link from 'next/link';

interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'icon-only';
  showSubtitle?: boolean;
  className?: string;
  isLink?: boolean;
}

export function BrandLogo({
  variant = 'full',
  showSubtitle = true,
  className = '',
  isLink = true,
}: BrandLogoProps) {
  const content = (
    <div
      suppressHydrationWarning
      className={`flex items-center ${variant === 'icon-only' ? 'justify-center' : 'gap-3'} select-none ${className}`}
    >
      {/* Official JPA Origami Flame/Bird Emblem in Full Colour */}
      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/15 to-blue-600/10 p-1.5 border border-amber-500/20 shadow-xs shrink-0 group-hover:scale-105 transition-transform duration-150">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="285 94 850 862"
          className="w-full h-full drop-shadow-xs"
        >
          <path fill="#F47A20" d="M 1015,488 L 731,883 L 739,852 L 837,557 L 722,461 L 721,896 L 1075,612 Z" />
          <path fill="#F47A20" d="M 485,398 L 405,453 L 670,839 L 528,570 L 528,567 L 553,541 Z" />
          <path fill="#F47A20" d="M 921,379 L 891,449 L 857,540 L 883,562 L 884,565 L 826,686 L 752,849 L 823,730 L 1006,440 Z" />
          <path fill="#F47A20" d="M 607,256 L 494,364 L 624,687 L 709,890 L 690,869 L 604,758 L 399,502 L 345,631 L 711,894 Z" />
          <path fill="#F47A20" d="M 718,154 L 720,337 L 650,395 L 659,457 L 719,415 L 720,421 L 845,528 L 919,299 Z" />
        </svg>
      </div>

      {variant !== 'icon-only' && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xl tracking-tight text-black">
              JPA <span className="text-[#F47A20]">QUOTE</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );

  if (isLink) {
    return (
      <Link href="/" className="group inline-flex items-center justify-center">
        {content}
      </Link>
    );
  }

  return content;
}
