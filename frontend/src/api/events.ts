'use client';

import { api, blobUrl, url } from './client';
import type { EventInput, OrganizerEvent, Photo } from './types';

/** Organizer's own events (dashboard, create-event wizard). */
export const eventsApi = {
  list: () => api.get<OrganizerEvent[]>('/events'),
  get: (id: string) => api.get<OrganizerEvent>(`/events/${id}`),
  create: (body: EventInput) => api.post<OrganizerEvent>('/events', body),
  update: (id: string, body: EventInput) => api.patch<OrganizerEvent>(`/events/${id}`, body),
  remove: (id: string) => api.delete(`/events/${id}`),
  uploadCover: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<OrganizerEvent>(`/events/${id}/cover`, form);
  },
  /** QR image as an object URL (the endpoint needs the organizer's token). Revoke it when done. */
  qrImage: (id: string, format: 'png' | 'svg' = 'png', download = false) =>
    blobUrl(`/events/${id}/qr`, { query: { format, download: download || undefined } }),
  qrPath: (id: string) => url(`/events/${id}/qr`),
  photos: (id: string, status?: 'pending' | 'published' | 'hidden' | 'removed') => api.get<Photo[]>(`/events/${id}/photos`, { query: { status } }),
  moderatePhoto: (id: string, photoId: string, status: 'published' | 'removed') =>
    api.patch<Photo>(`/events/${id}/photos/${photoId}`, { status }),
};
