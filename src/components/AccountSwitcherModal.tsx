'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  User,
  Shield,
  Briefcase,
  CheckCircle2,
  ArrowRightLeft,
  UserPlus,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import {
  getActiveTabSession,
  getKnownAccounts,
  switchActiveAccount,
  logoutActiveAccount,
  TabSession,
} from '@/lib/auth/client-context';

interface AccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountSwitcherModal({ isOpen, onClose }: AccountSwitcherModalProps) {
  const router = useRouter();
  const [activeSession, setActiveSession] = useState<TabSession | null>(null);
  const [knownAccounts, setKnownAccounts] = useState<TabSession[]>([]);

  const refreshAccounts = () => {
    const active = getActiveTabSession();
    setActiveSession(active);
    const known = getKnownAccounts();
    setKnownAccounts(known);
  };

  useEffect(() => {
    if (isOpen) {
      refreshAccounts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentEmail = activeSession?.user?.email?.toLowerCase();
  const otherAccounts = knownAccounts.filter(
    (acc) => acc.user.email.toLowerCase() !== currentEmail
  );

  const handleSwitch = (token: string) => {
    switchActiveAccount(token);
    onClose();
  };

  const handleSignInAnother = (newWindow: boolean = false) => {
    onClose();
    const loginUrl = window.location.hostname.endsWith('.hf.space')
      ? '/login.html?switch=true'
      : '/login?switch=true';
    if (newWindow) {
      window.open(loginUrl, '_blank');
    } else {
      window.location.href = loginUrl;
    }
  };

  const handleSignOutCurrent = async () => {
    onClose();
    await logoutActiveAccount();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md mac-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-switcher-title"
    >
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl mac-modal-content border border-white/80 shadow-[0_25px_70px_rgba(15,23,42,0.3)] overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-slate-900/5">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 id="account-switcher-title" className="text-base font-bold text-slate-900 leading-tight">
                Switch Account Context
              </h2>
              <p className="text-xs text-slate-500">
                Manage simultaneous account sessions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            aria-label="Close Account Switcher"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Active Session Section */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Active in this Window
            </span>
            {activeSession?.user ? (
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 shadow-xs flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white overflow-hidden">
                  {activeSession.user.picture || activeSession.user.avatarUrl ? (
                    <img src={activeSession.user.picture || activeSession.user.avatarUrl} alt={activeSession.user.name} className="w-full h-full object-cover" />
                  ) : (
                    activeSession.user.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-slate-900 truncate">
                      {activeSession.user.name}
                    </span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        activeSession.user.role === 'admin'
                          ? 'bg-blue-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {activeSession.user.role === 'admin' ? 'Administrator' : 'Employee'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 font-mono truncate mt-0.5">
                    {activeSession.user.email}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-blue-700 font-bold mt-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Current active identity</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                No active session detected in this window.
              </div>
            )}
          </div>

          {/* Other Known Accounts Section */}
          {otherAccounts.length > 0 && (
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Other Signed-In Accounts ({otherAccounts.length})
              </span>
              <div className="space-y-2">
                {otherAccounts.map((account) => (
                  <div
                    key={account.user.email}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/80 transition-all flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">
                        {account.user.picture || account.user.avatarUrl ? (
                          <img src={account.user.picture || account.user.avatarUrl} alt={account.user.name} className="w-full h-full object-cover" />
                        ) : (
                          account.user.name?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-sm font-bold text-slate-800 truncate">
                            {account.user.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider ${
                              account.user.role === 'admin'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {account.user.role === 'admin' ? 'Admin' : 'Staff'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono truncate">
                          {account.user.email}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSwitch(account.token)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer shrink-0 active:scale-95"
                    >
                      Switch
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Options */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleSignInAnother(false)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-700 font-bold text-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-blue-600" />
              <span>Sign In to Another Account (This Tab)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSignInAnother(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-slate-500" />
              <span>Open Another Account in New Tab</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSignOutCurrent}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out This Account</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

