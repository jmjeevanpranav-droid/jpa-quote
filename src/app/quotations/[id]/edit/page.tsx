'use client';

import React, { useState, useEffect, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';
import { LiveQuotationPreview } from '@/components/LiveQuotationPreview';
import { DownloadDropdown } from '@/components/DownloadDropdown';
import { GlassSelect } from '@/components/GlassSelect';
import { RateMatchBadge } from '@/components/RateMatchBadge';
import { ItemDescriptionAutocomplete } from '@/components/ItemDescriptionAutocomplete';
import { AiImportModal } from '@/components/AiImportModal';
import {
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Copy,
  Eraser,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Building2,
  Layers,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { calculateQuotationSummary } from '@/lib/calculations/financial';
import { capitalizeInput } from '@/lib/utils/formatters';

interface QuoteItem {
  id: string;
  storeName: string;
  description: string;
  specification: string;
  pack: string;
  quantity: number;
  unit: string;
  unitRate: number;
  gstRate: number;
  isRateAutofilled?: boolean;
  savedRateDate?: string;
}

interface QuoteSection {
  id: string;
  name: string;
  items: QuoteItem[];
}

function EditQuotationContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Form State
  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteDate, setQuoteDate] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [status, setStatus] = useState<'draft' | 'approved'>('draft');

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState('');

  const handleQuoteDateChange = (newQuoteDate: string) => {
    setQuoteDate(newQuoteDate);
    try {
      const parts = newQuoteDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        d.setDate(d.getDate() + 15);
        const vy = d.getFullYear();
        const vm = String(d.getMonth() + 1).padStart(2, '0');
        const vd = String(d.getDate()).padStart(2, '0');
        setValidityDate(`${vy}-${vm}-${vd}`);
      }
    } catch {}
  };

  const setPlus15DaysValidity = () => {
    try {
      const base = quoteDate ? quoteDate.split('-') : null;
      const d =
        base && base.length === 3
          ? new Date(Number(base[0]), Number(base[1]) - 1, Number(base[2]))
          : new Date();
      d.setDate(d.getDate() + 15);
      const vy = d.getFullYear();
      const vm = String(d.getMonth() + 1).padStart(2, '0');
      const vd = String(d.getDate()).padStart(2, '0');
      setValidityDate(`${vy}-${vm}-${vd}`);
    } catch {}
  };

  const [supplierProfile, setSupplierProfile] = useState<any>({
    name: 'Jeevan Pranav Agencies (JPA)',
    address: '16-P, Sakthi Illam, Podanur, Coimbatore - 641023',
    gstin: '33BRGPM1867B1Z1',
  });

  const [sections, setSections] = useState<QuoteSection[]>([]);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiImportTargetSecId, setAiImportTargetSecId] = useState<string | null>(null);
  const [aiImportTargetSecName, setAiImportTargetSecName] = useState<string | null>(null);
  const [termsPayment, setTermsPayment] = useState('As agreed.');
  const [termsDelivery, setTermsDelivery] = useState('Immediate.');
  const [termsValidity, setTermsValidity] = useState('15 days from quotation date.');
  const [termsTransport, setTermsTransport] = useState('Extra, if applicable.');
  const [termsGst, setTermsGst] = useState('Extra as Applicable');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/quotations/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        const q = res.quotation;
        setQuoteNumber(q.quote_number);
        setQuoteDate(q.quote_date);
        setValidityDate(q.validity_date);
        setReferenceNo(q.reference_no || '');
        setStatus(q.status || 'draft');

        setCustomerName(q.customer_name);
        setSelectedCustomerId(q.customer_id || '');
        setCustomerAddress(q.customer_address);
        setCustomerGstin(q.customer_gstin || '');
        setStoreName(q.store_name || '');
        setStoreCode(q.store_code || '');

        setTermsPayment(q.terms_payment || 'As agreed.');
        setTermsDelivery(q.terms_delivery || 'Immediate.');
        setTermsValidity(q.terms_validity || '15 days from quotation date.');
        setTermsTransport(q.terms_transport || 'Extra, if applicable.');
        setTermsGst(q.terms_gst || 'Extra as Applicable');

        if (res.supplier) setSupplierProfile(res.supplier);

        const loadedSecs = (res.sections || []).map((sec: any) => ({
          id: sec.id,
          name: sec.section_name,
          items: (sec.items || []).map((itm: any) => ({
            id: itm.id,
            storeName: itm.store_name || q.store_name || '',
            description: itm.description,
            specification: itm.specification || '',
            pack: itm.pack || '',
            quantity: Number(itm.quantity),
            unit: itm.unit,
            unitRate: Number(itm.unit_rate),
            gstRate: Number(itm.gst_rate),
            isRateAutofilled: Boolean(itm.is_rate_autofilled),
            savedRateDate: itm.saved_rate_date,
          })),
        }));

        setSections(loadedSecs);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));

    const handleCompanyUpdated = (e: any) => {
      if (e.detail) {
        setSupplierProfile(e.detail);
      } else {
        fetch('/api/company', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data.profile) setSupplierProfile(data.profile);
          })
          .catch(() => {});
      }
    };

    window.addEventListener('jpa:company-updated', handleCompanyUpdated);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'jpa_company_profile' && e.newValue) {
        try {
          setSupplierProfile(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('jpa:company-updated', handleCompanyUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, [id]);

  const allFlattenedItems = sections.flatMap((sec) => sec.items);
  const summary = calculateQuotationSummary(allFlattenedItems, supplierProfile.gstin?.slice(0, 2) || '33', customerGstin.slice(0, 2) || supplierProfile.gstin?.slice(0, 2) || '33');

  const handleItemFieldChange = async (
    secId: string,
    itemId: string,
    field: keyof QuoteItem,
    value: any
  ) => {
    const finalValue =
      typeof value === 'string' && ['description', 'specification', 'pack', 'unit'].includes(field as string)
        ? capitalizeInput(value)
        : value;

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          items: sec.items.map((itm) => (itm.id === itemId ? { ...itm, [field]: finalValue } : itm)),
        };
      })
    );

    // Silent Rate Memory Match on description change
    if (field === 'description' && typeof finalValue === 'string' && finalValue.trim().length >= 3) {
      try {
        const res = await fetch('/api/products/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: finalValue, customerId: selectedCustomerId }),
        });

        if (res.ok) {
          const match = await res.json();
          if (match.matched && match.rate) {
            setSections((prev) =>
              prev.map((sec) => {
                if (sec.id !== secId) return sec;
                return {
                  ...sec,
                  items: sec.items.map((itm) => {
                    if (itm.id !== itemId || itm.description !== value) return itm;
                    return {
                      ...itm,
                      unitRate: match.rate,
                      unit: match.unit || itm.unit,
                      specification: itm.specification || match.specification || '',
                      pack: itm.pack || match.pack || '',
                      gstRate: match.gstRate ?? itm.gstRate,
                      isRateAutofilled: true,
                      savedRateDate: match.savedRateDate,
                    };
                  }),
                };
              })
            );
          }
        }
      } catch (err) {}
    }
  };

  // Section Management
  const addSection = () => {
    const newSec: QuoteSection = {
      id: `sec_${Date.now()}`,
      name: '',
      items: [
        {
          id: `itm_${Date.now()}`,
          storeName,
          description: '',
          specification: '',
          pack: '',
          quantity: 0,
          unit: '',
          unitRate: 0,
          gstRate: 18,
        },
      ],
    };
    setSections([...sections, newSec]);
  };

  const removeSection = (secId: string) => {
    if (sections.length <= 1) {
      alert('Quotation must contain at least one section');
      return;
    }
    setSections(sections.filter((s) => s.id !== secId));
  };

  const clearSectionItems = (secId: string) => {
    const sec = sections.find((s) => s.id === secId);
    if (!sec || sec.items.length === 0) return;
    const hasData = sec.items.some(
      (i) => (i.description && i.description.trim()) || i.quantity > 0 || i.unitRate > 0
    );
    if (hasData) {
      if (!window.confirm(`Are you sure you want to clear all ${sec.items.length} items from this section?`)) {
        return;
      }
    }
    setSections(sections.map((s) => (s.id === secId ? { ...s, items: [] } : s)));
  };

  const openAiImportForSection = (secId: string, secName: string) => {
    setAiImportTargetSecId(secId);
    const cleaned = (secName || '').split('|')[0].trim();
    setAiImportTargetSecName(cleaned || null);
    setIsAiModalOpen(true);
  };

  // Item Row Management
  const addItemToSection = (secId: string) => {
    setSections(
      sections.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          items: [
            ...sec.items,
            {
              id: `itm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              storeName,
              description: '',
              specification: '',
              pack: '',
              quantity: 0,
              unit: '',
              unitRate: 0,
              gstRate: 18,
            },
          ],
        };
      })
    );
  };

  const removeItem = (secId: string, itemId: string) => {
    setSections(
      sections.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          items: sec.items.filter((i) => i.id !== itemId),
        };
      })
    );
  };

  const duplicateItem = (secId: string, item: QuoteItem) => {
    setSections(
      sections.map((sec) => {
        if (sec.id !== secId) return sec;
        const idx = sec.items.findIndex((i) => i.id === item.id);
        const newItem: QuoteItem = {
          ...item,
          id: `itm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        };
        const nextItems = [...sec.items];
        nextItems.splice(idx + 1, 0, newItem);
        return { ...sec, items: nextItems };
      })
    );
  };

  const handleAcceptAiItems = (
    importedItems: any[],
    destinationSectionName?: string,
    metadata?: any
  ) => {
    if (!importedItems || importedItems.length === 0) return;

    const newItems: QuoteItem[] = importedItems.map((aiItm) => {
      const unitRate = Number(aiItm.rate || 0);
      const isAutofilled = Boolean(aiItm.isRateAutofilled || unitRate > 0);
      const savedDate = aiItm.savedRateDate || (isAutofilled ? 'Rate Memory' : undefined);
      return {
        id: `itm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        storeName: storeName || (metadata?.storeGuess || ''),
        description: aiItm.description,
        specification: aiItm.specification || '',
        pack: aiItm.pack || '',
        quantity: aiItm.quantity ?? 0,
        unit: aiItm.unit || 'Nos',
        unitRate,
        gstRate: aiItm.gstRate != null ? Number(aiItm.gstRate) : 18,
        isRateAutofilled: isAutofilled,
        savedRateDate: savedDate,
      };
    });

    const formatSectionBanner = (name: string) => {
      const clean = (name || 'Items').split('|')[0].trim().toUpperCase();
      return `${clean}  |  ITEMS & PRICING`;
    };

    let target = (destinationSectionName || '').split('|')[0].trim();
    if (!target || target.toLowerCase() === 'current section' || target.toLowerCase() === 'imported section') {
      target = metadata?.sectionGuess || 'Stationery';
    }

    const targetFormatted = formatSectionBanner(target);
    const targetBase = target.toLowerCase();

    const isSingleInitial =
      sections.length === 1 &&
      (!sections[0].name.trim() || sections[0].name.toLowerCase().includes('current section')) &&
      (sections[0].items.length === 0 ||
        (sections[0].items.length === 1 && !sections[0].items[0].description.trim() && sections[0].items[0].quantity === 0));

    if (isSingleInitial) {
      setSections([
        {
          id: sections[0].id || `sec_${Date.now()}`,
          name: targetFormatted,
          items: newItems,
        },
      ]);
      setAiImportTargetSecId(null);
      setAiImportTargetSecName(null);
      return;
    }

    const existingIndex = sections.findIndex((s) => {
      const sBase = s.name.split('|')[0].trim().toLowerCase();
      return (
        sBase === targetBase ||
        s.name.toLowerCase().includes(targetBase) ||
        (sBase.length > 3 && targetBase.includes(sBase))
      );
    });

    if (aiImportTargetSecId) {
      const clickedSec = sections.find((s) => s.id === aiImportTargetSecId);
      if (clickedSec && !clickedSec.name.trim()) {
        setSections((prev) =>
          prev.map((sec) =>
            sec.id === aiImportTargetSecId
              ? {
                  ...sec,
                  name: targetFormatted,
                  items:
                    sec.items.length === 0 || (sec.items.length === 1 && !sec.items[0].description.trim())
                      ? newItems
                      : [...sec.items, ...newItems],
                }
              : sec
          )
        );
        setAiImportTargetSecId(null);
        setAiImportTargetSecName(null);
        return;
      }

      if (clickedSec) {
        const clickedBase = clickedSec.name.split('|')[0].trim().toLowerCase();
        if (clickedBase === targetBase || clickedSec.name.toLowerCase().includes(targetBase)) {
          setSections((prev) =>
            prev.map((sec) =>
              sec.id === aiImportTargetSecId
                ? {
                    ...sec,
                    items:
                      sec.items.length === 0 || (sec.items.length === 1 && !sec.items[0].description.trim())
                        ? newItems
                        : [...sec.items, ...newItems],
                  }
                : sec
            )
          );
          setAiImportTargetSecId(null);
          setAiImportTargetSecName(null);
          return;
        }
      }

      if (existingIndex >= 0) {
        setSections((prev) =>
          prev.map((sec, idx) =>
            idx === existingIndex
              ? {
                  ...sec,
                  items:
                    sec.items.length === 0 || (sec.items.length === 1 && !sec.items[0].description.trim())
                      ? newItems
                      : [...sec.items, ...newItems],
                }
              : sec
          )
        );
        setAiImportTargetSecId(null);
        setAiImportTargetSecName(null);
        return;
      }

      setSections((prev) => [
        ...prev,
        {
          id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: targetFormatted,
          items: newItems,
        },
      ]);
      setAiImportTargetSecId(null);
      setAiImportTargetSecName(null);
      return;
    }

    if (existingIndex >= 0) {
      setSections((prev) =>
        prev.map((sec, idx) =>
          idx === existingIndex
            ? {
                ...sec,
                items:
                  sec.items.length === 0 || (sec.items.length === 1 && !sec.items[0].description.trim())
                    ? newItems
                    : [...sec.items, ...newItems],
              }
            : sec
        )
      );
    } else {
      setSections((prev) => [
        ...prev,
        {
          id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: targetFormatted,
          items: newItems,
        },
      ]);
    }

    setAiImportTargetSecId(null);
    setAiImportTargetSecName(null);
  };

  const handleUpdateQuotation = async (desiredStatus?: 'draft' | 'approved') => {
    if (isSaving) return false;

    if (!quoteDate) {
      alert('Please enter a Quotation Date.');
      return false;
    }
    if (!validityDate) {
      alert('Please enter a Validity Date.');
      return false;
    }
    if (validityDate < quoteDate) {
      alert(
        `Validity Date (${validityDate}) cannot be earlier than Quotation Date (${quoteDate}). Please choose a validity date on or after ${quoteDate} (e.g. 15 or 30 days ahead).`
      );
      return false;
    }

    setIsSaving(true);
    try {
      const payload = {
        customerName,
        customerAddress,
        customerGstin,
        storeName,
        storeCode,
        quoteDate,
        validityDate,
        referenceNo,
        status: desiredStatus || status,
        termsPayment,
        termsDelivery,
        termsValidity,
        termsTransport,
        termsGst,
        sections,
      };

      const res = await fetch(`/api/quotations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update quotation');
      }

      if (desiredStatus) setStatus(desiredStatus);
      alert(`Quotation ${quoteNumber} updated successfully. Rate Memory updated.`);
      return true;
    } catch (err: any) {
      alert(err.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const previewData = {
    quoteNumber,
    quoteDate,
    validityDate,
    referenceNo,
    supplier: supplierProfile,
    customer: {
      companyName: customerName,
      address: customerAddress,
      gstin: customerGstin,
      storeName,
      storeCode,
    },
    sections,
    summary,
    terms: {
      payment: termsPayment,
      delivery: termsDelivery,
      validity: termsValidity,
      transport: termsTransport,
      gst: termsGst,
    },
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFF]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFF]">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Action Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between h-18 px-6 bg-white/75 backdrop-blur-md border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <Link
              href={`/quotations/${id}`}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Edit Quotation</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                  {quoteNumber}
                </span>
              </h1>
              <p className="text-xs text-slate-500">{customerName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleUpdateQuotation('draft')}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-300 cursor-pointer ${
                showPreview
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs hover:bg-blue-100/70'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs hover:border-slate-300'
              }`}
            >
              <span className="transition-transform duration-300">
                {showPreview ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </span>
              <span>{showPreview ? 'Hide Preview' : 'Show Preview'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleUpdateQuotation('approved')}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve & Finalize</span>
            </button>

            <DownloadDropdown quotationId={id} quoteNumber={quoteNumber} onBeforeDownload={() => handleUpdateQuotation()} />
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Form */}
          <div
            className={`flex-1 min-w-0 overflow-y-auto p-6 space-y-6 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              showPreview ? 'lg:w-3/5' : 'w-full'
            }`}
          >
            {/* Customer Details */}
            <div className="glass-panel rounded-2xl p-5 border border-white/80 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(capitalizeInput(e.target.value))}
                    className="w-full px-3 py-2 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase mb-1">
                      Store Location
                    </label>
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(capitalizeInput(e.target.value))}
                      className="w-full px-3 py-2 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase mb-1">
                      Store Code <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={storeCode}
                      onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                      placeholder="e.g. 1903"
                      className="w-full px-3 py-2 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white text-blue-700 font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(capitalizeInput(e.target.value))}
                    className="w-full px-3 py-2 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase mb-1">
                      GSTIN
                    </label>
                    <input
                      type="text"
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase mb-1">
                      Status
                    </label>
                    <GlassSelect
                      value={status}
                      onChange={(val) => setStatus(val)}
                      options={[
                        { value: 'draft', label: 'Draft' },
                        { value: 'approved', label: 'Approved' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* Quotation Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider">
                      Quotation Date
                    </label>
                    <span className="text-[10px] text-blue-600 font-semibold px-1.5 py-0.2 bg-blue-50 rounded-md">
                      Current / Present
                    </span>
                  </div>
                  <input
                    type="date"
                    aria-label="Quotation Date"
                    value={quoteDate}
                    onChange={(e) => handleQuoteDateChange(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider">
                      Validity Date
                    </label>
                    <button
                      type="button"
                      onClick={setPlus15DaysValidity}
                      className="text-[10px] text-emerald-700 font-bold px-1.5 py-0.2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-md cursor-pointer transition-colors"
                      title="Reset validity to +15 days from Quotation Date"
                    >
                      +15 Days (Default)
                    </button>
                  </div>
                  <input
                    type="date"
                    aria-label="Validity Date"
                    value={validityDate}
                    min={quoteDate || undefined}
                    onChange={(e) => setValidityDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Sections & Items */}
            <div className="space-y-6">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs transition-all relative"
                >
                  <div className="bg-white px-5 py-3.5 border-b border-slate-100 flex items-center justify-between rounded-t-2xl">
                    <div className="flex items-center gap-2.5 flex-1 max-w-xl mr-4">
                      <div className="p-2 rounded-xl bg-blue-50/80 border border-blue-200/70 text-blue-600 shrink-0 shadow-2xs">
                        <Layers className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        aria-label="Section name"
                        placeholder="SECTION NAME (e.g. Housekeeping, Stationery)..."
                        value={section.name}
                        onChange={(e) =>
                          setSections(
                            sections.map((s) =>
                              s.id === section.id ? { ...s, name: capitalizeInput(e.target.value) } : s
                            )
                          )
                        }
                        className="glass-section-box font-bold text-sm sm:text-[11pt] text-slate-800 uppercase px-3.5 py-1.5 rounded-xl w-full tracking-wider shadow-2xs"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => openAiImportForSection(section.id, section.name)}
                        title="AI Import items into this section"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50/90 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>AI Import Items</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => clearSectionItems(section.id)}
                        disabled={section.items.length === 0}
                        title="Clear all rows in this section"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Eraser className="w-3.5 h-3.5" />
                        <span>Clear All</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeSection(section.id)}
                        title="Remove section"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto bg-white min-h-[140px] rounded-b-2xl">
                    <table className="w-full min-w-[960px] text-left font-sans">
                      <thead className="bg-slate-50/70 text-slate-700 text-xs sm:text-[12pt] font-bold uppercase tracking-wider border-b border-slate-200/80">
                        <tr>
                          <th className="p-2.5 w-10 text-center">#</th>
                          <th className="p-2.5 min-w-[200px]">Particulars</th>
                          <th className="p-2.5 min-w-[100px] w-28">Spec</th>
                          <th className="p-2.5 min-w-[100px] w-28">Pack</th>
                          <th className="p-2.5 w-24 text-right">Qty</th>
                          <th className="p-2.5 w-24 text-center">Unit</th>
                          <th className="p-2.5 w-28 text-right">Rate (₹)</th>
                          <th className="p-2.5 w-24 text-center">GST</th>
                          <th className="p-2.5 w-28 text-right">Taxable</th>
                          <th className="p-2.5 w-28 text-right">Total</th>
                          <th className="p-2.5 w-16 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs sm:text-[12pt]">
                        {section.items.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="py-8 text-center text-slate-400 text-xs sm:text-sm">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <p className="text-slate-500 font-medium">All rows cleared. No items in this section.</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <button
                                    type="button"
                                    onClick={() => addItemToSection(section.id)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add Item</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openAiImportForSection(section.id, section.name)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>AI Import Items</span>
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          section.items.map((item, iIdx) => {
                          const taxable = Number((item.quantity * item.unitRate).toFixed(2));
                          const gst = Number(((taxable * (item.gstRate || 0)) / 100).toFixed(2));
                          const total = Number((taxable + gst).toFixed(2));

                          return (
                            <tr key={item.id} className="hover:bg-blue-50/20 transition-colors group">
                              <td className="p-2.5 text-center text-slate-400 font-mono text-xs sm:text-[11pt]">
                                {iIdx + 1}
                              </td>
                              <td className="p-2.5 relative">
                                <div className="space-y-1">
                                  <ItemDescriptionAutocomplete
                                    value={item.description}
                                    className="glass-input-pure-white w-full px-2.5 py-1.5 text-xs sm:text-[12pt] font-semibold rounded-xl text-slate-900"
                                    onChange={(val) =>
                                      handleItemFieldChange(
                                        section.id,
                                        item.id,
                                        'description',
                                        val
                                      )
                                    }
                                    onSelectProduct={(product) => {
                                      setSections((prev) =>
                                        prev.map((sec) => {
                                          if (sec.id !== section.id) return sec;
                                          return {
                                            ...sec,
                                            items: sec.items.map((itm) => {
                                              if (itm.id !== item.id) return itm;
                                              return {
                                                ...itm,
                                                productId: product.id,
                                                description: product.description,
                                                specification: product.specification || '',
                                                pack: product.pack || '',
                                                unit: product.unit || 'Nos',
                                                unitRate: Number(product.default_rate || 0),
                                                gstRate: Number(product.default_gst_rate ?? 18),
                                                isRateAutofilled: Number(product.default_rate || 0) > 0,
                                                savedRateDate: product.last_verified_date || 'Rate Memory',
                                              };
                                            }),
                                          };
                                        })
                                      );
                                    }}
                                  />
                                  {item.isRateAutofilled && (
                                    <RateMatchBadge
                                      date={item.savedRateDate}
                                      rate={item.unitRate}
                                    />
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  value={item.specification}
                                  placeholder="Spec"
                                  onChange={(e) =>
                                    handleItemFieldChange(
                                      section.id,
                                      item.id,
                                      'specification',
                                      e.target.value
                                    )
                                  }
                                  className="glass-input-pure-white w-full px-2 py-1.5 text-xs sm:text-[12pt] rounded-xl text-slate-800"
                                />
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  value={item.pack}
                                  placeholder="Pack"
                                  onChange={(e) =>
                                    handleItemFieldChange(section.id, item.id, 'pack', e.target.value)
                                  }
                                  className="glass-input-pure-white w-full px-2 py-1.5 text-xs sm:text-[12pt] rounded-xl text-slate-800 text-center"
                                />
                              </td>
                              <td className="p-2.5 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  aria-label="Quantity"
                                  value={item.quantity || ''}
                                  onChange={(e) =>
                                    handleItemFieldChange(
                                      section.id,
                                      item.id,
                                      'quantity',
                                      Number(e.target.value)
                                    )
                                  }
                                  className="glass-input-pure-white w-20 sm:w-24 px-2 py-1.5 text-xs sm:text-[12pt] text-right rounded-xl font-bold text-slate-900 font-mono"
                                />
                              </td>
                              <td className="p-2.5 text-center">
                                <input
                                  type="text"
                                  value={item.unit}
                                  onChange={(e) =>
                                    handleItemFieldChange(section.id, item.id, 'unit', e.target.value)
                                  }
                                  className="glass-input-pure-white w-20 sm:w-24 px-2 py-1.5 text-xs sm:text-[12pt] text-center rounded-xl text-slate-800 font-semibold"
                                />
                              </td>
                              <td className="p-2.5 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  aria-label="Unit rate"
                                  value={item.unitRate || ''}
                                  onChange={(e) =>
                                    handleItemFieldChange(
                                      section.id,
                                      item.id,
                                      'unitRate',
                                      Number(e.target.value)
                                    )
                                  }
                                  className="glass-input-pure-white w-24 sm:w-28 px-2 py-1.5 text-xs sm:text-[12pt] text-right rounded-xl font-bold text-blue-700 font-mono"
                                />
                              </td>
                              {/* GST Smooth Glassmorphism Drop */}
                              <td className="p-2.5 text-center">
                                <GlassSelect
                                  size="sm"
                                  value={item.gstRate}
                                  onChange={(val) =>
                                    handleItemFieldChange(
                                      section.id,
                                      item.id,
                                      'gstRate',
                                      Number(val)
                                    )
                                  }
                                  options={[
                                    { value: 0, label: '0%' },
                                    { value: 5, label: '5%' },
                                    { value: 18, label: '18%' },
                                  ]}
                                  ariaLabel="GST rate"
                                  className="w-20 sm:w-24 mx-auto"
                                  buttonClassName="py-1.5 px-2 text-center text-xs sm:text-[12pt] justify-center font-bold font-sans text-slate-900 glass-input-pure-white rounded-xl shadow-2xs"
                                  menuClassName="w-24 min-w-[90px] text-xs sm:text-[12pt]"
                                />
                              </td>
                              <td className="p-2.5 text-right text-xs sm:text-[12pt] text-slate-800 font-medium whitespace-nowrap">
                                ₹{taxable.toFixed(2)}
                              </td>
                              <td className="p-2.5 text-right text-xs sm:text-[12pt] font-bold text-slate-900 whitespace-nowrap">
                                ₹{total.toFixed(2)}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => duplicateItem(section.id, item)}
                                    title="Duplicate row"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeItem(section.id, item.id)}
                                    title="Delete row"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Section Footer: Add Row, AI Import & Clear All */}
                  <div className="bg-white px-5 py-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 rounded-b-2xl">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => addItemToSection(section.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Item</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openAiImportForSection(section.id, section.name)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50/70 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>AI Import Items</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => clearSectionItems(section.id)}
                        disabled={section.items.length === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Eraser className="w-3.5 h-3.5" />
                        <span>Clear All</span>
                      </button>
                    </div>
                    <span className="text-xs sm:text-sm text-slate-500 font-medium">
                      {section.items.length} {section.items.length === 1 ? 'item' : 'items'} in this section
                    </span>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addSection}
                className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/30 text-slate-600 hover:text-blue-700 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Quotation Section (e.g. Electrical / Industrial)</span>
              </button>
            </div>

            {/* Compulsory Standard Terms and Conditions Block (Fixed Constant Policy) */}
            <div className="glass-panel rounded-2xl p-5 border border-orange-200/80 bg-gradient-to-br from-white via-orange-50/20 to-amber-50/30 space-y-3">
              <div className="flex items-center justify-between border-b border-orange-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Standard Terms & Conditions
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                  Compulsory & Constant
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-[12pt]">
                <div className="p-3 rounded-xl bg-white/90 border border-slate-200/70 shadow-2xs">
                  <span className="text-xs font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">Payment</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">As agreed.</span>
                </div>
                <div className="p-3 rounded-xl bg-white/90 border border-slate-200/70 shadow-2xs">
                  <span className="text-xs font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">Delivery</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">Immediate.</span>
                </div>
                <div className="p-3 rounded-xl bg-white/90 border border-slate-200/70 shadow-2xs">
                  <span className="text-xs font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">Validity</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">15 days from quotation date.</span>
                </div>
                <div className="p-3 rounded-xl bg-white/90 border border-slate-200/70 shadow-2xs">
                  <span className="text-xs font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">Transportation</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">Extra, if applicable.</span>
                </div>
                <div className="sm:col-span-2 p-3 rounded-xl bg-white/90 border border-slate-200/70 shadow-2xs">
                  <span className="text-xs font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">GST</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">Extra as Applicable</span>
                </div>
              </div>
            </div>

            {/* Constant Authorized Signatory Block (Applied to every quotation automatically) */}
            <div className="glass-panel rounded-2xl p-5 border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/50 to-blue-50/20 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Authorized Signatory
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                  Constant & Automatic
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3.5 rounded-xl bg-white/90 border border-slate-200/70 shadow-2xs">
                <div className="space-y-1 text-xs sm:text-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Signatory Authority
                  </div>
                  <div className="font-bold text-slate-900 text-sm sm:text-base">
                    {supplierProfile.signatory_name || 'Mr. N JAYAKUMAR'}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-500 italic">
                    {supplierProfile.signatory_designation || 'Proprietor / Authorised Signatory'} • {supplierProfile.name || 'Jeevan Pranav Agencies (JPA)'}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                  <img
                    src="/signature.png"
                    alt="Authorized Signature"
                    className="h-11 w-auto object-contain"
                  />
                  <div className="border-t border-slate-300 w-24 my-0.5" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Official Signature
                  </span>
                </div>
              </div>
            </div>
            </div>

          {/* Right Live Preview (Smooth Slide-in / Expand Drawer) */}
          <div
            className={`hidden lg:flex flex-col min-w-0 shrink-0 border-slate-200/80 bg-slate-100/60 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              showPreview
                ? 'lg:w-2/5 border-l opacity-100'
                : 'lg:w-0 border-l-0 opacity-0 pointer-events-none'
            }`}
            style={{ willChange: 'width, opacity' }}
          >
            <div className="w-full min-w-[360px] sm:min-w-[420px] xl:min-w-[480px] p-6 h-full overflow-y-auto">
              <LiveQuotationPreview data={previewData} />
            </div>
          </div>
        </div>
      </div>

      {/* AI Document Import Modal */}
      <AiImportModal
        isOpen={isAiModalOpen}
        onClose={() => {
          setIsAiModalOpen(false);
          setAiImportTargetSecId(null);
          setAiImportTargetSecName(null);
        }}
        initialTargetSection={aiImportTargetSecName || undefined}
        availableSections={
          Array.from(
            new Set([
              ...sections.map((s) => s.name.split('|')[0].trim()).filter(Boolean),
              'Stationery',
              'Housekeeping',
              'Industrial',
              'Electrical',
            ])
          )
        }
        onAcceptItems={handleAcceptAiItems}
      />
    </div>
  );
}

export default function EditQuotationPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F8FAFF]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <EditQuotationContent {...props} />
    </Suspense>
  );
}
