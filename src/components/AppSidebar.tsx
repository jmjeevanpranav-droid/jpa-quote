'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  Database,
  Users2,
  BarChart3,
  Settings,
  LogOut,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeftRight,
  Camera,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { AccountSwitcherModal } from './AccountSwitcherModal';
import { ProfilePhotoSetterModal } from './ProfilePhotoSetterModal';
import {
  getActiveTabSession,
  logoutActiveAccount,
} from '@/lib/auth/client-context';

interface UserInfo {
  name: string;
  email: string;
  role: string;
  userId?: string;
  id?: string;
  avatarUrl?: string;
  picture?: string;
}

const SIDEBAR_STORAGE_KEY = 'jpa_sidebar_collapsed';

let cachedAuthMeUser: UserInfo | null = null;
let cachedAuthMeAt = 0;
let inflightAuthMe: Promise<UserInfo | null> | null = null;
let hasSidebarHydratedOnce = false;
let persistedDesktopCollapsed: boolean | null = null;
let persistedNavScrollTop = 0;

export function AppSidebar() {
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() =>
    hasSidebarHydratedOnce && persistedDesktopCollapsed !== null
      ? persistedDesktopCollapsed
      : false
  );
  const [animateWidth, setAnimateWidth] = useState<boolean>(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState<boolean>(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false);
  const [user, setUser] = useState<UserInfo | null>(() => {
    if (!hasSidebarHydratedOnce) return null;
    const active = getActiveTabSession();
    return active?.user || cachedAuthMeUser || null;
  });

  // Touch drag state for buttery 60fps mobile swipe-left-to-close
  const [dragOffsetX, setDragOffsetX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const mobileOpenedAtRef = useRef<number>(0);
  const widthAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathnameRef = useRef<string>(pathname);
  const desktopNavScrollRef = useRef<HTMLDivElement | null>(null);

  const toggleDesktopCollapse = useCallback(() => {
    if (widthAnimTimerRef.current) {
      clearTimeout(widthAnimTimerRef.current);
    }
    setAnimateWidth(true);
    setIsCollapsed((prev) => {
      const next = !prev;
      persistedDesktopCollapsed = next;
      if (typeof window !== 'undefined') {
        (window as any).__jpa_sidebar_collapsed = next;
        try {
          localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
        } catch {}
      }
      return next;
    });
    widthAnimTimerRef.current = setTimeout(() => {
      setAnimateWidth(false);
    }, 340);
  }, []);

  // Track user session and collapse listeners
  useEffect(() => {
    try {
      if (persistedDesktopCollapsed === null) {
        const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        persistedDesktopCollapsed = stored === 'true';
      }
      setIsCollapsed(persistedDesktopCollapsed);
    } catch {}

    hasSidebarHydratedOnce = true;

    if (desktopNavScrollRef.current && persistedNavScrollTop > 0) {
      desktopNavScrollRef.current.scrollTop = persistedNavScrollTop;
    }

    const handleToggleEvent = () => {
      if (window.innerWidth < 768) {
        setMobileOpen((prev) => {
          const next = !prev;
          if (next) {
            mobileOpenedAtRef.current = Date.now();
          }
          return next;
        });
      } else {
        toggleDesktopCollapse();
      }
    };

    const handleCloseMobile = () => setMobileOpen(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    const handleSessionChanged = (e: any) => {
      cachedAuthMeUser = null;
      cachedAuthMeAt = 0;
      if (e.detail?.user) {
        setUser(e.detail.user);
      }
    };

    const handleFocusSync = () => {
      const active = getActiveTabSession();
      if (active?.user) {
        setUser(active.user);
      }
    };

    window.addEventListener('jpa:toggle-sidebar', handleToggleEvent);
    window.addEventListener('jpa:close-sidebar', handleCloseMobile);
    window.addEventListener('jpa:session-changed', handleSessionChanged);
    window.addEventListener('focus', handleFocusSync);
    window.addEventListener('keydown', handleKeyDown);

    const activeSession = getActiveTabSession();
    if (activeSession?.user) {
      setUser(activeSession.user);
    } else {
      try {
        const cached = localStorage.getItem('jpa_cached_user');
        if (cached) setUser(JSON.parse(cached));
      } catch {}
    }

    const now = Date.now();
    if (cachedAuthMeUser && now - cachedAuthMeAt < 30_000) {
      if (!activeSession?.user) {
        setUser(cachedAuthMeUser);
      }
    } else {
      if (!inflightAuthMe) {
        const headers: Record<string, string> = {};
        if (activeSession?.token) {
          headers['x-jpa-session-token'] = activeSession.token;
          headers['Authorization'] = `Bearer ${activeSession.token}`;
        }
        inflightAuthMe = fetch('/api/auth/me', { headers })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.authenticated && data?.user) {
              cachedAuthMeUser = data.user;
              cachedAuthMeAt = Date.now();
              return data.user as UserInfo;
            }
            return null;
          })
          .catch(() => null)
          .finally(() => {
            inflightAuthMe = null;
          });
      }

      inflightAuthMe.then((fetchedUser) => {
        if (fetchedUser) {
          const currentTab = getActiveTabSession();
          if (currentTab?.user) {
            setUser(currentTab.user);
          } else {
            setUser(fetchedUser);
          }
        }
      });
    }

    return () => {
      if (widthAnimTimerRef.current) {
        clearTimeout(widthAnimTimerRef.current);
      }
      window.removeEventListener('jpa:toggle-sidebar', handleToggleEvent);
      window.removeEventListener('jpa:close-sidebar', handleCloseMobile);
      window.removeEventListener('jpa:session-changed', handleSessionChanged);
      window.removeEventListener('focus', handleFocusSync);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleDesktopCollapse]);

  // Close mobile drawer only when pathname actually changes after mount
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      setMobileOpen(false);
      setDragOffsetX(0);
      setIsDragging(false);
    }
  }, [pathname]);

  // Lock background scroll when mobile drawer is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (mobileOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [mobileOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!mobileOpen) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartYRef.current);
    // Only engage drag mode once horizontal left swipe exceeds 10px deadzone
    if (dx < -10 && Math.abs(dx) > dy * 1.1) {
      if (!isDragging) setIsDragging(true);
      setDragOffsetX(dx);
    } else if (isDragging && dx >= 0) {
      setDragOffsetX(0);
    }
  };

  const handleTouchEnd = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffsetX < -65) {
      setMobileOpen(false);
    }
    setDragOffsetX(0);
  };

  const handleLogout = async () => {
    await logoutActiveAccount();
  };

  const isAdmin = Boolean(user && user.role === 'admin');
  const isMasterAdmin = Boolean(user && user.role === 'admin');
  const defaultAdminName = 'N Jayakumar';
  const defaultAdminEmail = 'jeevanpranavagencies@gmail.com';

  const baseNavItems: Array<{
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    highlight?: boolean;
    badge?: string;
    adminOnly?: boolean;
  }> = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/quotations/new', label: 'Create Rate Card', icon: FilePlus2, highlight: true },
    { href: '/quotations', label: 'All Quotations', icon: FileText },
    { href: '/products', label: 'Rate Library', icon: Database },
    { href: '/customers', label: 'Customers', icon: Users2 },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/settings', label: 'Administrator Portal', icon: Settings, badge: 'Admin', adminOnly: true },
  ];

  const navItems = baseNavItems.filter((item) => !item.adminOnly || isAdmin);

  const renderNavLinks = (isMobile = false) => (
    <nav className="space-y-1.5" aria-label="Main Navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === '/quotations/new'
            ? pathname === '/quotations/new'
            : item.href === '/quotations'
            ? pathname.startsWith('/quotations') && pathname !== '/quotations/new'
            : item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

        const showCompact = !isMobile && isCollapsed;

        return (
          <div key={item.href} className="relative group">
            <Link
              href={item.href}
              onClick={() => {
                if (isMobile && item.href === pathname) {
                  setMobileOpen(false);
                }
              }}
              title={showCompact ? item.label : undefined}
              className={`flex items-center rounded-2xl font-bold transition-colors duration-150 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 ${
                showCompact
                  ? 'justify-center px-3 py-2.5 h-11.5 w-11.5 mx-auto gap-0'
                  : 'px-3.5 py-2.5 sm:py-3 text-[11.5pt] gap-3'
              } ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-500/50'
                  : item.highlight
                  ? 'bg-blue-50/90 text-blue-700 hover:bg-blue-100/90 border border-blue-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
              }`}
            >
              <Icon
                className={`shrink-0 transition-transform duration-150 group-hover:scale-105 w-5 h-5 ${
                  isActive ? 'text-white' : item.highlight ? 'text-blue-600' : 'text-slate-500'
                }`}
              />
              <span
                className={`flex items-center gap-2 min-w-0 ${
                  showCompact
                    ? 'hidden'
                    : 'flex-1 opacity-100'
                }`}
              >
                <span className="truncate flex-1 tracking-normal">{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9.5pt] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </span>
            </Link>

            {/* Desktop Collapsed Tooltip */}
            {showCompact && (
              <div
                role="tooltip"
                className="absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3.5 py-2 bg-slate-900/95 backdrop-blur-md text-white text-[11pt] font-bold rounded-xl shadow-2xl whitespace-nowrap pointer-events-none opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] z-50 flex items-center gap-2.5 border border-slate-700/80"
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9.5pt] font-extrabold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider">
                    {item.badge}
                  </span>
                )}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900/95" />
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* =========================================================================
          1. MOBILE SLIDE-IN DRAWER (Always Mounted for 60fps Spring Enter + Exit & Touch Drag)
          ========================================================================= */}
      <div
        className={`fixed inset-0 z-50 md:hidden flex ${
          mobileOpen
            ? 'visible pointer-events-auto transition-none'
            : 'invisible pointer-events-none transition-[visibility] delay-300'
        }`}
        role="dialog"
        aria-modal={mobileOpen}
        aria-hidden={!mobileOpen}
        aria-label="Mobile Navigation"
      >
        {/* Dimmed Glass Backdrop */}
        <div
          className={`fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => {
            if (Date.now() - mobileOpenedAtRef.current < 220) return;
            setMobileOpen(false);
          }}
          aria-hidden="true"
        />

        {/* Drawer Panel (GPU translate3d + real-time swipe-to-close) */}
        <aside
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: mobileOpen
              ? `translate3d(${dragOffsetX}px, 0, 0)`
              : 'translate3d(-102%, 0, 0)',
            transition: isDragging
              ? 'none'
              : 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform',
          }}
          className="relative z-10 w-74 max-w-[84vw] h-dvh bg-white/95 backdrop-blur-2xl border-r border-white/80 shadow-[0_24px_60px_rgba(15,23,42,0.28)] flex flex-col select-none"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between h-15 px-4 border-b border-slate-200/80 bg-white/90">
            <BrandLogo variant="compact" showSubtitle={false} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/90 transition-all duration-150 active:scale-90 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600"
              aria-label="Close Navigation Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto p-3.5 bg-white/85">
            {renderNavLinks(true)}
          </div>

          {/* Drawer User Footer */}
          <div className="p-4 border-t border-slate-200/80 bg-slate-50/90">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(true)}
                className="group relative w-10.5 h-10.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white hover:ring-blue-400 transition-all cursor-pointer overflow-hidden"
                title="Click to set or change profile photo"
              >
                {user?.avatarUrl || user?.picture ? (
                  <img src={user.avatarUrl || user.picture} alt={user?.name || ''} className="w-full h-full object-cover" />
                ) : (
                  <span>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                )}
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </button>
              <div
                onClick={() => setIsSwitcherOpen(true)}
                className="flex-1 min-w-0 overflow-hidden cursor-pointer group/user"
                title="Click to Switch Account"
              >
                {user ? (
                  <>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[11.5pt] font-bold text-slate-900 truncate group-hover/user:text-blue-700 transition-colors">
                        {user.name || (isMasterAdmin ? defaultAdminName : 'Employee')}
                      </span>
                      <span
                        className={`text-[9pt] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase ${
                          user.role === 'staff'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {user.role === 'staff' ? 'Staff' : 'Admin'}
                      </span>
                    </div>
                    <div className="text-[10pt] font-mono text-slate-600 truncate mt-0.5">
                      {user.email || (isMasterAdmin ? defaultAdminEmail : '')}
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsSwitcherOpen(true)}
                title="Switch Account Context"
                aria-label="Switch Account Context"
                className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all active:scale-90 cursor-pointer shrink-0"
              >
                <ArrowLeftRight className="w-4.5 h-4.5" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign Out"
                aria-label="Sign Out"
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all active:scale-90 cursor-pointer shrink-0"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* =========================================================================
          2. DESKTOP SLIDING SIDEBAR (Continuous Spring Width Slider Only on Toggle)
          ========================================================================= */}
      <aside
        suppressHydrationWarning
        className={`hidden md:flex shrink-0 relative z-30 flex-col h-dvh border-r border-slate-200/90 bg-white shadow-xs select-none ${
          animateWidth
            ? 'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none will-change-[width]'
            : ''
        } ${isCollapsed ? 'w-20' : 'w-64'}`}
        aria-label="Desktop Navigation Sidebar"
      >
        {/* Sidebar Header with Brand and Sliding Toggle Button */}
        <div className="flex items-center justify-between h-18 border-b border-slate-200/80 px-3.5 bg-white overflow-hidden">
          {!isCollapsed ? (
            <>
              <div className="overflow-hidden transition-opacity duration-200">
                <BrandLogo variant="full" showSubtitle={true} />
              </div>
              <button
                type="button"
                onClick={toggleDesktopCollapse}
                aria-label="Collapse sidebar"
                aria-expanded="true"
                title="Collapse sidebar"
                className="w-8.5 h-8.5 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 transition-all duration-200 active:scale-90 cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={toggleDesktopCollapse}
                aria-label="Expand sidebar"
                aria-expanded="false"
                title="Expand sidebar"
                className="w-9.5 h-9.5 rounded-xl flex items-center justify-center text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 transition-all duration-200 active:scale-90 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <PanelLeftOpen className="w-4.5 h-4.5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links Body */}
        <div
          ref={desktopNavScrollRef}
          onScroll={(e) => {
            persistedNavScrollTop = e.currentTarget.scrollTop;
          }}
          className={`flex-1 overflow-y-auto overflow-x-hidden py-4 bg-white ${
            animateWidth ? 'transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''
          } ${isCollapsed ? 'px-2' : 'px-3'}`}
        >
          {renderNavLinks(false)}
        </div>

        {/* User Profile Footer */}
        <div
          className={`border-t border-slate-200/80 bg-slate-50/90 ${
            animateWidth ? 'transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''
          } ${isCollapsed ? 'p-2.5' : 'p-3'}`}
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(true)}
                className="group relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white hover:ring-blue-400 transition-all cursor-pointer overflow-hidden"
                title="Click to set or change profile photo"
              >
                {user?.avatarUrl || user?.picture ? (
                  <img src={user.avatarUrl || user.picture} alt={user?.name || ''} className="w-full h-full object-cover" />
                ) : (
                  <span>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                )}
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-3.5 h-3.5 text-white" />
                </div>
              </button>
              <div
                onClick={() => setIsSwitcherOpen(true)}
                className="flex-1 min-w-0 overflow-hidden cursor-pointer group/user"
                title="Click to Switch Account"
              >
                {user ? (
                  <>
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[11.5pt] font-bold text-slate-900 truncate group-hover/user:text-blue-700 transition-colors">
                        {user.name || (isMasterAdmin ? defaultAdminName : 'Employee')}
                      </span>
                      <span
                        className={`text-[9.5pt] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase ${
                          user.role === 'staff'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {user.role === 'staff' ? 'Staff' : 'Admin'}
                      </span>
                    </div>
                    <div className="text-[10.5pt] font-mono text-slate-500 truncate mt-0.5">
                      {user.email || (isMasterAdmin ? defaultAdminEmail : '')}
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <div className="h-3.5 w-20 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsSwitcherOpen(true)}
                title="Switch Account Context"
                aria-label="Switch Account Context"
                className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all active:scale-90 cursor-pointer shrink-0"
              >
                <ArrowLeftRight className="w-4.5 h-4.5" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign Out"
                aria-label="Sign Out"
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all active:scale-90 cursor-pointer shrink-0"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          ) : (
            <div className="relative group flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(true)}
                aria-label="Set Profile Photo"
                title="Click to set or change profile photo"
                className="group relative w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-md ring-2 ring-white hover:ring-blue-400 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
              >
                {user?.avatarUrl || user?.picture ? (
                  <img src={user.avatarUrl || user.picture} alt={user?.name || ''} className="w-full h-full object-cover" />
                ) : (
                  <span>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                )}
                <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-2xs">
                  <Camera className="w-2.5 h-2.5" />
                </span>
              </button>

              <div
                role="tooltip"
                className="absolute left-full bottom-0 ml-4 p-4.5 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl pointer-events-none opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] z-50 flex flex-col min-w-[280px] border border-slate-700/90"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-[13.5pt] text-white tracking-wide truncate">
                    {user?.name || (isMasterAdmin ? defaultAdminName : 'User Account')}
                  </span>
                  <span
                    className={`text-[10pt] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                      user?.role === 'staff'
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                        : 'bg-blue-500/25 text-blue-300 border border-blue-500/50'
                    }`}
                  >
                    {user?.role === 'staff' ? 'Staff' : 'Admin'}
                  </span>
                </div>

                {(user?.email || (isMasterAdmin ? defaultAdminEmail : '')) && (
                  <span className="text-slate-300 font-mono text-[12pt] mt-1.5 truncate">
                    {user?.email || defaultAdminEmail}
                  </span>
                )}

                <div className="flex items-center gap-2 text-blue-300 font-semibold text-[11.5pt] mt-3.5 pt-3 border-t border-slate-700/80">
                  <ArrowLeftRight className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Click to Switch or Sign Out</span>
                </div>

                <div className="absolute right-full bottom-4 border-[7px] border-transparent border-r-slate-900/95" />
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Account Switcher Modal Dialog */}
      <AccountSwitcherModal
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
      />

      {/* Manual High-Quality Profile Photo Setter & Tracer Modal */}
      <ProfilePhotoSetterModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        userId={user?.userId || user?.id}
        userName={user?.name || (isAdmin ? defaultAdminName : 'User')}
        userRole={user?.role === 'admin' ? 'Administrator' : 'Employee'}
        currentAvatarUrl={user?.avatarUrl || user?.picture}
        onAvatarUpdated={(newUrl) => {
          if (user) {
            setUser({ ...user, avatarUrl: newUrl || undefined, picture: newUrl || undefined });
          }
        }}
      />
    </>
  );
}
