'use client';

import { api, API_URL } from './client';
import { getRefreshToken } from './session';
import type { AuthResult, Language, User } from './types';

export const authApi = {
  register: (body: { name: string; email: string; password: string }) => api.post<AuthResult>('/auth/register', body, { auth: 'none' }),
  login: (body: { email: string; password: string }) => api.post<AuthResult>('/auth/login', body, { auth: 'none' }),
  me: () => api.get<User>('/auth/me'),
  logout: async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) await api.post('/auth/logout', { refreshToken }, { auth: 'none' }).catch(() => undefined);
  },
  googleStatus: () => api.get<{ enabled: boolean }>('/auth/google/status', { auth: 'none' }),
  /** Full-page redirect target that starts Google sign-in. */
  googleUrl: `${API_URL}/auth/google`,
};

export interface ProfileInput {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  language?: Language;
  notifications?: Partial<User['notifications']>;
}

export const meApi = {
  update: (body: ProfileInput) => api.patch<User>('/me', body),
  changePassword: (body: { currentPassword?: string; newPassword: string }) => api.post<void>('/me/password', body),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<User>('/me/avatar', form);
  },
  removeAvatar: () => api.delete<User>('/me/avatar'),
  deleteAccount: () => api.delete('/me'),
};
