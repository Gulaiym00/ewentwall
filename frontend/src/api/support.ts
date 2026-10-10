'use client';

import { api } from './client';
import type { Role, UserStatus } from './types';

export type SupportTopic = 'password' | 'account' | 'event' | 'other';
export type TicketStatus = 'open' | 'resolved';

export interface ChatMessage {
  id: string;
  fromAdmin: boolean;
  authorName: string;
  text: string;
  /** Attached picture, GIF or sticker. */
  imageUrl: string | null;
  createdAt: string;
}

/** A conversation as the admin sees it. In the list, `messages` holds only the last message. */
export interface SupportTicket {
  id: string;
  email: string;
  name: string | null;
  topic: SupportTopic;
  status: TicketStatus;
  createdAt: string;
  resolvedAt: string | null;
  lastMessageAt: string;
  /** Messages from the user the admin hasn't opened yet. */
  unread: number;
  /** The account with this email, if there is one. */
  user: { id: string; name: string; role: Role; status: UserStatus; hasPassword: boolean; google: boolean } | null;
  messages: ChatMessage[];
}

export interface MyChat {
  status: TicketStatus | null;
  messages: ChatMessage[];
}

/** Text, an image (photo, GIF, sticker) or both. */
export interface OutgoingMessage {
  text: string;
  image?: File | null;
}

export const CHAT_IMAGE_MAX_MB = 10;

const messageForm = ({ text, image }: OutgoingMessage) => {
  const form = new FormData();
  if (text) form.append('text', text);
  if (image) form.append('image', image);
  return form;
};

/** Support chat between organizers and admins, plus the sign-in-free form on the login page. */
export const supportApi = {
  send: (body: { email: string; name?: string; topic: SupportTopic; message: string }) =>
    api.post<{ id: string }>('/support', body, { auth: 'none' }),

  myChat: () => api.get<MyChat>('/support/chat'),
  myUnread: () => api.get<{ count: number }>('/support/chat/unread'),
  sendMine: (body: OutgoingMessage) => api.post<MyChat>('/support/chat', messageForm(body)),

  tickets: (status?: TicketStatus) =>
    api.get<{ counts: Partial<Record<TicketStatus, number>>; items: SupportTicket[]; emailEnabled: boolean }>('/admin/support', { query: { status } }),
  ticket: (id: string) => api.get<SupportTicket>(`/admin/support/${id}`),
  reply: (id: string, body: OutgoingMessage) => api.post<SupportTicket>(`/admin/support/${id}/messages`, messageForm(body)),
  /** Sent by the server (SMTP); the email is also added to the conversation. */
  email: (id: string, body: { subject: string; text: string }) => api.post<SupportTicket>(`/admin/support/${id}/email`, body),
  update: (id: string, status: TicketStatus) => api.patch<SupportTicket>(`/admin/support/${id}`, { status }),
  remove: (id: string) => api.delete(`/admin/support/${id}`),
};
