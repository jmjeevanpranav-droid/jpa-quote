'use client';

import {
  isStaticSpaceHost,
  handleStaticSpaceApiRequest,
  toStaticSpaceUrl,
  installStaticSpaceRouter,
} from './static-space-engine';

export interface ClientUser {
  id: string;
  userId?: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  contact?: string;
  picture?: string;
  avatarUrl?: string;
}

export interface TabSession {
  token: string;
  user: ClientUser;
  lastActive?: number;
}

export const JPA_TAB_SESSION_KEY = 'jpa_tab_session';
export const JPA_KNOWN_ACCOUNTS_KEY = 'jpa_known_accounts';
export const JPA_CACHED_USER_KEY = 'jpa_cached_user';
const JPA_CLEAN_EMAILS_V2_KEY = 'jpa_clean_emails_v3';
const ADMIN_EMAIL = 'jeevanpranavagencies@gmail.com';
const LEGACY_SALES_EMAIL = 'salesteamjpa@gmail.com';

function sanitizeStorageAndHeaders(): void {
  if (typeof window === 'undefined') return;
  try {
    // 1. Purge oversized or bloated session cookies (> 1024 bytes) that cause HTTP 431 Request Header Fields Too Large
    if (typeof document !== 'undefined' && document.cookie) {
      const cookieList = document.cookie.split(';');
      for (const c of cookieList) {
        const parts = c.trim().split('=');
        if (parts[0] === 'jpa_session_token' && parts[1]) {
          const val = decodeURIComponent(parts[1]);
          if (val.length > 1024) {
            document.cookie = 'jpa_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
            document.cookie = 'jpa_session_token=; path=/; max-age=0; SameSite=Lax';
          }
        }
      }
    }

    // 2. Sanitize tab sessionStorage
    const tabRaw = sessionStorage.getItem(JPA_TAB_SESSION_KEY);
    if (tabRaw) {
      const parsed = JSON.parse(tabRaw);
      let changed = false;
      if (parsed?.token && parsed.token.length > 1024) {
        parsed.token = '';
        changed = true;
      }
      if (parsed?.user?.avatarUrl?.startsWith('data:') || parsed?.user?.picture?.startsWith('data:')) {
        delete parsed.user.avatarUrl;
        delete parsed.user.picture;
        changed = true;
      }
      if (changed) {
        sessionStorage.setItem(JPA_TAB_SESSION_KEY, JSON.stringify(parsed));
      }
    }

    // 3. Sanitize known accounts in localStorage
    const knownRaw = localStorage.getItem(JPA_KNOWN_ACCOUNTS_KEY);
    if (knownRaw) {
      const known = JSON.parse(knownRaw);
      if (Array.isArray(known)) {
        let changed = false;
        const cleaned = known.map((acc: any) => {
          if (acc?.token && acc.token.length > 1024) {
            acc.token = '';
            changed = true;
          }
          if (acc?.user?.avatarUrl?.startsWith('data:') || acc?.user?.picture?.startsWith('data:')) {
            delete acc.user.avatarUrl;
            delete acc.user.picture;
            changed = true;
          }
          return acc;
        });
        if (changed) {
          localStorage.setItem(JPA_KNOWN_ACCOUNTS_KEY, JSON.stringify(cleaned));
        }
      }
    }
  } catch {}
}

function ensureCleanAdminStorage(): void {
  if (typeof window === 'undefined') return;
  sanitizeStorageAndHeaders();
  try {
    if (localStorage.getItem(JPA_CLEAN_EMAILS_V2_KEY) === '1') return;

    // Only clean out deprecated test/sales emails, preserve all registered employees
    const knownRaw = localStorage.getItem(JPA_KNOWN_ACCOUNTS_KEY);
    if (knownRaw) {
      const known = JSON.parse(knownRaw);
      if (Array.isArray(known)) {
        const validAccounts = known.filter(
          (s: any) => s?.user?.email?.toLowerCase() !== LEGACY_SALES_EMAIL
        );
        localStorage.setItem(JPA_KNOWN_ACCOUNTS_KEY, JSON.stringify(validAccounts));
      }
    }

    const rememberEmail = localStorage.getItem('jpa_remember_email');
    if (rememberEmail && rememberEmail.trim().toLowerCase() === LEGACY_SALES_EMAIL) {
      localStorage.removeItem('jpa_remember_email');
      localStorage.removeItem('jpa_remember_me');
    }

    const cachedRaw = localStorage.getItem(JPA_CACHED_USER_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached?.email?.toLowerCase() === LEGACY_SALES_EMAIL) {
        localStorage.removeItem(JPA_CACHED_USER_KEY);
      }
    }

    const tabRaw = sessionStorage.getItem(JPA_TAB_SESSION_KEY);
    if (tabRaw) {
      const tab = JSON.parse(tabRaw);
      if (tab?.user?.email?.toLowerCase() === LEGACY_SALES_EMAIL) {
        sessionStorage.removeItem(JPA_TAB_SESSION_KEY);
      }
    }

    localStorage.setItem(JPA_CLEAN_EMAILS_V2_KEY, '1');
  } catch {}
}

