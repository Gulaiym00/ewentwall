'use client';

import { api, ApiError, API_URL, url } from './client';
import { getGuestSession, setGuestSession } from './session';
import { compressImage } from '@/utils/compress-image';
import type { Comment, Page, Photo, PublicEvent, Reactor, ReportReason } from './types';

const as = (slug: string) => ({ auth: { guest: slug } as const });

/** Guest side of an event, behind the QR link /e/{slug}. */
export const guestApi = {
  event: (slug: string) => api.get<PublicEvent>(`/e/${slug}`, { auth: 'none' }),

  join: async (slug: string, body: { name?: string; pin?: string }) => {
    const res = await api.post<{ guestToken: string; guest: { id: string; name: string | null } }>(`/e/${slug}/join`, body, { auth: 'none' });
    setGuestSession(slug, { token: res.guestToken, name: res.guest.name });
    return res;
  },

  photos: (slug: string, query: { sort?: 'newest' | 'popular' | 'mine'; cursor?: string; limit?: number } = {}) =>
    api.get<Page<Photo>>(`/e/${slug}/photos`, { ...as(slug), query }),

  /** Uploads with real progress (fetch can't report upload progress, XHR can). */
  upload: async (slug: string, originals: File[], caption: string, onProgress?: (pct: number) => void) => {
    const files = await Promise.all(originals.map(compressImage));
    return new Promise<{ photos: Photo[]; awaitingApproval: boolean }>((resolve, reject) => {
      const session = getGuestSession(slug);
      if (!session) return reject(new ApiError(401, 'Join the event first'));
      const form = new FormData();
      for (const f of files) form.append('files', f);
      if (caption.trim()) form.append('caption', caption.trim());

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/e/${slug}/photos`);
      xhr.setRequestHeader('Authorization', `Bearer ${session.token}`);
      xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        let body: unknown;
        try { body = JSON.parse(xhr.responseText); } catch { body = undefined; }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(body as { photos: Photo[]; awaitingApproval: boolean });
        const m = (body as { message?: string | string[] } | undefined)?.message;
        reject(new ApiError(xhr.status, Array.isArray(m) ? m.join('. ') : m ?? `Upload failed (${xhr.status})`, body));
      };
      xhr.onerror = () => reject(new ApiError(0, 'Upload failed — check your connection and try again'));
      xhr.send(form);
    });
  },

  react: (slug: string, photoId: string, emoji: string) => api.post<Photo>(`/photos/${photoId}/reactions`, { emoji }, as(slug)),
  reactions: (slug: string, photoId: string) => api.get<Reactor[]>(`/photos/${photoId}/reactions`, as(slug)),
  comments: (slug: string, photoId: string) => api.get<Comment[]>(`/photos/${photoId}/comments`, as(slug)),
  comment: (slug: string, photoId: string, text: string) => api.post<Comment>(`/photos/${photoId}/comments`, { text }, as(slug)),
  report: (slug: string, photoId: string, reason: ReportReason) => api.post(`/photos/${photoId}/reports`, { reason }, as(slug)),
  deletePhoto: (slug: string, photoId: string) => api.delete(`/photos/${photoId}`, as(slug)),

  /** Server-Sent Events stream of the live wall; private events pass the guest token as ?token=. */
  streamUrl: (slug: string) => url(`/e/${slug}/stream`, { token: getGuestSession(slug)?.token }),
};
