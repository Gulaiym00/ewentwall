'use client';

import { createContext, createElement, useContext, useMemo } from 'react';
import { adminApi } from '@/api/admin';
import type { AdminStats } from '@/api/types';
import { useApi } from './useApi';
import { useAuth } from './useAuth';

// Shared admin-console state: the dashboard stats that also feed the sidebar
// counters. Each section loads its own data through `adminApi` and calls
// `refreshCounts()` after an action so the badges stay in sync.

export interface AdminStore {
  stats: AdminStats | undefined;
  statsError: Error | undefined;
  counts: { pendingReports: number; pendingReviews: number; openTickets: number };
  refreshCounts: () => void;
}

function useAdminStore(): AdminStore {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const stats = useApi(() => (isAdmin ? adminApi.stats() : Promise.resolve(undefined)), [isAdmin]);

  return useMemo(() => ({
    stats: stats.data,
    statsError: stats.error,
    counts: { pendingReports: stats.data?.pendingReports ?? 0, pendingReviews: stats.data?.pendingReviews ?? 0, openTickets: stats.data?.openTickets ?? 0 },
    refreshCounts: stats.reload,
  }), [stats.data, stats.error, stats.reload]);
}

const AdminContext = createContext<AdminStore | null>(null);

/** Wraps the admin area (see app/admin/layout.tsx). */
export function AdminProvider({ children }: { children: React.ReactNode }) {
  return createElement(AdminContext.Provider, { value: useAdminStore() }, children);
}

export function useAdmin(): AdminStore {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider> (app/admin/layout.tsx)');
  return ctx;
}