export function getActiveTabSession(): TabSession | null {
  if (typeof window === 'undefined') return null;
  ensureCleanAdminStorage();

  try {
    // 1. Check tab-isolated sessionStorage first
    const tabStored = sessionStorage.getItem(JPA_TAB_SESSION_KEY);
    if (tabStored) {
      const parsed = JSON.parse(tabStored);
      if (parsed?.token && parsed?.user) {
        return parsed;
      }
    }

    // 2. Fallback for newly opened window: check known accounts
    const knownRaw = localStorage.getItem(JPA_KNOWN_ACCOUNTS_KEY);
    if (knownRaw) {
      const known: TabSession[] = JSON.parse(knownRaw);
      if (Array.isArray(known) && known.length > 0) {
        // Adopt the first available account for this tab
        const defaultSession = known[0];
        sessionStorage.setItem(JPA_TAB_SESSION_KEY, JSON.stringify(defaultSession));
        return defaultSession;
      }
    }

    // 3. Backward compatibility check
    const legacyCached = localStorage.getItem(JPA_CACHED_USER_KEY);
    if (legacyCached) {
      const user = JSON.parse(legacyCached);
      if (user?.email) {
        return { token: '', user };
      }
    }
  } catch (e) {
    console.error('Error reading tab session:', e);
  }

  return null;
}

export function syncTabCookie(): void {
  if (typeof window === 'undefined') return;
  const active = getActiveTabSession();
  if (active?.token && active.token.length <= 1024) {
    const cookieFlags = window.location.protocol === 'https:' ? 'SameSite=None; Secure' : 'SameSite=Lax';
    document.cookie = `jpa_session_token=${encodeURIComponent(active.token)}; path=/; max-age=2592000; ${cookieFlags}`;
  }
}

export function setActiveTabSession(session: TabSession): void {
  if (typeof window === 'undefined') return;

  try {
    // 1. Isolate to this specific browser tab/window
    sessionStorage.setItem(JPA_TAB_SESSION_KEY, JSON.stringify(session));

    // 2. Track in known accounts list across tabs
    const known = getKnownAccounts();
    const updated = known.filter(
      (s) => s.user.email.toLowerCase() !== session.user.email.toLowerCase()
    );
    updated.unshift({ ...session, lastActive: Date.now() });
    localStorage.setItem(JPA_KNOWN_ACCOUNTS_KEY, JSON.stringify(updated));

    // 3. Sync cookie for full-page SSR navigation (guard against bloated tokens causing HTTP 431)
    if (session.token && session.token.length <= 1024) {
      const cookieFlags = window.location.protocol === 'https:' ? 'SameSite=None; Secure' : 'SameSite=Lax';
      document.cookie = `jpa_session_token=${encodeURIComponent(session.token)}; path=/; max-age=2592000; ${cookieFlags}`;
    }

    // 4. Update legacy cache for smooth fallback
    localStorage.setItem(JPA_CACHED_USER_KEY, JSON.stringify(session.user));

    // Notify components in this window
    window.dispatchEvent(new CustomEvent('jpa:session-changed', { detail: session }));
  } catch (e) {
    console.error('Error setting tab session:', e);
  }
}

