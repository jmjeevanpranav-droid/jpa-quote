'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  ChevronDown,
  Check,
  Plus,
  Building2,
  X,
  Sparkles,
  MapPin,
  Tag,
  Loader2,
} from 'lucide-react';

export interface CustomerRecord {
  id: string;
  company_name: string;
  trade_name?: string | null;
  store_code?: string | null;
  gstin?: string | null;
  billing_address?: string | null;
  delivery_address?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  stores?: Array<{
    id?: string;
    store_name: string;
    store_code?: string | null;
    address?: string | null;
  }>;
}

interface CustomerSearchSelectProps {
  customers: CustomerRecord[];
  selectedCustomerId: string;
  onSelectCustomer: (customer: CustomerRecord | null) => void;
  onCustomerCreated?: (newCustomer: CustomerRecord) => void;
  placeholder?: string;
  className?: string;
}

export function CustomerSearchSelect({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onCustomerCreated,
  placeholder = 'Search firm, company, store code or GSTIN (e.g. Lifestyle, Prozone)...',
  className = '',
}: CustomerSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [mounted, setMounted] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dropdownCoords, setDropdownCoords] = useState<{
    top: number;
    left: number;
    width: number;
  }>({ top: 0, left: 0, width: 0 });

  // Creation modal state (Modern Nurture Glassmorphism)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalCompanyName, setModalCompanyName] = useState('');
  const [modalStoreCode, setModalStoreCode] = useState('');
  const [modalTradeName, setModalTradeName] = useState('');
  const [modalGstin, setModalGstin] = useState('');
  const [modalBillingAddress, setModalBillingAddress] = useState('');
  const [modalContactPerson, setModalContactPerson] = useState('');
  const [modalPhone, setModalPhone] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // Sync input value with selected customer when selectedCustomerId changes from outside
  useEffect(() => {
    if (selectedCustomer) {
      setInputValue(selectedCustomer.company_name);
    } else if (!isOpen) {
      setInputValue('');
    }
  }, [selectedCustomer, isOpen]);

  // Position calculation for dropdown
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownCoords({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 340),
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const onResizeScroll = () => updatePosition();
      window.addEventListener('resize', onResizeScroll);
      window.addEventListener('scroll', onResizeScroll, true);
      return () => {
        window.removeEventListener('resize', onResizeScroll);
        window.removeEventListener('scroll', onResizeScroll, true);
      };
    }
  }, [isOpen, updatePosition]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
        // If closed without selection, restore selected customer's name
        if (selectedCustomer) {
          setInputValue(selectedCustomer.company_name);
        }
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, selectedCustomer]);

  // Filter customers by input value
  const filteredCustomers = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    // If input is empty or exactly equals selected customer name when opening, show all
    if (!q || (selectedCustomer && q === selectedCustomer.company_name.toLowerCase())) {
      return customers;
    }
    return customers.filter((c) => {
      const name = (c.company_name || '').toLowerCase();
      const trade = (c.trade_name || '').toLowerCase();
      const code = (c.store_code || '').toLowerCase();
      const gstin = (c.gstin || '').toLowerCase();
      const address = (c.billing_address || '').toLowerCase();
      const storesMatch = (c.stores || []).some(
        (s) =>
          (s.store_name || '').toLowerCase().includes(q) ||
          (s.store_code || '').toLowerCase().includes(q)
      );
      return (
        name.includes(q) ||
        trade.includes(q) ||
        code.includes(q) ||
        gstin.includes(q) ||
        address.includes(q) ||
        storesMatch
      );
    });
  }, [customers, inputValue, selectedCustomer]);

  const handleSelect = (cust: CustomerRecord) => {
    setInputValue(cust.company_name);
    onSelectCustomer(cust);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputValue('');
    onSelectCustomer(null);
    setIsOpen(true);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredCustomers.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCustomers.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredCustomers.length) {
        handleSelect(filteredCustomers[highlightedIndex]);
      } else if (filteredCustomers.length === 0 && inputValue.trim()) {
        openCreateModal(inputValue.trim());
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      if (selectedCustomer) {
        setInputValue(selectedCustomer.company_name);
      }
    }
  };

  const openCreateModal = (initialName?: string) => {
    setModalCompanyName(initialName || inputValue.trim());
    setModalStoreCode('');
    setModalTradeName('');
    setModalGstin('');
    setModalBillingAddress('');
    setModalContactPerson('');
    setModalPhone('');
    setModalEmail('');
    setModalError(null);
    setIsOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCompanyName.trim()) {
      setModalError('Company Legal Name is required');
      return;
    }
    if (!modalBillingAddress.trim()) {
      setModalError('Billing Address is required');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const payload: any = {
        companyName: modalCompanyName.trim(),
        tradeName: modalTradeName.trim() || null,
        storeCode: modalStoreCode.trim() || null,
        gstin: modalGstin.trim().toUpperCase() || null,
        billingAddress: modalBillingAddress.trim(),
        deliveryAddress: modalBillingAddress.trim(),
        contactPerson: modalContactPerson.trim() || null,
        phone: modalPhone.trim() || null,
        email: modalEmail.trim() || null,
      };

      if (modalTradeName.trim()) {
        payload.stores = [
          {
            storeName: modalTradeName.trim(),
            storeCode: modalStoreCode.trim() || null,
            address: modalBillingAddress.trim(),
          },
        ];
      }

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create customer');
      }

      const data = await res.json();
      const newCustId = data.id || `cust_${Date.now()}`;

      const newRecord: CustomerRecord = {
        id: newCustId,
        company_name: modalCompanyName.trim(),
        trade_name: modalTradeName.trim() || null,
        store_code: modalStoreCode.trim() || null,
        gstin: modalGstin.trim().toUpperCase() || null,
        billing_address: modalBillingAddress.trim(),
        contact_person: modalContactPerson.trim() || null,
        phone: modalPhone.trim() || null,
        email: modalEmail.trim() || null,
        stores: modalTradeName.trim()
          ? [
              {
                store_name: modalTradeName.trim(),
                store_code: modalStoreCode.trim() || null,
                address: modalBillingAddress.trim(),
              },
            ]
          : [],
      };

      if (onCustomerCreated) {
        onCustomerCreated(newRecord);
      }
      setInputValue(newRecord.company_name);
      onSelectCustomer(newRecord);

      setIsCreateModalOpen(false);
    } catch (err: any) {
      setModalError(err.message || 'Error creating customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modern Glassmorphism Dropdown Menu
  const dropdownMenu = (
    <div
      ref={menuRef}
      role="listbox"
      style={{
        position: 'fixed',
        top: `${dropdownCoords.top}px`,
        left: `${dropdownCoords.left}px`,
        width: `${dropdownCoords.width}px`,
        maxHeight: '380px',
        zIndex: 99999,
      }}
      className="rounded-2xl border border-white/80 bg-white/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(30,58,138,0.22)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Top Glassmorphism Status Bar */}
      <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/70 backdrop-blur-md flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-blue-600" />
          <span>Registered Companies ({filteredCustomers.length})</span>
        </div>
        {inputValue.trim() && (
          <span className="text-blue-700 font-bold normal-case text-xs truncate max-w-[150px]">
            Typing: &ldquo;{inputValue}&rdquo;
          </span>
        )}
      </div>

      {/* Scrollable List of Company Names */}
      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((c, idx) => {
            const isSelected = c.id === selectedCustomerId;
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={c.id}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => handleSelect(c)}
                className={`group flex items-center justify-between p-3 rounded-xl text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isHighlighted
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50/80 text-blue-900 border border-blue-200/60'
                    : 'hover:bg-slate-50/80 text-slate-800'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  {/* Company Name in High-Impact Typography */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-black text-sm tracking-tight truncate ${
                        isSelected ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {c.company_name}
                    </span>

                    {c.store_code && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-extrabold uppercase shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        {c.store_code}
                      </span>
                    )}
                  </div>

                  {/* Branch & GSTIN Info */}
                  <div className="flex items-center gap-2.5 mt-1 text-xs flex-wrap">
                    {c.trade_name && (
                      <span
                        className={`font-semibold flex items-center gap-1 ${
                          isSelected ? 'text-blue-100' : 'text-blue-700'
                        }`}
                      >
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>Branch: {c.trade_name}</span>
                      </span>
                    )}
                    {c.gstin && (
                      <span
                        className={`font-mono text-[11px] ${
                          isSelected ? 'text-blue-200' : 'text-slate-500'
                        }`}
                      >
                        GSTIN: {c.gstin}
                      </span>
                    )}
                  </div>

                  {/* Address Snippet */}
                  {c.billing_address && (
                    <div
                      className={`text-[11px] truncate mt-0.5 ${
                        isSelected ? 'text-blue-100/90' : 'text-slate-400'
                      }`}
                    >
                      {c.billing_address}
                    </div>
                  )}
                </div>

                {isSelected ? (
                  <Check className="w-4 h-4 text-white shrink-0 ml-1.5" />
                ) : (
                  <span className="text-[11px] font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    Select →
                  </span>
                )}
              </div>
            );
          })
        ) : (
          /* Empty Search State: Not found -> Instant Create Option */
          <div className="p-5 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                No company found matching &ldquo;{inputValue}&rdquo;
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Click below to register this firm as a new customer and auto-fill details.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openCreateModal(inputValue.trim())}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-xs shadow-md shadow-blue-500/25 cursor-pointer transition-all active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Create &ldquo;{inputValue.trim()}&rdquo; & Auto-fill</span>
            </button>
          </div>
        )}
      </div>

      {/* Permanent Bottom Action Bar */}
      <div className="border-t border-slate-100 bg-slate-50/90 backdrop-blur-md p-2.5 flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">
          Can&apos;t find firm?
        </span>
        <button
          type="button"
          onClick={() => openCreateModal(inputValue.trim())}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-blue-700 hover:bg-blue-50 border border-blue-200/90 shadow-2xs hover:border-blue-300 cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-blue-600" />
          <span>{inputValue.trim() ? `Create "${inputValue.trim()}"` : 'Create New Customer'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Real Live Typing Search Bar Input */}
      <div
        className={`relative w-full flex items-center gap-2 px-3 py-2 rounded-xl border bg-white transition-all ${
          isOpen
            ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
            : 'border-slate-300 hover:border-slate-400 shadow-2xs'
        }`}
      >
        <Search
          className={`w-4 h-4 shrink-0 transition-colors ${
            isOpen ? 'text-blue-600' : 'text-slate-400'
          }`}
        />

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            setIsOpen(true);
            updatePosition();
          }}
          onClick={() => {
            setIsOpen(true);
            updatePosition();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Select Customer Search Bar"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent text-xs sm:text-[12pt] font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
        />

        {/* Selected Customer Store Code Badge */}
        {selectedCustomer && selectedCustomer.store_code && !isOpen && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 uppercase shrink-0">
            {selectedCustomer.store_code}
          </span>
        )}

        {/* Clear Button */}
        {inputValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}

        {/* Dropdown Toggle Chevron */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
            if (!isOpen) {
              updatePosition();
              inputRef.current?.focus();
            }
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
          title="Toggle customer list"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </button>
      </div>

      {/* Render Dropdown via React Portal */}
      {isOpen && mounted && typeof document !== 'undefined'
        ? createPortal(dropdownMenu, document.body)
        : null}

      {/* Modern Nurture Glassmorphism Customer Creation Modal */}
      {isCreateModalOpen && mounted && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200">
              <form
                onSubmit={handleCreateCustomerSubmit}
                className="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_24px_50px_rgba(30,58,138,0.22)] p-6 sm:p-7 space-y-4 max-h-[90vh] overflow-y-auto"
              >
                {/* Header with Modern Nurture Glassmorphism */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-slate-900 leading-tight">
                        Add Customer Firm
                      </h3>
                      <p className="text-xs text-slate-500">
                        Register client account & auto-fill quotation fields
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {modalError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    {modalError}
                  </div>
                )}

                {/* Company Legal Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Company Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={modalCompanyName}
                    onChange={(e) => setModalCompanyName(e.target.value)}
                    placeholder="e.g. Lifestyle International Pvt. Ltd."
                    className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                    autoFocus
                  />
                </div>

                {/* Store Code (Optional) & Store / Branch Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-200">
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                      Store Code <span className="text-amber-700 font-semibold normal-case">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={modalStoreCode}
                      onChange={(e) => setModalStoreCode(e.target.value.toUpperCase())}
                      placeholder="e.g. PZ-01 / 1903"
                      className="w-full px-3 py-2 text-sm font-mono font-bold text-blue-700 bg-white rounded-xl border border-amber-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 uppercase"
                    />
                    <span className="text-[10px] text-amber-800/80 mt-1 block">
                      Appears in separate column in exports & PDF
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Store / Branch Location
                    </label>
                    <input
                      type="text"
                      value={modalTradeName}
                      onChange={(e) => setModalTradeName(e.target.value)}
                      placeholder="e.g. Prozone Mall / Homecentre"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>

                {/* GSTIN */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Customer GSTIN
                  </label>
                  <input
                    type="text"
                    value={modalGstin}
                    onChange={(e) => setModalGstin(e.target.value.toUpperCase())}
                    placeholder="33AAACL2937J1ZL"
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-medium rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 uppercase"
                  />
                </div>

                {/* Billing Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Billing Address <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={modalBillingAddress}
                    onChange={(e) => setModalBillingAddress(e.target.value)}
                    placeholder="Full street address, city, and pincode..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                {/* Contact Person & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={modalContactPerson}
                      onChange={(e) => setModalContactPerson(e.target.value)}
                      placeholder="e.g. Mr. Anand"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={modalPhone}
                      onChange={(e) => setModalPhone(e.target.value)}
                      placeholder="+91 96984 14094"
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>

                {/* Email (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    placeholder="client@company.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Save & Auto-fill Quotation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
