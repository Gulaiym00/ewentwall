'use client';

import { api } from './client';
import type { Role, UserStatus } from './types';

export type SupportTopic = 'password' | 'account' | 'event' | 'other';
export type TicketStatus = 'open' | 'resolved';

export interface SupportTicket {
  id: string;
  email: string;
  name: string | null;
  topic: SupportTopic;
  message: string;
  status: TicketStatus;
  createdAt: string;
  resolvedAt: string | null;
  /** The account with this email, if there is one. */
  user: { id: string; name: string; role: Role; status: UserStatus; hasPassword: boolean; google: boolean } | null;
}

/** Support form on the site (works without signing in) and its inbox in Admin → Support. */
export const supportApi = {
  send: (body: { email: string; name?: string; topic: SupportTopic; message: string }) =>
    api.post<{ id: string }>('/support', body, { auth: 'none' }),

  tickets: (status?: TicketStatus) =>
    api.get<{ counts: Partial<Record<TicketStatus, number>>; items: SupportTicket[] }>('/admin/support', { query: { status } }),
  update: (id: string, status: TicketStatus) => api.patch<SupportTicket>(`/admin/support/${id}`, { status }),
  remove: (id: string) => api.delete(`/admin/support/${id}`),
};
