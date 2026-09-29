'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import EventCard from '@/components/EventCard';
import { Icon } from '@/ui/icons';
import { Card, EmptyState, PageHeader, SearchInput, Tabs } from '@/ui';
import type { EventStatus } from '@/api/types';
import { LoadError, PageLoader } from '@/ui/loader';
import { useOrganizer } from '@/hooks/useOrganizer';
import { useT } from '@/utils/locale';

export default function MyEvents() {
  const t = useT();
  const { events, eventsLoading, eventsError, reloadEvents } = useOrganizer();
  const [tab, setTab] = useState<'all' | EventStatus>('all');
  const [query, setQuery] = useState('');

  const count = (s: EventStatus) => events.filter(e => e.status === s).length;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(e => (tab === 'all' || e.status === tab) &&
      (!q || e.name.toLowerCase().includes(q) || (e.location ?? '').toLowerCase().includes(q)));
  }, [events, tab, query]);

  return (
    <>
      <PageHeader title={t('My Events', 'Мои события')} description={t('Everything you have created, past and upcoming.', 'Все ваши события — прошедшие и предстоящие.')}
        actions={
          <Link href="/dashboard/create" className="btn-press inline-flex h-10 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white">
            <Icon name="plus" size={16} /> {t('New event', 'Новое событие')}
          </Link>
        } />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'all', label: t('All', 'Все'), count: events.length },
          { value: 'active', label: t('Active', 'Идут'), count: count('active') },
          { value: 'upcoming', label: t('Upcoming', 'Скоро'), count: count('upcoming') },
          { value: 'closed', label: t('Closed', 'Завершены'), count: count('closed') },
          ...(count('flagged') ? [{ value: 'flagged' as const, label: t('Under review', 'На проверке'), count: count('flagged') }] : []),
        ]} />
        <SearchInput value={query} onChange={setQuery} placeholder={t('Search by name or city', 'Поиск по названию или городу')} className="md:w-72" />
      </div>

      {eventsLoading ? <PageLoader label={t('Loading your events…', 'Загружаем события…')} /> : eventsError ? <LoadError message={eventsError.message} onRetry={reloadEvents} /> : list.length === 0 ? (
        <Card><EmptyState icon="calendar" title={t('No events found', 'Событий не найдено')} description={t('Try another filter, or create a new event.', 'Попробуйте другой фильтр или создайте событие.')} /></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map(e => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </>
  );
}
