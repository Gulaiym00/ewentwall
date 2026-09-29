'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { errorMessage } from '@/api/client';
import { homeFor, useAuth } from '@/hooks/useAuth';

/**
 * Landing point after Google sign-in. The backend redirects here with the tokens
 * in the URL fragment (#accessToken=…&refreshToken=…), which never reaches a server.
 */
export default function AuthCallback() {
  const { acceptTokens } = useAuth();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    // Remove the tokens from the address bar and browser history right away.
    window.history.replaceState(null, '', window.location.pathname);

    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const expiresIn = Number(params.get('expiresIn') ?? 900);
    if (!accessToken || !refreshToken) {
      router.replace('/login?error=' + encodeURIComponent('Google sign-in did not complete, please try again'));
      return;
    }
    acceptTokens({ accessToken, refreshToken, expiresIn })
      .then(user => router.replace(homeFor(user)))
      .catch(err => router.replace('/login?error=' + encodeURIComponent(errorMessage(err))));
  }, [acceptTokens, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-muted">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" className="spin" aria-hidden="true">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <p className="text-sm font-medium">Signing you in…</p>
    </div>
  );
}
