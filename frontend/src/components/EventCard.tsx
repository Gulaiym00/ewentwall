'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { EventStatus, OrganizerEvent } from '@/api/types';
import { EventQrModal } from '@/components/EventQr';
import { Icon } from '@/ui/icons';
import { Badge, type Tone } from '@/ui';
import { formatDate, formatNumber } from '@/utils/format';
import { useT } from '@/utils/locale';
import { eventTypeLabel } from '@/utils/labels';

const STATUS: Record<EventStatus, { label: string; ru: string; tone: Tone }> = {
  active: { label: 'Active', ru: 'Идёт', tone: 'success' },
  upcoming: { label: 'Upcoming', ru: 'Скоро', tone: 'warning' },
  closed: { label: 'Closed', ru: 'Завершено', tone: 'neutral' },
  flagged: { label: 'Under review', ru: 'На проверке', tone: 'danger' },
};

export default function EventCard({ event }: { event: OrganizerEvent }) {
  const t = useT();
  const s = STATUS[event.status];
  const { stats } = event;
  const [qrOpen, setQrOpen] = useState(false);
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface sm:flex-row">
      <div className="flex h-32 shrink-0 items-center justify-center bg-accent-soft text-accent sm:h-auto sm:w-[130px]">
        {event.coverUrl
          ? <img src={event.coverUrl} alt="" className="block h-full w-full object-cover" />
          : <Icon name="camera" size={28} />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-4 md:flex-row md:items-center md:px-5 md:py-[18px]">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h3 className="max-w-full truncate text-base font-bold tracking-tight">{event.name}</h3>
            <Badge tone={s.tone}>{t(s.label, s.ru)}</Badge>
            {stats.pendingPhotos > 0 && <Badge tone="accent">{t(`${stats.pendingPhotos} to approve`, `${stats.pendingPhotos} на проверку`)}</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
            {event.startsAt && <span className="flex items-center gap-1.5"><Icon name="calendar" size={14} /> {formatDate(event.startsAt.slice(0, 10))}</span>}
            {event.location && <span className="flex items-center gap-1.5"><Icon name="mapPin" size={14} /> {event.location}</span>}
            {!event.startsAt && !event.location && <span>{eventTypeLabel(t, event.type)}</span>}
          </div>
          {event.status !== 'upcoming' && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold tabular-nums">
              <span className="flex items-center gap-1.5" title={t('Photos', 'Фото')}><Icon name="camera" size={15} /> {formatNumber(stats.photos)}</span>
              <span className="flex items-center gap-1.5" title={t('Guests', 'Гости')}><Icon name="user" size={15} /> {stats.guests}</span>
              <span className="flex items-center gap-1.5" title={t('Reactions', 'Реакции')}><Icon name="heart" size={15} /> {formatNumber(stats.reactions)}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setQrOpen(true)} aria-label={t(`QR code of ${event.name}`, `QR-код: ${event.name}`)} title={t('QR code', 'QR-код')}
            className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-line text-muted hover:bg-bg hover:text-fg">
            <Icon name="qr" size={16} />
          </button>
          <Link href={`/dashboard/events/${event.id}`} aria-label={t(`Settings of ${event.name}`, `Настройки: ${event.name}`)} title={t('Event settings', 'Настройки события')}
            className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-line text-muted hover:bg-bg hover:text-fg">
            <Icon name="settings" size={16} />
          </Link>
          <Link href={`/e/${event.slug}/wall`} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-line px-3.5 text-[13px] font-semibold hover:bg-bg md:flex-none">
            <Icon name="grid" size={15} /> {t('Wall', 'Стена')}
          </Link>
          <Link href={`/e/${event.slug}`} className="btn-press flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13px] font-semibold text-white md:flex-none">
            <Icon name="arrowRight" size={15} /> {t('Open', 'Открыть')}
          </Link>
        </div>
      </div>
      {qrOpen && <EventQrModal event={event} onClose={() => setQrOpen(false)} />}
    </article>
  );
}