export function getKnownAccounts(): TabSession[] {
  if (typeof window === 'undefined') return [];
  ensureCleanAdminStorage();
  try {
    const raw = localStorage.getItem(JPA_KNOWN_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function switchActiveAccount(targetEmailOrToken: string): boolean {
  if (typeof window === 'undefined') return false;

  const accounts = getKnownAccounts();
  const match = accounts.find(
    (a) =>
      a.token === targetEmailOrToken ||
      a.user.email.toLowerCase() === targetEmailOrToken.toLowerCase()
  );

  if (!match) return false;

  setActiveTabSession(match);
  window.location.reload();
  return true;
}

export async function logoutActiveAccount(): Promise<void> {
  if (typeof window === 'undefined') return;

  const current = getActiveTabSession();

  try {
    // 1. Remove from this tab's sessionStorage
    sessionStorage.removeItem(JPA_TAB_SESSION_KEY);

    // 2. Remove from known accounts in localStorage
    if (current) {
      const known = getKnownAccounts();
      const filtered = known.filter(
        (a) => a.user.email.toLowerCase() !== current.user.email.toLowerCase()
      );
      localStorage.setItem(JPA_KNOWN_ACCOUNTS_KEY, JSON.stringify(filtered));
      // Do NOT silently restore the previous account
      localStorage.removeItem(JPA_CACHED_USER_KEY);
    } else {
      localStorage.removeItem(JPA_CACHED_USER_KEY);
    }

    // 3. Expire the cookie immediately
    document.cookie = 'jpa_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';

    // 4. Invalidate server cookie
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  } finally {
    // Redirect cleanly to login without silent restore
    window.location.href = toStaticSpaceUrl('/login?switch=true');
  }
}

if (typeof window !== 'undefined' && typeof Response !== 'undefined' && Response.prototype && !(window as any).__jpa_safe_json_installed) {
  (window as any).__jpa_safe_json_installed = true;
  const origResponseJson = Response.prototype.json;
  Response.prototype.json = async function () {
    try {
      const text = await this.text();
      if (!text || !text.trim()) return {};
      return JSON.parse(text);
    } catch {
      return {};
    }
  };
}

function withSafeJson(res: Response): Response {
  return res;
}

/**
 * Transparent fetch interceptor that attaches the current tab's active session token
 * to every API request without modifying page code.
 */
export function installFetchInterceptor(): void {
  if (typeof window === 'undefined') return;
  installStaticSpaceRouter();
  if ((window as any).__jpa_fetch_intercepted) return;
  (window as any).__jpa_fetch_intercepted = true;

  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isApiCall = rawUrl.includes('/api/');

    try {
      const active = getActiveTabSession();
      if (active?.token && active.token.length <= 1024) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has('x-jpa-session-token')) {
          headers.set('x-jpa-session-token', active.token);
        }
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${active.token}`);
        }
        init.headers = headers;
      }

      if (isStaticSpaceHost()) {
        const staticApiRes = await handleStaticSpaceApiRequest(input, init);
        if (staticApiRes) {
          return withSafeJson(staticApiRes);
        }

        // Intercept Next.js RSC prefetch / router.push requests on static host
        const parsedUrl = new URL(rawUrl, window.location.origin);
        const reqHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));
        if (parsedUrl.searchParams.has('_rsc') || reqHeaders.get('RSC') === '1') {
          const isPrefetch =
            reqHeaders.get('Next-Router-Prefetch') === '1' ||
            reqHeaders.get('Next-Router-Segment-Prefetch') !== null ||
            reqHeaders.get('Purpose') === 'prefetch';
          if (!isPrefetch && parsedUrl.pathname !== window.location.pathname) {
            const cleanSearch = new URLSearchParams(parsedUrl.search);
            cleanSearch.delete('_rsc');
            const qs = cleanSearch.toString();
            window.location.href = toStaticSpaceUrl(parsedUrl.pathname + (qs ? `?${qs}` : ''));
          }
          return new Response('', { status: 200, headers: { 'Content-Type': 'text/x-component' } });
        }
      }
    } catch {}

    if (isApiCall) {
      const reqMethod = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      try {
        const res = await originalFetch.call(this, input, init);
        return withSafeJson(res);
      } catch {
        // GET polls fail silently; writes must surface a clear, retryable error
        if (reqMethod === 'GET') {
          return withSafeJson(
            new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
          );
        }
        return withSafeJson(
          new Response(
            JSON.stringify({ error: 'Network interrupted while saving. Please click again to retry.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
    }

    return originalFetch.call(this, input, init);
  };
}

export function updateActiveUserAvatar(avatarUrl: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getActiveTabSession();
    if (current && current.user) {
      current.user.picture = avatarUrl || undefined;
      current.user.avatarUrl = avatarUrl || undefined;
      sessionStorage.setItem(JPA_TAB_SESSION_KEY, JSON.stringify(current));

      const known = getKnownAccounts();
      const updated = known.map((a) => {
        if (a.user.email.toLowerCase() === current.user.email.toLowerCase()) {
          return {
            ...a,
            user: { ...a.user, picture: avatarUrl || undefined, avatarUrl: avatarUrl || undefined },
          };
        }
        return a;
      });
      localStorage.setItem(JPA_KNOWN_ACCOUNTS_KEY, JSON.stringify(updated));
      localStorage.setItem(JPA_CACHED_USER_KEY, JSON.stringify(current.user));

      window.dispatchEvent(new CustomEvent('jpa:session-changed', { detail: current }));
    }
  } catch (e) {
    console.error('Error updating active user avatar:', e);
  }
}

// Auto-install interceptor on client load
if (typeof window !== 'undefined') {
  installFetchInterceptor();
  window.addEventListener('focus', syncTabCookie);
}
