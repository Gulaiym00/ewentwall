'use client';

import type { TokenPair } from './types';

// Token storage for signed-in users.
// - Access token: memory only (short-lived, never persisted).
// - Refresh token: localStorage, so a reload keeps you signed in.
// The backend rotates the refresh token on every use and treats reuse as theft,
// so refreshes are serialised across tabs with the Web Locks API.

// Without NEXT_PUBLIC_API_URL (local development) the API is assumed on the same host as the page,
// so the site works from localhost and from a phone on the LAN even when the computer's IP changes.
function apiUrl(): string {
  const fixed = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fixed) return fixed.replace(/\/$/, '');
  const port = process.env.NEXT_PUBLIC_API_PORT || '8000';
  const host = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
  return `http://${host}:${port}/api`;
}

export const API_URL = apiUrl();

const REFRESH_KEY = 'epw.refreshToken';
const LOCK = 'epw.refresh';

let accessToken: string | null = null;
let accessExpiresAt = 0;
let inflight: Promise<string | null> | null = null;
const listeners = new Set<() => void>();

const read = () => { try { return localStorage.getItem(REFRESH_KEY); } catch { return null; } };
const write = (v: string | null) => {
  try { if (v) localStorage.setItem(REFRESH_KEY, v); else localStorage.removeItem(REFRESH_KEY); } catch { /* private mode */ }
};

export function setTokens(pair: TokenPair) {
  accessToken = pair.accessToken;
  accessExpiresAt = Date.now() + Math.max(pair.expiresIn - 30, 5) * 1000; // refresh 30 s early
  write(pair.refreshToken);
}

/** Forget the session locally and tell listeners (the auth provider signs the user out). */
export function clearTokens() {
  accessToken = null;
  accessExpiresAt = 0;
  write(null);
  listeners.forEach(fn => fn());
}

export const hasSession = () => !!accessToken || !!read();
export const getRefreshToken = read;

/** Called when the session ends (refresh failed, sign-out in another tab…). */
export function onSessionEnd(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = read(); // re-read inside the lock: another tab may have rotated it
  if (!refreshToken) return null;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (res.status === 401 || res.status === 400) {
    clearTokens();
    return null;
  }
  if (!res.ok) throw new Error(`Session refresh failed (${res.status})`);
  setTokens((await res.json()) as TokenPair);
  return accessToken;
}

/** Exchanges the refresh token for a new access token. Concurrent callers share one request. */
export function refreshAccess(): Promise<string | null> {
  if (!inflight) {
    // locks.request resolves with the callback's awaited result; its typings nest the promise.
    const run = typeof navigator !== 'undefined' && navigator.locks
      ? (navigator.locks.request(LOCK, () => doRefresh()) as unknown as Promise<string | null>)
      : doRefresh();
    inflight = run.finally(() => { inflight = null; });
  }
  return inflight;
}

/** A valid access token, refreshing it when needed; null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < accessExpiresAt) return accessToken;
  if (!read()) return null;
  return refreshAccess();
}

// Signing out in one tab signs out the others.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === REFRESH_KEY && e.newValue === null && accessToken) {
      accessToken = null;
      accessExpiresAt = 0;
      listeners.forEach(fn => fn());
    }
  });
}

// ─── Guest tokens (one per event, from POST /e/:slug/join) ───────────────────

export interface GuestSession { token: string; name: string | null }
const guestKey = (slug: string) => `epw.guest.${slug}`;

export function getGuestSession(slug: string): GuestSession | null {
  try {
    const raw = localStorage.getItem(guestKey(slug));
    return raw ? (JSON.parse(raw) as GuestSession) : null;
  } catch {
    return null;
  }
}

export function setGuestSession(slug: string, session: GuestSession | null) {
  try {
    if (session) localStorage.setItem(guestKey(slug), JSON.stringify(session));
    else localStorage.removeItem(guestKey(slug));
  } catch { /* private mode */ }
}
