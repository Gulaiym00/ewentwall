'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EventQrModal } from '@/components/EventQr';
import { useToast } from '@/components/Toast';
import { Icon } from '@/ui/icons';
import { Badge, Card, ConfirmDialog, EmptyState, IconButton, PageHeader, SearchInput, Tabs, type Tone } from '@/ui';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/client';
import type { AdminEvent, EventStatus } from '@/api/types';
import { formatDate, formatNumber } from '@/utils/format';
import { useAdmin } from '@/hooks/useAdmin';
import { useApi } from '@/hooks/useApi';
import { useDebounced } from '@/hooks/useDebounced';
import { LoadError } from '@/ui/loader';
import { useT } from '@/utils/locale';
import { eventStatusLabel } from '@/utils/labels';

const eventDate = (e: AdminEvent) => (e.startsAt ? formatDate(e.startsAt.slice(0, 10)) : '—');

const TONE: Record<EventStatus, Tone> = { active: 'success', upcoming: 'info', closed: 'neutral', flagged: 'danger' };

export default function AdminEvents() {
  const t = useT();
  const toast = useToast();
  const { refreshCounts } = useAdmin();
  const [tab, setTab] = useState<'all' | EventStatus>('all');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<{ type: 'close' | 'delete'; event: AdminEvent } | null>(null);
  const [qrEvent, setQrEvent] = useState<AdminEvent | null>(null);
  const search = useDebounced(query.trim(), 300);
  const list = useApi(() => adminApi.events({ query: search || undefined, status: tab === 'all' ? undefined : tab, pageSize: 100 }), [search, tab]);

  const counts = list.data?.counts ?? {};
  const count = (s: EventStatus) => counts[s] ?? 0;
  const filtered = list.data?.items ?? [];

  const run = async (action: () => Promise<unknown>, message: string, tone: 'success' | 'danger' = 'success') => {
    try {
      await action();
      toast(message, tone);
      list.reload();
      refreshCounts();
    } catch (err) {
      toast(errorMessage(err), 'danger');
    }
  };
  const setEventStatus = (e: AdminEvent, status: EventStatus, message: string) => run(() => adminApi.setEventStatus(e.id, status), message);

  const actions = (e: AdminEvent) => (
    <div className="flex justify-end gap-0.5">
      <IconButton icon="qr" label={t(`QR code of ${e.name}`, `QR-код: ${e.name}`)} onClick={() => setQrEvent(e)} />
      <Link href={`/dashboard/events/${e.id}`} aria-label={t(`Settings of ${e.name}`, `Настройки: ${e.name}`)} title={t('Event settings', 'Настройки события')}
        className="inline-flex size-9 items-center justify-center rounded-[9px] text-muted hover:bg-bg hover:text-fg">
        <Icon name="settings" size={17} />
      </Link>
      <Link href={`/e/${e.slug}/wall`} aria-label={t(`Open live wall of ${e.name}`, `Открыть живую стену: ${e.name}`)} title={t('Open live wall', 'Открыть живую стену')}
        className="inline-flex size-9 items-center justify-center rounded-[9px] text-muted hover:bg-bg hover:text-fg">
        <Icon name="external" size={17} />
      </Link>
      {e.status === 'flagged' && (
        <IconButton icon="check" label={t(`Mark ${e.name} as reviewed`, `Отметить проверенным: ${e.name}`)}
          onClick={() => setEventStatus(e, 'active', t('Flag cleared', 'Отметка снята'))} className="hover:text-success" />
      )}
      {e.status === 'active' && (
        <IconButton icon="flag" label={t(`Flag ${e.name} for review`, `Отправить на проверку: ${e.name}`)}
          onClick={() => setEventStatus(e, 'flagged', t('Event flagged', 'Событие отмечено'))} className="hover:text-danger" />
      )}
      {(e.status === 'active' || e.status === 'flagged') && (
        <IconButton icon="lock" label={t(`Close ${e.name}`, `Завершить: ${e.name}`)} onClick={() => setConfirm({ type: 'close', event: e })} />
      )}
      <IconButton icon="trash" label={t(`Delete ${e.name}`, `Удалить: ${e.name}`)} onClick={() => setConfirm({ type: 'delete', event: e })} className="hover:text-danger" />
    </div>
  );

  return (
    <>
      <PageHeader title={t('Events', 'События')} description={t('All events across the platform.', 'Все события на платформе.')} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'all', label: t('All', 'Все'), count: Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) },
          { value: 'active', label: eventStatusLabel(t, 'active'), count: count('active') },
          { value: 'upcoming', label: eventStatusLabel(t, 'upcoming'), count: count('upcoming') },
          { value: 'flagged', label: eventStatusLabel(t, 'flagged'), count: count('flagged') },
          { value: 'closed', label: eventStatusLabel(t, 'closed'), count: count('closed') },
        ]} />
        <SearchInput value={query} onChange={setQuery} placeholder={t('Search events, organizers, cities', 'Поиск событий, организаторов, городов')} className="lg:w-80" />
      </div>

      <Card padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <LoadError message={list.error.message} onRetry={list.reload} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="calendar" title={t('No events here', 'Событий нет')} description={t('Nothing matches this filter yet.', 'По этому фильтру пока ничего нет.')} />
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">{t('Event', 'Событие')}</th>
                  <th className="hidden px-3 py-3 font-semibold lg:table-cell">{t('Organizer', 'Организатор')}</th>
                  <th className="px-3 py-3 font-semibold">{t('Date', 'Дата')}</th>
                  <th className="px-3 py-3 text-right font-semibold">{t('Photos', 'Фото')}</th>
                  <th className="hidden px-3 py-3 text-right font-semibold xl:table-cell">{t('Guests', 'Гости')}</th>
                  <th className="px-3 py-3 font-semibold">{t('Status', 'Статус')}</th>
                  <th className="px-5 py-3"><span className="sr-only">{t('Actions', 'Действия')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map(e => (
                  <tr key={e.id} className="transition-colors hover:bg-bg">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {e.coverUrl ? <img src={e.coverUrl} alt="" className="h-10 w-14 shrink-0 rounded-lg bg-line object-cover" /> : <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon name="camera" size={16} /></span>}
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{e.name}</p>
                          <p className="truncate text-xs text-muted">{e.location}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 lg:table-cell">{e.organizer.name}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{eventDate(e)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(e.stats.photos)}</td>
                    <td className="hidden px-3 py-3 text-right tabular-nums xl:table-cell">{formatNumber(e.stats.guests)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={TONE[e.status]} dot>{eventStatusLabel(t, e.status)}</Badge>
                        {e.reports > 0 && <span className="text-xs text-danger" title={t('Open reports', 'Открытые жалобы')}>{e.reports} <span className="sr-only">{t('reports', 'жалоб')}</span><Icon name="flag" size={11} className="inline" /></span>}
                      </div>
                    </td>
                    <td className="px-5 py-3">{actions(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {filtered.map(e => (
                <li key={e.id} className="p-4">
                  <div className="flex gap-3">
                    {e.coverUrl ? <img src={e.coverUrl} alt="" className="h-14 w-20 shrink-0 rounded-lg bg-line object-cover" /> : <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon name="camera" size={18} /></span>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{e.name}</p>
                      <p className="truncate text-xs text-muted">{[e.organizer.name, e.location].filter(Boolean).join(' · ')}</p>
                      <p className="mt-1 text-xs text-muted">{eventDate(e)} · {t.count(e.stats.photos, ['photo', 'photos'], ['фото', 'фото', 'фото'])}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge tone={TONE[e.status]} dot>{eventStatusLabel(t, e.status)}</Badge>
                    {e.reports > 0 && <span className="text-xs font-semibold text-danger">{t.count(e.reports, ['report', 'reports'], ['жалоба', 'жалобы', 'жалоб'])}</span>}
                    <div className="ml-auto">{actions(e)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <EventQrModal event={qrEvent} onClose={() => setQrEvent(null)} />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.type === 'delete' ? t('Delete event?', 'Удалить событие?') : t('Close event?', 'Завершить событие?')}
        confirmLabel={confirm?.type === 'delete' ? t('Delete event', 'Удалить') : t('Close event', 'Завершить')}
        tone={confirm?.type === 'delete' ? 'danger' : 'primary'}
        description={confirm?.type === 'delete'
          ? t(`“${confirm.event.name}” and all ${formatNumber(confirm.event.stats.photos)} photos will be permanently deleted.`,
            `«${confirm.event.name}» и все фото (${formatNumber(confirm.event.stats.photos)}) будут удалены навсегда.`)
          : t(`Guests will no longer be able to upload to “${confirm?.event.name}”. The wall stays viewable.`,
            `Гости больше не смогут загружать фото в «${confirm?.event.name}». Стена останется доступной для просмотра.`)}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.type === 'delete') run(() => adminApi.deleteEvent(confirm.event.id), t('Event deleted', 'Событие удалено'), 'danger');
          else setEventStatus(confirm.event, 'closed', t('Event closed', 'Событие завершено'));
        }} />
    </>
  );
}
