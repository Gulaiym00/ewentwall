'use client';

import { api } from './client';

export interface MyReview {
  id: string;
  eventId: string | null;
  rating: number;
  text: string;
  status: 'pending' | 'published' | 'hidden';
  createdAt: string;
}

/** Organizer's reviews of the service; the admin approves them before they reach the landing page. */
export const reviewsApi = {
  mine: () => api.get<MyReview[]>('/reviews/mine'),
  create: (body: { rating: number; text: string; eventId?: string }) =>
    api.post<Omit<MyReview, 'eventId'>>('/reviews', body),
};
