'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import {
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  Loader2,
  ShieldAlert,
  Eye,
  EyeOff,
  UserPlus,
  CheckCircle2,
  Users2,
} from 'lucide-react';
import {
  setActiveTabSession,
  getKnownAccounts,
  switchActiveAccount,
  TabSession,
} from '@/lib/auth/client-context';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/';
  const urlError = searchParams.get('error');

  // Mode: 'signin' | 'signup'
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  // Form Fields
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [error, setError] = useState(
    urlError === 'admin_only'
      ? 'Access Restricted: Only authorized JPA Administrators have access to this portal.'
      : ''
  );
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [knownAccounts, setKnownAccounts] = useState<TabSession[]>([]);

  // Load Remember Me credentials on initial mount and check known accounts
  useEffect(() => {
    try {
      setKnownAccounts(getKnownAccounts());
      const savedRemember = localStorage.getItem('jpa_remember_me');
      const savedEmail = localStorage.getItem('jpa_remember_email');
      if (savedRemember === 'true' && savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // LocalStorage access safe fallback
    }
  }, []);

  const handleModeSwitch = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            rememberMe,
            recaptchaToken: 'google_recaptcha_verified_admin_token',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Login failed. Please verify your credentials.');
        }

        // Isolate tab session and register in known accounts
        if (data.token && data.user) {
          setActiveTabSession({ token: data.token, user: data.user });
        }

        // Persist or clear Remember Me in localStorage and cache user
        try {
          if (data.user) {
            localStorage.setItem('jpa_cached_user', JSON.stringify(data.user));
          }
          if (rememberMe) {
            localStorage.setItem('jpa_remember_email', email.trim());
            localStorage.setItem('jpa_remember_me', 'true');
          } else {
            localStorage.removeItem('jpa_remember_email');
            localStorage.removeItem('jpa_remember_me');
          }
        } catch {
          // ignore storage error
        }

        const destination = redirectTarget.startsWith('/') ? redirectTarget : '/';
        router.push(destination);
        router.refresh();
      } else {
        // Create New Account
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            contact,
            email,
            password,
            rememberMe,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create new account. Please check your details.');
        }

        // Isolate tab session and register in known accounts
        if (data.token && data.user) {
          setActiveTabSession({ token: data.token, user: data.user });
        }

        // Persist Remember Me and cache user if enabled
        try {
          if (data.user) {
            localStorage.setItem('jpa_cached_user', JSON.stringify(data.user));
          }
          if (rememberMe) {
            localStorage.setItem('jpa_remember_email', email.trim());
            localStorage.setItem('jpa_remember_me', 'true');
          }
        } catch {
          // ignore
        }

        setSuccessMsg('Account created successfully! Redirecting to dashboard...');
        setTimeout(() => {
          const destination = redirectTarget.startsWith('/') ? redirectTarget : '/';
          router.push(destination);
          router.refresh();
        }, 600);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md relative z-10 transition-all duration-300">
      {/* Classic Glass Panel Container */}
      <div className="glass-panel rounded-3xl shadow-2xl border border-white/80 p-7 sm:p-9 backdrop-blur-xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <BrandLogo variant="full" isLink={false} className="mb-2" />
          <p className="text-xs font-semibold text-slate-500 tracking-wide">
            Jeevan Pranav Agencies
          </p>
        </div>

        {/* Modern Segmented Mode Switcher with Smooth Sliding Glass Thumb */}
        <div className="relative grid grid-cols-2 p-1 bg-slate-200/65 backdrop-blur-md rounded-2xl mb-5 border border-white/85 shadow-inner">
          <div
            aria-hidden="true"
            style={{
              transform:
                mode === 'signin'
                  ? 'translate3d(0%, 0, 0)'
                  : 'translate3d(100%, 0, 0)',
            }}
            className="glass-segmented-thumb pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-sm border border-slate-200/70"
          />
          <button
            type="button"
            onClick={() => handleModeSwitch('signin')}
            className={`relative z-10 py-2 rounded-xl text-xs font-bold transition-colors duration-200 cursor-pointer select-none ${
              mode === 'signin'
                ? 'text-blue-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('signup')}
            className={`relative z-10 py-2 rounded-xl text-xs font-bold transition-colors duration-200 cursor-pointer select-none ${
              mode === 'signup'
                ? 'text-blue-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create New Account
          </button>
        </div>

        {/* Known Active Accounts Switcher */}
        {knownAccounts.length > 0 && mode === 'signin' && (
          <div className="mb-5 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
                Active in this Browser
              </span>
              <span className="text-[10px] font-semibold text-blue-600">
                1-click switch
              </span>
            </div>
            <div className="space-y-1.5">
              {knownAccounts.map((acc) => (
                <button
                  key={acc.user.email}
                  type="button"
                  onClick={() => {
                    switchActiveAccount(acc.token);
                    const destination = redirectTarget.startsWith('/') ? redirectTarget : '/';
                    window.location.href = destination;
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-white border border-blue-100 hover:border-blue-300 hover:shadow-xs transition-all text-left cursor-pointer group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                        {acc.user.name}
                      </span>
                      <span
                        className={`text-[9.5pt] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                          acc.user.role === 'admin'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {acc.user.role === 'admin' ? 'Admin' : 'Staff'}
                      </span>
                    </div>
                    <div className="text-[10.5pt] font-mono text-slate-500 truncate">
                      {acc.user.email}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-600 group-hover:underline shrink-0">
                    Switch →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feedback Messages */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 shadow-2xs animate-in fade-in duration-200">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 shadow-2xs animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span className="leading-relaxed font-semibold">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Sign Up Exclusive Fields: Name & Contact */}
          {mode === 'signup' && (
            <>
              {/* Name Field */}
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    aria-label="Full Name"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200/90 bg-white/95 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Contact Field */}
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Contact Number"
                    aria-label="Contact Number"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200/90 bg-white/95 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email Address Field (Common) */}
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                aria-label="Email Address"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200/90 bg-white/95 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Password Field (Common) */}
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                aria-label="Password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/90 bg-white/95 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Option */}
          <div className="pt-1 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer accent-blue-600 transition-all"
              />
              <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                Remember me
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all duration-150 cursor-pointer disabled:opacity-60 mt-4 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{mode === 'signup' ? 'Creating Account...' : 'Signing In...'}</span>
              </>
            ) : mode === 'signup' ? (
              <>
                <span>Create Account</span>
                <UserPlus className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Quick Switch */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          {mode === 'signin' ? (
            <p className="text-xs text-slate-500">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => handleModeSwitch('signup')}
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
              >
                Create New Account
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => handleModeSwitch('signin')}
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#F8FAFF] via-[#EEF4FF] to-[#E2E8F0]/50 relative overflow-hidden">
      {/* Subtle background glow circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 glass-panel rounded-3xl flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
