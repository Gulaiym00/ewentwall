'use client';

import { createContext, createElement, useContext, useMemo } from 'react';
import { eventsApi } from '@/api/events';
import type { OrganizerEvent, User } from '@/api/types';
import { useApi } from './useApi';
import { useAuth } from './useAuth';

// Organizer area state (/dashboard): the signed-in user and their events,
// loaded once for the sidebar pages and reloaded after changes.

export interface OrganizerStore {
  profile: User | null;
  setProfile: (user: User) => void;
  events: OrganizerEvent[];
  eventsLoading: boolean;
  eventsError: Error | undefined;
  reloadEvents: () => void;
}

function useOrganizerStore(): OrganizerStore {
  const { user, setUser } = useAuth();
  const events = useApi(() => (user ? eventsApi.list() : Promise.resolve([])), [user?.id]);

  return useMemo(() => ({
    profile: user,
    setProfile: setUser,
    events: events.data ?? [],
    eventsLoading: events.loading && !events.data,
    eventsError: events.error,
    reloadEvents: events.reload,
  }), [user, setUser, events.data, events.loading, events.error, events.reload]);
}

const OrganizerContext = createContext<OrganizerStore | null>(null);

/** Wraps the organizer area (see app/dashboard/(shell)/layout.tsx). */
export function OrganizerProvider({ children }: { children: React.ReactNode }) {
  return createElement(OrganizerContext.Provider, { value: useOrganizerStore() }, children);
}

/** Organizer profile and events: `const { profile, events } = useOrganizer();` */
export function useOrganizer(): OrganizerStore {
  const ctx = useContext(OrganizerContext);
  if (!ctx) throw new Error('useOrganizer must be used inside <OrganizerProvider> (app/dashboard/(shell)/layout.tsx)');
  return ctx;
}
