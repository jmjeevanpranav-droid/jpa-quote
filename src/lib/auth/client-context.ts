'use client';

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
const JPA_CLEAN_EMAILS_V2_KEY = 'jpa_clean_emails_v2';
const ADMIN_EMAIL = 'jeevanpranavagencies@gmail.com';

function ensureCleanAdminStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(JPA_CLEAN_EMAILS_V2_KEY) === '1') return;

    const knownRaw = localStorage.getItem(JPA_KNOWN_ACCOUNTS_KEY);
    if (knownRaw) {
      const known = JSON.parse(knownRaw);
      if (Array.isArray(known)) {
        const onlyAdmin = known.filter(
          (s: any) => s?.user?.email?.toLowerCase() === ADMIN_EMAIL
        );
        localStorage.setItem(JPA_KNOWN_ACCOUNTS_KEY, JSON.stringify(onlyAdmin));
      }
    }

    const rememberEmail = localStorage.getItem('jpa_remember_email');
    if (rememberEmail && rememberEmail.trim().toLowerCase() !== ADMIN_EMAIL) {
      localStorage.removeItem('jpa_remember_email');
      localStorage.removeItem('jpa_remember_me');
    }

    const cachedRaw = localStorage.getItem(JPA_CACHED_USER_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached?.email?.toLowerCase() !== ADMIN_EMAIL) {
        localStorage.removeItem(JPA_CACHED_USER_KEY);
      }
    }

    const tabRaw = sessionStorage.getItem(JPA_TAB_SESSION_KEY);
    if (tabRaw) {
      const tab = JSON.parse(tabRaw);
      if (tab?.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
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
  if (active?.token) {
    document.cookie = `jpa_session_token=${encodeURIComponent(active.token)}; path=/; max-age=2592000; SameSite=Lax`;
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

    // 3. Sync cookie for full-page SSR navigation
    if (session.token) {
      document.cookie = `jpa_session_token=${encodeURIComponent(session.token)}; path=/; max-age=2592000; SameSite=Lax`;
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
    window.location.href = '/login?switch=true';
  }
}

/**
 * Transparent fetch interceptor that attaches the current tab's active session token
 * to every API request without modifying page code.
 */
export function installFetchInterceptor(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__jpa_fetch_intercepted) return;
  (window as any).__jpa_fetch_intercepted = true;

  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    try {
      const active = getActiveTabSession();
      if (active?.token) {
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
    } catch {}

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
