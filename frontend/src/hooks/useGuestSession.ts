'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { getGuestSession, setGuestSession, type GuestSession } from '@/api/session';

const CHANGE = 'epw:guest-session';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/**
 * The guest's session for one event (token from POST /e/:slug/join), kept in localStorage.
 * Server render and first client render see `null`, so there's no hydration mismatch.
 */
export function useGuestSession(slug: string): [GuestSession | null, (s: GuestSession | null) => void] {
  // Snapshot as a string so React can compare it cheaply between renders.
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(getGuestSession(slug)),
    () => 'null',
  );
  const session = useMemo(() => JSON.parse(raw) as GuestSession | null, [raw]);

  const set = useCallback((s: GuestSession | null) => {
    setGuestSession(slug, s);
    window.dispatchEvent(new Event(CHANGE));
  }, [slug]);

  return [session, set];
}
