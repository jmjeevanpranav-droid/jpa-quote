'use client';

import React from 'react';
import { calculateLineItem, formatINR } from '@/lib/calculations/financial';
import { amountToWordsIndian } from '@/lib/calculations/number-to-words';

export interface PreviewData {
  taxType?: 'exclusive' | 'inclusive';
  quoteNumber: string;
  quoteDate: string;
  validityDate: string;
  referenceNo?: string;
  supplier: {
    name: string;
    tagline?: string;
    address: string;
    gstin: string;
    phone?: string;
    email?: string;
    website?: string;
    logoUrl?: string;
    signatoryName?: string;
    signatory_name?: string;
    signatoryDesignation?: string;
    signatory_designation?: string;
  };
  customer: {
    companyName: string;
    address: string;
    gstin?: string;
    storeName?: string;
    storeCode?: string;
    contactPerson?: string;
  };
  sections: Array<{
    name: string;
    items: Array<{
      storeName?: string;
      description: string;
      specification?: string;
      pack?: string;
      quantity: number;
      unit: string;
      unitRate: number;
      gstRate: number;
    }>;
  }>;
  summary: {
    isInterState?: boolean;
    subtotal: number;
    gstTotal: number;
    roundOff: number;
    grandTotal: number;
    gstByRate: Array<{
      rate: number;
      taxableAmount: number;
      gstAmount: number;
      cgstRate: number;
      cgstAmount: number;
      sgstRate: number;
      sgstAmount: number;
      igstRate: number;
      igstAmount: number;
    }>;
  };
  terms: {
    payment?: string;
    delivery?: string;
    validity?: string;
    transport?: string;
    gst?: string;
  };
  notes?: string;
}

