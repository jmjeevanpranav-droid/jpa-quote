'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';
import { getActiveTabSession, setActiveTabSession } from '@/lib/auth/client-context';
import { calculateLineItem, calculateQuotationSummary, formatINR } from '@/lib/calculations/financial';
import {
  ArrowLeft,
  Users,
  UserPlus,
  Pencil,
  Trash2,
  RefreshCw,
  FileText,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Search,
  X,
  Save,
  ExternalLink,
  User,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Calendar,
  Hash,
  Plus,
  Sparkles,
  UserCog,
} from 'lucide-react';

function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Not yet recorded';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export default function AdminEmployeesVisionPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [employees, setEmployees] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedEmpId, setSelectedEmpId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'draft'>('all');
  const [actionMsg, setActionMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Add Employee Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addGmail, setAddGmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<'staff' | 'admin'>('staff');
  const [showAddPwd, setShowAddPwd] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Edit Employee Modal
  const [editEmp, setEditEmp] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGmail, setEditGmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'staff' | 'admin'>('staff');
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Quotation Vision & Full Admin Control Modal
  const [activeQuote, setActiveQuote] = useState<any | null>(null);
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  const showToast = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 4000);
  };

  const loadAllData = useCallback(async (silent = false): Promise<any[] | null> => {
    if (!silent) setLoadingData(true);
    try {
      const [empRes, quoteRes] = await Promise.all([
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/admin/quotations', { cache: 'no-store' }),
      ]);
      const empData = await empRes.json();
      const quoteData = await quoteRes.json();
      if (!empRes.ok && !silent) {
        if (empRes.status === 431) {
          // Headers too large from legacy cookie; auto-purge was executed, retry immediately with clean headers
          setTimeout(() => loadAllData(silent), 250);
          return null;
        }
        setErrorMsg(empData.error || `Could not load employees (HTTP ${empRes.status}). Please sign in again as Administrator.`);
      } else if (empRes.ok) {
        setErrorMsg('');
      }
      if (Array.isArray(empData.users)) setEmployees(empData.users);
      if (Array.isArray(quoteData.quotations)) setQuotations(quoteData.quotations);
      return Array.isArray(empData.users) ? empData.users : null;
    } catch {
      if (!silent) setErrorMsg('Failed to load employee & quotation data.');
      return null;
    } finally {
      if (!silent) setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    const active = getActiveTabSession();
    if (active?.user) {
      setCurrentUser(active.user);
      if (active.user.role === 'admin') {
        loadAllData(true);
      }
    }
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          if (data.token) {
            const current = getActiveTabSession();
            if (current && (!current.token || current.token.length > 1024)) {
              setActiveTabSession({ ...current, token: data.token, user: data.user });
            }
          }
          if (data.user.role === 'admin') {
            loadAllData(true);
          }
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, [loadAllData]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return;
    // Check ?emp= query param for preselection
    try {
      const params = new URLSearchParams(window.location.search);
      const preEmp = params.get('emp');
      if (preEmp) setSelectedEmpId(preEmp);
    } catch {}
    loadAllData(false);
  }, [currentUser, loadAllData]);

  // Escape key closes modals
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveQuote(null);
        setEditEmp(null);
        setAddModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openEditEmployee = (emp: any) => {
    setEditEmp(emp);
    setEditName(emp.name || '');
    setEditPhone(emp.contact || '');
    setEditGmail(emp.email || '');
    setEditPassword('');
    setEditRole(emp.role === 'admin' ? 'admin' : 'staff');
    setShowEditPwd(false);
    setEditError('');
  };

  const handleSaveEmployeeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmp) return;
    setEditError('');
    setEditSaving(true);
    try {
      const payload: any = {
        userId: editEmp.id,
        name: editName.trim(),
        contact: editPhone.trim(),
        email: editGmail.trim(),
        role: editRole,
      };
      if (editPassword.trim().length > 0) {
        payload.password = editPassword;
      }
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to update employee (HTTP ${res.status}).`);
      setEditEmp(null);
      await loadAllData(true);
      showToast(`Employee "${editName.trim()}" updated successfully.`);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update employee.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addSaving) return;
    setAddError('');
    setAddSaving(true);
    const addedName = addName.trim();
    const addedPhone = addPhone.trim();
    const addedEmail = addGmail.trim().toLowerCase();
    const addedPassword = addPassword;

    const finishSuccess = async (msg: string) => {
      setAddModalOpen(false);
      setAddName('');
      setAddPhone('');
      setAddGmail('');
      setAddPassword('');
      setAddRole('staff');
      await loadAllData(true);
      showToast(msg);
    };

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addedName,
          contact: addedPhone,
          phnumber: addedPhone,
          email: addedEmail,
          gmail: addedEmail,
          password: addedPassword,
          role: addRole,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.success !== false || data.user)) {
        // Optimistic instant insert so the list updates immediately
        if (data.user) {
          setEmployees((prev) => [data.user, ...prev.filter((u) => u.id !== data.user.id)]);
        }
        await finishSuccess(
          data.message || `Employee "${addedName}" added and synced with Sign In & Sign Up.`
        );
        return;
      }

      if (res.status === 431) {
        // Legacy cookie was oversized; auto-purge cleaned cookies, retry immediately
        const retryRes = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: addedName,
            contact: addedPhone,
            phnumber: addedPhone,
            email: addedEmail,
            gmail: addedEmail,
            password: addedPassword,
            role: addRole,
          }),
        });
        const retryData = await retryRes.json().catch(() => ({}));
        if (retryRes.ok && (retryData.success !== false || retryData.user)) {
          if (retryData.user) {
            setEmployees((prev) => [retryData.user, ...prev.filter((u) => u.id !== retryData.user.id)]);
          }
          await finishSuccess(retryData.message || `Employee "${addedName}" added and synced.`);
          return;
        }
      }

      // Check if employee is registered in database despite any network glitch
      const latest = await loadAllData(true);
      if (latest?.some((u: any) => String(u.email).toLowerCase() === addedEmail)) {
        await finishSuccess(`Employee "${addedName}" is registered and synced to Sign In.`);
        return;
      }

      throw new Error(data.error || `Could not add employee (HTTP ${res.status}). Please try again.`);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add employee.');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteEmployee = async (emp: any) => {
    if (!confirm(`Delete employee "${emp.name}"? Their quotations will remain visible to Admin.`)) return;
    try {
      const res = await fetch(`/api/admin/users?id=${emp.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedEmpId === emp.id) setSelectedEmpId('ALL');
        await loadAllData(true);
        showToast(`Employee "${emp.name}" removed.`);
      }
    } catch {}
  };

  const handleQuickToggleStatus = async (q: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = q.status === 'approved' ? 'draft' : 'approved';
    // Optimistic update for instant smooth clicking
    setQuotations((prev) => prev.map((item) => (item.id === q.id ? { ...item, status: nextStatus } : item)));
    try {
      const res = await fetch('/api/admin/quotations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: q.id, status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast(`${q.quote_number} marked as ${nextStatus.toUpperCase()}.`);
    } catch {
      await loadAllData(true);
    }
  };

  const handleDeleteQuotation = async (q: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`Delete quotation ${q.quote_number} (${q.customer_name})? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/quotations/${q.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeQuote?.id === q.id) setActiveQuote(null);
        await loadAllData(true);
        showToast(`Quotation ${q.quote_number} deleted.`);
      }
    } catch {}
  };

  const openQuoteVision = (q: any) => {
    setQuoteError('');
    setActiveQuote(JSON.parse(JSON.stringify(q)));
  };

  const updateQuoteItem = (secIdx: number, itemIdx: number, field: string, value: any) => {
    if (!activeQuote) return;
    const next = { ...activeQuote };
    const sections = [...(next.sections || [])];
    const sec = { ...sections[secIdx] };
    const items = [...(sec.items || [])];
    const item = { ...items[itemIdx], [field]: value };

    const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
    const rate = Number(item.unit_rate ?? 0);
    const gst = Number(item.gst_rate ?? 18);
    const calc = calculateLineItem(qty, rate, gst, (next.tax_type || 'exclusive') as 'exclusive' | 'inclusive');
    item.taxable_amount = calc.taxableAmount;
    item.tax_amount = calc.gstAmount;
    item.line_total = calc.lineTotal;

    items[itemIdx] = item;
    sec.items = items;
    sections[secIdx] = sec;
    next.sections = sections;

    const summary = calculateQuotationSummary(
      sections.flatMap((s: any) =>
        s.items.map((i: any) => ({
          quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
          unitRate: Number(i.unit_rate ?? 0),
          gstRate: Number(i.gst_rate ?? 18),
          taxableAmount: Number(i.taxable_amount || 0),
          gstAmount: Number(i.tax_amount || 0),
        }))
      ),
      '33',
      '33',
      (next.tax_type || 'exclusive') as 'exclusive' | 'inclusive'
    );
    next.subtotal = summary.subtotal;
    next.total_tax = summary.gstTotal;
    next.grand_total = summary.grandTotal;
    setActiveQuote(next);
  };

  const addItemToSection = (secIdx: number) => {
    if (!activeQuote) return;
    const next = { ...activeQuote };
    const sections = [...(next.sections || [])];
    const sec = { ...sections[secIdx] };
    const newItem = {
      id: `new_${Date.now()}`,
      description: 'New Item',
      specification: '',
      pack: '',
      quantity: 1,
      unit: 'Nos',
      unit_rate: 0,
      gst_rate: 18,
      taxable_amount: 0,
      tax_amount: 0,
      line_total: 0,
    };
    sec.items = [...(sec.items || []), newItem];
    sections[secIdx] = sec;
    next.sections = sections;
    setActiveQuote(next);
  };

  const removeItemFromSection = (secIdx: number, itemIdx: number) => {
    if (!activeQuote) return;
    const next = { ...activeQuote };
    const sections = [...(next.sections || [])];
    const sec = { ...sections[secIdx] };
    sec.items = (sec.items || []).filter((_: any, idx: number) => idx !== itemIdx);
    sections[secIdx] = sec;
    next.sections = sections;
    const summary = calculateQuotationSummary(
      sections.flatMap((s: any) =>
        s.items.map((i: any) => ({
          quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
          unitRate: Number(i.unit_rate ?? 0),
          gstRate: Number(i.gst_rate ?? 18),
          taxableAmount: Number(i.taxable_amount || 0),
          gstAmount: Number(i.tax_amount || 0),
        }))
      ),
      '33',
      '33',
      (next.tax_type || 'exclusive') as 'exclusive' | 'inclusive'
    );
    next.subtotal = summary.subtotal;
    next.total_tax = summary.gstTotal;
    next.grand_total = summary.grandTotal;
    setActiveQuote(next);
  };

  const handleSaveQuotationChanges = async () => {
    if (!activeQuote) return;
    setQuoteError('');
    setQuoteSaving(true);
    try {
      const res = await fetch('/api/admin/quotations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeQuote.id,
          quote_number: activeQuote.quote_number,
          customer_name: activeQuote.customer_name,
          customer_address: activeQuote.customer_address,
          customer_gstin: activeQuote.customer_gstin,
          store_name: activeQuote.store_name,
          store_code: activeQuote.store_code,
          quote_date: activeQuote.quote_date,
          validity_date: activeQuote.validity_date,
          reference_no: activeQuote.reference_no,
          tax_type: activeQuote.tax_type,
          status: activeQuote.status,
          notes: activeQuote.notes,
          terms_and_conditions: activeQuote.terms_and_conditions,
          created_by_id: activeQuote.created_by_id,
          created_by: activeQuote.created_by,
          sections: activeQuote.sections,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save quotation changes.');
      setActiveQuote(null);
      await loadAllData(true);
      showToast(`Quotation ${activeQuote.quote_number} saved and synced with Rate Library.`);
    } catch (err: any) {
      setQuoteError(err.message || 'Failed to save quotation.');
    } finally {
      setQuoteSaving(false);
    }
  };

  const selectedEmployeeObj = useMemo(
    () => employees.find((e) => e.id === selectedEmpId) || null,
    [employees, selectedEmpId]
  );

  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (emp) =>
        emp.name?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.contact?.toLowerCase().includes(q)
    );
  }, [employees, searchTerm]);

  const filteredQuotations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return quotations.filter((quote) => {
      if (selectedEmpId !== 'ALL') {
        const emp = employees.find((e) => e.id === selectedEmpId);
        const matchesId =
          quote.created_by_id === selectedEmpId ||
          quote.employee?.id === selectedEmpId;
        const matchesNameEmail =
          emp &&
          (quote.created_by?.toLowerCase() === emp.name?.toLowerCase() ||
            quote.created_by?.toLowerCase() === emp.email?.toLowerCase());
        if (!matchesId && !matchesNameEmail) return false;
      }
      if (statusFilter !== 'all' && quote.status !== statusFilter) return false;
      if (q) {
        return (
          quote.quote_number?.toLowerCase().includes(q) ||
          quote.customer_name?.toLowerCase().includes(q) ||
          quote.store_name?.toLowerCase().includes(q) ||
          quote.store_code?.toLowerCase().includes(q) ||
          quote.created_by?.toLowerCase().includes(q) ||
          quote.reference_no?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [quotations, selectedEmpId, employees, statusFilter, searchTerm]);

  const totalPipelineValue = useMemo(
    () => filteredQuotations.reduce((sum, q) => sum + Number(q.grand_total || 0), 0),
    [filteredQuotations]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex bg-slate-50">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <AppHeader />
          <main className="flex-1 flex items-center justify-center p-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </main>
        </div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex bg-slate-50">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Administrator Access Only</h1>
              <p className="text-sm text-slate-600">
                Only Master Administrator (<strong>jeevanpranavagencies@gmail.com</strong>) can access Employee Editing &amp; Full Quotation Vision.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          {/* Top Navigation & Control Header */}
          <div className="rounded-3xl bg-white/90 backdrop-blur-md p-5 sm:p-6 border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-200/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs transition-all active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Administrator Portal</span>
                </Link>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Admin Gmail Backend Active</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight pt-1">
                Employee Editing &amp; Full Quotation Vision
              </h1>
              <p className="text-sm text-slate-600">
                Control registered employee credentials, view every quotation with employee attribution, and edit top-to-bottom quotation details smoothly.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setAddError('');
                  setAddModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Employee</span>
              </button>

              <button
                type="button"
                onClick={() => loadAllData(false)}
                disabled={loadingData}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Feedback Banners */}
          {actionMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Search & Status Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/85 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by employee name, Gmail, phone, Quote #, customer, store, or reference..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
              {(['all', 'approved', 'draft'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Master-Detail Two-Pane Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT PANE: Registered Employees Directory with Smooth 1-Click Selection & Edit */}
            <div className="lg:col-span-4 rounded-3xl bg-white/90 backdrop-blur-md border border-white/80 shadow-sm ring-1 ring-slate-200/70 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Registered Employees ({employees.length})</span>
                </h2>
              </div>

              {/* All Employees Overview Card */}
              <button
                type="button"
                onClick={() => setSelectedEmpId('ALL')}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] flex items-center justify-between ${
                  selectedEmpId === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-slate-50/90 hover:bg-blue-50/60 text-slate-800 border-slate-200/80'
                }`}
              >
                <div>
                  <div className="font-bold text-sm">All Quotations (Entire Team)</div>
                  <div className={`text-xs mt-0.5 ${selectedEmpId === 'ALL' ? 'text-blue-100' : 'text-slate-500'}`}>
                    {quotations.length} total quotations across all staff &amp; Admin
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                  selectedEmpId === 'ALL' ? 'bg-white/20 text-white' : 'bg-white text-blue-700 border border-blue-200'
                }`}>
                  {quotations.length}
                </span>
              </button>

              {/* Individual Employee Cards */}
              <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
                {loadingData && employees.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span>Loading employees...</span>
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl">
                    No employees match your search.
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = selectedEmpId === emp.id;
                    const qCount = emp.metrics?.quoteCount || 0;
                    const qVal = emp.metrics?.totalValue || 0;

                    return (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedEmpId(emp.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setSelectedEmpId(emp.id);
                        }}
                        className={`group p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] space-y-2 ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                              {emp.avatar_url ? (
                                <img src={emp.avatar_url} alt={emp.name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{emp.name ? emp.name.charAt(0).toUpperCase() : 'E'}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-sm truncate">{emp.name}</div>
                              <div className="text-xs text-slate-500 truncate">{emp.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditEmployee(emp);
                              }}
                              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-2xs"
                              title={`Edit ${emp.name}`}
                              aria-label={`Edit ${emp.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEmployee(emp);
                              }}
                              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-600 text-slate-500 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-2xs"
                              title={`Delete ${emp.name}`}
                              aria-label={`Delete ${emp.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="text-slate-600 font-medium flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {emp.contact || '—'}
                          </span>
                          <span className="font-bold text-blue-700">
                            {qCount} {qCount === 1 ? 'Quote' : 'Quotes'} • {formatINR(qVal)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT PANE: Selected Employee Details + Proper Quotation Vision */}
            <div className="lg:col-span-8 space-y-5">
              {/* Selected Employee Control Strip */}
              {selectedEmployeeObj && (
                <div className="rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900 truncate">{selectedEmployeeObj.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        selectedEmployeeObj.role === 'staff'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {selectedEmployeeObj.role === 'staff' ? 'Employee' : 'Admin'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {selectedEmployeeObj.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {selectedEmployeeObj.contact || 'No phone'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        Sign-In: {formatDateTime(selectedEmployeeObj.last_sign_in_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditEmployee(selectedEmployeeObj)}
                      className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer active:scale-90"
                      title={`Edit ${selectedEmployeeObj.name}`}
                      aria-label={`Edit ${selectedEmployeeObj.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEmployee(selectedEmployeeObj)}
                      className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-2xs"
                      title={`Delete ${selectedEmployeeObj.name}`}
                      aria-label={`Delete ${selectedEmployeeObj.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Proper Quotations Vision Table */}
              <div className="rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span>
                        {selectedEmployeeObj
                          ? `${selectedEmployeeObj.name}'s Proper Quotations (${filteredQuotations.length})`
                          : `All Proper Quotations (${filteredQuotations.length})`}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Click any quotation to inspect and edit top-to-bottom details, items, rates, status, or assigned employee.
                    </p>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold">
                    Pipeline: {formatINR(totalPipelineValue)}
                  </div>
                </div>

                {loadingData && quotations.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
                    <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                    <span className="text-sm">Loading quotations...</span>
                  </div>
                ) : filteredQuotations.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-2">
                    <FileText className="w-9 h-9 text-slate-300 mx-auto" />
                    <div className="font-bold text-slate-700 text-sm">No Quotations Found</div>
                    <p className="text-xs text-slate-500">
                      Try clearing your search filter or selecting &quot;All Quotations&quot;.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredQuotations.map((q) => (
                      <div
                        key={q.id}
                        onClick={() => openQuoteVision(q)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') openQuoteVision(q);
                        }}
                        className="p-4 sm:p-5 hover:bg-blue-50/40 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-blue-700 text-sm font-calibri">{q.quote_number}</span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold">
                              <User className="w-3 h-3" />
                              {q.created_by || 'Administrator'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleQuickToggleStatus(q, e)}
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase cursor-pointer transition-all active:scale-95 border ${
                                q.status === 'approved'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              }`}
                              title="Click to toggle Draft / Approved"
                            >
                              {q.status}
                            </button>
                          </div>

                          <div className="font-bold text-slate-900 text-sm sm:text-base truncate">
                            {q.customer_name}
                            {q.store_name ? (
                              <span className="text-slate-500 font-normal text-xs ml-2">
                                ({q.store_name}{q.store_code ? ` • ${q.store_code}` : ''})
                              </span>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>Date: <strong className="text-slate-700">{q.quote_date}</strong></span>
                            <span>Valid Till: <strong className="text-slate-700">{q.validity_date}</strong></span>
                            <span>{q.section_count || 0} Sections • {q.item_count || 0} Items</span>
                            {q.reference_no && <span>Ref: {q.reference_no}</span>}
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                          <div className="text-left md:text-right">
                            <div className="text-base sm:text-lg font-extrabold text-slate-900 font-calibri">
                              {formatINR(q.grand_total)}
                            </div>
                            <div className="text-[11px] text-slate-500 uppercase">{q.tax_type} GST</div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openQuoteVision(q);
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Vision &amp; Edit</span>
                            </button>

                            <Link
                              href={`/quotations/${q.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all"
                              title="Open Print / Export View"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteQuotation(q, e)}
                              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 transition-all cursor-pointer"
                              title="Delete Quotation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* =========================================================================
          TOP-TO-BOTTOM QUOTATION VISION & FULL ADMIN CONTROL MODAL
          ========================================================================= */}
      {activeQuote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-slate-900/50 backdrop-blur-md overflow-y-auto mac-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveQuote(null);
          }}
        >
          <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-white/95 backdrop-blur-xl rounded-3xl mac-modal-content border border-white/80 shadow-[0_25px_70px_rgba(15,23,42,0.3)] overflow-hidden my-auto ring-1 ring-slate-900/5">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-200/80 bg-slate-50/90 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold shadow-xs">
                    ADMIN FULL CONTROL
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                    {activeQuote.quote_number} — {activeQuote.customer_name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Created by <strong>{activeQuote.created_by}</strong> • Edit any top-to-bottom field, item, rate, or status below.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/quotations/${activeQuote.id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold transition-all shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Full Quote Builder</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveQuote(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Body: Top-to-Bottom Editable Quotation */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {quoteError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{quoteError}</span>
                </div>
              )}

              {/* 1. Top Metadata & Attribution */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Quote Number</label>
                  <input
                    type="text"
                    value={activeQuote.quote_number || ''}
                    onChange={(e) => setActiveQuote({ ...activeQuote, quote_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Employee Name (Owner)</label>
                  <select
                    value={activeQuote.created_by_id || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const found = employees.find((emp) => emp.id === val);
                      setActiveQuote({
                        ...activeQuote,
                        created_by_id: val,
                        created_by: found ? found.name : (val === 'usr_admin_1' ? 'N Jayakumar' : activeQuote.created_by),
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900"
                  >
                    <option value="usr_admin_1">N Jayakumar (Master Admin)</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Status</label>
                  <select
                    value={activeQuote.status || 'draft'}
                    onChange={(e) => setActiveQuote({ ...activeQuote, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900"
                  >
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tax Mode</label>
                  <select
                    value={activeQuote.tax_type || 'exclusive'}
                    onChange={(e) => setActiveQuote({ ...activeQuote, tax_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900"
                  >
                    <option value="exclusive">Exclusive (+ GST)</option>
                    <option value="inclusive">Inclusive (GST Included)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={activeQuote.customer_name || ''}
                    onChange={(e) => setActiveQuote({ ...activeQuote, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Store / Branch Name</label>
                  <input
                    type="text"
                    value={activeQuote.store_name || ''}
                    onChange={(e) => setActiveQuote({ ...activeQuote, store_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Store Code</label>
                  <input
                    type="text"
                    value={activeQuote.store_code || ''}
                    onChange={(e) => setActiveQuote({ ...activeQuote, store_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Reference No.</label>
                  <input
                    type="text"
                    value={activeQuote.reference_no || ''}
                    onChange={(e) => setActiveQuote({ ...activeQuote, reference_no: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Quote Date</label>
                  <input
                    type="date"
                    value={activeQuote.quote_date || ''}
                    onChange={(e) => setActiveQuote({ ...activeQuote, quote_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Validity Date</label>
                  <input
                    type="date"
                    value={activeQuote.validity_date || ''}
                    onChange={(e) => setActiveQuote({ ...activeQuote, validity_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Customer GSTIN</label>
                  <input
                    type="text"
                    value={activeQuote.customer_gstin || ''}
                    onChange={(e) => setActiveQuote({ ...activeQuote, customer_gstin: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Customer Address</label>
                  <input
                    type="text"
                    value={activeQuote.customer_address || ''}
                    onChange={(e) => setActiveQuote({ ...activeQuote, customer_address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
                  />
                </div>
              </div>

              {/* 2. Sections & Line Items */}
              <div className="space-y-4">
                {(activeQuote.sections || []).map((sec: any, sIdx: number) => (
                  <div key={sec.id || sIdx} className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                    <div className="px-4 py-3 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-3">
                      <input
                        type="text"
                        value={sec.name || ''}
                        onChange={(e) => {
                          const sections = [...activeQuote.sections];
                          sections[sIdx] = { ...sections[sIdx], name: e.target.value };
                          setActiveQuote({ ...activeQuote, sections });
                        }}
                        className="font-bold text-sm text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => addItemToSection(sIdx)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Row</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase">
                          <tr>
                            <th className="px-3 py-2.5">Particulars</th>
                            <th className="px-2 py-2.5 w-28">Spec</th>
                            <th className="px-2 py-2.5 w-24">Pack</th>
                            <th className="px-2 py-2.5 w-20">Qty</th>
                            <th className="px-2 py-2.5 w-20">Unit</th>
                            <th className="px-2 py-2.5 w-28">Rate (₹)</th>
                            <th className="px-2 py-2.5 w-20">GST %</th>
                            <th className="px-3 py-2.5 text-right w-28">Line Total</th>
                            <th className="px-2 py-2.5 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(sec.items || []).map((itm: any, iIdx: number) => (
                            <tr key={itm.id || iIdx} className="hover:bg-slate-50/70">
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={itm.description || ''}
                                  onChange={(e) => updateQuoteItem(sIdx, iIdx, 'description', e.target.value)}
                                  className="w-full min-w-[180px] px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={itm.specification || ''}
                                  onChange={(e) => updateQuoteItem(sIdx, iIdx, 'specification', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={itm.pack || ''}
                                  onChange={(e) => updateQuoteItem(sIdx, iIdx, 'pack', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  value={itm.quantity}
                                  onChange={(e) => updateQuoteItem(sIdx, iIdx, 'quantity', Number(e.target.value))}
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={itm.unit || ''}
                                  onChange={(e) => updateQuoteItem(sIdx, iIdx, 'unit', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={itm.unit_rate}
                                  onChange={(e) => updateQuoteItem(sIdx, iIdx, 'unit_rate', Number(e.target.value))}
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-blue-700"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={itm.gst_rate}
                                  onChange={(e) => updateQuoteItem(sIdx, iIdx, 'gst_rate', Number(e.target.value))}
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">
                                {formatINR(itm.line_total || 0)}
                              </td>
                              <td className="px-2 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItemFromSection(sIdx, iIdx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Remove Row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              {/* 3. Notes, Terms & Financial Totals */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={activeQuote.notes || ''}
                    onChange={(e) => setActiveQuote({ ...activeQuote, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Terms &amp; Conditions</label>
                  <textarea
                    rows={3}
                    value={activeQuote.terms_and_conditions || ''}
                    onChange={(e) => setActiveQuote({ ...activeQuote, terms_and_conditions: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                  />
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 flex flex-col justify-center">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-bold">{formatINR(activeQuote.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Total GST</span>
                    <span className="font-bold">{formatINR(activeQuote.total_tax || 0)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Grand Total</span>
                    <span className="text-blue-700">{formatINR(activeQuote.grand_total || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDeleteQuotation(activeQuote)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Quotation</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveQuote(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuotationChanges}
                  disabled={quoteSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {quoteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Top-to-Bottom Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT EMPLOYEE MODAL (ADMIN ONLY)
          ========================================================================= */}
      {editEmp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md overflow-y-auto mac-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditEmp(null);
          }}
        >
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl mac-modal-content border border-white/80 shadow-[0_25px_70px_rgba(15,23,42,0.3)] overflow-hidden my-auto ring-1 ring-slate-900/5">
            <div className="p-5 border-b border-slate-200/80 bg-slate-50/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Registered Employee</h3>
                  <p className="text-xs text-slate-500">Update Name, Phnumber, Gmail, Password or Role</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditEmp(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployeeEdit} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Gmail / Email *</label>
                <input
                  type="email"
                  required
                  value={editGmail}
                  onChange={(e) => setEditGmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  New Password (leave blank to keep current)
                </label>
                <div className="relative">
                  <input
                    type={showEditPwd ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Optional: minimum 6 characters"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showEditPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Portal Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value === 'admin' ? 'admin' : 'staff')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900"
                >
                  <option value="staff">Employee (Staff)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const empToDelete = editEmp;
                    handleDeleteEmployee(empToDelete);
                  }}
                  className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-2xs"
                  title={`Delete ${editEmp.name}`}
                  aria-label="Delete Employee"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditEmp(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                  >
                    {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD EMPLOYEE MODAL
          ========================================================================= */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md overflow-y-auto mac-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
        >
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl mac-modal-content border border-white/80 shadow-[0_25px_70px_rgba(15,23,42,0.3)] overflow-hidden my-auto ring-1 ring-slate-900/5">
            <div className="p-5 border-b border-slate-200/80 bg-slate-50/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Employee</h3>
                  <p className="text-xs text-slate-500">Required: Name, Phnumber, Gmail, Password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-5 space-y-4">
              {addError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. R Senthil Kumar"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Phnumber *</label>
                <input
                  type="tel"
                  required
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Gmail *</label>
                <input
                  type="email"
                  required
                  value={addGmail}
                  onChange={(e) => setAddGmail(e.target.value)}
                  placeholder="employee@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showAddPwd ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showAddPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Role</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value === 'admin' ? 'admin' : 'staff')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900"
                >
                  <option value="staff">Employee (Staff)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>Create Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
