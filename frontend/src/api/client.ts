'use client';

import { API_URL, clearTokens, getAccessToken, getGuestSession, refreshAccess } from './session';

export { API_URL };

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Who the request is sent as:
 * - 'user'  — signed-in organizer/admin (access token, refreshed automatically)
 * - { guest: slug } — guest of that event (token from POST /e/:slug/join), if joined
 * - 'none'  — anonymous
 */
export type AuthMode = 'user' | 'none' | { guest: string };

interface Options {
  body?: unknown;
  auth?: AuthMode;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

const messageOf = (body: unknown, status: number) => {
  const m = (body as { message?: unknown } | undefined)?.message;
  if (Array.isArray(m)) return m.join('. ');
  if (typeof m === 'string') return m;
  return status >= 500 ? 'Something went wrong on our side. Please try again.' : `Request failed (${status})`;
};

export function url(path: string, query?: Options['query']) {
  const qs = query
    ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString()
    : '';
  return `${API_URL}${path}${qs ? `?${qs}` : ''}`;
}

async function authHeader(auth: AuthMode): Promise<Record<string, string>> {
  if (auth === 'none') return {};
  if (auth === 'user') {
    const token = await getAccessToken();
    if (!token) throw new ApiError(401, 'Please sign in');
    return { Authorization: `Bearer ${token}` };
  }
  const guest = getGuestSession(auth.guest);
  return guest ? { Authorization: `Bearer ${guest.token}` } : {};
}

async function send(method: string, path: string, opts: Options, retried = false): Promise<Response> {
  const auth = opts.auth ?? 'user';
  const isForm = opts.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url(path, opts.query), {
      method,
      headers: { ...(opts.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}), ...(await authHeader(auth)) },
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  // Access token expired between the check and the request: refresh once and retry.
  if (res.status === 401 && auth === 'user' && !retried) {
    const token = await refreshAccess();
    if (token) return send(method, path, opts, true);
    clearTokens();
  }
  return res;
}

async function request<T>(method: string, path: string, opts: Options = {}): Promise<T> {
  const res = await send(method, path, opts);
  const body = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, messageOf(body, res.status), body);
  return body as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<Options, 'body'>) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: Omit<Options, 'body'>) => request<T>('POST', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<Options, 'body'>) => request<T>('PATCH', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<Options, 'body'>) => request<T>('PUT', path, { ...opts, body }),
  delete: <T = void>(path: string, opts?: Omit<Options, 'body'>) => request<T>('DELETE', path, opts),
};

/** Human-readable message for any error thrown by the API layer. */
export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');
