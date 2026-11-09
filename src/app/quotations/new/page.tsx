'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';
import { LiveQuotationPreview } from '@/components/LiveQuotationPreview';
import { AiImportModal } from '@/components/AiImportModal';
import { DownloadDropdown } from '@/components/DownloadDropdown';
import { GlassSelect } from '@/components/GlassSelect';
import { CustomerSearchSelect } from '@/components/CustomerSearchSelect';
import { RateMatchBadge } from '@/components/RateMatchBadge';
import { ItemDescriptionAutocomplete } from '@/components/ItemDescriptionAutocomplete';
import {
  Save,
  CheckCircle2,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Eraser,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import { calculateQuotationSummary, formatINR } from '@/lib/calculations/financial';
import { capitalizeInput } from '@/lib/utils/formatters';
import { getActiveTabSession } from '@/lib/auth/client-context';

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

function NewQuotationContent() {
  const router = useRouter();

  // Helper to compute today and default +15 days validity in YYYY-MM-DD
  const getInitialDates = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const qDate = `${yyyy}-${mm}-${dd}`;

    const valDateObj = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const vYyyy = valDateObj.getFullYear();
    const vMm = String(valDateObj.getMonth() + 1).padStart(2, '0');
    const vDd = String(valDateObj.getDate()).padStart(2, '0');
    const vDate = `${vYyyy}-${vMm}-${vDd}`;

    return { qDate, vDate };
  };

  const initialDates = getInitialDates();

  // Quotation Metadata
  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteDate, setQuoteDate] = useState(initialDates.qDate);
  const [validityDate, setValidityDate] = useState(initialDates.vDate);
  const [referenceNo, setReferenceNo] = useState('');
  const [status, setStatus] = useState<'draft' | 'approved'>('draft');

  // Quotation Date defaults to current/present date, and Validity Date defaults to +15 days from Quotation Date
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

  // Customer & Supplier Details
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState('');

  const [supplierProfile, setSupplierProfile] = useState<any>({
    name: 'Jeevan Pranav Agencies (JPA)',
    tagline: 'Industrial & Housekeeping Supplies',
    address: '16-P, Sakthi Illam, Gandhi Nagar, Mettuthottam, Podanur, Coimbatore - 641023',
    gstin: '33BRGPM1867B1Z1',
    phone: '+91 9790600971',
    email: 'jeevanpranavagencies@gmail.com',
    website: 'www.jeevanpranavagencies.com',
  });

  // Quotation Sections with real reference items
  const [sections, setSections] = useState<QuoteSection[]>([
    {
      id: 'blank-section',
      name: '',
      items: [
        {
          id: 'itm_init',
          storeName: '',
          description: '',
          specification: '',
          pack: '',
          quantity: 0,
          unit: '',
          unitRate: 0,
          gstRate: 18,
        },
      ],
    },
  ]);

  // Terms and Conditions
  const [termsPayment, setTermsPayment] = useState('As agreed.');
  const [termsDelivery, setTermsDelivery] = useState('Immediate.');
  const [termsValidity, setTermsValidity] = useState('15 days from quotation date.');
  const [termsTransport, setTermsTransport] = useState('Extra, if applicable.');
  const [termsGst, setTermsGst] = useState('Extra as Applicable');

  // UI state
  const [showPreview, setShowPreview] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setShowPreview(false);
    }
  }, []);
  const [aiImportTargetSecId, setAiImportTargetSecId] = useState<string | null>(null);
  const [aiImportTargetSecName, setAiImportTargetSecName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  // Load Customers and Supplier details
  useEffect(() => {
    fetch('/api/customers')
      .then((r) => r.json())
      .then((data) => {
        const custList = data.customers || [];
        setCustomers(custList);
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const preselectedId = urlParams.get('customerId');
          if (preselectedId && custList.length > 0) {
            const matched = custList.find((c: any) => c.id === preselectedId);
            if (matched) {
              setSelectedCustomerId(matched.id);
              setCustomerName(matched.company_name);
              setCustomerAddress(matched.billing_address || matched.delivery_address || '');
              setCustomerGstin(matched.gstin || '');
              setStoreCode(matched.store_code || (matched.stores?.[0]?.store_code) || '');
              if (matched.stores && matched.stores.length > 0) {
                setStoreName(matched.stores[0].store_name);
              } else if (matched.trade_name) {
                setStoreName(matched.trade_name);
              }
            }
          }
        } catch {}

        // Check for pending AI import from dashboard
        try {
          const pendingRaw = sessionStorage.getItem('jpa_pending_ai_import');
          if (pendingRaw) {
            sessionStorage.removeItem('jpa_pending_ai_import');
            const pending = JSON.parse(pendingRaw);
            if (pending.items && pending.items.length > 0) {
              handleAcceptAiItems(pending.items, pending.targetSection, pending.metadata);

              // Auto-select customer if matched
              if (pending.metadata?.customerGuess && custList.length > 0) {
                const guessedUpper = pending.metadata.customerGuess.toUpperCase();
                const matchedCust = custList.find((c: any) =>
                  guessedUpper.includes(c.company_name.toUpperCase())
                );
                if (matchedCust) {
                  setSelectedCustomerId(matchedCust.id);
                  setCustomerName(matchedCust.company_name);
                  setCustomerAddress(matchedCust.billing_address || matchedCust.delivery_address || '');
                  setCustomerGstin(matchedCust.gstin || '');
                  setStoreCode(matchedCust.store_code || (matchedCust.stores?.[0]?.store_code) || '');
                  if (matchedCust.stores && matchedCust.stores.length > 0) {
                    setStoreName(matchedCust.stores[0].store_name);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('Error restoring pending AI import:', e);
        }
      })
      .catch((e) => console.error(e));

    const loadCompany = () => {
      fetch('/api/company', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (data.profile) setSupplierProfile(data.profile);
        })
        .catch((e) => console.error(e));
    };

    loadCompany();

    const handleCompanyUpdated = (e: any) => {
      if (e.detail) {
        setSupplierProfile(e.detail);
      } else {
        loadCompany();
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
  }, []);

  // Compute live deterministic totals
  const allFlattenedItems = sections.flatMap((sec) => sec.items);
  const summary = calculateQuotationSummary(allFlattenedItems, supplierProfile.gstin?.slice(0, 2) || '33', customerGstin.slice(0, 2) || supplierProfile.gstin?.slice(0, 2) || '33');

  // Customer selection change
  const handleCustomerSelect = (cust: any) => {
    if (!cust) {
      setSelectedCustomerId('');
      setCustomerName('');
      setCustomerAddress('');
      setCustomerGstin('');
      setStoreName('');
      setStoreCode('');
      return;
    }
    setSelectedCustomerId(cust.id);
    setCustomerName(cust.company_name);
    setCustomerAddress(cust.billing_address || cust.delivery_address || '');
    setCustomerGstin(cust.gstin || '');
    const sCode = cust.store_code || (cust.stores && cust.stores[0]?.store_code) || '';
    setStoreCode(sCode);
    if (cust.stores && cust.stores.length > 0 && cust.stores[0].store_name) {
      setStoreName(cust.stores[0].store_name);
    } else if (cust.trade_name) {
      setStoreName(cust.trade_name);
    } else {
      setStoreName('');
    }

    // Auto-refresh line items with existing company / group rates
    if (cust.id) {
      setTimeout(async () => {
        setSections((currentSections) => {
          const hasUnpriced = currentSections.some((sec) =>
            sec.items.some((itm) => itm.description && itm.description.trim().length >= 2 && (!itm.unitRate || itm.unitRate === 0))
          );
          if (!hasUnpriced) return currentSections;

          currentSections.forEach(async (sec) => {
            for (const itm of sec.items) {
              if (itm.description && itm.description.trim().length >= 2 && (!itm.unitRate || itm.unitRate === 0)) {
                try {
                  const mRes = await fetch('/api/products/match', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      description: itm.description,
                      customerId: cust.id,
                    }),
                  });
                  if (mRes.ok) {
                    const match = await mRes.json();
                    if (match.matched && match.rate) {
                      setSections((prev) =>
                        prev.map((s) =>
                          s.id === sec.id
                            ? {
                                ...s,
                                items: s.items.map((i) =>
                                  i.id === itm.id && (!i.unitRate || i.unitRate === 0)
                                    ? {
                                        ...i,
                                        unitRate: match.rate,
                                        unit: match.unit || i.unit,
                                        specification: i.specification || match.specification || '',
                                        pack: i.pack || match.pack || '',
                                        gstRate: match.gstRate ?? i.gstRate,
                                        isRateAutofilled: true,
                                        savedRateDate: match.savedRateDate,
                                      }
                                    : i
                                ),
                              }
                            : s
                        )
                      );
                    }
                  }
                } catch {}
              }
            }
          });

          return currentSections;
        });
      }, 50);
    }
  };

  const handleCustomerChange = (custId: string) => {
    const found = customers.find((c) => c.id === custId);
    handleCustomerSelect(found || null);
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

  // Clear All Items from a Section
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
    setSections(
      sections.map((s) => (s.id === secId ? { ...s, items: [] } : s))
    );
  };

  // Open AI Import modal targeted directly to a specific section
  const openAiImportForSection = (secId: string, secName: string) => {
    setAiImportTargetSecId(secId);
    const cleaned = (secName || '').split('|')[0].trim();
    setAiImportTargetSecName(cleaned || null);
    setIsAiModalOpen(true);
  };

  const openGlobalAiImport = () => {
    setAiImportTargetSecId(null);
    setAiImportTargetSecName(null);
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
        return {
          ...sec,
          items: [
            ...sec.items,
            {
              ...item,
              id: `itm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            },
          ],
        };
      })
    );
  };

  // CRITICAL: SILENT PRODUCT & RATE MEMORY AUTOFILL ON ITEM ENTRY
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

    // If user edited the description, silently search the Rate Memory!
    if (field === 'description' && typeof finalValue === 'string' && finalValue.trim().length >= 3) {
      try {
        const res = await fetch('/api/products/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: finalValue,
            customerId: selectedCustomerId,
          }),
        });

        if (res.ok) {
          const match = await res.json();
          if (match.matched && match.rate) {
            // Auto-populate silently without noisy popup!
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
      } catch (err) {
        // Silent match failure, do not disturb user
      }
    }
  };

  // Save Quotation Handler
  const handleSaveQuotation = async (desiredStatus: 'draft' | 'approved' = 'draft') => {
    if (isSaving) return false;

    // Granular Validation with Specific, Actionable User Feedback
    if (!selectedCustomerId || !customerName.trim()) {
      alert('Please select a customer for this quotation.');
      return false;
    }

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

    if (!sections.some((s) => s.items.length > 0)) {
      alert('Please add at least one line item to the quotation before saving.');
      return false;
    }

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx];
      for (let iIdx = 0; iIdx < sec.items.length; iIdx++) {
        const itm = sec.items[iIdx];
        const lineNum = iIdx + 1;
        const lineName = itm.description?.trim() ? `"${itm.description}"` : `Item #${lineNum}`;

        if (!itm.description || !itm.description.trim()) {
          alert(`Item #${lineNum} in Section "${sec.name || `Section ${sIdx + 1}`}" is missing a description.`);
          return false;
        }

        if (itm.quantity <= 0 || isNaN(itm.quantity)) {
          alert(
            `${lineName} in Section "${sec.name || `Section ${sIdx + 1}`}" must have a positive quantity (greater than 0). Currently set to ${itm.quantity}.`
          );
          return false;
        }

        if (itm.unitRate < 0 || isNaN(itm.unitRate)) {
          alert(`${lineName} in Section "${sec.name || `Section ${sIdx + 1}`}" cannot have a negative rate.`);
          return false;
        }
      }
    }
    setIsSaving(true);
    try {
      const activeTab = typeof window !== 'undefined' ? getActiveTabSession() : null;
      const creatorName = activeTab?.user?.name;
      const creatorId = activeTab?.user?.id || activeTab?.user?.userId;

      const payload = {
        companyProfileId: supplierProfile.id || 'cmp_jpa_master',
        customerId: selectedCustomerId,
        customerName,
        customerAddress,
        customerGstin,
        storeName,
        storeCode,
        quoteDate,
        validityDate,
        referenceNo,
        status: desiredStatus,
        termsPayment,
        termsDelivery,
        termsValidity,
        termsTransport,
        termsGst,
        sections,
        createdBy: creatorName,
        createdById: creatorId,
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (activeTab?.token) {
        headers['x-jpa-session-token'] = activeTab.token;
        headers['Authorization'] = `Bearer ${activeTab.token}`;
      }

      const res = await fetch(savedQuoteId ? `/api/quotations/${savedQuoteId}` : '/api/quotations', {
        method: savedQuoteId ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save quotation');
      }

      const data = await res.json();
      const id = savedQuoteId || data.quotationId;
      setSavedQuoteId(id);
      setQuoteNumber(data.quoteNumber || quoteNumber);
      setStatus(desiredStatus);
      alert(
        `Quotation ${data.quoteNumber} saved successfully! Verified rates have been stored in JPA central Rate Memory.`
      );
      return id;
    } catch (err: any) {
      alert(`Error saving quotation: ${err.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // AI Import Acceptance Callback
  const handleAcceptAiItems = async (aiItems: any[], targetSectionName?: string, metadata?: any) => {
    if (metadata) {
      if (metadata.referenceNumber) {
        if (!referenceNo || referenceNo.trim() === '') {
          setReferenceNo(metadata.referenceNumber);
        }
        if (!quoteNumber || quoteNumber.startsWith('JPA-')) {
          setQuoteNumber(metadata.referenceNumber);
        }
      }
      if (metadata.storeGuess) {
        setStoreName(metadata.storeGuess);
      }
      if (metadata.documentDate) {
        setQuoteDate(metadata.documentDate);
      }
      if (metadata.customerGuess && !selectedCustomerId) {
        const guessNorm = metadata.customerGuess.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedCust = customers.find((c: any) => {
          const cNorm = c.company_name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cNorm.includes(guessNorm) || guessNorm.includes(cNorm);
        });
        if (matchedCust) {
          handleCustomerChange(matchedCust.id);
        } else if (!customerName || customerName.trim() === '') {
          setCustomerName(metadata.customerGuess);
        }
      }
    }

    const preparedItems: { item: QuoteItem; sectionName: string }[] = [];

    for (const aiItm of aiItems) {
      if (!aiItm.description || !aiItm.description.trim() || aiItm.matchType === 'unreadable' || aiItm.rowStatus === 'unreadable') {
        continue;
      }

      let unitRate = aiItm.rate || 0;
      let isAutofilled = Boolean(aiItm.rateSource === 'catalog' || aiItm.catalogRate);
      let savedDate = aiItm.rateSource === 'catalog' ? 'Rate Library' : undefined;

      // Silently match Rate Memory if rate was null in the uploaded document or to enrich specs
      if (!unitRate || unitRate <= 0) {
        try {
          const matchRes = await fetch('/api/products/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: aiItm.description,
              specification: aiItm.specification,
              pack: aiItm.pack,
              unit: aiItm.unit,
              customerId: selectedCustomerId,
            }),
          });
          if (matchRes.ok) {
            const match = await matchRes.json();
            if (match.matched) {
              if (match.rate && (!unitRate || unitRate <= 0)) {
                unitRate = match.rate;
                isAutofilled = true;
                savedDate = match.savedRateDate || match.badgeText || 'Rate Library';
              }
              if (!aiItm.specification && match.specification) aiItm.specification = match.specification;
              if (!aiItm.pack && match.pack) aiItm.pack = match.pack;
              if (!aiItm.unit && match.unit) aiItm.unit = match.unit;
              if (match.gstRate != null && Number(match.gstRate) > 0) aiItm.gstRate = match.gstRate;
            }
          }
        } catch (e) {}
      }

      const finalGst =
        aiItm.gstRate != null && !isNaN(aiItm.gstRate) && Number(aiItm.gstRate) > 0
          ? Number(aiItm.gstRate)
          : 18;

      preparedItems.push({
        item: {
          id: `itm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          storeName: storeName || (metadata?.storeGuess || ''),
          description: aiItm.description.trim(),
          specification: aiItm.specification || '',
          pack: aiItm.pack || '',
          quantity: aiItm.quantity ?? 0,
          unit: aiItm.unit || '',
          unitRate,
          gstRate: finalGst,
          isRateAutofilled: isAutofilled,
          savedRateDate: savedDate,
        },
        sectionName: (
          aiItm.sectionName ||
          (targetSectionName && targetSectionName !== 'Multi-Sheet Auto-Route' ? targetSectionName : '') ||
          metadata?.sectionGuess ||
          'General'
        ).split('|')[0].trim(),
      });
    }

    // Helper to format section banner title
    const formatSectionBanner = (name: string) => {
      const clean = (name || 'Items').split('|')[0].trim().toUpperCase();
      return `${clean}  |  ITEMS & PRICING`;
    };

    // Group items by their section/sheet name
    const sectionGroups = new Map<string, QuoteItem[]>();
    for (const prep of preparedItems) {
      const secKey = prep.sectionName || 'General';
      if (!sectionGroups.has(secKey)) {
        sectionGroups.set(secKey, []);
      }
      sectionGroups.get(secKey)!.push(prep.item);
    }

    const hasMultipleSheets = sectionGroups.size > 1 || Boolean(metadata?.hasMultipleSections);

    // Check if initial single blank section exists (standard new quotation empty state)
    const isSingleInitial =
      sections.length === 1 &&
      (!sections[0].name.trim() || sections[0].name.toLowerCase().includes('current section')) &&
      (sections[0].items.length === 0 ||
        (sections[0].items.length === 1 && !sections[0].items[0].description.trim() && sections[0].items[0].quantity === 0));

    // MULTI-SHEET ROUTING: Quote each sheet in its own separate section!
    if (hasMultipleSheets) {
      if (isSingleInitial) {
        const newSecList: QuoteSection[] = [];
        let idx = 0;
        for (const [secName, grpItems] of sectionGroups.entries()) {
          newSecList.push({
            id: idx === 0 && sections[0].id ? sections[0].id : `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: formatSectionBanner(secName),
            items: grpItems,
          });
          idx++;
        }
        setSections(newSecList);
        setAiImportTargetSecId(null);
        setAiImportTargetSecName(null);
        return;
      }

      // Existing sections already present: merge or append new sections per sheet
      setSections((prev) => {
        const updated = [...prev];
        for (const [secName, grpItems] of sectionGroups.entries()) {
          const targetBase = secName.toLowerCase();
          const matchIdx = updated.findIndex((s) => {
            const sBase = s.name.split('|')[0].trim().toLowerCase();
            return (
              sBase === targetBase ||
              s.name.toLowerCase().includes(targetBase) ||
              (sBase.length > 3 && targetBase.includes(sBase))
            );
          });

          if (matchIdx >= 0) {
            updated[matchIdx] = {
              ...updated[matchIdx],
              items:
                updated[matchIdx].items.length === 0 ||
                (updated[matchIdx].items.length === 1 && !updated[matchIdx].items[0].description.trim())
                  ? grpItems
                  : [...updated[matchIdx].items, ...grpItems],
            };
          } else {
            updated.push({
              id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: formatSectionBanner(secName),
              items: grpItems,
            });
          }
        }
        return updated;
      });
      setAiImportTargetSecId(null);
      setAiImportTargetSecName(null);
      return;
    }

    const newItems = preparedItems.map((p) => p.item);

    let target = (targetSectionName || '').split('|')[0].trim();
    if (!target || target.toLowerCase() === 'current section' || target.toLowerCase() === 'imported section') {
      target = metadata?.sectionGuess || 'Stationery';
    }

    const targetFormatted = formatSectionBanner(target);
    const targetBase = target.toLowerCase();

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

    // Check if an existing section matches targetBase
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
      // If clicked section is unnamed, give it the target name and insert items
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

      // If clicked section name matches target, insert into clicked section
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

      // Clicked section does not match target:
      // If an existing section matches target, place items in that existing matching section!
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

      // Otherwise, create a new section for this target
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

    // No specific section clicked (global/header/dashboard import):
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

  // Preview Data object
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

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F8FAFF]">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Action Bar */}
        <header className="sticky top-0 z-20 flex flex-wrap gap-2 sm:gap-3 items-center justify-between min-h-15 sm:min-h-18 py-2.5 sm:py-3 px-3 sm:px-6 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('jpa:toggle-sidebar'));
              }}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-slate-200 transition-all duration-150 active:scale-90 cursor-pointer shrink-0 shadow-2xs"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2 truncate">
                <span className="truncate">Create Rate Card</span>
                {quoteNumber && (
                  <span className="font-mono text-[11px] sm:text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold shrink-0">
                    {quoteNumber}
                  </span>
                )}
              </h1>
            </div>
          </div>

          {/* Top-Right Mandatory Action Bar: Save Draft · Preview · ⬇ Download ▾ */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 ml-auto">
            <button
              type="button"
              onClick={() => handleSaveQuotation('draft')}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 shadow-2xs transition-all cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span className="sm:hidden">Draft</span>
              <span className="hidden sm:inline">Save Draft</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 cursor-pointer ${
                showPreview
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs hover:bg-blue-100/70'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs hover:border-slate-300'
              }`}
            >
              <span className="transition-transform duration-250">
                {showPreview ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </span>
              <span className="sm:hidden">Preview</span>
              <span className="hidden sm:inline">{showPreview ? 'Hide Preview' : 'Show Preview'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveQuotation('approved')}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="sm:hidden">Final</span>
              <span className="hidden sm:inline">Save as Final</span>
            </button>

            {/* Top-Right Download Dropdown */}
            <DownloadDropdown
              quotationId={savedQuoteId || ''}
              quoteNumber={quoteNumber}
              onBeforeDownload={() => handleSaveQuotation(status)}
            />
          </div>
        </header>

        {/* Workspace Split Layout: Left Editor (60%) + Right Live A4 Preview (40%) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Left Main Quotation Form */}
          <div
            className={`flex-1 min-w-0 overflow-y-auto smooth-scroll-pane p-3 sm:p-6 space-y-5 sm:space-y-6 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              showPreview ? 'lg:w-3/5' : 'w-full'
            }`}
          >
            {/* Customer & Store Selection Block */}
            <div className="glass-panel rounded-2xl p-5 border border-white/80 space-y-4">
              <div className="flex flex-wrap gap-2 items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Customer & Store Information</span>
                </div>
                <button
                  type="button"
                  onClick={openGlobalAiImport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Import Customer List</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Select Customer
                    </label>
                    <CustomerSearchSelect
                      customers={customers}
                      selectedCustomerId={selectedCustomerId}
                      onSelectCustomer={handleCustomerSelect}
                      onCustomerCreated={(newCust) => {
                        setCustomers((prev) => [newCust, ...prev]);
                      }}
                      placeholder="Search firm, company, store code or GSTIN..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Store / Branch Location
                      </label>
                      <input
                        type="text"
                        value={storeName}
                        onChange={(e) => setStoreName(capitalizeInput(e.target.value))}
                        placeholder="e.g. Prozone Mall / Homecentre"
                        className="w-full px-3 py-2 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Store Code <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={storeCode}
                        onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                        placeholder="e.g. 1903 / PZ-01"
                        className="w-full px-3 py-2 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white text-blue-700 font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all uppercase"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Customer Address
                    </label>
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(capitalizeInput(e.target.value))}
                      placeholder="Full billing address..."
                      className="w-full px-3 py-2 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Customer GSTIN
                      </label>
                      <input
                        type="text"
                        value={customerGstin}
                        onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                        placeholder="33AAACL1234F1Z9"
                        className="w-full px-3 py-2 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white text-slate-800 font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">
                        RC Number / Ref No.
                      </label>
                      <input
                        type="text"
                        value={referenceNo}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReferenceNo(val);
                          setQuoteNumber(val);
                        }}
                        placeholder="e.g. JPA-79"
                        className="w-full px-3 py-2 text-xs sm:text-[12pt] rounded-xl border border-slate-300 bg-white text-slate-800 font-bold font-mono text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quotation Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
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

                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">
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

            {/* Sections & Line Items Editor */}
            <div className="space-y-6">
              {sections.map((section, sIdx) => (
                <div
                  key={section.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs transition-all relative"
                >
                  {/* Section Title Bar */}
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

                  {/* Items Table */}
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

                              {/* Description with silent Rate Memory match */}
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

                              {/* Spec */}
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

                              {/* Pack */}
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

                              {/* Qty */}
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

                              {/* Unit */}
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

                              {/* Rate */}
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

                              {/* Live Calculated Taxable */}
                              <td className="p-2.5 text-right text-xs sm:text-[12pt] text-slate-800 font-medium whitespace-nowrap">
                                ₹{taxable.toFixed(2)}
                              </td>

                              {/* Live Line Total (Auto-calculated Taxable + GST) */}
                              <td className="p-2.5 text-right text-xs sm:text-[12pt] font-bold text-slate-900 whitespace-nowrap">
                                ₹{total.toFixed(2)}
                              </td>

                              {/* Actions */}
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

            {/* Constant Authorized Signatory Block (Applied to every new quotation automatically) */}
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

          {/* Right Live A4 Quotation Preview — Desktop Split Slider + Mobile Slide-Over Sheet */}
          <div
            className={`hidden lg:flex min-w-0 shrink-0 border-slate-200/80 bg-slate-100/60 overflow-hidden flex-col transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              showPreview
                ? 'lg:w-2/5 border-l opacity-100'
                : 'lg:w-0 border-l-0 opacity-0 pointer-events-none'
            }`}
            style={{ willChange: 'width, opacity' }}
          >
            <div className="w-full min-w-[380px] xl:min-w-[460px] p-4 sm:p-6 h-full overflow-y-auto smooth-scroll-pane">
              <LiveQuotationPreview data={previewData} />
            </div>
          </div>

          {/* Mobile & Tablet Smooth Slide-Over Preview Drawer (< lg) */}
          <div
            className={`fixed inset-0 z-40 lg:hidden flex justify-end transition-[visibility] duration-300 ${
              showPreview ? 'visible pointer-events-auto' : 'invisible pointer-events-none delay-300'
            }`}
          >
            <div
              className={`fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                showPreview ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={() => setShowPreview(false)}
              aria-hidden="true"
            />
            <div
              style={{
                transform: showPreview ? 'translate3d(0, 0, 0)' : 'translate3d(102%, 0, 0)',
                transition: 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
                willChange: 'transform',
              }}
              className="relative z-10 w-full sm:w-[90vw] sm:max-w-xl h-dvh bg-slate-100/95 backdrop-blur-2xl border-l border-white/80 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-white/90 border-b border-slate-200/80">
                <span className="text-sm font-extrabold text-slate-900">Live A4 Rate Card Preview</span>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="w-8.5 h-8.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                  aria-label="Close Live Preview"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-auto p-3 sm:p-5">
                <LiveQuotationPreview data={previewData} />
              </div>
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

export default function NewQuotationPage() {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const reset = () => setGeneration(n => n + 1);
    window.addEventListener('jpa:new-quotation', reset);
    return () => window.removeEventListener('jpa:new-quotation', reset);
  }, []);
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F8FAFF]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <NewQuotationContent key={generation} />
    </Suspense>
  );
}
