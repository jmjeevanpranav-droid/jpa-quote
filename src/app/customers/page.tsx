'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';
import {
  Users2,
  Plus,
  MapPin,
  Phone,
  Building,
  FilePlus2,
  X,
  Loader2,
  Trash2,
  CheckCircle2,
  Search,
  LayoutGrid,
  Table as TableIcon,
  Folder,
  FolderPlus,
  Store,
  ChevronRight,
  ArrowLeft,
  Building2,
  FileText,
  Eye,
  Pencil,
  Download,
  Camera,
  Upload,
  ImageIcon,
} from 'lucide-react';
import { normalizeCompanyName, capitalizeInput } from '@/lib/utils/formatters';
import { formatINR } from '@/lib/calculations/financial';

interface CustomerRecord {
  id: string;
  company_name: string;
  trade_name?: string | null;
  store_code?: string | null;
  folder_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  billing_address: string;
  delivery_address?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  state_code?: string | null;
  stores?: Array<{
    id: string;
    store_name: string;
    store_code?: string | null;
    address?: string | null;
    contact_person?: string | null;
    phone?: string | null;
  }>;
  quotes?: Array<{
    id: string;
    quote_number: string;
    quote_date: string;
    validity_date?: string | null;
    grand_total: number;
    status: string;
    reference_no?: string | null;
    store_name?: string | null;
    store_code?: string | null;
  }>;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [registeredFolders, setRegisteredFolders] = useState<Array<{ id: string; name: string; gstin?: string; billing_address?: string; logo_url?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'folders' | 'table' | 'cards'>('folders');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Row save status trackers for microsecond UX feedback (no emojis)
  const [rowStatus, setRowStatus] = useState<Record<string, { state: 'saved' | 'saving' | 'error'; ms?: string }>>({});

  // Toast notification state in White Glassmorphism (strictly no emojis)
  const [toastNotification, setToastNotification] = useState<{
    title: string;
    details: string;
  } | null>(null);

  useEffect(() => {
    if (toastNotification) {
      const t = setTimeout(() => setToastNotification(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastNotification]);

  // New customer modal form state
  const [companyName, setCompanyName] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [customerFolder, setCustomerFolder] = useState('');
  const [gstin, setGstin] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);

  // New Folder modal form state
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderInitialStore, setNewFolderInitialStore] = useState('');
  const [newFolderStoreCode, setNewFolderStoreCode] = useState('');
  const [newFolderGstin, setNewFolderGstin] = useState('');
  const [newFolderAddress, setNewFolderAddress] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Quick inline add row state
  const [quickRow, setQuickRow] = useState({
    company_name: '',
    store_code: '',
    trade_name: '',
    gstin: '',
    billing_address: '',
    contact_person: '',
    phone: '',
  });
  const [quickAdding, setQuickAdding] = useState(false);

  // Unit Quotations Drawer / Modal State (Secure & De-duplicated)
  const [selectedUnitForQuotes, setSelectedUnitForQuotes] = useState<CustomerRecord | null>(null);
  const [unitQuotes, setUnitQuotes] = useState<any[]>([]);
  const [unitQuotesSearch, setUnitQuotesSearch] = useState('');
  const [loadingUnitQuotes, setLoadingUnitQuotes] = useState(false);
  const [isUnitQuotesModalOpen, setIsUnitQuotesModalOpen] = useState(false);

  const openUnitQuotations = async (unit: CustomerRecord) => {
    setSelectedUnitForQuotes(unit);
    setIsUnitQuotesModalOpen(true);
    setLoadingUnitQuotes(true);
    setUnitQuotesSearch('');
    try {
      const res = await fetch(`/api/quotations?customerId=${encodeURIComponent(unit.id)}`);
      if (res.ok) {
        const data = await res.json();
        // Strict client-side de-duplication to ensure zero duplicate records
        const unique = Array.from(
          new Map((data.quotations || []).map((q: any) => [q.id, q])).values()
        );
        setUnitQuotes(unique);
      } else {
        setUnitQuotes([]);
      }
    } catch (err) {
      console.error('Failed to fetch unit quotations:', err);
      setUnitQuotes([]);
    } finally {
      setLoadingUnitQuotes(false);
    }
  };

  // Folder DP / Logo Customization State (Supports webp, png, jpeg, jpg, avif, etc.)
  const [newFolderLogoUrl, setNewFolderLogoUrl] = useState('');
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [logoTargetFolder, setLogoTargetFolder] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [savingLogo, setSavingLogo] = useState(false);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>, isNewFolder = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        if (isNewFolder) {
          setNewFolderLogoUrl(result);
        } else {
          setLogoPreview(result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = async () => {
    if (!logoTargetFolder) return;
    setSavingLogo(true);
    try {
      const res = await fetch('/api/customers/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: logoTargetFolder,
          logoUrl: logoPreview || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update folder DP');
      }

      setToastNotification({
        title: 'Saved Successfully',
        details: `Updated DP for "${logoTargetFolder}"`,
      });
      setIsLogoModalOpen(false);
      setLogoTargetFolder(null);
      setLogoPreview('');
      fetchFolders();
    } catch (err: any) {
      alert(`Error updating logo: ${err.message}`);
    } finally {
      setSavingLogo(false);
    }
  };

  // Debounce timers & dirty-row tracking so scrolling/blurring unchanged inputs never fires network saves
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const dirtyRowsRef = useRef<Set<string>>(new Set());

  const fetchCustomers = () => {
    setLoading(true);
    fetch('/api/customers')
      .then((r) => r.json())
      .then((data) => setCustomers(data.customers || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  const fetchFolders = () => {
    fetch('/api/customers/folders')
      .then((r) => r.json())
      .then((data) => setRegisteredFolders(data.folders || []))
      .catch((e) => console.error(e));
  };

  useEffect(() => {
    fetchCustomers();
    fetchFolders();
  }, []);

  /**
   * Microsecond Background Save
   * Dispatches PUT /api/customers without blocking UI
   */
  const executeSave = useCallback(async (id: string, customerData: Partial<CustomerRecord>) => {
    const t0 = performance.now();
    setRowStatus((prev) => ({ ...prev, [id]: { state: 'saving' } }));

    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          companyName: customerData.company_name,
          tradeName: customerData.trade_name,
          storeCode: customerData.store_code,
          folderName: customerData.folder_name,
          gstin: customerData.gstin,
          billingAddress: customerData.billing_address,
          contactPerson: customerData.contact_person,
          phone: customerData.phone,
          email: customerData.email,
        }),
      });

      const elapsed = Math.max(0.1, performance.now() - t0).toFixed(1);

      if (!res.ok) {
        throw new Error('Save failed');
      }

      setRowStatus((prev) => ({ ...prev, [id]: { state: 'saved', ms: `${elapsed}ms` } }));
      setToastNotification({
        title: 'Saved Successfully',
        details: `${customerData.trade_name || customerData.company_name || 'Customer'} updated`,
      });

      // Clear the green saved badge after 2.5s
      setTimeout(() => {
        setRowStatus((prev) => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });
      }, 2500);
    } catch (err) {
      setRowStatus((prev) => ({ ...prev, [id]: { state: 'error' } }));
    }
  }, []);

  /**
   * Optimistic instant update (0ms latency)
   */
  const handleInlineChange = (id: string, field: keyof CustomerRecord, value: string) => {
    dirtyRowsRef.current.add(id);
    let updatedCustomer: CustomerRecord | undefined;
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          updatedCustomer = { ...c, [field]: value };
          return updatedCustomer;
        }
        return c;
      })
    );

    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id]);
    }

    if (updatedCustomer) {
      const payload = updatedCustomer;
      debounceTimers.current[id] = setTimeout(() => {
        dirtyRowsRef.current.delete(id);
        executeSave(id, payload);
      }, 350);
    }
  };

  /**
   * Immediate save on Blur event (only when modified)
   */
  const handleBlur = (id: string) => {
    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id]);
      delete debounceTimers.current[id];
    }
    if (!dirtyRowsRef.current.has(id)) {
      return;
    }
    dirtyRowsRef.current.delete(id);
    const target = customers.find((c) => c.id === id);
    if (target) {
      executeSave(id, target);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    const prev = customers;
    setCustomers((p) => p.filter((c) => c.id !== id));
    setToastNotification({
      title: 'Saved Successfully',
      details: `Deleted "${name}"`,
    });
    try {
      const res = await fetch(`/api/customers?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setCustomers(prev);
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete customer');
      }
    } catch (err: any) {
      setCustomers(prev);
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to DELETE ALL registered customers? This cannot be undone.')) return;
    const prev = customers;
    setCustomers([]);
    setToastNotification({
      title: 'Saved Successfully',
      details: 'All customer accounts cleared',
    });
    try {
      const res = await fetch('/api/customers?all=true', {
        method: 'DELETE',
      });
      if (!res.ok) {
        setCustomers(prev);
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete all customers');
      }
    } catch (err: any) {
      setCustomers(prev);
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const targetFolder = customerFolder || normalizeCompanyName(companyName);
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          tradeName,
          storeCode: storeCode || null,
          folderName: targetFolder || null,
          gstin,
          billingAddress,
          contactPerson,
          phone,
          email,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add customer');
      }

      setIsModalOpen(false);
      setToastNotification({
        title: 'Saved Successfully',
        details: `${tradeName ? `${companyName} (${tradeName})` : companyName} created`,
      });

      setCompanyName('');
      setStoreCode('');
      setTradeName('');
      setCustomerFolder('');
      setGstin('');
      setBillingAddress('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      fetchCustomers();
      fetchFolders();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    try {
      const folderNameClean = newFolderName.trim();

      // 1. Create company folder
      const res = await fetch('/api/customers/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderNameClean,
          gstin: newFolderGstin.trim() || null,
          billingAddress: newFolderAddress.trim() || null,
          logoUrl: newFolderLogoUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create folder');
      }

      // 2. If initial store provided, add it under this folder
      if (newFolderInitialStore.trim() || newFolderAddress.trim()) {
        await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: folderNameClean,
            tradeName: newFolderInitialStore.trim() || 'Head Office',
            storeCode: newFolderStoreCode.trim() || null,
            folderName: folderNameClean,
            gstin: newFolderGstin.trim() || null,
            billingAddress: newFolderAddress.trim() || 'Head Office Address',
          }),
        });
      }

      setIsFolderModalOpen(false);
      setToastNotification({
        title: 'Saved Successfully',
        details: `Company Folder "${folderNameClean}" created`,
      });

      setNewFolderName('');
      setNewFolderInitialStore('');
      setNewFolderStoreCode('');
      setNewFolderGstin('');
      setNewFolderAddress('');
      setNewFolderLogoUrl('');

      fetchCustomers();
      fetchFolders();
    } catch (err: any) {
      alert(`Error creating folder: ${err.message}`);
    } finally {
      setCreatingFolder(false);
    }
  };

  const openAddUnitForFolder = (folderName: string) => {
    setCompanyName(folderName);
    setCustomerFolder(folderName);
    setTradeName('');
    setStoreCode('');
    setGstin('');
    setBillingAddress('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setIsModalOpen(true);
  };

  /**
   * Fast inline row addition
   */
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRow.company_name.trim() || !quickRow.billing_address.trim()) {
      alert('Please provide Company Name and Billing Address to create customer.');
      return;
    }

    setQuickAdding(true);

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: quickRow.company_name.trim(),
          tradeName: quickRow.trade_name.trim() || null,
          storeCode: quickRow.store_code.trim() || null,
          folderName: selectedFolder || normalizeCompanyName(quickRow.company_name.trim()),
          gstin: quickRow.gstin.trim() || null,
          billingAddress: quickRow.billing_address.trim(),
          contactPerson: quickRow.contact_person.trim() || null,
          phone: quickRow.phone.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add customer');
      }

      setToastNotification({
        title: 'Saved Successfully',
        details: `${quickRow.trade_name ? `${quickRow.company_name} (${quickRow.trade_name})` : quickRow.company_name} added`,
      });

      setQuickRow({
        company_name: '',
        store_code: '',
        trade_name: '',
        gstin: '',
        billing_address: '',
        contact_person: '',
        phone: '',
      });

      fetchCustomers();
      fetchFolders();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setQuickAdding(false);
    }
  };

  // Grouping into Apple macOS/iOS Glassmorphism Company Folders
  const companyFolderGroups = useMemo(() => {
    const map = new Map<string, { name: string; gstin?: string | null; logo_url?: string | null; units: CustomerRecord[] }>();

    // Seed registered folders
    for (const f of registeredFolders) {
      const key = f.name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name: f.name, gstin: f.gstin || null, logo_url: f.logo_url || null, units: [] });
      } else {
        const item = map.get(key)!;
        if (f.logo_url) item.logo_url = f.logo_url;
      }
    }

    // Group customer accounts by company folder (only for registered folders or explicit folder_name)
    for (const c of customers) {
      const explicitFolder = c.folder_name ? c.folder_name.trim() : '';
      const folderName = explicitFolder || normalizeCompanyName(c.company_name || 'General Accounts');
      const key = folderName.toLowerCase();

      if (!map.has(key)) {
        if (!explicitFolder) {
          continue;
        }
        map.set(key, {
          name: explicitFolder,
          gstin: c.gstin || null,
          logo_url: null,
          units: [],
        });
      }

      const group = map.get(key)!;
      if (!group.gstin && c.gstin) {
        group.gstin = c.gstin;
      }
      group.units.push(c);
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, registeredFolders]);

  // Omni-search matcher: matches customer details, store locations, and all quotation content (quote #, date, grand total, status, ref)
  const matchesCustomerSearch = useCallback((c: CustomerRecord, query: string) => {
    if (!query || !query.trim()) return true;
    const q = query.trim().toLowerCase();
    const numQ = q.replace(/[^0-9.]/g, '');

    // 1. Direct Customer Details
    if (
      (c.company_name || '').toLowerCase().includes(q) ||
      (c.trade_name || '').toLowerCase().includes(q) ||
      (c.store_code || '').toLowerCase().includes(q) ||
      (c.folder_name || '').toLowerCase().includes(q) ||
      (c.gstin || '').toLowerCase().includes(q) ||
      (c.billing_address || '').toLowerCase().includes(q) ||
      (c.contact_person || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    ) {
      return true;
    }

    // 2. Multi-Store Branches
    if (
      c.stores?.some(
        (s) =>
          (s.store_name || '').toLowerCase().includes(q) ||
          (s.store_code || '').toLowerCase().includes(q) ||
          (s.address || '').toLowerCase().includes(q) ||
          (s.contact_person || '').toLowerCase().includes(q) ||
          (s.phone || '').toLowerCase().includes(q)
      )
    ) {
      return true;
    }

    // 3. Complete Quotation Details: Quote Number, Quoted Date, Validity Date, Reference No, Status, Quoted Amount (Grand Total)
    if (
      c.quotes?.some((qt) => {
        const qNum = (qt.quote_number || '').toLowerCase();
        const qDate = (qt.quote_date || '').toLowerCase();
        const vDate = (qt.validity_date || '').toLowerCase();
        const refNo = (qt.reference_no || '').toLowerCase();
        const status = (qt.status || '').toLowerCase();
        const storeName = (qt.store_name || '').toLowerCase();
        const storeCode = (qt.store_code || '').toLowerCase();

        const grandTotalStr = qt.grand_total !== undefined && qt.grand_total !== null ? String(qt.grand_total) : '';
        const formattedTotal = qt.grand_total ? formatINR(qt.grand_total).toLowerCase() : '';
        const roundedTotal = qt.grand_total ? String(Math.round(qt.grand_total)) : '';

        return (
          qNum.includes(q) ||
          qDate.includes(q) ||
          vDate.includes(q) ||
          refNo.includes(q) ||
          status.includes(q) ||
          storeName.includes(q) ||
          storeCode.includes(q) ||
          grandTotalStr.includes(q) ||
          formattedTotal.includes(q) ||
          (numQ && (grandTotalStr.includes(numQ) || roundedTotal.includes(numQ)))
        );
      })
    ) {
      return true;
    }

    return false;
  }, []);

  // Filter customers by search term
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => matchesCustomerSearch(c, searchQuery));
  }, [customers, searchQuery, matchesCustomerSearch]);

  // Filtered folders by search term
  const filteredFolders = useMemo(() => {
    return companyFolderGroups.filter((f) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        f.name.toLowerCase().includes(q) ||
        (f.gstin && f.gstin.toLowerCase().includes(q)) ||
        f.units.some((u) => matchesCustomerSearch(u, searchQuery))
      );
    });
  }, [companyFolderGroups, searchQuery, matchesCustomerSearch]);

  // Units belonging to the actively opened folder
  const activeFolderUnits = useMemo(() => {
    if (!selectedFolder) return [];
    const group = companyFolderGroups.find(
      (f) => f.name.toLowerCase() === selectedFolder.toLowerCase()
    );
    if (!group) return [];
    return group.units.filter((u) => matchesCustomerSearch(u, searchQuery));
  }, [companyFolderGroups, selectedFolder, searchQuery, matchesCustomerSearch]);

  // Quotations filtered by unit modal search
  const filteredUnitQuotes = useMemo(() => {
    if (!unitQuotesSearch.trim()) return unitQuotes;
    const clean = unitQuotesSearch.trim().toLowerCase();
    const numQ = clean.replace(/[^0-9.]/g, '');

    return unitQuotes.filter((q) => {
      const qNum = (q.quote_number || '').toLowerCase();
      const qDate = (q.quote_date || '').toLowerCase();
      const vDate = (q.validity_date || '').toLowerCase();
      const refNo = (q.reference_no || '').toLowerCase();
      const status = (q.status || '').toLowerCase();
      const storeName = (q.store_name || '').toLowerCase();
      const storeCode = (q.store_code || '').toLowerCase();

      const grandTotalStr = q.grand_total !== undefined && q.grand_total !== null ? String(q.grand_total) : '';
      const formattedTotal = q.grand_total ? formatINR(q.grand_total).toLowerCase() : '';
      const roundedTotal = q.grand_total ? String(Math.round(q.grand_total)) : '';

      return (
        qNum.includes(clean) ||
        qDate.includes(clean) ||
        vDate.includes(clean) ||
        refNo.includes(clean) ||
        status.includes(clean) ||
        storeName.includes(clean) ||
        storeCode.includes(clean) ||
        grandTotalStr.includes(clean) ||
        formattedTotal.includes(clean) ||
        (numQ && (grandTotalStr.includes(numQ) || roundedTotal.includes(numQ)))
      );
    });
  }, [unitQuotes, unitQuotesSearch]);

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F8FAFF]">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto smooth-scroll-pane">
        <AppHeader title="Customers & Store Locations" />

        <main className="p-4 sm:p-6 md:p-8 max-w-[1500px] mx-auto w-full space-y-6">
          {/* Top Title & Action Bar - Comfortable & Responsive Apple Glassmorphic Box */}
          <div className="bg-white/95 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-7 border border-slate-200/85 shadow-xs space-y-4 sm:space-y-5">
            {/* Top Row: Title & Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl md:text-[26px] font-black text-slate-900 tracking-tight">
                  Registered Client Accounts
                </h2>
              </div>

              <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white text-blue-700 border border-blue-200/90 shadow-2xs hover:bg-blue-50/70 hover:border-blue-300 transition-all cursor-pointer backdrop-blur-md min-h-[42px] active:scale-95"
                  title="Create a New Company Folder"
                >
                  <FolderPlus className="w-4 h-4 text-blue-600" />
                  <span>New Folder</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCompanyName('');
                    setTradeName('');
                    setStoreCode('');
                    setCustomerFolder('');
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4.5 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer min-h-[42px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Customer</span>
                </button>

                {customers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAll}
                    className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs sm:text-sm transition-all cursor-pointer min-h-[42px] active:scale-95"
                    title="Clear all registered accounts"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete All</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Row: Search & View Mode Switcher */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 sm:pt-3 border-t border-slate-100 font-['Calibri'] text-[11pt]">
              {/* Search input - comfortable & responsive pure white glass */}
              <div className="relative flex-1 max-w-full md:max-w-md flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full !pl-10 pr-9 py-2.5 glass-input-white rounded-2xl text-[11pt] font-['Calibri'] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                  style={{ paddingLeft: '2.5rem' }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer z-10"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* View mode toggle - GPU spring-animated segmented control */}
              <div className="relative grid grid-cols-3 items-center p-1 bg-slate-200/65 rounded-2xl border border-slate-200/85 shadow-inner self-stretch md:self-auto min-w-0 sm:min-w-[430px] font-['Calibri'] text-[11pt]">
                <div
                  aria-hidden="true"
                  style={{
                    transform:
                      viewMode === 'folders'
                        ? 'translate3d(0%, 0, 0)'
                        : viewMode === 'table'
                        ? 'translate3d(100%, 0, 0)'
                        : 'translate3d(200%, 0, 0)',
                  }}
                  className="glass-segmented-thumb pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] rounded-xl bg-white shadow-xs border border-slate-200/70"
                />
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('folders');
                    setSelectedFolder(null);
                  }}
                  className={`relative z-10 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-[11pt] font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap select-none ${
                    viewMode === 'folders' ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Apple Glassmorphism Folder Grid"
                >
                  <Folder className="w-4 h-4 shrink-0" />
                  <span className="truncate">Company Folders</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`relative z-10 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-[11pt] font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap select-none ${
                    viewMode === 'table' ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Spreadsheet Table View"
                >
                  <TableIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">Editable Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`relative z-10 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-[11pt] font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap select-none ${
                    viewMode === 'cards' ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Card Grid View"
                >
                  <LayoutGrid className="w-4 h-4 shrink-0" />
                  <span className="truncate">Card Grid</span>
                </button>
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: Apple macOS / iOS Glassmorphism Folder Grid */}
          {viewMode === 'folders' && !selectedFolder && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <Folder className="w-5 h-5 text-blue-600 fill-blue-500/20" />
                    <span>Company Folders</span>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/80">
                      {filteredFolders.length} Folders
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Apple-style glass organization for multi-unit corporate clients
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/80 hover:bg-white text-blue-700 border border-blue-200 shadow-2xs backdrop-blur-md cursor-pointer transition-all"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ New Folder</span>
                </button>
              </div>

              {filteredFolders.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-white/70 backdrop-blur-md rounded-3xl border border-slate-200 shadow-xs">
                  No company folders match your search. Click &quot;New Folder&quot; to organize client accounts.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredFolders.map((folder) => (
                    <div
                      key={folder.name}
                      onClick={() => setSelectedFolder(folder.name)}
                      className="group relative bg-white/75 hover:bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/90 hover:border-blue-300/80 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_45px_rgba(37,99,235,0.12)] transition-all duration-300 flex flex-col justify-between cursor-pointer overflow-hidden"
                    >
                      {/* Top ambient glass highlight */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-3xl" />

                      <div>
                        {/* Apple macOS style 3D glass folder icon / Custom DP + Unit count */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="relative group/dp">
                            {folder.logo_url ? (
                              <img
                                src={folder.logo_url}
                                alt={folder.name}
                                className="w-13 h-13 rounded-2xl object-cover shadow-[0_8px_22px_rgba(37,99,235,0.25)] border-2 border-white/90 group-hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-[0_8px_22px_rgba(37,99,235,0.35)] group-hover:scale-105 transition-transform duration-200">
                                <Folder className="w-7 h-7 fill-white/20 text-white" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLogoTargetFolder(folder.name);
                                setLogoPreview(folder.logo_url || '');
                                setIsLogoModalOpen(true);
                              }}
                              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-white/95 border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 shadow-sm flex items-center justify-center transition-all cursor-pointer opacity-90 group-hover/dp:opacity-100"
                              title="Customize Folder DP / Logo"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
                            {folder.units.length} {folder.units.length === 1 ? 'Store' : 'Stores'}
                          </span>
                        </div>

                        {/* Folder Title (Company Name) */}
                        <h4 className="font-extrabold text-base sm:text-lg text-slate-900 group-hover:text-blue-700 tracking-tight transition-colors line-clamp-1">
                          {folder.name}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                          {folder.gstin ? `GSTIN: ${folder.gstin}` : 'Corporate Group & Units'}
                        </p>

                        {/* Units Preview chips - Click any unit to view its quotations */}
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {folder.units.slice(0, 4).map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openUnitQuotations(u);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-white/90 text-slate-700 border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all shadow-2xs cursor-pointer active:scale-95 group/unit"
                              title={`Click to view quotations for ${u.trade_name || u.company_name}`}
                            >
                              <Store className="w-3.5 h-3.5 text-blue-600 shrink-0 group-hover/unit:scale-110 transition-transform" />
                              <span className="truncate max-w-[130px] font-medium">{u.trade_name || u.store_code || 'Main'}</span>
                              <FileText className="w-3 h-3 text-slate-400 group-hover/unit:text-blue-600 transition-colors ml-0.5 shrink-0" />
                            </button>
                          ))}
                          {folder.units.length > 4 && (
                            <span className="px-2 py-1.5 rounded-xl text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200">
                              +{folder.units.length - 4} more
                            </span>
                          )}
                          {folder.units.length === 0 && (
                            <span className="text-[11px] text-slate-400 italic">Empty folder (Click to add store)</span>
                          )}
                        </div>
                      </div>

                      {/* Folder Footer */}
                      <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                          <span>Open Folder</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddUnitForFolder(folder.name);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                          title={`Add a store/unit to ${folder.name}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Unit</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 1 (Drilled Down): Inside a Selected Company Folder */}
          {viewMode === 'folders' && selectedFolder && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 md:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.05)] space-y-5 sm:space-y-6 w-full font-['Calibri'] text-[11pt]">
              {/* Breadcrumb Navigation & Top Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
                <div className="flex items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => setSelectedFolder(null)}
                    className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
                    title="Back to All Folders"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="relative group/dp shrink-0">
                    {companyFolderGroups.find((f) => f.name.toLowerCase() === selectedFolder.toLowerCase())?.logo_url ? (
                      <img
                        src={companyFolderGroups.find((f) => f.name.toLowerCase() === selectedFolder.toLowerCase())!.logo_url!}
                        alt={selectedFolder}
                        className="w-13 h-13 rounded-2xl object-cover shadow-md shadow-blue-500/25 border-2 border-white/90"
                      />
                    ) : (
                      <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
                        <Folder className="w-7 h-7 fill-white/20 text-white" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const f = companyFolderGroups.find((item) => item.name.toLowerCase() === selectedFolder.toLowerCase());
                        setLogoTargetFolder(selectedFolder);
                        setLogoPreview(f?.logo_url || '');
                        setIsLogoModalOpen(true);
                      }}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-white/95 border border-slate-200 text-slate-600 hover:text-blue-600 shadow-sm flex items-center justify-center transition-all cursor-pointer"
                      title="Change Folder DP"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Company Folder</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60 shadow-2xs">
                        {activeFolderUnits.length} {activeFolderUnits.length === 1 ? 'Unit' : 'Units'}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5 mt-0.5">
                      <span>{selectedFolder}</span>
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => openAddUnitForFolder(selectedFolder)}
                    className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-2xl text-[11pt] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Store to {selectedFolder}</span>
                  </button>
                </div>
              </div>

              {/* Stores / Units inside this Folder */}
              {activeFolderUnits.length === 0 ? (
                <div className="p-12 text-center text-slate-400 glass-box-white rounded-3xl border border-dashed border-slate-200 font-['Calibri'] text-[11pt]">
                  No stores or branches currently in this folder. Click &quot;Add Store to {selectedFolder}&quot; to register units.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* AUTOMATED RESPONSIVE VIEW 1: Mobile Apple iOS Pure White Glass Cards */}
                  <div className="block md:hidden space-y-3.5">
                    {activeFolderUnits.map((u, idx) => (
                      <div
                        key={u.id}
                        className="glass-box-white rounded-3xl p-4 sm:p-5 space-y-3.5 border-1.5 border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.06)] font-['Calibri'] text-[11pt]"
                      >
                        {/* Card Header: Unit #, Store Code, Prominent Red Delete Button */}
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200/60 shadow-2xs">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              Store Unit #{idx + 1}
                            </span>
                          </div>
                          {/* Delete Symbol */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(u.id, u.trade_name || u.company_name)}
                            className="glass-symbol-btn text-rose-500 hover:text-rose-600"
                            title="Delete this store branch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Store Code (Optional) & Store / Branch Name */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="sm:col-span-1">
                            <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Store Code
                            </label>
                            <input
                              type="text"
                              value={u.store_code || ''}
                              onChange={(e) => handleInlineChange(u.id, 'store_code', e.target.value.toUpperCase())}
                              onBlur={() => handleBlur(u.id)}
                              placeholder="e.g. 1903"
                              className="w-full bg-amber-50/70 hover:bg-amber-50 focus:bg-white border-1.5 border-amber-300 focus:border-amber-500 rounded-2xl py-2.5 px-3 text-[11pt] font-mono font-bold text-blue-700 shadow-[0_2px_6px_rgba(15,23,42,0.05)] focus:ring-4 focus:ring-amber-500/20 transition-all"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Store Name
                            </label>
                            <input
                              type="text"
                              value={u.trade_name || ''}
                              onChange={(e) => handleInlineChange(u.id, 'trade_name', e.target.value)}
                              onBlur={() => handleBlur(u.id)}
                              placeholder="e.g. Prozone Mall"
                              className="w-full bg-white hover:bg-white focus:bg-white border-1.5 border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2.5 px-3.5 text-[11pt] font-bold text-slate-800 shadow-[0_2px_6px_rgba(15,23,42,0.05)] focus:ring-4 focus:ring-blue-500/15 transition-all"
                            />
                          </div>
                        </div>

                        {/* GSTIN */}
                        <div>
                          <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            GSTIN
                          </label>
                          <input
                            type="text"
                            value={u.gstin || ''}
                            onChange={(e) => handleInlineChange(u.id, 'gstin', e.target.value.toUpperCase())}
                            onBlur={() => handleBlur(u.id)}
                            placeholder="GSTIN (e.g. 33AAACL2937J1ZL)"
                            className="w-full bg-white hover:bg-white focus:bg-white border-1.5 border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2.5 px-3.5 text-[11pt] font-mono font-semibold text-slate-800 uppercase shadow-[0_2px_6px_rgba(15,23,42,0.05)] focus:ring-4 focus:ring-blue-500/15 transition-all"
                          />
                        </div>

                        {/* Billing Address - FULL & COMFORTABLE EXPANDED VISIBILITY */}
                        <div>
                          <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Billing Address
                          </label>
                          <textarea
                            rows={2}
                            value={u.billing_address || ''}
                            onChange={(e) => handleInlineChange(u.id, 'billing_address', e.target.value)}
                            onBlur={() => handleBlur(u.id)}
                            placeholder="Full store billing address..."
                            className="w-full bg-white hover:bg-white focus:bg-white border-1.5 border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2.5 px-3.5 text-[11pt] text-slate-800 resize-none leading-relaxed shadow-[0_2px_6px_rgba(15,23,42,0.05)] focus:ring-4 focus:ring-blue-500/15 transition-all"
                          />
                        </div>

                        {/* Contact Person & Phone */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Contact Person
                            </label>
                            <input
                              type="text"
                              value={u.contact_person || ''}
                              onChange={(e) => handleInlineChange(u.id, 'contact_person', e.target.value)}
                              onBlur={() => handleBlur(u.id)}
                              placeholder="Contact person..."
                              className="w-full bg-white hover:bg-white focus:bg-white border-1.5 border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2.5 px-3 text-[11pt] text-slate-800 shadow-[0_2px_6px_rgba(15,23,42,0.05)] focus:ring-4 focus:ring-blue-500/15 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Phone
                            </label>
                            <input
                              type="text"
                              value={u.phone || ''}
                              onChange={(e) => handleInlineChange(u.id, 'phone', e.target.value)}
                              onBlur={() => handleBlur(u.id)}
                              placeholder="Phone..."
                              className="w-full bg-white hover:bg-white focus:bg-white border-1.5 border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2.5 px-3 text-[11pt] font-mono text-slate-800 shadow-[0_2px_6px_rgba(15,23,42,0.05)] focus:ring-4 focus:ring-blue-500/15 transition-all"
                            />
                          </div>
                        </div>

                        {/* Action Symbols in Modern Glassmorphism Box */}
                        <div className="pt-2 flex items-center justify-end border-t border-slate-100">
                          <div className="glass-action-box">
                            <button
                              type="button"
                              onClick={() => openUnitQuotations(u)}
                              className="glass-symbol-btn text-indigo-600 hover:text-indigo-700"
                              title="View Quotations"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <Link
                              href={`/quotations/new?customerId=${u.id}`}
                              className="glass-symbol-btn text-blue-600 hover:text-blue-700"
                              title="Create Quotation (+)"
                            >
                              <Plus className="w-4 h-4 stroke-[2.5]" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(u.id, u.trade_name || u.company_name)}
                              className="glass-symbol-btn text-rose-500 hover:text-rose-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AUTOMATED RESPONSIVE VIEW 2: Monitor / Desktop Spacious Pure White Glassmorphism Table */}
                  <div className="hidden md:block overflow-x-auto smooth-table-scroll glass-box-white rounded-3xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] font-['Calibri'] text-[11pt]">
                    <table className="w-full text-left font-['Calibri'] text-[11pt] border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10.5pt] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3.5 px-2.5 text-center w-12">#</th>
                          <th className="py-3.5 px-2.5 w-28 min-w-[105px]">Store Code</th>
                          <th className="py-3.5 px-2.5 w-48 min-w-[180px]">Store / Branch Name</th>
                          <th className="py-3.5 px-2.5 w-40 min-w-[155px]">GSTIN</th>
                          <th className="py-3.5 px-2.5 min-w-[260px]">Billing Address</th>
                          <th className="py-3.5 px-2.5 w-36 min-w-[130px]">Contact Person</th>
                          <th className="py-3.5 px-2.5 w-32 min-w-[120px]">Phone</th>
                          {/* PINNED STICKY ACTIONS COLUMN - GPU COMPOSITED CRISP WHITE */}
                          <th className="py-3.5 px-3 text-center w-36 min-w-[136px] sticky right-0 bg-slate-50 shadow-[-6px_0_14px_rgba(15,23,42,0.05)] border-l border-slate-200 z-20">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/90 font-normal">
                        {activeFolderUnits.map((u, idx) => (
                          <tr key={u.id} className="hover:bg-[#F5F9FF] transition-colors duration-100 group">
                            {/* # and Quick Delete Button */}
                            <td className="py-2.5 px-2.5 text-center font-bold text-slate-400">
                              <div className="flex items-center justify-center gap-1">
                                <span>{idx + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomer(u.id, u.trade_name || u.company_name)}
                                  className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Delete this store branch"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            {/* Store Code Box */}
                            <td className="py-2.5 px-2">
                              <input
                                type="text"
                                value={u.store_code || ''}
                                onChange={(e) => handleInlineChange(u.id, 'store_code', e.target.value.toUpperCase())}
                                onBlur={() => handleBlur(u.id)}
                                placeholder="e.g. 1903"
                                className="w-full bg-amber-50/70 hover:bg-amber-50 focus:bg-white border border-amber-300 focus:border-amber-500 rounded-2xl py-2 px-2.5 text-[11pt] font-mono font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-colors duration-150"
                              />
                            </td>
                            {/* Store / Branch Name Box */}
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={u.trade_name || ''}
                                  onChange={(e) => handleInlineChange(u.id, 'trade_name', e.target.value)}
                                  onBlur={() => handleBlur(u.id)}
                                  placeholder="e.g. Prozone Mall"
                                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2 px-3 text-[11pt] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors duration-150"
                                />
                                <button
                                  type="button"
                                  onClick={() => openUnitQuotations(u)}
                                  className="glass-symbol-btn text-indigo-600 hover:text-indigo-700 shrink-0"
                                  title="View Quotations for this Store"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            {/* GSTIN Box */}
                            <td className="py-2.5 px-2">
                              <input
                                type="text"
                                value={u.gstin || ''}
                                onChange={(e) => handleInlineChange(u.id, 'gstin', e.target.value.toUpperCase())}
                                onBlur={() => handleBlur(u.id)}
                                placeholder="GSTIN"
                                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2 px-3 text-[11pt] font-mono font-semibold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors duration-150"
                              />
                            </td>
                            {/* Expanded & Comfortable Billing Address */}
                            <td className="py-2.5 px-2">
                              <input
                                type="text"
                                value={u.billing_address || ''}
                                onChange={(e) => handleInlineChange(u.id, 'billing_address', e.target.value)}
                                onBlur={() => handleBlur(u.id)}
                                title={u.billing_address || ''}
                                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2 px-3 text-[11pt] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors duration-150"
                              />
                            </td>
                            {/* Contact Person Box */}
                            <td className="py-2.5 px-2">
                              <input
                                type="text"
                                value={u.contact_person || ''}
                                onChange={(e) => handleInlineChange(u.id, 'contact_person', e.target.value)}
                                onBlur={() => handleBlur(u.id)}
                                placeholder="Contact..."
                                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2 px-2.5 text-[11pt] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors duration-150"
                              />
                            </td>
                            {/* Phone Box */}
                            <td className="py-2.5 px-2">
                              <input
                                type="text"
                                value={u.phone || ''}
                                onChange={(e) => handleInlineChange(u.id, 'phone', e.target.value)}
                                onBlur={() => handleBlur(u.id)}
                                placeholder="Phone..."
                                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2 px-2.5 text-[11pt] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors duration-150"
                              />
                            </td>
                            {/* PINNED STICKY ACTIONS COLUMN - GPU COMPOSITED CRISP WHITE */}
                            <td className="py-2 px-2.5 text-center sticky right-0 bg-white group-hover:bg-[#F5F9FF] shadow-[-6px_0_14px_rgba(15,23,42,0.05)] border-l border-slate-200/90 z-10 transition-colors duration-100">
                              <div className="glass-action-box">
                                <button
                                  type="button"
                                  onClick={() => openUnitQuotations(u)}
                                  className="glass-symbol-btn text-indigo-600 hover:text-indigo-700"
                                  title="View Quotations"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <Link
                                  href={`/quotations/new?customerId=${u.id}`}
                                  className="glass-symbol-btn text-blue-600 hover:text-blue-700"
                                  title="Create Quotation (+)"
                                >
                                  <Plus className="w-4 h-4 stroke-[2.5]" />
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomer(u.id, u.trade_name || u.company_name)}
                                  className="glass-symbol-btn text-rose-500 hover:text-rose-600"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: Editable Table Spreadsheet Grid */}
          {viewMode === 'table' && (
            <div className="glass-box-white rounded-3xl border border-white/90 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden animate-in fade-in duration-200 font-['Calibri'] text-[11pt]">
              {loading ? (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
                  <span className="text-[11pt] text-slate-500 font-medium">Loading customer directory...</span>
                </div>
              ) : (
                <div className="p-4 sm:p-5 space-y-4">
                  {/* AUTOMATED RESPONSIVE VIEW 1: Mobile Apple iOS Pure White Glass Cards */}
                  <div className="block md:hidden space-y-3.5">
                    {filteredCustomers.map((c, idx) => {
                      const status = rowStatus[c.id];
                      return (
                        <div
                          key={c.id}
                          className="glass-box-white rounded-3xl p-4 sm:p-5 space-y-3.5 border border-white/90 shadow-[0_6px_20px_rgba(15,23,42,0.04)] font-['Calibri'] text-[11pt]"
                        >
                          {/* Card Header: Index, Save Status, Delete */}
                          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              {status?.state === 'saved' ? (
                                <span
                                  title={`Saved in ${status.ms || '0ms'}`}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                </span>
                              ) : status?.state === 'saving' ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                              ) : (
                                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200/60">
                                  {idx + 1}
                                </span>
                              )}
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Account #{idx + 1}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(c.id, c.trade_name || c.company_name)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Company Legal Name */}
                          <div>
                            <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Client / Company Legal Name
                            </label>
                            <input
                              type="text"
                              value={c.company_name || ''}
                              onChange={(e) => handleInlineChange(c.id, 'company_name', e.target.value)}
                              onBlur={() => handleBlur(c.id)}
                              placeholder="Company name..."
                              className="w-full glass-input-white rounded-2xl py-2 px-3.5 text-[11pt] font-bold text-slate-900"
                            />
                          </div>

                          {/* Store Code & Store / Trade Name */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="sm:col-span-1">
                              <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Store Code
                              </label>
                              <input
                                type="text"
                                value={c.store_code || ''}
                                onChange={(e) => handleInlineChange(c.id, 'store_code', e.target.value.toUpperCase())}
                                onBlur={() => handleBlur(c.id)}
                                placeholder="e.g. 1903"
                                className="w-full glass-input-white rounded-2xl py-2 px-3 text-[11pt] font-mono font-bold text-blue-700 bg-amber-50/50 hover:bg-amber-50 focus:bg-white border-amber-200/80"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Store / Branch Name
                              </label>
                              <input
                                type="text"
                                value={c.trade_name || ''}
                                onChange={(e) => handleInlineChange(c.id, 'trade_name', e.target.value)}
                                onBlur={() => handleBlur(c.id)}
                                placeholder="e.g. Prozone Mall"
                                className="w-full glass-input-white rounded-2xl py-2 px-3.5 text-[11pt] font-bold text-slate-800"
                              />
                            </div>
                          </div>

                          {/* GSTIN */}
                          <div>
                            <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              GSTIN
                            </label>
                            <input
                              type="text"
                              value={c.gstin || ''}
                              onChange={(e) => handleInlineChange(c.id, 'gstin', e.target.value.toUpperCase())}
                              onBlur={() => handleBlur(c.id)}
                              placeholder="GSTIN (e.g. 33AAACL2937J1ZL)"
                              className="w-full glass-input-white rounded-2xl py-2 px-3.5 text-[11pt] font-mono text-slate-800 uppercase"
                            />
                          </div>

                          {/* Billing Address - EXPANDED & COMFORTABLE */}
                          <div>
                            <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Billing Address
                            </label>
                            <textarea
                              rows={2}
                              value={c.billing_address || ''}
                              onChange={(e) => handleInlineChange(c.id, 'billing_address', e.target.value)}
                              onBlur={() => handleBlur(c.id)}
                              placeholder="Full billing address..."
                              className="w-full glass-input-white rounded-2xl py-2 px-3.5 text-[11pt] text-slate-800 resize-none leading-relaxed"
                            />
                          </div>

                          {/* Contact Person & Phone */}
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Contact Person
                              </label>
                              <input
                                type="text"
                                value={c.contact_person || ''}
                                onChange={(e) => handleInlineChange(c.id, 'contact_person', e.target.value)}
                                onBlur={() => handleBlur(c.id)}
                                placeholder="Contact..."
                                className="w-full glass-input-white rounded-2xl py-2 px-3 text-[11pt] text-slate-800"
                              />
                            </div>
                            <div>
                              <label className="block text-[10pt] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Phone
                              </label>
                              <input
                                type="text"
                                value={c.phone || ''}
                                onChange={(e) => handleInlineChange(c.id, 'phone', e.target.value)}
                                onBlur={() => handleBlur(c.id)}
                                placeholder="Phone..."
                                className="w-full glass-input-white rounded-2xl py-2 px-3 text-[11pt] font-mono text-slate-800"
                              />
                            </div>
                          </div>

                          {/* Action Symbols in Modern Glassmorphism Box */}
                          <div className="pt-2 flex items-center justify-end border-t border-slate-100">
                            <div className="glass-action-box">
                              <button
                                type="button"
                                onClick={() => openUnitQuotations(c)}
                                className="glass-symbol-btn text-indigo-600 hover:text-indigo-700"
                                title="View Quotations"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <Link
                                href={`/quotations/new?customerId=${c.id}`}
                                className="glass-symbol-btn text-blue-600 hover:text-blue-700"
                                title="Create Quotation (+)"
                              >
                                <Plus className="w-4 h-4 stroke-[2.5]" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(c.id, c.trade_name || c.company_name)}
                                className="glass-symbol-btn text-rose-500 hover:text-rose-600"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* AUTOMATED RESPONSIVE VIEW 2: Monitor / Desktop Spacious Pure White Glassmorphism Table */}
                  <div className="hidden md:block overflow-x-auto smooth-table-scroll glass-box-white rounded-3xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] font-['Calibri'] text-[11pt]">
                    <table className="w-full text-left font-['Calibri'] text-[11pt] border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10.5pt] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3.5 px-2.5 text-center w-12">No.</th>
                          <th className="py-3.5 px-2.5 w-48 min-w-[185px]">Client / Company Legal Name</th>
                          <th className="py-3.5 px-2.5 w-28 min-w-[105px]">Store Code</th>
                          <th className="py-3.5 px-2.5 w-44 min-w-[170px]">Store / Trade Name</th>
                          <th className="py-3.5 px-2.5 w-40 min-w-[155px]">GSTIN</th>
                          <th className="py-3.5 px-2.5 min-w-[260px]">Billing Address</th>
                          <th className="py-3.5 px-2.5 w-36 min-w-[130px]">Contact Person</th>
                          <th className="py-3.5 px-2.5 w-32 min-w-[120px]">Phone</th>
                          {/* PINNED STICKY ACTIONS COLUMN - GPU COMPOSITED CRISP WHITE */}
                          <th className="py-3.5 px-3 text-center w-36 min-w-[136px] sticky right-0 bg-slate-50 shadow-[-6px_0_14px_rgba(15,23,42,0.05)] border-l border-slate-200 z-20">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/90 font-normal">
                        {filteredCustomers.map((c, idx) => {
                          const status = rowStatus[c.id];
                          return (
                            <tr
                              key={c.id}
                              className="hover:bg-[#F5F9FF] transition-colors duration-100 group relative"
                            >
                              {/* Col 1: No., Quick Delete & Save Indicator */}
                              <td className="py-2.5 px-2.5 text-center text-[11pt] font-semibold text-slate-400 relative">
                                <div className="flex items-center justify-center gap-1">
                                  {status?.state === 'saved' ? (
                                    <span
                                      title={`Saved in ${status.ms || '0ms'}`}
                                      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs"
                                    >
                                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                    </span>
                                  ) : status?.state === 'saving' ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 mx-auto" />
                                  ) : (
                                    <span>{idx + 1}</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomer(c.id, c.trade_name || c.company_name)}
                                    className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Delete Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                              {/* Col 2: Company Legal Name */}
                              <td className="py-2.5 px-2">
                                <input
                                  type="text"
                                  value={c.company_name || ''}
                                  onChange={(e) => handleInlineChange(c.id, 'company_name', e.target.value)}
                                  onBlur={() => handleBlur(c.id)}
                                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2 px-3 text-[11pt] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors duration-150"
                                />
                              </td>

                              {/* Col 3: Store Code (Optional) */}
                              <td className="py-2.5 px-2">
                                <input
                                  type="text"
                                  value={c.store_code || ''}
                                  onChange={(e) => handleInlineChange(c.id, 'store_code', e.target.value.toUpperCase())}
                                  onBlur={() => handleBlur(c.id)}
                                  placeholder="e.g. 1903"
                                  className="w-full bg-amber-50/70 hover:bg-amber-50 focus:bg-white border border-amber-300 focus:border-amber-500 rounded-2xl py-2 px-2.5 text-[11pt] font-mono font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-colors duration-150"
                                />
                              </td>

                              {/* Col 4: Store / Trade Name */}
                              <td className="py-2.5 px-2">
                                <input
                                  type="text"
                                  value={c.trade_name || ''}
                                  onChange={(e) => handleInlineChange(c.id, 'trade_name', e.target.value)}
                                  onBlur={() => handleBlur(c.id)}
                                  placeholder="e.g. Prozone Mall"
                                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2 px-3 text-[11pt] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors duration-150"
                                />
                              </td>

                              {/* Col 5: GSTIN */}
                              <td className="py-2.5 px-2">
                                <input
                                  type="text"
                                  value={c.gstin || ''}
                                  onChange={(e) => handleInlineChange(c.id, 'gstin', e.target.value.toUpperCase())}
                                  onBlur={() => handleBlur(c.id)}
                                  placeholder="33AAACL2937J1ZL"
                                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2 px-3 text-[11pt] font-mono font-semibold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors duration-150"
                                />
                              </td>

                              {/* Col 6: Billing Address - EXPANDED & COMFORTABLE */}
                              <td className="py-2.5 px-2">
                                <input
                                  type="text"
                                  value={c.billing_address || ''}
                                  onChange={(e) => handleInlineChange(c.id, 'billing_address', e.target.value)}
                                  onBlur={() => handleBlur(c.id)}
                                  title={c.billing_address || ''}
                                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2 px-3 text-[11pt] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors duration-150"
                                />
                              </td>

                              {/* Col 7: Contact Person */}
                              <td className="py-2.5 px-2">
                                <input
                                  type="text"
                                  value={c.contact_person || ''}
                                  onChange={(e) => handleInlineChange(c.id, 'contact_person', e.target.value)}
                                  onBlur={() => handleBlur(c.id)}
                                  placeholder="Contact..."
                                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2 px-2.5 text-[11pt] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors duration-150"
                                />
                              </td>

                              {/* Col 8: Phone */}
                              <td className="py-2.5 px-2">
                                <input
                                  type="text"
                                  value={c.phone || ''}
                                  onChange={(e) => handleInlineChange(c.id, 'phone', e.target.value)}
                                  onBlur={() => handleBlur(c.id)}
                                  placeholder="Phone..."
                                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl py-2 px-2.5 text-[11pt] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors duration-150"
                                />
                              </td>

                              {/* Col 9: PINNED STICKY QUICK ACTIONS - GPU COMPOSITED CRISP WHITE */}
                              <td className="py-2 px-2.5 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-[#F5F9FF] shadow-[-6px_0_14px_rgba(15,23,42,0.05)] border-l border-slate-200/90 z-10 transition-colors duration-100">
                                <div className="glass-action-box">
                                  <button
                                    type="button"
                                    onClick={() => openUnitQuotations(c)}
                                    className="glass-symbol-btn text-indigo-600 hover:text-indigo-700"
                                    title="View Quotations"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                  <Link
                                    href={`/quotations/new?customerId=${c.id}`}
                                    className="glass-symbol-btn text-blue-600 hover:text-blue-700"
                                    title="Create Quotation (+)"
                                  >
                                    <Plus className="w-4 h-4 stroke-[2.5]" />
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomer(c.id, c.trade_name || c.company_name)}
                                    className="glass-symbol-btn text-rose-500 hover:text-rose-600"
                                    title="Delete Account"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bottom Quick Row: Fast Add Customer / Store (Pure White Glassmorphism) */}
              <form onSubmit={handleQuickAdd} className="border-t border-slate-200/80 bg-white/70 backdrop-blur-md p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[11pt] font-bold text-blue-600 px-2">+</span>
                  <input
                    type="text"
                    required
                    value={quickRow.company_name}
                    onChange={(e) => setQuickRow({ ...quickRow, company_name: capitalizeInput(e.target.value) })}
                    placeholder="+ New Company Name..."
                    className="flex-1 min-w-[200px] glass-input-white rounded-2xl py-2 px-3.5 text-[11pt] font-bold text-slate-900"
                  />
                  <input
                    type="text"
                    value={quickRow.store_code}
                    onChange={(e) => setQuickRow({ ...quickRow, store_code: e.target.value.toUpperCase() })}
                    placeholder="Store Code (Optional)"
                    className="w-36 glass-input-white rounded-2xl py-2 px-3 text-[11pt] font-mono font-bold text-blue-700 bg-amber-50/60 border-amber-200/80"
                  />
                  <input
                    type="text"
                    value={quickRow.trade_name}
                    onChange={(e) => setQuickRow({ ...quickRow, trade_name: capitalizeInput(e.target.value) })}
                    placeholder="Store / Location..."
                    className="w-36 glass-input-white rounded-2xl py-2 px-3 text-[11pt] font-bold text-slate-800"
                  />
                  <input
                    type="text"
                    value={quickRow.gstin}
                    onChange={(e) => setQuickRow({ ...quickRow, gstin: e.target.value.toUpperCase() })}
                    placeholder="GSTIN..."
                    className="w-36 glass-input-white rounded-2xl py-2 px-3 text-[11pt] font-mono text-slate-800 uppercase"
                  />
                  <input
                    type="text"
                    required
                    value={quickRow.billing_address}
                    onChange={(e) => setQuickRow({ ...quickRow, billing_address: capitalizeInput(e.target.value) })}
                    placeholder="Billing address..."
                    className="flex-1 min-w-[220px] glass-input-white rounded-2xl py-2 px-3.5 text-[11pt] text-slate-800"
                  />
                  <input
                    type="text"
                    value={quickRow.contact_person}
                    onChange={(e) => setQuickRow({ ...quickRow, contact_person: capitalizeInput(e.target.value) })}
                    placeholder="Contact person..."
                    className="w-32 glass-input-white rounded-2xl py-2 px-3 text-[11pt] text-slate-800"
                  />
                  <input
                    type="text"
                    value={quickRow.phone}
                    onChange={(e) => setQuickRow({ ...quickRow, phone: e.target.value })}
                    placeholder="Phone..."
                    className="w-32 glass-input-white rounded-2xl py-2 px-3 text-[11pt] font-mono text-slate-800"
                  />
                  <button
                    type="submit"
                    disabled={quickAdding}
                    className="px-5 py-2 text-[11pt] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {quickAdding ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* VIEW MODE 3: Cards Grid View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-200 font-['Calibri'] text-[11pt]">
              {filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  className="glass-box-white rounded-3xl p-5 sm:p-6 border border-white/90 shadow-[0_8px_25px_rgba(15,23,42,0.04)] hover:shadow-[0_16px_35px_rgba(37,99,235,0.08)] transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <h3 className="font-extrabold text-[12pt] text-slate-900 tracking-tight leading-snug">
                          {c.company_name}
                        </h3>
                        {c.trade_name && (
                          <p className="text-[11pt] font-bold text-blue-600 mt-0.5">{c.trade_name}</p>
                        )}
                      </div>
                      <div className="glass-action-box shrink-0">
                        <button
                          type="button"
                          onClick={() => openUnitQuotations(c)}
                          className="glass-symbol-btn text-indigo-600 hover:text-indigo-700"
                          title="View Quotations"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/quotations/new?customerId=${c.id}`}
                          className="glass-symbol-btn text-blue-600 hover:text-blue-700"
                          title="Create Quotation (+)"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(c.id, c.trade_name || c.company_name)}
                          className="glass-symbol-btn text-rose-500 hover:text-rose-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {c.store_code && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11pt] font-mono font-bold text-blue-700 shadow-2xs">
                        <Store className="w-3.5 h-3.5 text-amber-600" />
                        <span>Code: {c.store_code}</span>
                      </div>
                    )}

                    {c.gstin && (
                      <p className="text-[11pt] font-mono text-slate-500 font-semibold">
                        GSTIN: <span className="text-slate-800">{c.gstin}</span>
                      </p>
                    )}

                    <div className="flex items-start gap-2 text-[11pt] text-slate-700 bg-white/70 p-3 rounded-2xl border border-white/80">
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{c.billing_address}</span>
                    </div>

                    {(c.contact_person || c.phone) && (
                      <div className="flex items-center gap-3 text-[11pt] text-slate-600 pt-1">
                        {c.contact_person && <span className="font-semibold text-slate-800">{c.contact_person}</span>}
                        {c.phone && (
                          <span className="flex items-center gap-1 text-slate-600 font-mono">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {c.phone}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: Create Company Folder (Apple Glassmorphism UI) */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200 font-['Calibri'] text-[11pt]">
          <div className="relative w-full max-w-lg glass-box-white rounded-3xl border border-white/90 shadow-[0_24px_60px_-12px_rgba(30,58,138,0.25)] p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Top glass gradient reflection */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-[0_8px_20px_rgba(37,99,235,0.3)]">
                  <FolderPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                    Create Company Folder
                  </h3>
                  <p className="text-[10pt] text-slate-500 font-medium">
                    Group all units and stores under a shared corporate umbrella
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Folder Form */}
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Company / Group Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(capitalizeInput(e.target.value))}
                  placeholder="e.g. Lifestyle International, Landmark Group"
                  className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Initial Store / Unit (Optional)
                  </label>
                  <input
                    type="text"
                    value={newFolderInitialStore}
                    onChange={(e) => setNewFolderInitialStore(capitalizeInput(e.target.value))}
                    placeholder="e.g. Homecentre, Prozone Mall"
                    className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Store Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={newFolderStoreCode}
                    onChange={(e) => setNewFolderStoreCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 1903, HC-01"
                    className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] font-mono font-bold text-blue-700 bg-amber-50/50 border-amber-200/80"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Group GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={newFolderGstin}
                    onChange={(e) => setNewFolderGstin(e.target.value.toUpperCase())}
                    placeholder="33AAACL2937J1ZL"
                    className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] font-mono text-slate-800 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Head Office / Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={newFolderAddress}
                    onChange={(e) => setNewFolderAddress(capitalizeInput(e.target.value))}
                    placeholder="Registered billing address"
                    className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] text-slate-800"
                  />
                </div>
              </div>

              {/* Folder Logo / DP Picker */}
              <div>
                <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Folder Logo / DP (Optional - WebP, PNG, JPEG, AVIF)
                </label>
                <div className="flex items-center gap-3">
                  {newFolderLogoUrl ? (
                    <div className="relative shrink-0">
                      <img
                        src={newFolderLogoUrl}
                        alt="Folder DP Preview"
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setNewFolderLogoUrl('')}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px]"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-dashed border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/webp,image/png,image/jpeg,image/jpg,image/avif,image/*,.doc,.docx"
                      onChange={(e) => handleLogoFileChange(e, true)}
                      className="hidden"
                    />
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11pt] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs">
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>Upload DP Image</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2.5 text-[11pt] font-bold text-slate-600 hover:bg-slate-100 rounded-2xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFolder}
                  className="px-5 py-2.5 text-[11pt] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{creatingFolder ? 'Creating...' : 'Create Folder'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add New Customer / Store Location */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200 font-['Calibri'] text-[11pt]">
          <div className="relative w-full max-w-lg glass-box-white rounded-3xl border border-white/90 shadow-[0_24px_60px_-12px_rgba(30,58,138,0.25)] p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200 overflow-hidden max-h-[92dvh] overflow-y-auto">
            {/* Ambient top glass accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />

            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/80 shadow-2xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                    Add Client / Store Account
                  </h3>
                  <p className="text-[10pt] text-slate-500 font-medium">
                    Register a billing account or retail store location
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Company Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(capitalizeInput(e.target.value))}
                  placeholder="e.g. Lifestyle International Pvt. Ltd"
                  className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Store / Branch Location
                  </label>
                  <input
                    type="text"
                    value={tradeName}
                    onChange={(e) => setTradeName(capitalizeInput(e.target.value))}
                    placeholder="e.g. Prozone Mall, Madurai"
                    className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Store Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 1903, PZ-01"
                    className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] font-mono font-bold text-blue-700 bg-amber-50/50 border-amber-200/80"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="33AAACL2937J1ZL"
                  className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] font-mono text-slate-800 uppercase"
                />
              </div>

              <div>
                <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Billing Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(capitalizeInput(e.target.value))}
                  placeholder="Store / Office billing address"
                  className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] text-slate-800 resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(capitalizeInput(e.target.value))}
                    placeholder="e.g. Mr. Anand"
                    className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9698414094"
                    className="w-full glass-input-white rounded-2xl py-2.5 px-3.5 text-[11pt] font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-[11pt] font-bold text-slate-600 hover:bg-slate-100 rounded-2xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 text-[11pt] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{creating ? 'Saving...' : 'Save Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Unit Quotations Modal (Strictly De-duplicated & Fully Secured) */}
      {isUnitQuotesModalOpen && selectedUnitForQuotes && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200 font-['Calibri'] text-[11pt]">
          <div className="relative glass-box-white rounded-3xl border border-white/90 shadow-[0_24px_70px_rgba(30,58,138,0.22)] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
            {/* Top radiant glass accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-sky-400 via-blue-600 to-indigo-600 shrink-0" />

            {/* Header */}
            <div className="p-5 sm:p-7 border-b border-slate-200/80 bg-white/80 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
                    <Store className="w-7 h-7 fill-white/20 text-white" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10pt] font-bold uppercase tracking-wider text-slate-400">
                        {selectedUnitForQuotes.folder_name || normalizeCompanyName(selectedUnitForQuotes.company_name)}
                      </span>
                      {selectedUnitForQuotes.store_code && (
                        <span className="px-2.5 py-0.5 rounded-xl text-[10pt] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Code: {selectedUnitForQuotes.store_code}
                        </span>
                      )}
                      {selectedUnitForQuotes.gstin && (
                        <span className="px-2.5 py-0.5 rounded-xl text-[10pt] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          GSTIN: {selectedUnitForQuotes.gstin}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                      {selectedUnitForQuotes.trade_name
                        ? `${selectedUnitForQuotes.trade_name}`
                        : selectedUnitForQuotes.company_name}
                    </h3>
                    <p className="text-[10pt] text-slate-500 font-medium line-clamp-1 mt-0.5">
                      {selectedUnitForQuotes.billing_address || 'Registered Branch Address'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-center">
                  <Link
                    href={`/quotations/new?customerId=${selectedUnitForQuotes.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11pt] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Quote for Unit</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnitQuotesModalOpen(false);
                      setSelectedUnitForQuotes(null);
                    }}
                    className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body / Quotations List */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4">
              {loadingUnitQuotes ? (
                <div className="p-16 text-center flex flex-col items-center justify-center">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600 mb-2" />
                  <span className="text-[11pt] text-slate-500 font-medium">Fetching verified quotations for this unit...</span>
                </div>
              ) : unitQuotes.length === 0 ? (
                <div className="p-12 text-center rounded-3xl border border-dashed border-slate-200 bg-white/70 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">No Quotations Yet</h4>
                  <p className="text-[11pt] text-slate-500 max-w-md mx-auto">
                    There are no quotations created yet for &quot;{selectedUnitForQuotes.trade_name || selectedUnitForQuotes.company_name}&quot;. Create a quotation to apply rate memory and track pricing.
                  </p>
                  <div className="pt-2">
                    <Link
                      href={`/quotations/new?customerId=${selectedUnitForQuotes.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11pt] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create First Quotation</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search inside unit quotes */}
                  <div className="relative w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                    <input
                      type="text"
                      value={unitQuotesSearch}
                      onChange={(e) => setUnitQuotesSearch(e.target.value)}
                      placeholder="Search quote #, date, grand total amount..."
                      className="w-full !pl-10 pr-9 py-2 glass-input-white rounded-2xl text-[11pt] font-['Calibri'] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                    {unitQuotesSearch && (
                      <button
                        type="button"
                        onClick={() => setUnitQuotesSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer z-10"
                        title="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10pt] font-extrabold text-slate-500 uppercase tracking-wider">
                      {filteredUnitQuotes.length}{' '}
                      {filteredUnitQuotes.length === 1 ? 'Quotation' : 'Quotations'}{' '}
                      {unitQuotesSearch ? `matching "${unitQuotesSearch}"` : 'Found'}
                    </span>
                    <span className="text-[10pt] text-slate-400">Strictly de-duplicated</span>
                  </div>

                  {filteredUnitQuotes.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-white/50 text-slate-400 text-[11pt]">
                      No quotations match &quot;{unitQuotesSearch}&quot;.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
                      {filteredUnitQuotes.map((q) => (
                        <div
                          key={q.id}
                          className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="font-mono font-bold text-sm sm:text-base text-blue-700">
                                {q.quote_number}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${q.status === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                              >
                                {q.status === 'approved' ? 'Approved' : 'Draft'}
                              </span>
                              {q.reference_no && (
                                <span className="text-[10pt] text-slate-500 font-mono">
                                  Ref: {q.reference_no}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11pt] text-slate-500">
                              <span>Date: <strong className="text-slate-700">{q.quote_date}</strong></span>
                              {q.validity_date && (
                                <span>Valid till: <strong className="text-slate-700">{q.validity_date}</strong></span>
                              )}
                              <span>Items: <strong className="text-slate-700">{q.item_count || 0}</strong></span>
                              {q.store_name && (
                                <span>Store: <strong className="text-slate-700">{q.store_name}</strong></span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            <div className="text-left sm:text-right">
                              <div className="text-[10pt] font-bold text-slate-400 uppercase">Grand Total</div>
                              <div className="text-base sm:text-lg font-black text-slate-900 font-sans">
                                {formatINR(q.grand_total || 0)}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/quotations/${q.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11pt] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                title="View Quotation"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">View</span>
                              </Link>
                              <Link
                                href={`/quotations/${q.id}/edit`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11pt] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                                title="Edit Quotation"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Edit</span>
                              </Link>
                              <a
                                href={`/api/quotations/${q.id}/pdf`}
                                download
                                className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Download PDF"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200/80 bg-white/70 flex items-center justify-between text-[10pt] text-slate-500 shrink-0">
              <span>Unit Account ID: <code className="font-mono text-slate-600">{selectedUnitForQuotes.id}</code></span>
              <button
                type="button"
                onClick={() => {
                  setIsUnitQuotesModalOpen(false);
                  setSelectedUnitForQuotes(null);
                }}
                className="px-4 py-2 rounded-2xl text-[11pt] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shadow-2xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Customize Folder Logo / DP (Supports webp, png, jpeg, jpg, avif, etc.) */}
      {isLogoModalOpen && logoTargetFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200 font-['Calibri'] text-[11pt]">
          <div className="relative w-full max-w-md glass-box-white rounded-3xl border border-white/90 shadow-[0_24px_60px_-12px_rgba(30,58,138,0.25)] p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Top glass gradient reflection */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600" />

            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/80 shadow-2xs">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                    Customize Folder DP / Logo
                  </h3>
                  <p className="text-[10pt] text-slate-500 font-medium truncate max-w-[240px]">
                    {logoTargetFolder}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsLogoModalOpen(false);
                  setLogoTargetFolder(null);
                  setLogoPreview('');
                }}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* DP Live Preview */}
              <div className="flex flex-col items-center justify-center py-2">
                <div className="relative group/preview">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Folder DP Preview"
                      className="w-24 h-24 rounded-3xl object-cover shadow-lg shadow-blue-500/20 border-3 border-white ring-2 ring-blue-500/30"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                      <Folder className="w-12 h-12 fill-white/20 text-white" />
                    </div>
                  )}
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={() => setLogoPreview('')}
                      className="absolute -top-2 -right-2 px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[10pt] font-bold shadow-md hover:bg-rose-600 transition-colors"
                      title="Reset to default icon"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <span className="text-[10pt] text-slate-400 font-medium mt-2">
                  High-res Apple Glass DP Preview
                </span>
              </div>

              {/* Upload file button */}
              <div>
                <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Upload Photo / DP (webp, png, jpeg, jpg, avif, svg)
                </label>
                <label className="flex flex-col items-center justify-center p-4 rounded-3xl border-2 border-dashed border-slate-200 hover:border-blue-400 bg-white/70 hover:bg-blue-50/40 cursor-pointer transition-all group/upload">
                  <Upload className="w-6 h-6 text-slate-400 group-hover/upload:text-blue-600 mb-1 transition-colors" />
                  <span className="text-[11pt] font-bold text-slate-700 group-hover/upload:text-blue-700">
                    Choose image from device
                  </span>
                  <span className="text-[10pt] text-slate-400 mt-0.5">
                    Supports WebP, PNG, JPEG, JPG, AVIF, SVG, etc.
                  </span>
                  <input
                    type="file"
                    accept="image/webp,image/png,image/jpeg,image/jpg,image/avif,image/*,.doc,.docx"
                    onChange={(e) => handleLogoFileChange(e, false)}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Or paste Image URL */}
              <div>
                <label className="block text-[10pt] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Or Image Web URL
                </label>
                <input
                  type="text"
                  value={logoPreview}
                  onChange={(e) => setLogoPreview(e.target.value)}
                  placeholder="https://example.com/logo.webp or .png"
                  className="w-full glass-input-white rounded-2xl py-2 px-3 text-[11pt] text-slate-800"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogoModalOpen(false);
                    setLogoTargetFolder(null);
                    setLogoPreview('');
                  }}
                  className="px-4 py-2 text-[11pt] font-bold text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLogo}
                  disabled={savingLogo}
                  className="px-5 py-2 text-[11pt] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {savingLogo ? 'Saving...' : 'Set as DP'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Save Notification in White Glassmorphism (Strictly Zero Emojis) */}
      {toastNotification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 glass-box-white rounded-2xl border border-white/90 shadow-[0_12px_36px_rgba(30,58,138,0.16)] text-slate-800 animate-in slide-in-from-bottom-5 duration-200 font-['Calibri'] text-[11pt]">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/80 shadow-2xs shrink-0">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <div className="text-[11pt] min-w-0 pr-1">
            <div className="font-extrabold text-slate-900 leading-tight">
              {toastNotification.title}
            </div>
            <div className="text-slate-600 font-semibold text-[10pt] truncate max-w-[260px] mt-0.5">
              {toastNotification.details}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
