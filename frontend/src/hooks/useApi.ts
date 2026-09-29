'use client';

import { useCallback, useEffect, useState } from 'react';

export interface ApiState<T> {
  data: T | undefined;
  error: Error | undefined;
  /** True while the current request (first load, reload or changed deps) is in flight. */
  loading: boolean;
  reload: () => void;
  /** Update the cached data locally (optimistic updates). */
  setData: (update: (prev: T | undefined) => T | undefined) => void;
}

/**
 * Loads data from the API and reloads it when `deps` change.
 *   const { data, loading, error, reload } = useApi(() => adminApi.users({ query }), [query]);
 * Previous data stays visible while a reload is in flight.
 */
export function useApi<T>(load: () => Promise<T>, deps: readonly unknown[]): ApiState<T> {
  const [nonce, setNonce] = useState(0);
  const signature = `${JSON.stringify(deps)}#${nonce}`;
  const [state, setState] = useState<{ signature: string | null; data?: T; error?: Error }>({ signature: null });

  useEffect(() => {
    let alive = true;
    load().then(
      data => { if (alive) setState({ signature, data }); },
      (error: Error) => { if (alive) setState(s => ({ signature, data: s.data, error })); },
    );
    return () => { alive = false; };
    // `load` is a new closure each render; `signature` captures deps + reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  const setData = useCallback((update: (prev: T | undefined) => T | undefined) => setState(s => ({ ...s, data: update(s.data) })), []);

  return { data: state.data, error: state.signature === signature ? state.error : undefined, loading: state.signature !== signature, reload, setData };
}
