'use client';

import { useEffect } from 'react';
import { installFetchInterceptor, syncTabCookie, getActiveTabSession } from '@/lib/auth/client-context';
import { isStaticSpaceHost, toStaticSpaceUrl, installStaticSpaceRouter } from '@/lib/auth/static-space-engine';

export function ClientSessionSync() {
  useEffect(() => {
    installStaticSpaceRouter();
    installFetchInterceptor();
    syncTabCookie();

    if (isStaticSpaceHost()) {
      const session = getActiveTabSession();
      const pathname = window.location.pathname;
      if (!session?.token && !pathname.startsWith('/login')) {
        window.location.replace(toStaticSpaceUrl('/login'));
        return;
      }
    }

    const onSync = () => {
      syncTabCookie();
    };

    window.addEventListener('focus', onSync);
    window.addEventListener('visibilitychange', onSync);

    return () => {
      window.removeEventListener('focus', onSync);
      window.removeEventListener('visibilitychange', onSync);
    };
  }, []);

  return null;
}