export function LiveQuotationPreview({ data }: { data: PreviewData }) {
  const words = amountToWordsIndian(data.summary.grandTotal);

  return (
    <div
      style={{
        fontFamily: 'Calibri, "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif',
        fontSize: '11pt',
      }}
      className="w-full bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200/90 p-4 sm:p-6 md:p-8 leading-normal select-text print:p-0 print:shadow-none print:border-none"
    >
      {/* Supplier Header */}
      <div className="flex items-start justify-between border-b border-slate-200/80 pb-3.5 mb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-orange-50/80 border border-orange-200 flex items-center justify-center p-1.5 shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="285 94 850 862"
              className="w-full h-full"
            >
              <path fill="#F47A20" d="M 1015,488 L 731,883 L 739,852 L 837,557 L 722,461 L 721,896 L 1075,612 Z" />
              <path fill="#F47A20" d="M 485,398 L 405,453 L 670,839 L 528,570 L 528,567 L 553,541 Z" />
              <path fill="#F47A20" d="M 921,379 L 891,449 L 857,540 L 883,562 L 884,565 L 826,686 L 752,849 L 823,730 L 1006,440 Z" />
              <path fill="#F47A20" d="M 607,256 L 494,364 L 624,687 L 709,890 L 690,869 L 604,758 L 399,502 L 345,631 L 711,894 Z" />
              <path fill="#F47A20" d="M 718,154 L 720,337 L 650,395 L 659,457 L 719,415 L 720,421 L 845,528 L 919,299 Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-blue-900 uppercase leading-snug">
              {data.supplier.name}
            </h1>
            {data.supplier.tagline && (
              <p className="text-[10pt] font-medium text-slate-500 italic mb-0.5">
                {data.supplier.tagline}
              </p>
            )}
            <p className="text-[10.5pt] text-slate-600 leading-snug">
              {data.supplier.address}
            </p>
            <p className="text-[10.5pt] text-slate-600 font-medium leading-snug">
              GSTIN: <span className="font-semibold text-slate-900">{data.supplier.gstin}</span> | Contact: {data.supplier.phone || '9790600971'} | Email: {data.supplier.email}
            </p>
          </div>
        </div>
      </div>

      {/* Quotation To & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 mb-4">
        <div>
          <span className="text-[11pt] font-bold text-blue-900 uppercase tracking-wider block mb-0.5">
            Quotation To
          </span>
          <div className="font-bold text-base sm:text-lg text-slate-900 flex items-center gap-2 flex-wrap">
            <span>{data.customer.companyName}</span>
            {data.customer.storeCode && (
              <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 uppercase font-bold tracking-wider">
                Store Code: {data.customer.storeCode}
              </span>
            )}
          </div>
          {data.customer.storeName && (
            <div className="text-[11pt] font-medium text-blue-800">
              Store: {data.customer.storeName}
            </div>
          )}
          <div className="text-[10.5pt] text-slate-600 whitespace-pre-line mt-0.5 leading-snug">
            {data.customer.address}
          </div>
          {data.customer.contactPerson && (
            <div className="text-[10.5pt] font-medium text-slate-700 mt-1">
              Name: <span className="font-semibold text-slate-900">{data.customer.contactPerson}</span>
            </div>
          )}
          {data.customer.gstin && (
            <div className="text-[10.5pt] font-medium text-slate-700 mt-0.5">
              Customer GSTIN: <span className="font-semibold text-slate-900">{data.customer.gstin}</span>
            </div>
          )}
        </div>

        <div className="md:text-right flex flex-col justify-between">
          <div>
            <div className="font-capture-clean text-2xl sm:text-3xl font-bold text-[#EA580C] tracking-wider block mb-0.5">
              RATE CARD
            </div>
            <div className="font-bold text-[10.5pt] text-slate-700">
              RC Number: <span className="text-slate-900 font-bold">{data.referenceNo || data.quoteNumber}</span>
            </div>
            <div className="text-[10pt] text-slate-600 mt-0.5">
              Date: <span className="font-semibold text-slate-800">{data.quoteDate}</span>
            </div>
            <div className="text-[10pt] text-slate-600">
              Validity: <span className="font-semibold text-slate-800">{data.validityDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sections and Tables */}
      <div className="space-y-5 mb-5">
        {data.sections.map((section, sIdx) => {
          const distinctStores = new Set(
            section.items
              .map((i) => (i.storeName || '').trim())
              .filter((s) => s.length > 0 && s !== (data.customer.storeName || '').trim())
          );
          const showStoreCol = distinctStores.size > 0;

          return (
            <div key={sIdx} className="border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
              {/* Section Banner */}
              <div className="bg-blue-900 text-white font-bold px-3.5 py-1.5 text-[11pt] tracking-wide uppercase flex items-center justify-between">
                <span>{section.name}</span>
                <span className="text-xs text-blue-200 font-semibold normal-case">Section Rate Card</span>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FBE8D7] text-[#1E3A8A] text-[10pt] font-bold uppercase tracking-wider border-b border-slate-200/90">
                      <th className="py-2.5 px-2 text-center w-9">#</th>
                      {showStoreCol && <th className="py-2.5 px-2.5">Store / Branch</th>}
                      <th className="py-2.5 px-3">Particulars</th>
                      <th className="py-2.5 px-2.5 min-w-[110px]">Specification</th>
                      <th className="py-2.5 px-2.5 text-right">Qty</th>
                      <th className="py-2.5 px-2.5 text-center">Unit</th>
                      <th className="py-2.5 px-2.5 text-right">Unit Price (Rs.)</th>
                      <th className="py-2.5 px-2.5 text-center">GST %</th>
                      <th className="py-2.5 px-2.5 text-right">Taxable</th>
                      <th className="py-2.5 px-3 text-right">Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10.5pt]">
                    {section.items.map((item, iIdx) => {
                      const { taxableAmount: taxable, gstAmount: gst, lineTotal: total } = calculateLineItem(item.quantity, item.unitRate, item.gstRate, data.taxType || 'exclusive');

                      return (
                        <tr key={iIdx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-2 text-center text-slate-500 font-semibold">{iIdx + 1}</td>
                          {showStoreCol && (
                            <td className="py-2 px-2.5 text-slate-600 max-w-[150px] truncate">
                              {item.storeName || data.customer.storeName || '—'}
                            </td>
                          )}
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {item.description}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600">
                            {[item.specification, item.pack].filter(Boolean).join(' - ') || '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-semibold text-slate-800">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-2.5 text-center text-slate-600">
                            {item.unit}
                          </td>
                          <td className="py-2 px-2.5 text-right font-semibold text-slate-800 font-mono">
                            ₹{item.unitRate.toFixed(2)}
                          </td>
                          <td className="py-2 px-2.5 text-center font-semibold text-slate-600 font-mono">
                            {item.gstRate}%
                          </td>
                          <td className="py-2 px-2.5 text-right font-semibold text-slate-800 font-mono">
                            ₹{taxable.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-[#1E3A8A] font-mono">
                            ₹{total.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Box & Tax Reconciliation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 mb-4">
        {/* Left: Amount in Words */}
        <div>
          <span className="text-[10pt] font-bold text-blue-900 uppercase tracking-wider block mb-1">
            Amount in Words
          </span>
          <div className="text-[10.5pt] font-semibold text-slate-800 bg-slate-50/80 p-3 rounded-lg border border-slate-200/80 leading-relaxed">
            {words}
          </div>
        </div>

        {/* Right: Consolidated Totals */}
        <div className="space-y-1 text-[10.5pt]">
          <div className="flex justify-between py-0.5 text-slate-600 border-b border-slate-100">
            <span>Price Subtotal (Quoted Items Only)</span>
            <span className="font-semibold text-slate-900">₹{data.summary.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-0.5 text-slate-600 border-b border-slate-100">
            <span>GST Total Amount</span>
            <span className="font-semibold text-slate-900">₹{data.summary.gstTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-0.5 text-slate-600 border-b border-slate-100">
            <span>Round off</span>
            <span className="font-semibold text-slate-700">
              {data.summary.roundOff >= 0 ? '+' : ''}₹{data.summary.roundOff.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 px-3 rounded-lg bg-blue-900 text-white font-bold text-[11.5pt] tracking-wide">
            <span>GRAND TOTAL</span>
            <span>₹{data.summary.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Terms & Conditions & Signatory */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-200">
        <div className="md:col-span-2 text-[10pt] text-slate-600 space-y-1">
          <span className="text-[10pt] font-bold text-blue-900 uppercase tracking-wider block mb-1">
            Terms & Conditions
          </span>
          <p className="font-bold text-slate-800"><span className="text-blue-900">1. Payment:</span> {data.terms.payment || 'As agreed.'}</p>
          <p className="font-bold text-slate-800"><span className="text-blue-900">2. Delivery:</span> {data.terms.delivery || 'Immediate.'}</p>
          <p className="font-bold text-slate-800"><span className="text-blue-900">3. Validity:</span> {data.terms.validity || '15 days from quotation date.'}</p>
          <p className="font-bold text-slate-800"><span className="text-blue-900">4. Transportation:</span> {data.terms.transport || 'Extra, if applicable.'}</p>
          <p className="font-bold text-slate-800"><span className="text-blue-900">5. GST:</span> {data.terms.gst || 'Extra as Applicable'}</p>
        </div>

        <div className="flex flex-col justify-end items-end text-center">
          <div className="font-bold text-slate-900 text-[10.5pt] mb-0.5 w-48 text-center">
            For {data.supplier.name}
          </div>
          <div className="h-14 w-48 flex items-center justify-center my-0.5">
            <img
              src="/signature.png"
              alt="Authorized Signature"
              className="h-12 w-auto object-contain max-w-[130px]"
            />
          </div>
          <div className="border-t border-slate-300 pt-1 w-48 text-center">
            <div className="font-bold text-[10.5pt] text-slate-900 leading-tight">
              {data.supplier.signatoryName || (data.supplier as any).signatory_name || 'Mr. N JAYAKUMAR'}
            </div>
            <div className="text-[9.5pt] text-slate-500 italic leading-tight mt-0.5">
              {data.supplier.signatoryDesignation || (data.supplier as any).signatory_designation || 'Proprietor / Authorised Signatory'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
