'use client';

import { api } from './client';
import type {
  AdminEvent, AdminReview, AdminStats, AdminUser, AuditCategory, AuditEntry, EventStatus, Language, Page, Paged, PlatformSettings,
  ReportGroup, ReportStatus, ReviewStatus, Role, SiteContent,
} from './types';

type Counts<K extends string> = Partial<Record<K, number>>;

/** Admin console API (/admin/*). Every change is written to the audit log by the backend. */
export const adminApi = {
  stats: () => api.get<AdminStats>('/admin/stats'),

  users: (query: { query?: string; role?: Role; status?: 'active' | 'pending' | 'blocked'; page?: number; pageSize?: number }) =>
    api.get<Paged<AdminUser>>('/admin/users', { query }),
  inviteUser: (body: { name?: string; email: string; role: Role }) => api.post<AdminUser>('/admin/users/invite', body),
  updateUser: (id: string, body: { role?: Role; status?: 'active' | 'blocked' }) => api.patch<AdminUser>(`/admin/users/${id}`, body),
  setUserPassword: (id: string, password: string) => api.post(`/admin/users/${id}/password`, { password }),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),

  events: (query: { query?: string; status?: EventStatus; page?: number; pageSize?: number }) =>
    api.get<Paged<AdminEvent> & { counts: Counts<EventStatus> }>('/admin/events', { query }),
  setEventStatus: (id: string, status: EventStatus) => api.patch(`/admin/events/${id}`, { status }),
  deleteEvent: (id: string) => api.delete(`/admin/events/${id}`),

  reports: (query: { status?: ReportStatus; sort?: 'ai' | 'reports' | 'recent' }) =>
    api.get<{ counts: Counts<ReportStatus>; items: ReportGroup[] }>('/admin/reports', { query }),
  resolveReports: (photoIds: string[], action: 'keep' | 'remove' | 'reopen') =>
    api.post<{ updated: number }>('/admin/reports/resolve', { photoIds, action }),

  reviews: (status?: ReviewStatus) => api.get<{ counts: Counts<ReviewStatus>; items: AdminReview[] }>('/admin/reviews', { query: { status } }),
  updateReview: (id: string, body: { status?: ReviewStatus; featured?: boolean }) => api.patch<AdminReview>(`/admin/reviews/${id}`, body),
  deleteReview: (id: string) => api.delete(`/admin/reviews/${id}`),

  content: (locale: Language) => api.get<SiteContent>(`/admin/content/${locale}`),
  saveContent: (locale: Language, content: SiteContent) => api.put<SiteContent>(`/admin/content/${locale}`, content),

  settings: () => api.get<PlatformSettings>('/admin/settings'),
  saveSettings: (patch: Partial<PlatformSettings>) => api.patch<PlatformSettings>('/admin/settings', patch),

  audit: (query: { category?: AuditCategory; query?: string; cursor?: string; limit?: number }) =>
    api.get<Page<AuditEntry>>('/admin/audit', { query }),
};
