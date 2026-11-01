import React from 'react';
import { Sparkles } from 'lucide-react';

interface RateMatchBadgeProps {
  date?: string;
  rate?: number;
  className?: string;
}

export function RateMatchBadge({ date, rate, className = '' }: RateMatchBadgeProps) {
  const label = date ? `Saved rate · ${date}` : 'Saved rate';

  return (
    <span
      title={rate ? `Verified rate ₹${rate.toFixed(2)} automatically reused from JPA central Product & Rate Memory` : 'Verified rate reused from Rate Memory'}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-blue-50/80 text-blue-700 border border-blue-200/60 shadow-2xs select-none transition-colors hover:bg-blue-100/80 ${className}`}
    >
      <Sparkles className="w-3 h-3 text-blue-500" />
      <span>{label}</span>
    </span>
  );
}
