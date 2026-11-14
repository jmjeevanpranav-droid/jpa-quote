'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';
import { getActiveTabSession, setActiveTabSession } from '@/lib/auth/client-context';
import { ProfilePhotoSetterModal } from '@/components/ProfilePhotoSetterModal';
import {
  Building2,
  Lock,
  Pencil,
  Save,
  CheckCircle2,
  Loader2,
  CreditCard,
  UserCheck,
  Globe,
  Mail,
  Phone,
  MapPin,
  Users,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  FilePlus2,
  UserCog,
  RefreshCw,
  FileText,
  Activity,
  Clock,
  ArrowUpRight,
  TrendingUp,
  X,
  ExternalLink,
  KeyRound,
  Database,
  Check,
  Camera,
  User,
  UserPlus,
  Eye,
  EyeOff,
  ChevronDown,
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

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>({
    id: 'cmp_jpa_master',
    name: 'Jeevan Pranav Agencies (JPA)',
    tagline: 'Industrial & Housekeeping Supplies',
    gstin: '33BRGPM1867B1Z1',
    address: '16-P, Sakthi illam, Gandhi nagar, Mettuthottam, Podanur, Coimbatore-641023.',
    phone: '9790600971',
    email: 'jeevanpranavagencies@gmail.com',
    website: 'https://www.jeevanpranavagencies.com/',
    bank_name: 'HDFC Bank Ltd',
    account_no: '50200034981273',
    ifsc_code: 'HDFC0001867',
    branch: 'Podanur Branch, Coimbatore',
    signatory_name: 'Mr. N JAYAKUMAR',
    signatory_designation: 'Proprietor / Authorised Signatory',
    logo_url: '/jpa-header-logo.png',
  });

  const [editForm, setEditForm] = useState<any>({ ...profile });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [openSections, setOpenSections] = useState<{
    admin: boolean;
    employees: boolean;
    supplier: boolean;
  }>({
    admin: true,
    employees: true,
    supplier: true,
  });

  const toggleSection = (key: 'admin' | 'employees' | 'supplier') => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // User, Employee Directory and Progress Modal State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Selected Employee for Activity & Quotations Vision Modal
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const selectedEmployeeRef = React.useRef<any>(null);
  selectedEmployeeRef.current = selectedEmployee;
  const [modalTab, setModalTab] = useState<'quotes' | 'activity'>('quotes');

  // Profile Photo Setter Modal State (High-Resolution Manual Tracer)
  const [photoModalTarget, setPhotoModalTarget] = useState<{
    id?: string;
    name: string;
    role?: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [adminAvatarUrl, setAdminAvatarUrl] = useState<string | null>(null);

  // Password Reset Modal State
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Add Employee Modal State
  const [addEmployeeModalOpen, setAddEmployeeModalOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpGmail, setNewEmpGmail] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<'staff' | 'admin'>('staff');
  const [showNewEmpPassword, setShowNewEmpPassword] = useState(false);
  const [addEmployeeLoading, setAddEmployeeLoading] = useState(false);
  const [addEmployeeError, setAddEmployeeError] = useState('');

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddEmployeeError('');
    setAddEmployeeLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEmpName.trim(),
          contact: newEmpPhone.trim(),
          phnumber: newEmpPhone.trim(),
          email: newEmpGmail.trim(),
          gmail: newEmpGmail.trim(),
          password: newEmpPassword,
          role: newEmpRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add employee account.');
      }

      setAddEmployeeModalOpen(false);
      const addedName = newEmpName.trim();
      setNewEmpName('');
      setNewEmpPhone('');
      setNewEmpGmail('');
      setNewEmpPassword('');
      setNewEmpRole('staff');

      await loadEmployees(false);
      setActionMsg(`Employee "${addedName}" added successfully! They can log in immediately using either their Gmail or Phone Number.`);
      setTimeout(() => setActionMsg(''), 5000);
    } catch (err: any) {
      setAddEmployeeError(err.message || 'Failed to add employee. Please check details.');
    } finally {
      setAddEmployeeLoading(false);
    }
  };

  // Edit Employee Modal State (Admin Only)
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpPhone, setEditEmpPhone] = useState('');
  const [editEmpGmail, setEditEmpGmail] = useState('');
  const [editEmpPassword, setEditEmpPassword] = useState('');
  const [editEmpRole, setEditEmpRole] = useState<'staff' | 'admin'>('staff');
  const [showEditEmpPassword, setShowEditEmpPassword] = useState(false);
  const [editEmployeeLoading, setEditEmployeeLoading] = useState(false);
  const [editEmployeeError, setEditEmployeeError] = useState('');

  const openEditEmployeeModal = (emp: any) => {
    setEditingEmployee(emp);
    setEditEmpName(emp.name || '');
    setEditEmpPhone(emp.contact || '');
    setEditEmpGmail(emp.email || '');
    setEditEmpPassword('');
    setEditEmpRole(emp.role === 'admin' ? 'admin' : 'staff');
    setShowEditEmpPassword(false);
    setEditEmployeeError('');
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setEditEmployeeError('');
    setEditEmployeeLoading(true);
    try {
      const payload: any = {
        userId: editingEmployee.id,
        name: editEmpName.trim(),
        contact: editEmpPhone.trim(),
        email: editEmpGmail.trim(),
        role: editEmpRole,
      };
      if (editEmpPassword.trim().length > 0) {
        payload.password = editEmpPassword;
      }
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update employee.');
      const savedName = editEmpName.trim();
      setEditingEmployee(null);
      await loadEmployees(false);
      setActionMsg(`Employee "${savedName}" updated successfully!`);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err: any) {
      setEditEmployeeError(err.message || 'Failed to update employee.');
    } finally {
      setEditEmployeeLoading(false);
    }
  };

  // Sync Verification State
  const [syncStatus, setSyncStatus] = useState<any | null>(null);
  const [loadingSync, setLoadingSync] = useState(false);

  const loadSyncStatus = useCallback(async (isBackground: boolean = false) => {
    if (!isBackground) setLoadingSync(true);
    try {
      const res = await fetch('/api/admin/sync-status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
      }
    } catch (e) {
      console.error('Failed to verify rate and quotation synchronization:', e);
    } finally {
      if (!isBackground) setLoadingSync(false);
    }
  }, []);

  const loadEmployees = useCallback(async (isBackground: boolean = false) => {
    if (!isBackground) setLoadingEmployees(true);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await res.json();
      if (data.users) {
        setEmployees(data.users);
        if (selectedEmployeeRef.current) {
          const currentId = selectedEmployeeRef.current.id;
          const currentEmail = selectedEmployeeRef.current.email;
          const updated = data.users.find(
            (u: any) => u.id === currentId || (currentEmail && u.email.toLowerCase() === currentEmail.toLowerCase())
          );
          if (updated) setSelectedEmployee(updated);
        }
      }
    } catch (e) {
      console.error('Failed to load employees:', e);
    } finally {
      if (!isBackground) setLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    // 1. Verify Authentication & Role
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
          if (data.user.avatarUrl || data.user.picture) {
            setAdminAvatarUrl(data.user.avatarUrl || data.user.picture);
          }
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setAuthLoading(false));

    // Fast-boot admin avatar from active tab session
    try {
      const activeSession = getActiveTabSession();
      if (activeSession?.user?.avatarUrl || activeSession?.user?.picture) {
        setAdminAvatarUrl(activeSession.user.avatarUrl || activeSession.user.picture || null);
      }
    } catch {}

    const handleSessionChange = () => {
      try {
        const active = getActiveTabSession();
        if (active?.user) {
          if (active.user.avatarUrl || active.user.picture) {
            setAdminAvatarUrl(active.user.avatarUrl || active.user.picture || null);
          }
        }
      } catch {}
    };

    window.addEventListener('jpa:session-changed', handleSessionChange);

    // 2. Load Company Profile
    fetch('/api/company', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
          setEditForm(data.profile);
        }
      })
      .catch((e) => console.error('Failed to load company profile:', e))
      .finally(() => setLoading(false));

    return () => {
      window.removeEventListener('jpa:session-changed', handleSessionChange);
    };
  }, []);

  // Real-time synchronization polling & auto-revalidation on tab focus for multi-user sync
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return;

    loadEmployees(false);
    loadSyncStatus(false);

    // Periodic polling every 15s when visible for smooth zero-lag navigation
    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadEmployees(true);
        loadSyncStatus(true);
      }
    }, 15000);

    const handleTabActive = () => {
      if (document.visibilityState === 'visible') {
        loadEmployees(true);
        loadSyncStatus(true);
      }
    };

    window.addEventListener('focus', handleTabActive);
    document.addEventListener('visibilitychange', handleTabActive);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleTabActive);
      document.removeEventListener('visibilitychange', handleTabActive);
    };
  }, [currentUser, loadEmployees, loadSyncStatus]);

  // Global Escape key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEmployee(null);
        setPasswordModalOpen(false);
        setPhotoModalTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRoleToggle = async (userId: string, currentRole: string) => {
    const nextRole = currentRole === 'admin' ? 'staff' : 'admin';
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: nextRole }),
      });
      if (res.ok) {
        setActionMsg(`User role successfully updated to ${nextRole === 'admin' ? 'Administrator' : 'Employee'}`);
        setTimeout(() => setActionMsg(''), 3000);
        loadEmployees();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteEmployee = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the employee account for "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setActionMsg(`Employee "${name}" has been removed`);
        setTimeout(() => setActionMsg(''), 3000);
        if (selectedEmployee?.id === userId) {
          setSelectedEmployee(null);
        }
        loadEmployees();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || 'Error updating administrator password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleStartEdit = () => {
    setEditForm({ ...profile });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditForm({ ...profile });
    setIsEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        throw new Error('Failed to update company profile');
      }

      setProfile({ ...editForm });
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Failed to save profile. Please ensure you are logged in as administrator.');
    } finally {
      setSaving(false);
    }
  };

  const totalStaffCount = employees.length;
  const totalStaffQuotes = employees.reduce((sum, e) => sum + (e.metrics?.quoteCount || 0), 0);
  const totalStaffPipeline = employees.reduce((sum, e) => sum + (e.metrics?.totalValue || 0), 0);

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-slate-50 via-slate-100/70 to-blue-50/20 overflow-hidden font-sans">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AppHeader
          title="Administrator Portal & Settings"
          subtitle="Vision employee sign-ins, activities and quotations with verified rate synchronization"
        />

        <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
          {/* Employee Restricted View Banner */}
          {!authLoading && currentUser && currentUser.role === 'staff' ? (
            <div className="p-8 max-w-2xl mx-auto my-12 bg-white rounded-3xl border border-slate-200 shadow-md text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Administrator Portal — Access Restricted
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                You are currently signed in as an Employee. You have full access to write, generate, and view your quotations, but system settings, company profile, and employee directory are reserved exclusively for Administrator <strong className="text-slate-900">N Jayakumar</strong>.
              </p>
              <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/quotations/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span>Write New Quotation</span>
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all active:scale-95 shadow-2xs"
                >
                  <span>Return to Dashboard</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Notification Message */}
              {actionMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11pt] flex items-center gap-3 shadow-2xs animate-in fade-in duration-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{actionMsg}</span>
                </div>
              )}

              {/* =========================================================================
                  1. ADMINISTRATOR PROFILE & VERIFIED RATE SYNCHRONIZATION STATUS (WHITE GLASSMORPHISM)
                  ========================================================================= */}
              <div className="rounded-3xl bg-white/90 backdrop-blur-md p-7 sm:p-9 border border-white/80 shadow-[0_12px_40px_rgb(0,0,0,0.05)] ring-1 ring-slate-200/70 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-slate-100/90 pb-6">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        setPhotoModalTarget({
                          id: currentUser?.userId || currentUser?.id || 'usr_admin_1',
                          name: 'N Jayakumar',
                          role: 'Administrator (Proprietor)',
                          avatarUrl: adminAvatarUrl || currentUser?.avatarUrl || currentUser?.picture || null,
                        })
                      }
                      className="group relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-xs shrink-0 ring-4 ring-white hover:ring-blue-400 transition-all cursor-pointer overflow-hidden"
                      title="Click to set or change administrator profile photo"
                    >
                      {adminAvatarUrl || currentUser?.avatarUrl || currentUser?.picture ? (
                        <img
                          src={adminAvatarUrl || currentUser?.avatarUrl || currentUser?.picture}
                          alt="N Jayakumar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>NJ</span>
                      )}
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </button>
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-wide">N Jayakumar</h2>
                        <span className="text-[11pt] font-bold px-3 py-1 rounded-full bg-blue-100/90 text-blue-800 uppercase tracking-wide">
                          Administrator (Proprietor)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPhotoModalTarget({
                              id: currentUser?.userId || currentUser?.id || 'usr_admin_1',
                              name: 'N Jayakumar',
                              role: 'Administrator (Proprietor)',
                              avatarUrl: adminAvatarUrl || currentUser?.avatarUrl || currentUser?.picture || null,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/80 text-[10.5pt] font-semibold transition-colors cursor-pointer shadow-2xs"
                          title="Set high-quality photo with manual tracing tool"
                        >
                          <Camera className="w-3.5 h-3.5 text-blue-600" />
                          <span>Change Photo</span>
                        </button>
                      </div>
                      <p className="text-[11.5pt] text-slate-600 mt-1 tracking-wide">
                        Primary Administrator for Jeevan Pranav Agencies Quote Builder
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-800 text-[11pt] font-semibold tracking-wide shadow-2xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Master Security Active</span>
                    </span>
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50/90 border border-blue-200/80 text-blue-800 text-[11pt] font-semibold tracking-wide shadow-2xs">
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                      <span>Rates Synced with Employee Portal</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleSection('admin')}
                      aria-expanded={openSections.admin}
                      title={openSections.admin ? 'Collapse section' : 'Expand section'}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100/90 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/80 text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      <span>{openSections.admin ? 'Hide' : 'Show'}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openSections.admin ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {openSections.admin && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 animate-in fade-in duration-150">
                  {/* Card 1: Administrator Email */}
                  <div className="p-5 rounded-2xl bg-slate-50/80 backdrop-blur-xs border border-slate-200/70 space-y-1.5 min-w-0">
                    <span className="text-slate-500 block font-bold text-[11pt] uppercase tracking-wide">Administrator Email</span>
                    <span className="font-bold text-slate-900 font-calibri text-[11pt] block truncate break-all tracking-wide" title="jeevanpranavagencies@gmail.com">
                      jeevanpranavagencies@gmail.com
                    </span>
                    <span className="text-[10.5pt] text-slate-500 block tracking-wide">Master login account</span>
                  </div>

                  {/* Card 2: Password Security & Server-Side Hash */}
                  <div className="p-5 rounded-2xl bg-slate-50/80 backdrop-blur-xs border border-slate-200/70 flex flex-col justify-between">
                    <div>
                      <span className="text-slate-500 block font-bold text-[11pt] uppercase tracking-wide">Account Password Security</span>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Lock className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-slate-900 font-calibri text-[11pt] tracking-wide">Bcrypt Hashed</span>
                      </div>
                      <span className="text-[10.5pt] text-slate-500 block mt-1 tracking-wide">Protected with salt rounds; never stored in plaintext</span>
                    </div>
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordError('');
                          setPasswordSuccess(false);
                          setPasswordModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold font-calibri text-[11pt] shadow-2xs transition-all cursor-pointer active:scale-95 tracking-wide"
                      >
                        <KeyRound className="w-4 h-4 text-blue-600" />
                        <span>Change Password</span>
                      </button>
                    </div>
                  </div>

                  {/* Card 3: Verified Data Synchronization */}
                  <div className="p-5 rounded-2xl bg-slate-50/80 backdrop-blur-xs border border-slate-200/70 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 block font-bold text-[11pt] uppercase tracking-wide">Rate & Quote Synchronization</span>
                        <button
                          type="button"
                          onClick={() => loadSyncStatus(false)}
                          disabled={loadingSync}
                          className="text-blue-600 hover:text-blue-800 text-[11pt] font-bold font-calibri flex items-center gap-1.5 cursor-pointer disabled:opacity-50 tracking-wide"
                          title="Verify data parity"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loadingSync ? 'animate-spin' : ''}`} />
                          <span>Verify</span>
                        </button>
                      </div>
                      <div className="mt-1.5">
                        <span className="font-bold text-emerald-700 flex items-center gap-1.5 font-calibri text-[11pt] tracking-wide">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{syncStatus?.databaseStatus || 'Active & Verified'}</span>
                        </span>
                        <div className="text-[11pt] text-slate-600 mt-1.5 font-calibri tracking-wide">
                          Products: <strong>{syncStatus?.catalog?.totalProducts ?? '...'}</strong> • Quotes: <strong>{syncStatus?.quotations?.totalQuotations ?? '...'}</strong> • Rates: <strong>{syncStatus?.rates?.totalRateChanges ?? '...'}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="text-[10.5pt] text-slate-400 mt-2 tracking-wide font-calibri">
                      Verified at: {syncStatus?.verifiedAt ? formatDateTime(syncStatus.verifiedAt) : 'Ready for verification'}
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* =========================================================================
                  2. VISION NEW SIGN-INS & REGISTERED EMPLOYEES DIRECTORY (Moved to dedicated /settings/employees page)
                  ========================================================================= */}
              {false && (
              <div className="relative overflow-hidden rounded-3xl bg-white/90 backdrop-blur-md p-5 sm:p-7 md:p-9 border border-white/80 shadow-[0_12px_40px_rgb(0,0,0,0.05)] ring-1 ring-slate-200/70 space-y-7">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-200/60 shadow-2xs shrink-0">
                        <Users className="w-6 h-6" />
                      </div>
                      <a
                        href="/settings/employees"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/emp-title inline-flex items-center gap-2 text-xl sm:text-2xl font-bold text-slate-900 hover:text-blue-700 tracking-wide transition-colors"
                        title="Open Registered Employees & Full Details in New Tab"
                      >
                        <span>Registered Employees & Recent Sign-Ins</span>
                        <ExternalLink className="w-4 h-4 text-blue-600 opacity-70 group-hover/emp-title:opacity-100 transition-opacity" />
                      </a>
                    </div>
                    <p className="text-[11pt] sm:text-[11.5pt] text-slate-600 mt-1.5 tracking-wide">
                      Monitor employee credentials, real-time sign-in timestamps, last recorded activities, and quotation progress.
                    </p>
                  </div>

                  {/* Header Actions: Summary Pills + Add Employee Button + Refresh */}
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                    <div className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-slate-100/80 backdrop-blur-xs border border-white text-slate-700 text-[10.5pt] sm:text-[11pt] font-semibold flex items-center gap-2 shadow-2xs tracking-wide whitespace-nowrap">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{totalStaffCount} {totalStaffCount === 1 ? 'Registered Staff' : 'Registered Staff'}</span>
                    </div>
                    <div className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-blue-50/90 backdrop-blur-xs border border-blue-100 text-blue-800 text-[10.5pt] sm:text-[11pt] font-semibold shadow-2xs tracking-wide whitespace-nowrap">
                      <span>{totalStaffQuotes} {totalStaffQuotes === 1 ? 'Quote' : 'Quotes'} (₹{Number(totalStaffPipeline).toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span>
                    </div>

                    {/* NEW: Dedicated Employee & Quotation Vision Page Link (Opens in New Tab) */}
                    <a
                      href="/settings/employees"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5pt] sm:text-[11pt] shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-95 tracking-wide whitespace-nowrap"
                      title="Open Dedicated Employee Portal & Full Quotation Vision in New Tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open Employees Tab</span>
                    </a>

                    {/* NEW: Add Employee Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setAddEmployeeError('');
                        setAddEmployeeModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10.5pt] sm:text-[11pt] shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-95 tracking-wide whitespace-nowrap"
                      title="Add New Employee (Name, Phnumber, Gmail, Password)"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Add Employee</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => loadEmployees(false)}
                      disabled={loadingEmployees}
                      className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl bg-white/95 hover:bg-white border border-slate-200/80 text-slate-700 font-bold text-[10.5pt] sm:text-[11pt] shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 tracking-wide whitespace-nowrap"
                      title="Refresh employee sign-in list"
                    >
                      <RefreshCw className={`w-4 h-4 text-slate-500 ${loadingEmployees ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleSection('employees')}
                      aria-expanded={openSections.employees}
                      title={openSections.employees ? 'Collapse section' : 'Expand section'}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100/90 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/80 text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openSections.employees ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {openSections.employees && (
                <>

                {loadingEmployees && employees.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                    <span className="text-[11pt] text-slate-500 tracking-wide">Loading registered employee sign-ins...</span>
                  </div>
                ) : employees.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-[11pt] border border-dashed border-slate-200 rounded-3xl bg-white/50 backdrop-blur-xs tracking-wide">
                    No additional employees registered yet. Click &quot;Add Employee&quot; above to create employee credentials, or staff can register on the sign-in page.
                  </div>
                ) : (
                  <>
                    {/* =========================================================================
                        DESKTOP TABLE VIEW (Fluid Proportional Widths, Zero Horizontal Clipping)
                        ========================================================================= */}
                    <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-xs shadow-xs">
                      <table className="w-full min-w-[960px] text-left font-sans table-auto">
                        <thead className="bg-slate-100/90 backdrop-blur-xs text-slate-700 border-b border-slate-200/80 text-[11pt] font-bold tracking-[0.05em] uppercase">
                          <tr>
                            <th className="px-4 py-4 w-[24%]">Employee Name</th>
                            <th className="px-3.5 py-4 w-[13%]">Contact Number</th>
                            <th className="px-3.5 py-4 w-[20%]">Email Address</th>
                            <th className="px-3.5 py-4 w-[18%]">Sign-In Time (Last Active)</th>
                            <th className="px-3 py-4 w-[12%] text-center">Quotations</th>
                            <th className="px-3 py-4 w-[13%] text-center">Role</th>
                            <th className="px-4 py-4 w-[160px] text-right shrink-0">Vision & Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/90 text-[11.5pt] tracking-wide">
                          {employees.map((emp) => {
                            const isStaff = emp.role === 'staff';
                            const quoteCount = emp.metrics?.quoteCount || 0;
                            const totalValue = emp.metrics?.totalValue || 0;

                            return (
                              <tr key={emp.id} className="hover:bg-blue-50/40 backdrop-blur-xs transition-colors">
                                {/* Employee Name */}
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPhotoModalTarget({
                                          id: emp.id,
                                          name: emp.name,
                                          role: emp.role === 'staff' ? 'Employee' : 'Administrator',
                                          avatarUrl: emp.avatar_url || null,
                                        })
                                      }
                                      className="group relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white hover:ring-blue-400 transition-all cursor-pointer overflow-hidden"
                                      title={`Set or change profile photo for ${emp.name}`}
                                    >
                                      {emp.avatar_url ? (
                                        <img src={emp.avatar_url} alt={emp.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span>{emp.name ? emp.name.charAt(0).toUpperCase() : 'U'}</span>
                                      )}
                                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Camera className="w-3.5 h-3.5 text-white" />
                                      </div>
                                    </button>
                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-900 text-[12pt] tracking-wide truncate">{emp.name}</div>
                                      <div className="text-[10.5pt] text-slate-500 font-medium tracking-wide">ID: {emp.id.replace('usr_', '')}</div>
                                    </div>
                                  </div>
                                </td>

                                {/* Contact Number */}
                                <td className="px-3.5 py-4">
                                  {emp.contact ? (
                                    <div className="flex items-center gap-1.5 font-calibri text-slate-800 font-semibold text-[11pt] tracking-wide">
                                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>{emp.contact}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-normal font-calibri text-[11pt] tracking-wide">—</span>
                                  )}
                                </td>

                                {/* Email Address */}
                                <td className="px-3.5 py-4">
                                  <div className="flex items-center gap-1.5 font-calibri text-slate-800 text-[11pt] tracking-wide truncate" title={emp.email}>
                                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{emp.email}</span>
                                  </div>
                                </td>

                                {/* Sign-In Time (Last Active) */}
                                <td className="px-3.5 py-4">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 font-calibri text-slate-900 font-bold text-[11pt] tracking-wide">
                                      <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      <span>{formatDateTime(emp.last_sign_in_at)}</span>
                                    </div>
                                    {emp.last_active_at && emp.last_active_at !== emp.last_sign_in_at && (
                                      <div className="text-[11pt] text-slate-600 font-medium font-calibri tracking-wide flex items-center gap-1.5 pl-5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                                        <span>Active: {formatDateTime(emp.last_active_at)}</span>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Quotations Created */}
                                <td className="px-3 py-4 text-center">
                                  <div className="inline-flex flex-col items-center px-2.5 py-1 rounded-xl bg-blue-50/90 backdrop-blur-xs text-blue-900 border border-blue-200/80 shadow-2xs font-calibri">
                                    <span className="font-bold text-[11pt]">{quoteCount} {quoteCount === 1 ? 'Quote' : 'Quotes'}</span>
                                    <span className="text-[11pt] text-blue-700 font-semibold">₹{Number(totalValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                  </div>
                                </td>

                                {/* Role */}
                                <td className="px-3 py-4 text-center">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5pt] font-bold tracking-wide border shadow-2xs ${
                                      isStaff
                                        ? 'bg-emerald-50/95 text-emerald-800 border-emerald-200/90'
                                        : 'bg-blue-50/95 text-blue-800 border-blue-200/90'
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${isStaff ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                                    <span>{isStaff ? 'Employee' : 'Admin'}</span>
                                  </span>
                                </td>

                                {/* Vision & Actions */}
                                <td className="px-4 py-4 text-right shrink-0">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPhotoModalTarget({
                                          id: emp.id,
                                          name: emp.name,
                                          role: emp.role === 'staff' ? 'Employee' : 'Administrator',
                                          avatarUrl: emp.avatar_url || null,
                                        })
                                      }
                                      className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50/90 border border-transparent hover:border-blue-200 transition-colors cursor-pointer shrink-0"
                                      title={`Set or Change Profile Photo for ${emp.name}`}
                                    >
                                      <Camera className="w-4 h-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setSelectedEmployee(emp)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10.5pt] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer tracking-wide shrink-0"
                                      title={`Vision ${emp.name}'s quotations and activity`}
                                    >
                                      <TrendingUp className="w-3.5 h-3.5" />
                                      <span>Progress</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openEditEmployeeModal(emp)}
                                      className="p-1.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50/90 border border-transparent hover:border-blue-200 transition-colors cursor-pointer shrink-0"
                                      title={`Edit ${emp.name}'s details`}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleRoleToggle(emp.id, emp.role)}
                                      className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white/90 border border-transparent hover:border-slate-200 transition-colors cursor-pointer shrink-0"
                                      title={isStaff ? 'Promote to Administrator' : 'Demote to Employee'}
                                    >
                                      <UserCog className="w-4.5 h-4.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50/90 border border-transparent hover:border-rose-200 transition-colors cursor-pointer shrink-0"
                                      title="Delete Employee Account"
                                    >
                                      <Trash2 className="w-4.5 h-4.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* =========================================================================
                        MOBILE & TABLET RESPONSIVE CARDS VIEW (< lg screens, Fully Stacked & Visible)
                        ========================================================================= */}
                    <div className="block lg:hidden space-y-4">
                      {employees.map((emp) => {
                        const isStaff = emp.role === 'staff';
                        const quoteCount = emp.metrics?.quoteCount || 0;
                        const totalValue = emp.metrics?.totalValue || 0;

                        return (
                          <div
                            key={emp.id}
                            className="p-5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs space-y-4"
                          >
                            {/* Card Header: Avatar, Name, Employee ID, Role Badge */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPhotoModalTarget({
                                      id: emp.id,
                                      name: emp.name,
                                      role: emp.role === 'staff' ? 'Employee' : 'Administrator',
                                      avatarUrl: emp.avatar_url || null,
                                    })
                                  }
                                  className="group relative w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white hover:ring-blue-400 transition-all cursor-pointer overflow-hidden"
                                  title={`Set or change photo for ${emp.name}`}
                                >
                                  {emp.avatar_url ? (
                                    <img src={emp.avatar_url} alt={emp.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{emp.name ? emp.name.charAt(0).toUpperCase() : 'U'}</span>
                                  )}
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Camera className="w-4 h-4 text-white" />
                                  </div>
                                </button>
                                <div>
                                  <div className="font-bold text-slate-900 text-[12pt]">{emp.name}</div>
                                  <div className="text-[10.5pt] text-slate-500 font-medium">ID: {emp.id.replace('usr_', '')}</div>
                                </div>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5pt] font-bold border shadow-2xs shrink-0 ${
                                  isStaff
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full ${isStaff ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                                <span>{isStaff ? 'Employee' : 'Admin'}</span>
                              </span>
                            </div>

                            {/* Contact & Email */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11pt] font-calibri">
                              <div className="flex items-center gap-2 text-slate-700">
                                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                                <span>{emp.contact || 'No phone recorded'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-700 min-w-0" title={emp.email}>
                                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="truncate break-all">{emp.email}</span>
                              </div>
                            </div>

                            {/* Sign-In & Activity Status + Quotation Count */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/70 text-[11pt] font-calibri">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-slate-900 font-semibold text-[11pt]">
                                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                                  <span>Sign-In: {formatDateTime(emp.last_sign_in_at)}</span>
                                </div>
                                {emp.last_active_at && emp.last_active_at !== emp.last_sign_in_at && (
                                  <div className="text-[11pt] text-slate-600 font-medium flex items-center gap-2 pl-6">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                                    <span>Active: {formatDateTime(emp.last_active_at)}</span>
                                  </div>
                                )}
                              </div>

                              <div className="px-3.5 py-1.5 rounded-xl bg-blue-100/80 text-blue-950 font-bold text-center shrink-0 border border-blue-200/80 font-calibri">
                                <span>{quoteCount} {quoteCount === 1 ? 'Quote' : 'Quotes'}</span>
                                <span className="block text-[11pt] text-blue-800">₹{Number(totalValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                              </div>
                            </div>

                            {/* Action Buttons Row */}
                            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-2.5 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setSelectedEmployee(emp)}
                                className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-[10.5pt] sm:text-[11pt] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                              >
                                <TrendingUp className="w-4 h-4" />
                                <span>Vision Progress</span>
                              </button>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPhotoModalTarget({
                                      id: emp.id,
                                      name: emp.name,
                                      role: emp.role === 'staff' ? 'Employee' : 'Administrator',
                                      avatarUrl: emp.avatar_url || null,
                                    })
                                  }
                                  className="p-2 sm:p-2.5 rounded-xl text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 border border-slate-200 transition-colors cursor-pointer"
                                  title={`Set Profile Photo for ${emp.name}`}
                                >
                                  <Camera className="w-4.5 h-4.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openEditEmployeeModal(emp)}
                                  className="p-2 sm:p-2.5 rounded-xl text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 border border-slate-200 transition-colors cursor-pointer"
                                  title={`Edit ${emp.name}'s details`}
                                >
                                  <Pencil className="w-4.5 h-4.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRoleToggle(emp.id, emp.role)}
                                  className="p-2 sm:p-2.5 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                                  title={isStaff ? 'Promote to Administrator' : 'Demote to Employee'}
                                >
                                  <UserCog className="w-4.5 h-4.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                                  className="p-2 sm:p-2.5 rounded-xl text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                                  title="Delete Employee Account"
                                >
                                  <Trash2 className="w-4.5 h-4.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                </>
                )}
              </div>
              )}

              {/* =========================================================================
                  EMPLOYEE ACTIVITY & PROGRESS MODAL (Opaque Solid Background, No Blur, Viewport-Constrained)
                  ========================================================================= */}
              {selectedEmployee && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 overflow-y-auto"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="vision-modal-title"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setSelectedEmployee(null);
                  }}
                >
                  <div className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-150">
                    {/* Modal Header */}
                    <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            setPhotoModalTarget({
                              id: selectedEmployee.id,
                              name: selectedEmployee.name,
                              role: selectedEmployee.role === 'staff' ? 'Employee' : 'Administrator',
                              avatarUrl: selectedEmployee.avatar_url || null,
                            })
                          }
                          className="group relative w-13 h-13 rounded-2xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center shadow-xs shrink-0 ring-4 ring-white hover:ring-blue-400 transition-all cursor-pointer overflow-hidden"
                          title="Click to set or change employee profile photo"
                        >
                          {selectedEmployee.avatar_url ? (
                            <img src={selectedEmployee.avatar_url} alt={selectedEmployee.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{selectedEmployee.name ? selectedEmployee.name.charAt(0).toUpperCase() : 'E'}</span>
                          )}
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Camera className="w-4 h-4 text-white" />
                          </div>
                        </button>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <h3 id="vision-modal-title" className="text-lg sm:text-xl font-bold text-slate-900 tracking-wide truncate">
                              {selectedEmployee.name}
                            </h3>
                            <span className="text-[10pt] sm:text-[10.5pt] font-bold px-2.5 sm:px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                              {selectedEmployee.role === 'staff' ? 'Employee' : 'Administrator'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPhotoModalTarget({
                                  id: selectedEmployee.id,
                                  name: selectedEmployee.name,
                                  role: selectedEmployee.role === 'staff' ? 'Employee' : 'Administrator',
                                  avatarUrl: selectedEmployee.avatar_url || null,
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-[9.5pt] sm:text-[10pt] font-semibold transition-colors cursor-pointer shadow-2xs"
                              title="Set or change profile photo"
                            >
                              <Camera className="w-3 h-3 text-blue-600" />
                              <span>Set Photo</span>
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10.5pt] sm:text-[11pt] text-slate-600 mt-1.5 font-calibri">
                            <span className="flex items-center gap-1.5 text-slate-800 truncate">
                              <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="truncate">{selectedEmployee.email}</span>
                            </span>
                            {selectedEmployee.contact && (
                              <span className="flex items-center gap-1.5 text-slate-800">
                                <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                                <span>{selectedEmployee.contact}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                              Last Sign-In: {formatDateTime(selectedEmployee.last_sign_in_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Prominent, Easy-to-Use Action & Close Buttons */}
                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-start shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditEmployeeModal(selectedEmployee)}
                          className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white hover:bg-blue-50 text-blue-700 font-bold text-[10.5pt] flex items-center gap-1.5 border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit Employee</span>
                        </button>
                        <a
                          href={`/settings/employees?emp=${selectedEmployee.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10.5pt] flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Full Quotation Vision</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setSelectedEmployee(null)}
                          className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-[10.5pt] sm:text-[11pt] flex items-center gap-1.5 border border-slate-300 transition-colors cursor-pointer shadow-2xs shrink-0"
                          aria-label="Close Vision Panel"
                        >
                          <X className="w-4 h-4" />
                          <span>Close</span>
                        </button>
                      </div>
                    </div>

                    {/* Progress Metrics Overview Cards with Non-Misleading Labels */}
                    <div className="p-4 sm:p-6 border-b border-slate-200 bg-white grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-1">
                        <span className="text-[11pt] font-bold text-blue-800 block tracking-wide">Total Quotations</span>
                        <div className="text-2xl font-bold text-slate-900 font-calibri">
                          {selectedEmployee.metrics?.quoteCount || 0}
                        </div>
                        <span className="text-[10.5pt] text-slate-600 block">All quotations created</span>
                      </div>

                      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                        <span className="text-[11pt] font-bold text-emerald-800 block tracking-wide">Total Pipeline Value</span>
                        <div className="text-2xl font-bold text-slate-900 font-calibri">
                          ₹{Number(selectedEmployee.metrics?.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                        <span className="text-[10.5pt] text-slate-600 block">Total grand total sum (₹)</span>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[11pt] font-bold text-slate-800 block tracking-wide">Approved Quotations</span>
                        <div className="text-2xl font-bold text-emerald-700 font-calibri">
                          {selectedEmployee.metrics?.approvedCount || 0}
                        </div>
                        <span className="text-[10.5pt] text-slate-600 block">Approved status</span>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[11pt] font-bold text-slate-800 block tracking-wide">Draft Quotations</span>
                        <div className="text-2xl font-bold text-amber-700 font-calibri">
                          {selectedEmployee.metrics?.draftCount || 0}
                        </div>
                        <span className="text-[10.5pt] text-slate-600 block">Draft status</span>
                      </div>
                    </div>

                    {/* Segmented Tabs Switcher */}
                    <div className="px-5 sm:px-6 pt-3 border-b border-slate-200 bg-white flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setModalTab('quotes')}
                        className={`inline-flex items-center gap-2 pb-3 px-4 text-[11.5pt] font-bold transition-all border-b-2 cursor-pointer ${
                          modalTab === 'quotes'
                            ? 'border-blue-600 text-blue-700'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileText className="w-4.5 h-4.5" />
                        <span>Quotations Created ({selectedEmployee.quotations?.length || 0})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalTab('activity')}
                        className={`inline-flex items-center gap-2 pb-3 px-4 text-[11.5pt] font-bold transition-all border-b-2 cursor-pointer ${
                          modalTab === 'activity'
                            ? 'border-blue-600 text-blue-700'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Activity className="w-4.5 h-4.5" />
                        <span>Activities & Sign-In History ({selectedEmployee.activities?.length || 0})</span>
                      </button>
                    </div>

                    {/* Tab Contents (Scrollable inside Viewport) */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-white">
                      {modalTab === 'quotes' ? (
                        <div>
                          {selectedEmployee.quotations && selectedEmployee.quotations.length > 0 ? (
                            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
                              <table className="w-full text-left font-sans">
                                <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 tracking-wide text-[11pt] uppercase">
                                  <tr>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Quote #</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Customer & Location</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Quote Date</th>
                                    <th className="px-4 py-3.5 text-right whitespace-nowrap">Grand Total (₹)</th>
                                    <th className="px-4 py-3.5 text-center whitespace-nowrap">Status</th>
                                    <th className="px-4 py-3.5 text-right whitespace-nowrap">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[11.5pt] tracking-wide">
                                  {selectedEmployee.quotations.map((q: any) => (
                                    <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                                      <td className="px-4 py-3.5 font-bold text-blue-700 font-calibri text-[11.5pt] whitespace-nowrap">
                                        {q.quote_number}
                                      </td>
                                      <td className="px-4 py-3.5 font-semibold text-slate-900 font-calibri">
                                        <div>{q.customer_name}</div>
                                        {q.store_name && (
                                          <div className="text-[10.5pt] text-slate-600 font-normal">
                                            Store: {q.store_name}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-4 py-3.5 text-slate-700 font-calibri text-[11pt] whitespace-nowrap">
                                        {q.quote_date}
                                      </td>
                                      <td className="px-4 py-3.5 text-right font-extrabold text-slate-900 font-calibri text-[11.5pt] whitespace-nowrap">
                                        ₹{Number(q.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                        <span
                                          className={`inline-block px-3 py-1 rounded-full text-[10.5pt] font-bold uppercase tracking-wide ${
                                            q.status === 'approved'
                                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                                          }`}
                                        >
                                          {q.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                        <Link
                                          href={`/quotations/${q.id}`}
                                          target="_blank"
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10.5pt] font-bold bg-white border border-slate-200 text-blue-700 hover:bg-blue-50 shadow-2xs transition-all"
                                        >
                                          <span>View</span>
                                          <ArrowUpRight className="w-3.5 h-3.5" />
                                        </Link>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-500 space-y-2">
                              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                              <h4 className="text-sm font-bold text-slate-800">No Quotations Created Yet</h4>
                              <p className="text-xs max-w-sm mx-auto text-slate-600">
                                When {selectedEmployee.name} generates new rate cards and quotations in the Employee Portal, they will appear here with live rate details.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Activity Timeline */
                        <div>
                          {selectedEmployee.activities && selectedEmployee.activities.length > 0 ? (
                            <div className="space-y-2.5">
                              {selectedEmployee.activities.map((act: any) => {
                                const isLogin = act.action.includes('LOGIN');
                                const isQuote = act.action.includes('QUOTATION');
                                const isRegister = act.action.includes('REGISTER');

                                return (
                                  <div
                                    key={act.id}
                                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3.5 hover:bg-white transition-colors"
                                  >
                                    <div
                                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                        isLogin
                                          ? 'bg-blue-100 text-blue-700'
                                          : isQuote
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : isRegister
                                          ? 'bg-purple-100 text-purple-700'
                                          : 'bg-slate-200 text-slate-700'
                                      }`}
                                    >
                                      {isLogin ? (
                                        <Clock className="w-4.5 h-4.5" />
                                      ) : isQuote ? (
                                        <FileText className="w-4.5 h-4.5" />
                                      ) : (
                                        <Activity className="w-4.5 h-4.5" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="font-bold text-[11.5pt] text-slate-900 tracking-wide">
                                          {isLogin
                                            ? 'Employee Signed In'
                                            : isQuote
                                            ? `Created Quotation ${act.details?.quoteNumber || ''}`
                                            : isRegister
                                            ? 'Account Created & Registered'
                                            : act.action}
                                        </span>
                                        <span className="text-[10.5pt] text-slate-500 font-calibri shrink-0">
                                          {formatDateTime(act.created_at)}
                                        </span>
                                      </div>
                                      <p className="text-[11pt] text-slate-600 mt-1 leading-relaxed">
                                        {isQuote && act.details?.customerName && (
                                          <span>Customer: <strong className="text-slate-900">{act.details.customerName}</strong> • Grand Total: ₹{Number(act.details.grandTotal || 0).toFixed(2)}</span>
                                        )}
                                        {isLogin && (
                                          <span>Authenticated session active. Ready to write new quotations.</span>
                                        )}
                                        {isRegister && (
                                          <span>Joined JPA quote builder team with quotation writing privileges.</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-10 text-center border border-dashed border-slate-200 rounded-2xl text-slate-500 space-y-2">
                              <Activity className="w-10 h-10 text-slate-400 mx-auto" />
                              <h4 className="text-base font-bold text-slate-800">No Activity Logs Found</h4>
                              <p className="text-[11pt] max-w-sm mx-auto text-slate-600">
                                Recent login events and quotation activities will be tracked chronologically here.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                      <span className="text-[11pt] text-slate-600 font-medium truncate">
                        Employee Vision Panel for <strong className="text-slate-900">{selectedEmployee.name}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedEmployee(null)}
                        className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11pt] transition-colors cursor-pointer"
                      >
                        Close Panel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  ADMINISTRATOR PASSWORD RESET MODAL (Server-Side Bcrypt Hashing)
                  ========================================================================= */}
              {passwordModalOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md overflow-y-auto mac-modal-backdrop"
                  role="dialog"
                  aria-modal="true"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setPasswordModalOpen(false);
                  }}
                >
                  <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/80 mac-modal-content overflow-hidden ring-1 ring-slate-900/5">
                    <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                          <KeyRound className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Change Master Password</h3>
                          <p className="text-[11px] text-slate-500">Administrator account credential update</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPasswordModalOpen(false)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handlePasswordChange} className="p-5 space-y-4 text-xs">
                      {passwordError && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold text-xs">
                          {passwordError}
                        </div>
                      )}
                      {passwordSuccess && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Password successfully updated and securely hashed!</span>
                        </div>
                      )}

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          Current Master Password *
                        </label>
                        <input
                          type="password"
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          New Master Password * (Min 6 chars)
                        </label>
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new strong password"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          Confirm New Password *
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-type new password"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setPasswordModalOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={passwordSaving}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                          <span>Update Password</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  ADD EMPLOYEE MODAL (Responsive, Secure & Interlinked with Sign In / Sign Up)
                  ========================================================================= */}
              {addEmployeeModalOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-md overflow-y-auto mac-modal-backdrop"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="add-employee-title"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setAddEmployeeModalOpen(false);
                  }}
                >
                  <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl mac-modal-content border border-white/80 shadow-[0_25px_70px_rgba(15,23,42,0.3)] overflow-hidden my-auto ring-1 ring-slate-900/5">
                    {/* Modal Header */}
                    <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                          <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 id="add-employee-title" className="text-base sm:text-lg font-bold text-slate-900">
                            Add New Employee
                          </h3>
                          <p className="text-xs text-slate-500">
                            Required fields: Name, Phnumber, Gmail, Password
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAddEmployeeModalOpen(false)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer transition-colors"
                        aria-label="Close modal"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleAddEmployee} className="p-5 sm:p-6 space-y-4">
                      {addEmployeeError && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{addEmployeeError}</span>
                        </div>
                      )}

                      {/* Required Field 1: Name */}
                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-wide text-[11px] mb-1.5">
                          Name (Full Name) *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <User className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            required
                            value={newEmpName}
                            onChange={(e) => setNewEmpName(e.target.value)}
                            placeholder="e.g. R Senthil Kumar"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {/* Required Field 2: Phnumber (Phone Number) */}
                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-wide text-[11px] mb-1.5">
                          Phnumber (Phone Number) *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Phone className="w-4 h-4 text-emerald-600" />
                          </div>
                          <input
                            type="tel"
                            required
                            value={newEmpPhone}
                            onChange={(e) => setNewEmpPhone(e.target.value)}
                            placeholder="e.g. 9790600971 or +91 9790600971"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400"
                          />
                        </div>
                        <span className="text-[10.5px] text-slate-500 mt-1 block">
                          Used for login: employee can enter this phone number on the Sign In screen
                        </span>
                      </div>

                      {/* Required Field 3: Gmail */}
                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-wide text-[11px] mb-1.5">
                          Gmail (Email Address) *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Mail className="w-4 h-4 text-blue-600" />
                          </div>
                          <input
                            type="email"
                            required
                            value={newEmpGmail}
                            onChange={(e) => setNewEmpGmail(e.target.value)}
                            placeholder="e.g. senthil.jpa@gmail.com"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400"
                          />
                        </div>
                        <span className="text-[10.5px] text-slate-500 mt-1 block">
                          Used for login: employee can enter this Gmail on the Sign In screen
                        </span>
                      </div>

                      {/* Required Field 4: Password */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block font-bold text-slate-700 uppercase tracking-wide text-[11px]">
                            Password *
                          </label>
                          <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Bcrypt Salted Encryption</span>
                          </span>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Lock className="w-4 h-4 text-slate-400" />
                          </div>
                          <input
                            type={showNewEmpPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={newEmpPassword}
                            onChange={(e) => setNewEmpPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewEmpPassword(!showNewEmpPassword)}
                            tabIndex={-1}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                            title={showNewEmpPassword ? 'Hide password' : 'Show password'}
                          >
                            {showNewEmpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Role Assignment */}
                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-wide text-[11px] mb-1.5">
                          Role Assignment
                        </label>
                        <select
                          value={newEmpRole}
                          onChange={(e) => setNewEmpRole(e.target.value as 'staff' | 'admin')}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all cursor-pointer"
                        >
                          <option value="staff">Employee / Staff (Write Quotes & Access Rate Library)</option>
                          <option value="admin">Administrator (Full Admin Access & Directory)</option>
                        </select>
                      </div>

                      {/* Interlinked Login Info */}
                      <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-[11px] text-blue-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-blue-950">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Interlinked Login Access</span>
                        </div>
                        <p className="text-blue-800 leading-relaxed">
                          The employee can access and log in using <strong>either their Phone Number OR Gmail Address</strong> together with this password.
                        </p>
                      </div>

                      {/* Modal Actions */}
                      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setAddEmployeeModalOpen(false)}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={addEmployeeLoading}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-60 active:scale-95"
                        >
                          {addEmployeeLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Adding Employee...</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              <span>Add Employee</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  EDIT EMPLOYEE MODAL (Admin Only - Name, Phnumber, Gmail, Password, Role)
                  ========================================================================= */}
              {editingEmployee && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-md overflow-y-auto mac-modal-backdrop"
                  role="dialog"
                  aria-modal="true"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setEditingEmployee(null);
                  }}
                >
                  <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl mac-modal-content border border-white/80 shadow-[0_25px_70px_rgba(15,23,42,0.3)] overflow-hidden my-auto ring-1 ring-slate-900/5">
                    <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                          <Pencil className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900">
                            Edit Registered Employee
                          </h3>
                          <p className="text-xs text-slate-500">
                            Admin Control: Update Name, Phnumber, Gmail, Password or Role
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingEmployee(null)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleEditEmployee} className="p-5 sm:p-6 space-y-4">
                      {editEmployeeError && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>{editEmployeeError}</span>
                        </div>
                      )}

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-wide text-[11px] mb-1.5">
                          Name (Full Name) *
                        </label>
                        <input
                          type="text"
                          required
                          value={editEmpName}
                          onChange={(e) => setEditEmpName(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-wide text-[11px] mb-1.5">
                          Phnumber (Phone Number) *
                        </label>
                        <input
                          type="tel"
                          required
                          value={editEmpPhone}
                          onChange={(e) => setEditEmpPhone(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-wide text-[11px] mb-1.5">
                          Gmail Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={editEmpGmail}
                          onChange={(e) => setEditEmpGmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-wide text-[11px] mb-1.5">
                          Reset Password (leave blank to keep current)
                        </label>
                        <div className="relative">
                          <input
                            type={showEditEmpPassword ? 'text' : 'password'}
                            value={editEmpPassword}
                            onChange={(e) => setEditEmpPassword(e.target.value)}
                            placeholder="Optional: minimum 6 characters"
                            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEditEmpPassword(!showEditEmpPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showEditEmpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-wide text-[11px] mb-1.5">
                          Role Assignment
                        </label>
                        <select
                          value={editEmpRole}
                          onChange={(e) => setEditEmpRole(e.target.value as 'staff' | 'admin')}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm cursor-pointer"
                        >
                          <option value="staff">Employee / Staff</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setEditingEmployee(null)}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editEmployeeLoading}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-60 active:scale-95"
                        >
                          {editEmployeeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          <span>Save Employee Changes</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  3. VERIFIED SUPPLIER COMPANY PROFILE (WHITE GLASSMORPHISM)
                  ========================================================================= */}
              <div className="rounded-3xl bg-white/90 backdrop-blur-md p-7 sm:p-9 border border-white/80 shadow-[0_12px_40px_rgb(0,0,0,0.05)] ring-1 ring-slate-200/70 space-y-7">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-slate-100/90 pb-5">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-wide">
                      <Building2 className="w-6 h-6 text-blue-600" />
                      <span>Verified Supplier Profile</span>
                    </h2>
                    <p className="text-[11.5pt] text-slate-600 mt-1.5 tracking-wide">
                      Master corporate details printed on headers, GST invoices, and PDF/Excel quotation documents
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenSections((prev) => ({ ...prev, supplier: true }));
                          handleStartEdit();
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11pt] shadow-2xs transition-all cursor-pointer active:scale-95 tracking-wide whitespace-nowrap"
                      >
                        <Pencil className="w-4 h-4 text-blue-600" />
                        <span>Edit Master Details</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSection('supplier')}
                      aria-expanded={openSections.supplier}
                      title={openSections.supplier ? 'Collapse section' : 'Expand section'}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100/90 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/80 text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      <span>{openSections.supplier ? 'Hide' : 'Show'}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openSections.supplier ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {openSections.supplier && (
                <>

                {saveSuccess && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11pt] flex items-center gap-2.5 shadow-2xs animate-in fade-in tracking-wide">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-semibold">Company profile updated successfully. All new quotations reflect these verified details.</span>
                  </div>
                )}

                {loading ? (
                  <div className="p-14 text-center flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                    <span className="text-[11pt] text-slate-400 tracking-wide">Loading company profile...</span>
                  </div>
                ) : !isEditing ? (
                  /* Read-Only Grid Display */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[11.5pt]">
                    {/* Left Column: Organization & Legal Details */}
                    <div className="space-y-5">
                      <div>
                        <span className="text-slate-500 font-bold block uppercase tracking-wide text-[11pt] mb-1.5">
                          Company Name & Trade Title
                        </span>
                        <div className="font-bold text-slate-900 text-lg sm:text-xl tracking-wide">{profile.name}</div>
                        {profile.tagline && (
                          <div className="text-blue-700 font-medium text-[11.5pt] mt-1 tracking-wide">{profile.tagline}</div>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-500 font-bold block uppercase tracking-wide text-[11pt] mb-1.5">
                          GSTIN Registration (Coimbatore, Tamil Nadu)
                        </span>
                        <div className="font-mono font-bold text-slate-900 text-[12pt] bg-slate-50/90 px-3.5 py-1.5 rounded-xl border border-slate-200 inline-block tracking-wide">
                          {profile.gstin}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 font-bold block uppercase tracking-wide text-[11pt] mb-1.5">
                          Registered Office Address
                        </span>
                        <div className="text-slate-700 flex items-start gap-2 leading-relaxed tracking-wide text-[11.5pt]">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                          <span>{profile.address}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div>
                          <span className="text-slate-500 font-bold block uppercase tracking-wide text-[11pt] mb-1.5">
                            Contact Phone
                          </span>
                          <div className="text-slate-800 flex items-center gap-2 font-mono font-semibold tracking-wide text-[11.5pt]">
                            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{profile.phone}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-500 font-bold block uppercase tracking-wide text-[11pt] mb-1.5">
                            Official Email
                          </span>
                          <div className="text-slate-800 flex items-center gap-2 truncate tracking-wide text-[11.5pt]">
                            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate">{profile.email}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Banking, Authorized Signatory & Website */}
                    <div className="space-y-5 md:border-l md:border-slate-100/90 md:pl-8">
                      <div>
                        <span className="text-slate-500 font-bold block uppercase tracking-wide text-[11pt] mb-1.5">
                          Authorised Signatory
                        </span>
                        <div className="flex items-center gap-3">
                          <UserCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900 text-[12.5pt] tracking-wide">{profile.signatory_name}</div>
                            <div className="text-slate-500 text-[11pt] tracking-wide">{profile.signatory_designation}</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-slate-50/80 backdrop-blur-xs border border-slate-200/80 space-y-3">
                        <div className="flex items-center gap-2 text-blue-700 font-bold text-[11.5pt] tracking-wide">
                          <CreditCard className="w-5 h-5" />
                          <span>Banking & Direct Remittance Details</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11pt]">
                          <div>
                            <span className="text-slate-500 block text-[10.5pt] tracking-wide">Bank Name:</span>
                            <span className="font-semibold text-slate-800 tracking-wide text-[11.5pt]">{profile.bank_name}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10.5pt] tracking-wide">Account Number:</span>
                            <span className="font-mono font-bold text-slate-900 tracking-wide text-[11.5pt] break-all">{profile.account_no}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10.5pt] tracking-wide">IFSC Code:</span>
                            <span className="font-mono font-bold text-slate-900 tracking-wide text-[11.5pt] break-all">{profile.ifsc_code}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10.5pt] tracking-wide">Branch:</span>
                            <span className="text-slate-700 tracking-wide text-[11.5pt]">{profile.branch}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 font-bold block uppercase tracking-wide text-[11pt] mb-1.5">
                          Web Presence
                        </span>
                        <div className="text-slate-700 flex items-center gap-2 text-[11.5pt] truncate tracking-wide">
                          <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                          <a
                            href={profile.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate"
                          >
                            {profile.website}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Edit Form */
                  <form onSubmit={handleSave} className="space-y-5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          Company Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          Tagline / Business Category
                        </label>
                        <input
                          type="text"
                          value={editForm.tagline}
                          onChange={(e) => setEditForm({ ...editForm, tagline: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          GSTIN *
                        </label>
                        <input
                          type="text"
                          required
                          value={editForm.gstin}
                          onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          Official Phone *
                        </label>
                        <input
                          type="text"
                          required
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          Office Address *
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={editForm.address}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          Email Addresses *
                        </label>
                        <input
                          type="text"
                          required
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          Website
                        </label>
                        <input
                          type="text"
                          value={editForm.website}
                          onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          Signatory Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={editForm.signatory_name}
                          onChange={(e) => setEditForm({ ...editForm, signatory_name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                          Signatory Designation *
                        </label>
                        <input
                          type="text"
                          required
                          value={editForm.signatory_designation}
                          onChange={(e) => setEditForm({ ...editForm, signatory_designation: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                        <span className="font-bold text-slate-800 text-xs block mb-3 tracking-normal">Bank Account Information</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                              Bank Name
                            </label>
                            <input
                              type="text"
                              value={editForm.bank_name}
                              onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                              Account Number
                            </label>
                            <input
                              type="text"
                              value={editForm.account_no}
                              onChange={(e) => setEditForm({ ...editForm, account_no: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                              IFSC Code
                            </label>
                            <input
                              type="text"
                              value={editForm.ifsc_code}
                              onChange={(e) => setEditForm({ ...editForm, ifsc_code: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 uppercase tracking-normal text-[10px] mb-1">
                              Branch Location
                            </label>
                            <input
                              type="text"
                              value={editForm.branch}
                              onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs shadow-2xs transition-all cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>Save & Update Immediately</span>
                      </button>
                    </div>
                  </form>
                )}
                </>
                )}
              </div>

              {/* Profile Photo Setter Modal with High-Resolution Manual Tracer */}
              {photoModalTarget && (
                <ProfilePhotoSetterModal
                  isOpen={!!photoModalTarget}
                  onClose={() => setPhotoModalTarget(null)}
                  userId={photoModalTarget.id}
                  userName={photoModalTarget.name}
                  userRole={photoModalTarget.role || 'Employee'}
                  currentAvatarUrl={photoModalTarget.avatarUrl}
                  onAvatarUpdated={(newAvatarUrl) => {
                    if (
                      !photoModalTarget.id ||
                      photoModalTarget.id === currentUser?.userId ||
                      photoModalTarget.id === currentUser?.id ||
                      photoModalTarget.name === 'N Jayakumar'
                    ) {
                      setAdminAvatarUrl(newAvatarUrl);
                    }
                    if (photoModalTarget.id) {
                      setEmployees((prev) =>
                        prev.map((e) =>
                          e.id === photoModalTarget.id ? { ...e, avatar_url: newAvatarUrl } : e
                        )
                      );
                      if (selectedEmployee && selectedEmployee.id === photoModalTarget.id) {
                        setSelectedEmployee((prev: any) =>
                          prev ? { ...prev, avatar_url: newAvatarUrl } : null
                        );
                      }
                    }
                    setActionMsg(`Profile photo for ${photoModalTarget.name} updated successfully.`);
                    setTimeout(() => setActionMsg(''), 4000);
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
