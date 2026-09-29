'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '@/api/auth';
import { clearTokens, hasSession, onSessionEnd, setTokens } from '@/api/session';
import type { AuthResult, Role, User } from '@/api/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

export interface AuthState {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  /** Finish Google sign-in with tokens from the /auth/callback fragment. */
  acceptTokens: (tokens: { accessToken: string; refreshToken: string; expiresIn: number }) => Promise<User>;
  logout: () => Promise<void>;
  /** Replace the cached user after a profile change. */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** Where a user lands after signing in. */
export const homeFor = (user: Pick<User, 'role'>) => (user.role === 'admin' ? '/admin' : '/dashboard');

function useAuthStore(): AuthState {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUserState] = useState<User | null>(null);

  const signedIn = useCallback((u: User) => {
    setUserState(u);
    setStatus('authenticated');
    return u;
  }, []);

  const signedOut = useCallback(() => {
    setUserState(null);
    setStatus('anonymous');
  }, []);

  // Restore the session on load (refresh token in storage → /auth/me).
  useEffect(() => {
    let cancelled = false;
    if (!hasSession()) {
      queueMicrotask(signedOut);
      return;
    }
    authApi.me()
      .then(u => { if (!cancelled) signedIn(u); })
      .catch(() => { if (!cancelled) signedOut(); });
    return () => { cancelled = true; };
  }, [signedIn, signedOut]);

  // Refresh failed / signed out in another tab.
  useEffect(() => onSessionEnd(signedOut), [signedOut]);

  const accept = useCallback((r: AuthResult) => {
    setTokens(r);
    return signedIn(r.user);
  }, [signedIn]);

  const login = useCallback(async (email: string, password: string) => accept(await authApi.login({ email, password })), [accept]);
  const register = useCallback(async (name: string, email: string, password: string) => accept(await authApi.register({ name, email, password })), [accept]);

  const acceptTokens = useCallback(async (tokens: { accessToken: string; refreshToken: string; expiresIn: number }) => {
    setTokens(tokens);
    return signedIn(await authApi.me());
  }, [signedIn]);

  const logout = useCallback(async () => {
    await authApi.logout();
    clearTokens();
    signedOut();
  }, [signedOut]);

  return useMemo(
    () => ({ status, user, login, register, acceptTokens, logout, setUser: signedIn }),
    [status, user, login, register, acceptTokens, logout, signedIn],
  );
}

/** Mounted once in app/layout.tsx. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return createElement(AuthContext.Provider, { value: useAuthStore() }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider> (app/layout.tsx)');
  return ctx;
}

/**
 * Client-side gate for private areas: sends anonymous visitors to /login and
 * users without the right role to their own home. The API enforces the same
 * rules, this only keeps people from seeing screens they can't use.
 * Returns the user once access is confirmed, otherwise null (render a loader).
 */
export function useRequireAuth(roles: Role[]): User | null {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = status === 'authenticated' && !!user && roles.includes(user.role);

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (status === 'authenticated' && user && !roles.includes(user.role)) router.replace(homeFor(user));
  }, [status, user, roles, router, pathname]);

  return allowed ? user : null;
}
