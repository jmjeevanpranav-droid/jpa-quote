'use client';

import { useEffect } from 'react';
import { installFetchInterceptor, syncTabCookie } from '@/lib/auth/client-context';

export function ClientSessionSync() {
  useEffect(() => {
    installFetchInterceptor();
    syncTabCookie();

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

