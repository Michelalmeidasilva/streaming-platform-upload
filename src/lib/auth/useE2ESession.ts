'use client';

import { useLayoutEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { createE2ESession, E2E_AUTH_COOKIE } from './e2e';

/**
 * Resolves the effective session by overlaying an optional E2E test session on
 * top of NextAuth. Uses useLayoutEffect to read the cookie before the first
 * paint, preventing a loading-state flash when the E2E overlay is active.
 */
export function useE2ESession() {
  const { data: session, status } = useSession();
  const e2eAuthEnabled = process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED === '1';

  // undefined = cookie not yet read; null = no e2e session
  type E2ESessionValue = ReturnType<typeof createE2ESession> | null | undefined;
  const [e2eSession, setE2ESession] = useState<E2ESessionValue>(e2eAuthEnabled ? undefined : null);

  useLayoutEffect(() => {
    if (!e2eAuthEnabled) {
      setE2ESession(null);
      return;
    }
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${E2E_AUTH_COOKIE}=`))
      ?.split('=')
      .slice(1)
      .join('=');
    setE2ESession(cookieValue ? createE2ESession(decodeURIComponent(cookieValue)) : null);
  }, [e2eAuthEnabled]);

  const effectiveSession = e2eSession ?? session;
  // Treat undefined e2e session as loading to avoid a premature unauthenticated
  // redirect before the cookie has been read.
  let effectiveStatus: 'loading' | 'authenticated' | typeof status;
  if (e2eSession === undefined) {
    effectiveStatus = 'loading';
  } else if (e2eSession) {
    effectiveStatus = 'authenticated';
  } else {
    effectiveStatus = status;
  }

  // Immediately applies an e2e session (optimistic update before the page reloads).
  const activateE2ESession = (email: string) => setE2ESession(createE2ESession(email));

  return { effectiveSession, effectiveStatus, activateE2ESession };
}
