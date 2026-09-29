'use client';

import Link from 'next/link';
import { guestApi } from '@/api/guest';
import type { OrganizerEvent } from '@/api/types';
import EventCard from '@/components/EventCard';
import { useApi } from '@/hooks/useApi';
import { useOrganizer } from '@/hooks/useOrganizer';
import { Icon, type IconName } from '@/ui/icons';
import { LoadError, PageLoader } from '@/ui/loader';
import { formatNumber } from '@/utils/format';
import { useT, type Translate } from '@/utils/locale';
import ReviewCard from '@/widgets/review-card';

const sum = (events: OrganizerEvent[], key: 'photos' | 'guests' | 'reactions') => events.reduce((s, e) => s + e.stats[key], 0);

const stats = (t: Translate, events: OrganizerEvent[]): { label: string; value: number; icon: IconName; color: string }[] => [
  { label: t('Events', 'События'), value: events.length, icon: 'calendar', color: '#E11D48' },
  { label: t('Photos', 'Фото'), value: sum(events, 'photos'), icon: 'camera', color: '#8B5CF6' },
  { label: t('Guests', 'Гости'), value: sum(events, 'guests'), icon: 'user', color: '#0EA5E9' },
  { label: t('Reactions', 'Реакции'), value: sum(events, 'reactions'), icon: 'heart', color: '#F59E0B' },
];

const greeting = (t: Translate) => {
  const h = new Date().getHours();
  return h < 5 ? t('Good night', 'Доброй ночи') : h < 12 ? t('Good morning', 'Доброе утро') : h < 18 ? t('Good afternoon', 'Добрый день') : t('Good evening', 'Добрый вечер');
};

export default function Dashboard() {
  const t = useT();
  const { profile, events, eventsLoading, eventsError, reloadEvents } = useOrganizer();
  const firstName = profile?.name.split(' ')[0] ?? '';

  // Most-loved photo of the live (or most recent) event with photos
  const spotlight = events.find(e => e.status === 'active' && e.stats.photos > 0) ?? events.find(e => e.stats.photos > 0);
  const topPhoto = useApi(
    () => (spotlight ? guestApi.photos(spotlight.slug, { sort: 'popular', limit: 1 }).then(p => p.items[0] ?? null) : Promise.resolve(null)),
    [spotlight?.slug],
  );
  const needsApproval = events.filter(e => e.stats.pendingPhotos > 0);

  if (eventsLoading) return <PageLoader label={t('Loading your events…', 'Загружаем события…')} />;
  if (eventsError) return <LoadError message={eventsError.message} onRetry={reloadEvents} />;

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="mb-1 text-[clamp(24px,3vw,32px)] font-bold tracking-tight">
          {greeting(t)}, <span className="font-serif text-accent italic">{firstName}</span> ✨
        </h1>
        <p className="text-[clamp(14px,2vw,15px)] text-muted">
          {events.length
            ? t('Here is how your events are doing.', 'Вот как идут ваши события.')
            : t('Create your first event and share the QR code with your guests.', 'Создайте первое событие и поделитесь QR-кодом с гостями.')}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:mb-10 md:gap-4 lg:grid-cols-4">
        {stats(t, events).map(stat => (
          <div key={stat.label} className="min-w-0 rounded-2xl border border-line bg-surface p-4 md:p-[22px]">
            <div className="mb-3 flex size-9 items-center justify-center rounded-[10px] md:mb-4" style={{ background: `${stat.color}18`, color: stat.color }}>
              <Icon name={stat.icon} size={18} />
            </div>
            <p className="mb-0.5 text-[clamp(22px,3vw,28px)] font-bold tracking-tight tabular-nums">{formatNumber(stat.value)}</p>
            <p className="text-[13px] font-medium text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 md:mb-5">
        <h2 className="text-xl font-bold tracking-tight">{t('My Events', 'Мои события')}</h2>
        <div className="flex items-center gap-3">
          {events.length > 0 && <Link href="/dashboard/events" className="hidden text-[13px] font-semibold text-accent hover:underline sm:inline">{t('View all', 'Все события')}</Link>}
          <Link href="/dashboard/create" className="btn-press flex h-9 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[13px] font-semibold whitespace-nowrap text-white">
            <Icon name="plus" size={16} /> {t('New event', 'Новое событие')}
          </Link>
        </div>
      </div>

      {events.length === 0 ? (
        <Link href="/dashboard/create"
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line px-6 py-14 text-center hover:border-accent">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Icon name="plus" size={22} /></span>
          <span className="font-semibold">{t('Create your first event', 'Создайте первое событие')}</span>
          <span className="max-w-xs text-sm text-muted">{t('Set a name and date, choose guest settings, and get a QR code — it takes about two minutes.', 'Укажите название и дату, настройте правила для гостей и получите QR-код — это займёт пару минут.')}</span>
        </Link>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {events.slice(0, 3).map(event => <EventCard key={event.id} event={event} />)}
          </div>
          {events.length > 3 && (
            <Link href="/dashboard/events" className="mt-3 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm font-semibold text-muted hover:text-fg">
              {t(`Show all ${events.length} events`, `Показать все события (${events.length})`)} <Icon name="arrowRight" size={15} />
            </Link>
          )}
        </>
      )}

      {events.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-3 md:mt-10 md:grid-cols-2 md:gap-4">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface p-5">
            <p className="mb-4 text-[13px] font-bold tracking-wider text-muted uppercase">{t('Most loved photo', 'Самое любимое фото')}</p>
            {topPhoto.data ? (
              <>
                <Link href={`/e/${spotlight!.slug}/wall`}>
                  <img src={topPhoto.data.url} alt={topPhoto.data.caption ?? ''} className="mb-3 block h-40 w-full rounded-xl bg-line object-cover" />
                </Link>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold">{topPhoto.data.caption ?? `${t('by', 'от')} ${topPhoto.data.author}`}</span>
                  <span className="shrink-0 text-sm font-bold text-accent">❤️ {topPhoto.data.totalReactions}</span>
                </div>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted">{topPhoto.loading ? t('Loading…', 'Загрузка…') : t('Photos will appear here once guests start uploading.', 'Фото появятся здесь, когда гости начнут их загружать.')}</p>
            )}
          </div>

          <div className="min-w-0 rounded-2xl border border-line bg-surface p-5">
            <p className="mb-4 text-[13px] font-bold tracking-wider text-muted uppercase">{t('Needs your attention', 'Требует внимания')}</p>
            {needsApproval.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">{t('All caught up — no photos waiting for approval.', 'Всё проверено — нет фото, ожидающих одобрения.')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {needsApproval.map(e => (
                  <li key={e.id} className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent"><Icon name="camera" size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.name}</p>
                      <p className="text-xs text-muted">{t(`${e.stats.pendingPhotos} photo${e.stats.pendingPhotos > 1 ? 's' : ''} waiting for approval`, `Ждут одобрения: ${t.count(e.stats.pendingPhotos, ['photo', 'photos'], ['фото', 'фото', 'фото'])}`)}</p>
                    </div>
                    <Link href={`/dashboard/events/${e.id}`} className="shrink-0 text-[13px] font-semibold text-accent hover:underline">{t('Review', 'Проверить')}</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {events.length > 0 && <ReviewCard events={events} />}
    </>
  );
}
